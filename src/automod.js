'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits: P,
  REST,
  Routes,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const DATA_FILE = path.resolve(process.env.AUTOMOD_DATA_PATH || 'automod.json');
const LINK_PATTERN = /(?:https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/)[^\s]*/gi;
const FILTERS = {
  caps: { label: 'Mayúsculas excesivas', description: 'Elimina mensajes con texto casi totalmente en mayúsculas.' },
  mentions: { label: 'Spam de menciones', description: 'Bloquea @everyone y mensajes con muchas menciones.' },
  links: { label: 'Enlaces externos', description: 'Elimina mensajes que contengan URLs o invitaciones.' },
  words: { label: 'Palabras prohibidas', description: 'Elimina mensajes que incluyan términos configurados.' }
};
let store = { guilds: {} };
try {
  if (fs.existsSync(DATA_FILE)) store = { ...store, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
} catch (error) {
  console.error('No se pudo leer automod.json:', error.message);
}
function save() {
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DATA_FILE);
}
function settings(guildId) {
  const current = store.guilds[guildId] ||= {};
  current.filters ||= { caps: false, mentions: false, links: false, words: false };
  current.bannedWords ||= [];
  return current;
}
function makeEmbed(guildId) {
  const config = settings(guildId);
  const status = Object.entries(FILTERS).map(([key, filter]) =>
    `${config.filters[key] ? '🟢' : '⚫'} **${filter.label}:** ${config.filters[key] ? 'activado' : 'desactivado'}`
  ).join('\n');
  const words = config.bannedWords.length ? config.bannedWords.map(word => `\`${word}\``).join(', ') : 'Ninguna configurada';
  return new EmbedBuilder().setColor(0x5865F2).setTitle('Panel de AutoMod')
    .setDescription(`${status}\n\n**Términos prohibidos:** ${words}\n\nPulsa un botón para activar o desactivar el filtro. Usa **Editar palabras** para añadir o quitar términos.`)
    .setFooter({ text: 'Los mensajes filtrados se eliminan automáticamente.' }).setTimestamp();
}
function panelComponents(guildId) {
  const config = settings(guildId);
  const row = new ActionRowBuilder();
  for (const [key, filter] of Object.entries(FILTERS)) {
    row.addComponents(new ButtonBuilder()
      .setCustomId(`automod:toggle:${guildId}:${key}`)
      .setLabel(filter.label)
      .setStyle(config.filters[key] ? ButtonStyle.Success : ButtonStyle.Secondary));
  }
  row.addComponents(new ButtonBuilder().setCustomId(`automod:words:${guildId}`).setLabel('Editar palabras').setEmoji('📝').setStyle(ButtonStyle.Primary));
  return [row];
}
const command = {
  name: 'automod',
  description: 'Abre el panel para configurar filtros automáticos.',
  default_member_permissions: P.ManageGuild.toString()
};

async function register(client) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.DEV_GUILD_ID
    ? Routes.applicationGuildCommands(client.user.id, process.env.DEV_GUILD_ID)
    : Routes.applicationCommands(client.user.id);
  const current = await rest.get(route);
  const merged = new Map(current.map(item => [item.name, item]));
  merged.set(command.name, command);
  await rest.put(route, { body: [...merged.values()] });
  console.log('Comando slash /automod registrado.');
}
function hasManageGuild(interaction) {
  return interaction.memberPermissions?.has(P.ManageGuild) || interaction.member?.permissions?.has(P.ManageGuild);
}
async function replyDenied(interaction) {
  await interaction.reply({ content: 'Necesitas el permiso Gestionar servidor para modificar AutoMod.', ephemeral: true }).catch(() => {});
}
async function handleInteraction(interaction) {
  if (interaction.isChatInputCommand() && interaction.commandName === 'automod') {
    if (!hasManageGuild(interaction)) return replyDenied(interaction);
    await interaction.reply({ embeds: [makeEmbed(interaction.guildId)], components: panelComponents(interaction.guildId), ephemeral: true });
    return true;
  }

  const customId = interaction.customId || '';
  if (!(interaction.isButton() || interaction.isModalSubmit()) || !customId.startsWith('automod:')) return false;
  const parts = customId.split(':');
  const guildId = parts[2];
  if (interaction.guildId !== guildId || !hasManageGuild(interaction)) {
    await replyDenied(interaction);
    return true;
  }

  if (interaction.isButton() && parts[1] === 'toggle') {
    const filterKey = parts[3];
    if (!Object.hasOwn(FILTERS, filterKey)) {
      await interaction.reply({ content: 'Ese filtro no existe.', ephemeral: true });
      return true;
    }
    const config = settings(guildId);
    config.filters[filterKey] = !config.filters[filterKey];
    save();
    await interaction.update({ embeds: [makeEmbed(guildId)], components: panelComponents(guildId) });
    return true;
  }

  if (interaction.isButton() && parts[1] === 'words') {
    const modal = new ModalBuilder().setCustomId(`automod:words-modal:${guildId}`).setTitle('Editar palabras prohibidas');
    const input = new TextInputBuilder().setCustomId('terms').setLabel('Palabras separadas por comas')
      .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000)
      .setPlaceholder('Añadir: insulto, spamword | Quitar: -spamword | Limpiar todo: *');
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isModalSubmit() && parts[1] === 'words-modal') {
    const config = settings(guildId);
    const submitted = interaction.fields.getTextInputValue('terms').split(',').map(word => word.trim().toLocaleLowerCase()).filter(Boolean);
    for (const item of submitted) {
      if (item === '*') {
        config.bannedWords = [];
        continue;
      }
      if (item.startsWith('-')) {
        const remove = item.slice(1).trim();
        config.bannedWords = config.bannedWords.filter(word => word !== remove);
        continue;
      }
      if (item.length < 2 || item.length > 80) continue;
      if (!config.bannedWords.includes(item)) config.bannedWords.push(item);
    }
    config.bannedWords = config.bannedWords.slice(0, 100);
    save();
    const payload = { embeds: [makeEmbed(guildId)], components: panelComponents(guildId), ephemeral: true };
    if (interaction.message) await interaction.update(payload).catch(async () => interaction.reply(payload));
    else await interaction.reply({ content: 'Lista de palabras actualizada. Ejecuta `/automod` para ver el panel.', ephemeral: true });
    return true;
  }
  return false;
}

