'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder,
  PermissionFlagsBits: P, REST, Routes, TextInputBuilder, TextInputStyle,
  ChannelType, ThreadChannel
} = require('discord.js');

const STORE_PATH = path.resolve(process.env.SOCIAL_DATA_PATH || 'social-data.json');
const PREFIX = '.';
const COOLDOWN_MS = 12 * 60 * 60 * 1000;
const REACTION_PREFIX = 'p4social:';
const GOLD = 0xD4AF37;
const BLUE = 0x3498DB;
let data = { guilds: {}, reputations: {}, repCooldowns: {}, marriages: {}, bios: {}, tournaments: {}, welcomeDm: {} };
try {
  if (fs.existsSync(STORE_PATH)) data = { ...data, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) };
} catch (error) { console.error('No se pudo leer social-data.json:', error.message); }
function save() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, STORE_PATH);
}
const card = (title, description, color = BLUE) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
const key = (guildId, userId) => `${guildId}:${userId}`;
const commandDefs = [
  { name: 'marry', description: 'Propón matrimonio a otro miembro.', options: [{ type: 6, name: 'usuario', description: 'Persona a quien proponerle matrimonio', required: true }] },
  { name: 'divorce', description: 'Confirma la disolución de tu matrimonio.' },
  { name: 'profile', description: 'Muestra un perfil social.', options: [{ type: 6, name: 'usuario', description: 'Perfil que quieres consultar', required: false }] },
  { name: 'setbio', description: 'Edita la biografía de tu perfil mediante un formulario.' },
  { name: 'tournament', description: 'Crea un panel para inscribirse a un torneo.', options: [
    { type: 3, name: 'nombre', description: 'Nombre del evento', required: true, min_length: 1, max_length: 80 },
    { type: 4, name: 'cupos', description: 'Número máximo de participantes', required: true, min_value: 2, max_value: 100 }
  ] },
  { name: 'welcome-dm', description: 'Configura el mensaje privado de bienvenida mediante un formulario.' }
];
const socialActions = {
  boop: { initial: '{author} le tocó la puntita de la nariz a {target}', gif: 'poke', buttons: [
    { label: 'Hacer boop de vuelta', emoji: '👃', text: '{target} le hizo boop de vuelta a {author}', gif: 'poke' },
    { label: 'Arrugar la nariz', emoji: '😖', text: '{target} arrugó la nariz ante {author}', gif: 'pout' }
  ] },
  blush: { initial: '{author} se sonrojó muchísimo por culpa de {target}', gif: 'blush', buttons: [
    { label: 'Hacerlo sonrojar más', emoji: '😊', text: '{target} hizo sonrojar aún más a {author}', gif: 'blush' },
    { label: 'Taparse la cara', emoji: '🙈', text: '{target} se tapó la cara, avergonzado por {author}', gif: 'shy' }
  ] },
  kill: { initial: '{author} eliminó dramáticamente a {target} (¡de broma!)', gif: 'kill', buttons: [
    { label: 'Volver como fantasma', emoji: '👻', text: '{target} volvió como fantasma para asustar a {author}', gif: 'ghost' },
    { label: 'Revivir y vengarse', emoji: '⚔️', text: '{target} revivió y se vengó de {author}', gif: 'fight' }
  ] },
  dance: { initial: '{author} sacó a bailar a {target}', gif: 'dance', buttons: [
    { label: 'Bailar juntos', emoji: '💃', text: '{target} aceptó bailar junto a {author}', gif: 'dance' },
    { label: 'Quedarse sentado', emoji: '🪑', text: '{target} prefirió quedarse sentado mientras {author} bailaba', gif: 'shrug' }
  ] },
  cry: { initial: '{author} se puso a llorar en el hombro de {target}', gif: '哭', buttons: [
    { label: 'Darle un pañuelo', emoji: '🧻', text: '{target} le ofreció un pañuelo a {author}', gif: 'cry' },
    { label: 'Consolar con abrazo', emoji: '🫂', text: '{target} consoló a {author} con un abrazo', gif: 'hug' }
  ] },
  sleep: { initial: '{author} se quedó dormido encima de {target}', gif: 'sleep', buttons: [
    { label: 'Taparlo con una manta', emoji: '🛌', text: '{target} tapó a {author} con una manta', gif: 'sleep' },
    { label: 'Despertarlo de susto', emoji: '⏰', text: '{target} despertó de golpe a {author}', gif: 'surprised' }
  ] }
};

