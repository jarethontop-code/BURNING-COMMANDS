'use strict';

const {
  EmbedBuilder,
  PermissionFlagsBits: P,
  REST,
  Routes
} = require('discord.js');

const nukeCommand = {
  name: 'nuke',
  description: 'Recrea este canal. Con confirmar:true ejecuta; false cancela.',
  default_member_permissions: P.ManageChannels.toString(),
  options: [{
    type: 5,
    name: 'confirmar',
    description: 'true para ejecutar inmediatamente; false para cancelar',
    required: true
  }]
};
const embed = (title, description, color = 0x5865F2) =>
  new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();

async function handleNuke(interaction) {
  if (!interaction.isChatInputCommand?.() || interaction.commandName !== 'nuke') return false;
  const confirmed = interaction.options.getBoolean('confirmar', true);
  if (!confirmed) {
    await interaction.reply({ embeds: [embed('Nuke cancelado', 'No se realizó ningún cambio en el canal.')], ephemeral: true });
    return true;
  }
  if (!interaction.memberPermissions?.has(P.ManageChannels)) {
    await interaction.reply({ embeds: [embed('Sin permiso', 'Necesitas Gestionar canales para usar este comando.', 0xE74C3C)], ephemeral: true });
    return true;
  }
  const guild = interaction.guild;
  const channel = interaction.channel;
  if (!guild || !channel || !guild.members.me?.permissions.has(P.ManageChannels)) {
    await interaction.reply({ embeds: [embed('Falta permiso', 'El bot necesita Gestionar canales.', 0xE74C3C)], ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const position = channel.rawPosition;
    const replacement = await channel.clone({ reason: `Canal recreado por ${interaction.user.tag}` });
    await replacement.setPosition(position).catch(() => {});
    await channel.delete(`Nuke confirmado por ${interaction.user.tag}`);
    await replacement.send({ embeds: [embed('Canal recreado', `Canal recreado por ${interaction.user.tag}. El historial anterior ya no está disponible.`, 0xE67E22)] });
    await interaction.editReply({ embeds: [embed('Nuke completado', 'Se recreó el canal y el historial anterior fue eliminado.', 0x2ECC71)] }).catch(() => {});
  } catch (error) {
    console.error('Error ejecutando /nuke:', error);
    await interaction.editReply({ embeds: [embed('Nuke fallido', 'No se pudo recrear el canal. Revisa los permisos del bot y vuelve a intentarlo.', 0xE74C3C)] }).catch(() => {});
  }
  return true;
}

async function register(client) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.DEV_GUILD_ID
    ? Routes.applicationGuildCommands(client.user.id, process.env.DEV_GUILD_ID)
    : Routes.applicationCommands(client.user.id);
  const registered = await rest.get(route);
  const commands = new Map(registered.map(command => [command.name, command]));
  commands.set('nuke', nukeCommand);
  await rest.put(route, { body: [...commands.values()] });
}

function install() {
  const { Client } = require('discord.js');
  const originalOn = Client.prototype.on;
  const originalOnce = Client.prototype.once;

  Client.prototype.on = function patchedOn(eventName, listener) {
    if (eventName === 'interactionCreate') {
      return originalOn.call(this, eventName, async interaction => {
        try {
          if (await handleNuke(interaction)) return;
        } catch (error) {
          console.error('Error procesando /nuke:', error);
          const response = { embeds: [embed('Error en /nuke', 'No se pudo procesar el comando. Inténtalo de nuevo.', 0xE74C3C)], ephemeral: true };
          if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
          else await interaction.reply(response).catch(() => {});
          return;
        }
        return listener.call(this, interaction);
      });
    }
    return originalOn.call(this, eventName, listener);
  };

  Client.prototype.once = function patchedOnce(eventName, listener) {
    if (eventName !== 'ready') return originalOnce.call(this, eventName, listener);
    return originalOnce.call(this, eventName, async (...args) => {
      await listener.apply(this, args);
      try {
        await register(this);
        console.log('Comando /nuke actualizado: true ejecuta; false cancela.');
      } catch (error) {
        console.error('No se pudo registrar la corrección de /nuke:', error.message);
      }
    });
  };
}

module.exports = { install, handleNuke };