function allCaps(content) {
  const letters = content.match(/[a-záéíóúüñ]/gi) || [];
  const uppercase = content.match(/[A-ZÁÉÍÓÚÜÑ]/g) || [];
  return letters.length >= 10 && uppercase.length / letters.length >= 0.8;
}
function matchingWord(content, words) {
  const normalized = content.toLocaleLowerCase();
  return words.find(word => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu').test(normalized);
  });
}
async function checkMessage(message) {
  if (!message.guild || message.author.bot) return false;
  const config = settings(message.guild.id);
  const content = message.content || '';
  let reason = null;
  if (config.filters.mentions && (/@everyone|@here/i.test(content) || message.mentions.users.size >= 5 || message.mentions.roles.size >= 5)) reason = 'spam de menciones';
  else if (config.filters.links && LINK_PATTERN.test(content)) reason = 'enlaces externos';
  LINK_PATTERN.lastIndex = 0;
  if (!reason && config.filters.caps && allCaps(content)) reason = 'mayúsculas excesivas';
  if (!reason && config.filters.words) {
    const word = matchingWord(content, config.bannedWords);
    if (word) reason = `palabra prohibida: ${word}`;
  }
  if (!reason) return false;
  const permissions = message.guild.members.me?.permissionsIn(message.channel);
  if (permissions?.has(P.ManageMessages)) await message.delete().catch(() => {});
  if (permissions?.has(P.SendMessages)) {
    const warning = await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription(`${message.author}, mensaje eliminado por **${reason}**.`)], allowedMentions: { users: [message.author.id] } }).catch(() => null);
    if (warning) setTimeout(() => warning.delete().catch(() => {}), 6000);
  }
  return true;
}
function install() {
  const { Client } = require('discord.js');
  const originalOn = Client.prototype.on;
  const originalOnce = Client.prototype.once;
  Client.prototype.on = function patchedOn(eventName, listener) {
    if (eventName === 'interactionCreate') {
      return originalOn.call(this, eventName, async interaction => {
        try { if (await handleInteraction(interaction)) return; }
        catch (error) {
          console.error('Error en /automod:', error);
          const response = { embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('No se pudo procesar AutoMod. Inténtalo de nuevo.')], ephemeral: true };
          if (interaction.deferred || interaction.replied) await interaction.followUp(response).catch(() => {});
          else await interaction.reply(response).catch(() => {});
          return;
        }
        return listener.call(this, interaction);
      });
    }
    if (eventName === 'messageCreate') {
      return originalOn.call(this, eventName, async message => {
        if (await checkMessage(message).catch(error => { console.error('Error en AutoMod:', error); return false; })) return;
        return listener.call(this, message);
      });
    }
    return originalOn.call(this, eventName, listener);
  };
  Client.prototype.once = function patchedOnce(eventName, listener) {
    if (eventName !== 'ready') return originalOnce.call(this, eventName, listener);
    return originalOnce.call(this, eventName, async (...args) => {
      await listener.apply(this, args);
      try { await register(this); } catch (error) { console.error('No se pudo registrar /automod:', error.message); }
    });
  };
}

module.exports = { install, command };