function coupleFor(guildId, userId) { return data.marriages[key(guildId, userId)] || null; }
function coupleText(guildId, userId) {
  const couple = coupleFor(guildId, userId);
  return couple ? `<@${couple.partnerId}> · desde <t:${Math.floor(couple.since / 1000)}:D>` : 'Sin pareja';
}
function badgesFor(guildId, userId, rep) {
  const badges = [];
  if (rep >= 1) badges.push('🤝 Buena persona');
  if (rep >= 10) badges.push('🌟 Ayudante');
  if (rep >= 50) badges.push('🏆 Leyenda');
  if (coupleFor(guildId, userId)) badges.push('💍 En pareja');
  return badges.length ? badges.join(' · ') : 'Aún no hay insignias';
}
function memberOption(interaction, name) { return interaction.options.getMember(name) || null; }
function controls(...buttons) { return [new ActionRowBuilder().addComponents(...buttons)]; }
function safeError(interaction, message) {
  const payload = { embeds: [card('No se pudo completar', message, 0xE74C3C)], ephemeral: true };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload).catch(() => {});
  return interaction.reply(payload).catch(() => {});
}
async function register(client) {
  if (!process.env.DISCORD_TOKEN) return;
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.DEV_GUILD_ID
    ? Routes.applicationGuildCommands(client.user.id, process.env.DEV_GUILD_ID)
    : Routes.applicationCommands(client.user.id);
  const current = await rest.get(route);
  const merged = new Map(current.map(item => [item.name, item]));
  for (const command of commandDefs) merged.set(command.name, command);
  await rest.put(route, { body: [...merged.values()] });
  console.log('Comandos sociales, torneos y welcome-DM registrados.');
}
async function socialReaction(message, name, target) {
  const config = socialActions[name];
  const authorName = message.member?.displayName || message.author.username;
  const targetName = target.displayName;
  const gif = await fetch(`https://nekos.best/api/v2/${encodeURIComponent(config.gif)}`, { signal: AbortSignal.timeout(5000) })
    .then(async response => response.ok ? (await response.json()).results?.[0]?.url : null).catch(() => null);
  const row = new ActionRowBuilder().addComponents(config.buttons.map((action, index) =>
    new ButtonBuilder().setCustomId(`${REACTION_PREFIX}${message.guildId || message.guild.id}:${message.author.id}:${target.id}:${name}:${index}`)
      .setLabel(action.label).setEmoji(action.emoji).setStyle(ButtonStyle.Secondary)));
  const embed = card('Reacción social', config.initial.replaceAll('{author}', authorName).replaceAll('{target}', targetName), 0xE74C3C);
  if (gif) embed.setImage(gif);
  await message.channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
}
async function handlePrefix(client, message) {
  if (!message.guild || message.author.bot || !message.content?.startsWith(PREFIX)) return false;
  const [rawName, ...args] = message.content.slice(1).trim().split(/\s+/).filter(Boolean);
  const name = (rawName || '').toLowerCase();
  const known = new Set(['lockall','unlockall','purgeembeds','threadlock','threadunlock','firstmessage','inrole','permissions','rep','say','jumbo','botinfo', ...Object.keys(socialActions)]);
  if (!known.has(name)) return false;
  const reply = (title, text, color = BLUE) => message.reply({ embeds: [card(title, text, color)], allowedMentions: { repliedUser: false } });
  const requirePermission = (permission) => {
    if (!message.member.permissions.has(permission)) throw new Error('No tienes permiso para esta acción.');
    if (!message.guild.members.me?.permissions.has(permission)) throw new Error('Al bot le falta el permiso necesario.');
  };
  try {
    if (Object.hasOwn(socialActions, name)) {
      const target = message.mentions.members.first();
      if (!target) throw new Error(`Uso: .${name} @usuario`);
      if (target.id === message.author.id || target.user.bot) throw new Error('Menciona a otra persona, no a ti mismo ni a un bot.');
      await socialReaction(message, name, target);
      return true;
    }
    if (name === 'lockall' || name === 'unlockall') {
      requirePermission(P.ManageChannels);
      const lock = name === 'lockall';
      let changed = 0;
      for (const channel of message.guild.channels.cache.values()) {
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) continue;
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: lock ? false : null }, { reason: `${name} por ${message.author.tag}` }).then(() => changed++).catch(() => {});
      }
      await reply(lock ? '🔒 Canales bloqueados' : '🔓 Canales desbloqueados', `Se actualizaron ${changed} canales públicos.`, 0x2ECC71);
      return true;
    }
    if (name === 'purgeembeds') {
      requirePermission(P.ManageMessages);
      const limit = Number(args[0]);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Uso: `.purgeembeds 1-100`.');
      const recent = await message.channel.messages.fetch({ limit: Math.min(100, limit + 1) });
      const candidates = [...recent.values()].filter(item => item.id !== message.id && (item.embeds.length || item.attachments.size || /https?:\/\/\S+/i.test(item.content)));
      const deleted = await message.channel.bulkDelete(candidates, true);
      await reply('🧹 Limpieza de embeds', `Se borraron ${deleted.size} mensajes con embeds, archivos o enlaces.`);
      return true;
    }
    if (name === 'threadlock' || name === 'threadunlock') {
      if (!message.channel.isThread?.()) throw new Error('Este comando solo funciona dentro de un hilo.');
      requirePermission(P.ManageThreads);
      await message.channel.setLocked(name === 'threadlock', `Acción de ${message.author.tag}`);
      await message.channel.setArchived(name === 'threadlock', `Acción de ${message.author.tag}`);
      await reply(name === 'threadlock' ? '🔒 Hilo cerrado' : '🔓 Hilo reabierto', name === 'threadlock' ? 'El hilo fue bloqueado y archivado.' : 'El hilo fue desbloqueado y reabierto.', 0x2ECC71);
      return true;
    }
    if (name === 'firstmessage') {
      let oldest = null;
      let before;
      while (true) {
        const page = await message.channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        if (!page.size) break;
        oldest = page.last();
        if (page.size < 100) break;
        before = oldest.id;
      }
      if (!oldest) throw new Error('No pude encontrar mensajes en este canal.');
      await reply('📌 Primer mensaje del canal', `[Abrir el primer mensaje](${oldest.url})\nEnviado por ${oldest.author}.`);
      return true;
    }
    if (name === 'inrole') {
      const role = message.mentions.roles.first();
      if (!role) throw new Error('Uso: `.inrole @rol`.');
      await message.guild.members.fetch();
      const members = role.members.map(member => member.user.tag).sort((a,b) => a.localeCompare(b));
      const text = members.length ? members.slice(0, 80).map(tag => `• ${tag}`).join('\n') : 'No hay miembros con ese rol.';
      await reply(`Miembros con ${role.name}`, `${text}${members.length > 80 ? `\n… y ${members.length - 80} más.` : ''}`);
      return true;
    }
    if (name === 'permissions') {
      const member = message.mentions.members.first() || message.member;
      const permissions = message.channel.permissionsFor(member);
      const notable = [
        ['Administrator','Administrador'],['ManageGuild','Gestionar servidor'],['ManageChannels','Gestionar canales'],['ManageMessages','Gestionar mensajes'],
        ['ManageRoles','Gestionar roles'],['KickMembers','Expulsar miembros'],['BanMembers','Banear miembros'],['ModerateMembers','Aplicar timeout'],['ManageThreads','Gestionar hilos']
      ];
      const text = notable.map(([key,label]) => `${permissions?.has(P[key]) ? '✅' : '❌'} ${label}`).join('\n');
      await reply(`Permisos de ${member.user.tag}`, text);
      return true;
    }
    if (name === 'rep') {
      const target = message.mentions.members.first();
      if (!target || target.id === message.author.id || target.user.bot) throw new Error('Menciona a otra persona (no bots ni a ti mismo).');
      const cooldownKey = key(message.guild.id, message.author.id);
      const previous = data.repCooldowns[cooldownKey] || 0;
      const remaining = previous + COOLDOWN_MS - Date.now();
      if (remaining > 0) throw new Error(`Podrás dar reputación de nuevo <t:${Math.ceil((previous + COOLDOWN_MS) / 1000)}:R>.`);
      const targetKey = key(message.guild.id, target.id);
      data.reputations[targetKey] = (data.reputations[targetKey] || 0) + 1;
      data.repCooldowns[cooldownKey] = Date.now();
      save();
      await reply('🌟 Reputación otorgada', `${message.author} dio +1 punto de reputación a ${target}. Total: **${data.reputations[targetKey]}**.`, 0x2ECC71);
      return true;
    }
    if (name === 'say') {
      requirePermission(P.ManageMessages);
      const text = message.content.slice(message.content.indexOf(' ') + 1).trim();
      if (!text || text.length > 2000) throw new Error('Escribe el texto (máximo 2000 caracteres).');
      await message.delete();
      await message.channel.send({ content: text, allowedMentions: { parse: [] } });
      return true;
    }
    if (name === 'jumbo') {
      const emoji = args[0];
      if (!emoji) throw new Error('Uso: `.jumbo <emoji>`.');
      const custom = emoji.match(/^<(a?):([\w~]+):(\d{17,20})>$/);
      let url;
      if (custom) url = `https://cdn.discordapp.com/emojis/${custom[3]}.${custom[1] ? 'gif' : 'png'}?size=1024&quality=lossless`;
      else {
        const codepoints = [...emoji].map(char => char.codePointAt(0).toString(16)).join('-');
        if (!/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]+$/u.test(emoji)) throw new Error('Ese texto no parece un emoji válido.');
        url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${codepoints}.png`;
      }
      await message.reply({ embeds: [new EmbedBuilder().setColor(BLUE).setTitle('Emoji ampliado').setImage(url)], allowedMentions: { repliedUser: false } });
      return true;
    }
    if (name === 'botinfo') {
      const uptime = Math.floor(client.uptime / 1000);
      const days = Math.floor(uptime / 86400), hours = Math.floor((uptime % 86400) / 3600), minutes = Math.floor((uptime % 3600) / 60), seconds = uptime % 60;
      const memory = process.memoryUsage();
      await message.reply({ embeds: [card('🤖 Estadísticas del bot', `**Uptime:** ${days}d ${hours}h ${minutes}m ${seconds}s\n**RAM RSS:** ${(memory.rss / 1024 / 1024).toFixed(1)} MB\n**Heap usado:** ${(memory.heapUsed / 1024 / 1024).toFixed(1)} MB\n**Servidores:** ${client.guilds.cache.size}\n**Node.js:** ${process.version}\n**discord.js:** ${require('discord.js').version}`)], allowedMentions: { repliedUser: false } });
      return true;
    }
  } catch (error) {
    console.error(`.${name}:`, error);
    await reply('No se pudo ejecutar el comando', error.message || 'Error inesperado.', 0xE74C3C).catch(() => {});
  }
  return true;
}

async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand?.() || !commandDefs.some(command => command.name === interaction.commandName)) return false;
  try {
    const { guild, user } = interaction;
    const name = interaction.commandName;
    if (name === 'marry') {
      const target = memberOption(interaction, 'usuario');
      if (!target || target.id === user.id || target.user.bot) throw new Error('Elige a otro miembro humano del servidor.');
      if (coupleFor(guild.id, user.id) || coupleFor(guild.id, target.id)) throw new Error('Uno de los dos ya está casado.');
      const row = controls(
        new ButtonBuilder().setCustomId(`p4:m:a:${guild.id}:${user.id}:${target.id}`).setLabel('Aceptar propuesta').setEmoji('💍').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`p4:m:r:${guild.id}:${user.id}:${target.id}`).setLabel('Rechazar').setEmoji('💔').setStyle(ButtonStyle.Danger)
      );
      await interaction.reply({ embeds: [card('💍 Propuesta de matrimonio', `${user} le propone matrimonio a ${target}. ¿Aceptas?`, GOLD)], components: row, allowedMentions: { users: [target.id] } });
      return true;
    }
    if (name === 'divorce') {
      if (!coupleFor(guild.id, user.id)) throw new Error('No tienes un matrimonio registrado que disolver.');
      await interaction.reply({ embeds: [card('💔 Confirmar divorcio', '¿Seguro que quieres disolver tu matrimonio?', GOLD)], components: controls(
        new ButtonBuilder().setCustomId(`p4:d:y:${guild.id}:${user.id}`).setLabel('Confirmar divorcio').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`p4:d:n:${guild.id}:${user.id}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
      ), ephemeral: true });
      return true;
    }
    if (name === 'profile') {
      const target = interaction.options.getUser('usuario') || user;
      const profileKey = key(guild.id, target.id);
      const rep = data.reputations[profileKey] || 0;
      const member = await guild.members.fetch(target.id).catch(() => null);
      const bio = data.bios[profileKey] || 'Sin biografía. Usa `/setbio` para añadir una.';
      const embed = new EmbedBuilder().setColor(GOLD).setTitle(`Perfil de ${target.globalName || target.username}`)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: 'Pareja', value: coupleText(guild.id, target.id), inline: true },
          { name: 'Reputación', value: `⭐ ${rep}`, inline: true },
          { name: 'Insignias', value: badgesFor(guild.id, target.id, rep), inline: false },
          { name: 'Cumpleaños', value: 'No configurado', inline: true },
          { name: 'Biografía', value: bio, inline: false }
        );
      if (member) embed.setFooter({ text: `Miembro desde ${new Date(member.joinedTimestamp).toLocaleDateString('es')}` });
      await interaction.reply({ embeds: [embed], ephemeral: false });
      return true;
    }
    if (name === 'setbio') {
      const modal = new ModalBuilder().setCustomId(`p4:bio:${guild.id}:${user.id}`).setTitle('Editar biografía');
      const input = new TextInputBuilder().setCustomId('bio').setLabel('Tu biografía').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500).setPlaceholder('Cuéntale algo al servidor…');
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return true;
    }
    if (name === 'tournament') {
      const title = interaction.options.getString('nombre', true);
      const capacity = interaction.options.getInteger('cupos', true);
      const row = controls(new ButtonBuilder().setCustomId('p4:t:signup:pending').setLabel('Inscribirse').setEmoji('⚔️').setStyle(ButtonStyle.Primary));
      const embed = card(`⚔️ ${title}`, `Cupos: **0/${capacity}**\nPulsa el botón para participar.`, GOLD);
      await interaction.reply({ embeds: [embed], components: row, fetchReply: true });
      const panel = await interaction.fetchReply();
      data.tournaments[panel.id] = { guildId: guild.id, channelId: interaction.channelId, name: title, capacity, participants: [] };
      save();
      await panel.edit({ components: controls(new ButtonBuilder().setCustomId(`p4:t:${guild.id}:${panel.id}`).setLabel('Inscribirse').setEmoji('⚔️').setStyle(ButtonStyle.Primary)) });
      return true;
    }
    if (name === 'welcome-dm') {
      if (!interaction.memberPermissions?.has(P.ManageGuild)) throw new Error('Necesitas Gestionar servidor para configurar la bienvenida privada.');
      const modal = new ModalBuilder().setCustomId(`p4:wdm:${guild.id}:${user.id}`).setTitle('Configurar bienvenida por DM');
      const messageInput = new TextInputBuilder().setCustomId('message').setLabel('Mensaje de bienvenida').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder('Usa {user} y {server} si quieres.');
      const rulesInput = new TextInputBuilder().setCustomId('rules').setLabel('Reglas básicas (opcional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000);
      const channelsInput = new TextInputBuilder().setCustomId('channels').setLabel('IDs canales reglas,general (opcional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(80).setPlaceholder('IDs separados por coma');
      modal.addComponents(new ActionRowBuilder().addComponents(messageInput), new ActionRowBuilder().addComponents(rulesInput), new ActionRowBuilder().addComponents(channelsInput));
      await interaction.showModal(modal);
      return true;
    }
  } catch (error) { await safeError(interaction, error.message || 'Error inesperado.'); return true; }
  return false;
}
async function handleComponent(interaction) {
  const id = interaction.customId || '';
  if (id.startsWith(REACTION_PREFIX)) {
    const [, , guildId, authorId, targetId, actionName, indexText] = id.split(':');
    if (interaction.guildId !== guildId || interaction.user.id !== targetId) {
      await interaction.reply({ content: `Estos botones son solo para <@${targetId}>.`, ephemeral: true });
      return true;
    }
    const config = socialActions[actionName];
    const action = config?.buttons[Number(indexText)];
    if (!action) { await interaction.reply({ content: 'Esta reacción ya no está disponible.', ephemeral: true }); return true; }
    await interaction.update({ components: interaction.message.components.map(row => ({ type: 1, components: row.components.map(button => ({ ...button.toJSON(), disabled: true })) })) }).catch(() => {});
    const author = await interaction.guild.members.fetch(authorId).catch(() => null);
    const target = interaction.member;
    const gif = await fetch(`https://nekos.best/api/v2/${encodeURIComponent(action.gif)}`, { signal: AbortSignal.timeout(5000) }).then(async r => r.ok ? (await r.json()).results?.[0]?.url : null).catch(() => null);
    const response = card(action.text.replaceAll('{author}', author?.displayName || 'La persona').replaceAll('{target}', target?.displayName || interaction.user.username), null, 0x9B59B6);
    if (gif) response.setImage(gif);
    await interaction.channel.send({ embeds: [response], allowedMentions: { parse: [] } }).catch(() => {});
    return true;
  }
  if (id.startsWith('p4:m:')) {
    const [, , choice, guildId, proposerId, targetId] = id.split(':');
    if (interaction.guildId !== guildId) return false;
    if (interaction.user.id !== targetId) { await interaction.reply({ content: 'Solo la persona destinataria puede responder.', ephemeral: true }); return true; }
    if (choice === 'r') {
      await interaction.update({ embeds: [card('Propuesta rechazada', 'La propuesta de matrimonio fue rechazada.', 0xE74C3C)], components: [] });
      return true;
    }
    if (coupleFor(guildId, proposerId) || coupleFor(guildId, targetId)) {
      await interaction.update({ embeds: [card('Propuesta caducada', 'Uno de los usuarios ya está casado.', 0xE74C3C)], components: [] });
      return true;
    }
    const now = Date.now();
    data.marriages[key(guildId, proposerId)] = { partnerId: targetId, since: now };
    data.marriages[key(guildId, targetId)] = { partnerId: proposerId, since: now };
    save();
    await interaction.update({ embeds: [card('💍 ¡Aceptaron la propuesta!', `<@${proposerId}> y <@${targetId}> ahora están casados. Aniversario: <t:${Math.floor(now / 1000)}:D>`, GOLD)], components: [] });
    return true;
  }
  if (id.startsWith('p4:d:')) {
    const [, , choice, guildId, userId] = id.split(':');
    if (interaction.user.id !== userId) { await interaction.reply({ content: 'Solo quien inició el divorcio puede confirmarlo.', ephemeral: true }); return true; }
    if (choice === 'n') {
      await interaction.update({ embeds: [card('Divorcio cancelado', 'El matrimonio permanece registrado.', GOLD)], components: [] });
      return true;
    }
    const marriage = coupleFor(guildId, userId);
    if (!marriage) { await interaction.update({ embeds: [card('Sin matrimonio', 'No hay un matrimonio que disolver.', 0xE74C3C)], components: [] }); return true; }
    delete data.marriages[key(guildId, userId)];
    delete data.marriages[key(guildId, marriage.partnerId)];
    save();
    await interaction.update({ embeds: [card('💔 Matrimonio disuelto', 'Se eliminó el registro de la pareja.', GOLD)], components: [] });
    return true;
  }
  if (id.startsWith('p4:t:')) {
    const [, , guildId, messageId] = id.split(':');
    const tournament = data.tournaments[messageId];
    if (!tournament || tournament.guildId !== guildId || interaction.guildId !== guildId) {
      await interaction.reply({ content: 'La inscripción a este evento ya no está disponible.', ephemeral: true }); return true;
    }
    if (tournament.participants.includes(interaction.user.id)) {
      await interaction.reply({ content: 'Ya estás inscrito.', ephemeral: true }); return true;
    }
    if (tournament.participants.length >= tournament.capacity) {
      await interaction.reply({ content: 'El torneo ya está completo.', ephemeral: true }); return true;
    }
    tournament.participants.push(interaction.user.id);
    save();
    const names = tournament.participants.map(userId => `<@${userId}>`).join(', ');
    const full = tournament.participants.length >= tournament.capacity;
    await interaction.update({ embeds: [card(`⚔️ ${tournament.name}`, `Cupos: **${tournament.participants.length}/${tournament.capacity}**\n${names || 'Sin participantes todavía.'}`, GOLD)], components: controls(new ButtonBuilder().setCustomId(id).setLabel(full ? 'Cupos completos' : 'Inscribirse').setEmoji('⚔️').setStyle(ButtonStyle.Primary).setDisabled(full)) });
    return true;
  }
  if (id.startsWith('p4:bio:') && interaction.isModalSubmit()) {
    const [, , guildId, userId] = id.split(':');
    if (interaction.guildId !== guildId || interaction.user.id !== userId) { await safeError(interaction, 'Este formulario pertenece a otra persona o servidor.'); return true; }
    const bio = interaction.fields.getTextInputValue('bio').trim();
    data.bios[key(guildId, userId)] = bio;
    save();
    await interaction.reply({ embeds: [card('Biografía guardada', bio || 'Se eliminó tu biografía.')], ephemeral: true });
    return true;
  }
  if (id.startsWith('p4:wdm:') && interaction.isModalSubmit()) {
    const [, , guildId, userId] = id.split(':');
    if (interaction.guildId !== guildId || interaction.user.id !== userId || !interaction.memberPermissions?.has(P.ManageGuild)) { await safeError(interaction, 'No puedes modificar esta configuración.'); return true; }
    const message = interaction.fields.getTextInputValue('message').trim();
    const rules = interaction.fields.getTextInputValue('rules').trim();
    const channels = interaction.fields.getTextInputValue('channels').split(',').map(value => value.trim()).filter(value => /^\d{17,20}$/.test(value)).slice(0, 2);
    data.welcomeDm[guildId] = { message, rules, channelIds: channels };
    save();
    await interaction.reply({ embeds: [card('Bienvenida privada configurada', 'El mensaje se enviará por DM a los próximos miembros que entren.')], ephemeral: true });
    return true;
  }
  return false;
}
async function onMemberJoin(member) {
  const welcome = data.welcomeDm[member.guild.id];
  if (!welcome) return;
  const text = welcome.message.replaceAll('{user}', member.user.username).replaceAll('{server}', member.guild.name);
  const embed = card(`Bienvenido/a a ${member.guild.name}`, `${text}${welcome.rules ? `\n\n**Reglas básicas**\n${welcome.rules}` : ''}`);
  const rowButtons = welcome.channelIds.map((channelId, index) => new ButtonBuilder().setLabel(index === 0 ? 'Reglas' : 'Canal general').setStyle(ButtonStyle.Link).setURL(`https://discord.com/channels/${member.guild.id}/${channelId}`));
  await member.send({ embeds: [embed], ...(rowButtons.length ? { components: controls(...rowButtons) } : {}) }).catch(error => console.warn(`No se pudo enviar bienvenida DM a ${member.id}:`, error.message));
}
function install() {
  const { Client } = require('discord.js');
  const originalOn = Client.prototype.on;
  const originalOnce = Client.prototype.once;
  Client.prototype.on = function patchedOn(eventName, listener) {
    if (eventName === 'messageCreate') {
      return originalOn.call(this, eventName, async message => {
        try { if (await handlePrefix(this, message)) return; }
        catch (error) { console.error('Error paquete social punto:', error); }
        return listener.call(this, message);
      });
    }
    if (eventName === 'interactionCreate') {
      return originalOn.call(this, eventName, async interaction => {
        try {
          if (await handleCommand(interaction)) return;
          if (await handleComponent(interaction)) return;
        } catch (error) { console.error('Error paquete social slash:', error); await safeError(interaction, error.message || 'Error inesperado.'); return; }
        return listener.call(this, interaction);
      });
    }
    if (eventName === 'guildMemberAdd') {
      return originalOn.call(this, eventName, async member => {
        await onMemberJoin(member).catch(error => console.error('Error welcome-DM:', error));
        return listener.call(this, member);
      });
    }
    return originalOn.call(this, eventName, listener);
  };
  Client.prototype.once = function patchedOnce(eventName, listener) {
    if (eventName !== 'ready') return originalOnce.call(this, eventName, listener);
    return originalOnce.call(this, eventName, async (...args) => {
      await listener.apply(this, args);
      try { await register(this); } catch (error) { console.error('No se pudieron registrar comandos paquete 4:', error.message); }
    });
  };
}
module.exports = { install, commandDefs };
