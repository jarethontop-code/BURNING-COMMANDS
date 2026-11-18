const {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const P = PermissionFlagsBits;
const REQUEST_PREFIX = 'burning:antibot:';
const REQUEST_TTL = 10 * 60 * 1000;

function isAllowed(hybrid, guildId, botId) {
  const list = hybrid.settings(guildId).allowedBots || [];
  return list.includes(botId);
}

function setAllowed(hybrid, guildId, botId, allowed) {
  const config = hybrid.settings(guildId);
  const current = new Set(config.allowedBots || []);
  if (allowed) current.add(botId);
  else current.delete(botId);
  config.allowedBots = [...current];
  hybrid.save();
}

function approvalLink(botId) {
  const params = new URLSearchParams({
    client_id: botId,
    scope: 'bot applications.commands',
    permissions: '0'
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function notifyOwner(member, executor, hybrid) {
  const { guild, user: botUser } = member;
  const owner = await guild.fetchOwner().catch(() => null);
  if (!owner) return;

  const requester = executor ? `${executor.tag} (<@${executor.id}>)` : 'No se pudo identificar al usuario en los registros de auditoría';
  const embed = new EmbedBuilder()
    .setColor(0xE67E22)
    .setTitle('Solicitud de acceso de bot')
    .setDescription(`**${requester}** intentó añadir un bot, pero por seguridad se retiró antes de que pudiera entrar.\n\n**Bot:** ${botUser.tag}\n**ID del bot:** \`${botUser.id}\`\n**Servidor:** ${guild.name}\n\n¿Autorizas que se vuelva a añadir este bot? La autorización solo se guardará para este ID de bot y este servidor.`)
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${REQUEST_PREFIX}allow:${guild.id}:${botUser.id}`)
      .setLabel('Acceder')
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${REQUEST_PREFIX}deny:${guild.id}:${botUser.id}`)
      .setLabel('Negar')
      .setEmoji('🔴')
      .setStyle(ButtonStyle.Danger)
  );
  await owner.send({ embeds: [embed], components: [row] });
}

async function onMemberAdd(member, client, hybrid) {
  if (!member.user.bot || !hybrid.settings(member.guild.id).antibot) return;
  if (isAllowed(hybrid, member.guild.id, member.id)) return;

  let executor = null;
  try {
    if (member.guild.members.me?.permissions.has(P.ViewAuditLog)) {
      const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 6 });
      const entry = logs.entries.find(item =>
        item.target?.id === member.id && Date.now() - item.createdTimestamp < REQUEST_TTL
      );
      if (entry?.executor) executor = entry.executor;
    }
  } catch (error) {
    console.warn('Antibot: no se pudo consultar el registro de auditoría:', error.message);
  }

  // Discord notifica el ingreso cuando el bot ya se unió. Retirarlo de inmediato
  // y pedir autorización al propietario evita que permanezca en el servidor.
  if (member.kickable) {
    await member.kick('Antibot: requiere autorización explícita del propietario del servidor.').catch(error => {
      console.error(`Antibot: no se pudo retirar a ${member.id}:`, error.message);
    });
  }

  try {
    await notifyOwner(member, executor, hybrid);
  } catch (error) {
    console.warn(`Antibot: no se pudo enviar DM al propietario de ${member.guild.id}:`, error.message);
  }
}

async function onInteraction(interaction, hybrid) {
  if (!interaction.isButton() || !interaction.customId.startsWith(REQUEST_PREFIX)) return false;
  const [, action, guildId, botId] = interaction.customId.split(':');
  if (!guildId || !botId || !['allow', 'deny'].includes(action)) return false;

  if (interaction.user.id !== interaction.guild?.ownerId && interaction.user.id !== (await interaction.client.guilds.fetch(guildId).catch(() => null))?.ownerId) {
    await interaction.reply({ content: 'Solo el propietario de ese servidor puede autorizar esta solicitud.', ephemeral: true });
    return true;
  }

  const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    await interaction.reply({ content: 'No se encontró el servidor de esta solicitud.', ephemeral: true });
    return true;
  }

  if (action === 'deny') {
    setAllowed(hybrid, guildId, botId, false);
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('Solicitud denegada').setDescription(`El bot \`${botId}\` no fue autorizado para **${guild.name}**.`)],
      components: []
    });
    return true;
  }

  setAllowed(hybrid, guildId, botId, true);
  const link = approvalLink(botId);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Añadir este bot autorizado').setStyle(ButtonStyle.Link).setURL(link)
  );
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle('Bot autorizado').setDescription(`Se autorizó únicamente el bot con ID \`${botId}\` para **${guild.name}**. Pulsa el botón para volver a invitarlo. El enlace apunta al ID de ese bot; no autoriza otros bots.`)],
    components: [row]
  });
  return true;
}

module.exports = { onMemberAdd, onInteraction };
