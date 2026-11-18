'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const {
  ActionRowBuilder,
  AttachmentBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits: P,
  REST,
  Routes,
  StringSelectMenuBuilder
} = require('discord.js');

const execFileAsync = promisify(execFile);
const DATA_PATH = path.resolve(process.env.DATA_PATH || 'data.json');
const MEDIA_DIR = path.resolve(process.env.WELCOME_MEDIA_DIR || 'welcome-media');
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const JOIN_WINDOW_MS = 10_000;
const NEW_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const defaults = { guilds: {}, warnings: {}, allowedBots: {} };
let data = defaults;
try {
  if (fs.existsSync(DATA_PATH)) data = { ...defaults, ...JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) };
} catch (error) {
  console.error('No se pudo leer data.json:', error.message);
}
function save() {
  const temp = `${DATA_PATH}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(temp, DATA_PATH);
}
function config(guildId) {
  data.guilds[guildId] ||= {};
  const guildConfig = data.guilds[guildId];
  guildConfig.antiRaid ||= { enabled: false, threshold: 5, locked: false, previousOverwrites: {} };
  return guildConfig;
}
const embed = (title, description, color = 0x5865F2) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
const setWelcomeCommand = {
  name: 'setwelcome',
  description: 'Configura el canal, texto y archivo de bienvenida.',
  default_member_permissions: P.ManageGuild.toString(),
  options: [
    { type: 7, name: 'canal', description: 'Canal de texto de bienvenida', required: true, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
    { type: 3, name: 'mensaje', description: 'Texto; variables disponibles: {user}, {server}', required: true, max_length: 1000 },
    { type: 11, name: 'archivo', description: 'Imagen o video MP4/MOV de hasta 10 segundos', required: false }
  ]
};
const commands = [
  setWelcomeCommand,
  { name: 'testwelcome', description: 'Previsualiza la bienvenida configurada.', default_member_permissions: P.ManageGuild.toString() },
  { name: 'anti-raid', description: 'Abre el panel interactivo de protección anti-raid.', default_member_permissions: P.ManageGuild.toString() },
  { name: 'verify', description: 'Publica un botón que asigna un rol de verificación.', default_member_permissions: P.ManageGuild.toString(), options: [
    { type: 7, name: 'canal', description: 'Canal donde publicar el botón', required: true, channel_types: [ChannelType.GuildText] },
    { type: 8, name: 'rol', description: 'Rol que se dará al verificar', required: true }
  ] }
];
const joinWindows = new Map();

function hasManageGuild(interaction) {
  return interaction.memberPermissions?.has(P.ManageGuild) || interaction.member?.permissions?.has(P.ManageGuild);
}
function requireManageGuild(interaction) {
  if (!hasManageGuild(interaction)) throw new Error('Necesitas el permiso Gestionar servidor.');
}
function requireBotPermission(guild, permission, label) {
  if (!guild.members.me?.permissions.has(permission)) throw new Error(`Al bot le falta el permiso: ${label}.`);
}
function isTextChannel(channel) {
  return channel && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type);
}
function renderWelcomeText(template, member) {
  return template.replaceAll('{user}', `<@${member.id}>`).replaceAll('{server}', member.guild.name);
}
async function postWelcome(channel, member, welcome, preview = false) {
  const description = renderWelcomeText(welcome.message, member);
  const card = embed(preview ? 'Vista previa de bienvenida' : `¡Bienvenido/a a ${member.guild.name}!`, description, 0x2ECC71);
  const payload = { embeds: [card], allowedMentions: { users: preview ? [] : [member.id] } };
  if (welcome.imageUrl) card.setImage(welcome.imageUrl);
  if (welcome.gifPath && fs.existsSync(welcome.gifPath)) {
    payload.files = [new AttachmentBuilder(welcome.gifPath, { name: 'welcome.gif' })];
    card.setImage('attachment://welcome.gif');
  }
  await channel.send(payload);
}
async function fetchAttachment(attachment) {
  if (!attachment || attachment.size > MAX_UPLOAD_BYTES) throw new Error('El archivo no puede superar 25 MB.');
  const response = await fetch(attachment.url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error('No se pudo descargar el archivo adjunto.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('El archivo descargado supera el límite de 25 MB.');
  return buffer;
}
async function prepareWelcomeMedia(guildId, attachment) {
  if (!attachment) return { imageUrl: null, gifPath: null };
  const filename = attachment.name.toLowerCase();
  const contentType = (attachment.contentType || '').toLowerCase();
  const isImage = contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(filename);
  const isVideo = /\.(mp4|mov)$/i.test(filename) || ['video/mp4', 'video/quicktime'].includes(contentType);
  if (isImage) return { imageUrl: attachment.url, gifPath: null };
  if (!isVideo) throw new Error('Formato no admitido. Sube una imagen o un archivo MP4/MOV.');

  const bytes = await fetchAttachment(attachment);
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'burning-welcome-'));
  const inputPath = path.join(tempDir, filename.replace(/[^\w.-]/g, '_'));
  const outputPath = path.join(MEDIA_DIR, `welcome-${guildId}.gif`);
  try {
    fs.writeFileSync(inputPath, bytes, { mode: 0o600 });
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    const duration = Number(stdout.trim());
    if (!Number.isFinite(duration) || duration <= 0 || duration > 10) throw new Error('El video debe durar como máximo 10 segundos.');
    await execFileAsync('ffmpeg', ['-y', '-i', inputPath, '-t', '10', '-vf', 'fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse', '-loop', '0', outputPath], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    return { imageUrl: null, gifPath: outputPath };
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('La conversión de video requiere ffmpeg y ffprobe instalados en el servidor.');
    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
function createAntiRaidPanel() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('burning:raid:enable').setLabel('Activar escudo').setEmoji('🛡️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('burning:raid:restore').setLabel('Restaurar servidor').setEmoji('🟢').setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('burning:raid:threshold').setPlaceholder('Selecciona el umbral de entradas en 10 segundos').addOptions(
        { label: '3 usuarios / 10 s', value: '3' },
        { label: '5 usuarios / 10 s', value: '5', default: true },
        { label: '7 usuarios / 10 s', value: '7' },
        { label: '10 usuarios / 10 s', value: '10' }
      )
    )
  ];
}
async function lockGuildTextChannels(guild) {
  requireBotPermission(guild, P.ManageChannels, 'Gestionar canales');
  const raid = config(guild.id).antiRaid;
  for (const channel of guild.channels.cache.values()) {
    if (!isTextChannel(channel)) continue;
    try {
      const overwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
      raid.previousOverwrites[channel.id] = overwrite ? {
        sendMessages: overwrite.allow.has(P.SendMessages) ? true : overwrite.deny.has(P.SendMessages) ? false : null,
        sendMessagesInThreads: overwrite.allow.has(P.SendMessagesInThreads) ? true : overwrite.deny.has(P.SendMessagesInThreads) ? false : null
      } : { sendMessages: null, sendMessagesInThreads: null };
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, SendMessagesInThreads: false }, { reason: 'Escudo anti-raid: bloqueo temporal' });
    } catch (error) { console.warn(`Anti-raid no pudo bloquear ${channel.id}:`, error.message); }
  }
  raid.locked = true;
  save();
}
async function restoreGuildChannels(guild) {
  const raid = config(guild.id).antiRaid;
  for (const [channelId, previous] of Object.entries(raid.previousOverwrites || {})) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !isTextChannel(channel)) continue;
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: previous.sendMessages,
      SendMessagesInThreads: previous.sendMessagesInThreads
    }, { reason: 'Escudo anti-raid: restauración manual del servidor' }).catch(error => console.warn(`No se pudo restaurar ${channelId}:`, error.message));
  }
  raid.previousOverwrites = {};
  raid.locked = false;
  raid.enabled = false;
  save();
}
async function handlePanelInteraction(interaction) {
  const customId = interaction.customId;
  if (!customId?.startsWith('burning:raid:')) return false;
  requireManageGuild(interaction);
  const raid = config(interaction.guildId).antiRaid;
  if (customId === 'burning:raid:threshold') {
    raid.threshold = Number(interaction.values[0]);
    save();
    await interaction.reply({ embeds: [embed('Umbral anti-raid actualizado', `El escudo se activará al detectar **${raid.threshold} entradas en 10 segundos**.`, 0x2ECC71)], ephemeral: true });
    return true;
  }
  if (customId === 'burning:raid:enable') {
    raid.enabled = true;
    save();
    await interaction.update({ embeds: [embed('🛡️ Escudo anti-raid activado', `Detección: **${raid.threshold} entradas en 10 segundos**. Las cuentas creadas hace menos de 7 días serán expulsadas al dispararse el escudo.`, 0xE67E22)], components: createAntiRaidPanel() });
    return true;
  }
  if (customId === 'burning:raid:restore') {
    await interaction.deferUpdate();
    await restoreGuildChannels(interaction.guild);
    await interaction.message.edit({ embeds: [embed('🟢 Servidor restaurado', 'Se restauraron los permisos previos de los canales y el escudo quedó desactivado.', 0x2ECC71)], components: createAntiRaidPanel() });
    return true;
  }
  return false;
}
async function onMemberJoin(member) {
  const raid = config(member.guild.id).antiRaid;
  if (!raid.enabled) return;
  const now = Date.now();
  const recent = (joinWindows.get(member.guild.id) || []).filter(timestamp => now - timestamp < JOIN_WINDOW_MS);
  recent.push(now);
  joinWindows.set(member.guild.id, recent);
  if (recent.length < raid.threshold || raid.locked) return;

  raid.enabled = false;
  save();
  await lockGuildTextChannels(member.guild);
  const botMember = member.guild.members.me;
  if (botMember?.permissions.has(P.KickMembers)) {
    for (const newcomer of member.guild.members.cache.values()) {
      if (Date.now() - newcomer.user.createdTimestamp < NEW_ACCOUNT_AGE_MS && newcomer.kickable) {
        await newcomer.kick('Anti-raid: cuenta creada hace menos de 7 días durante una entrada masiva').catch(error => console.warn(`No se pudo expulsar a ${newcomer.id}:`, error.message));
      }
    }
  }
  const logChannel = member.guild.systemChannel;
  if (logChannel?.isTextBased()) await logChannel.send({ embeds: [embed('🚨 Ataque anti-raid detectado', `Se detectaron ${recent.length} entradas en 10 segundos. Los canales se bloquearon y las cuentas de menos de 7 días fueron expulsadas si los permisos lo permiten. Usa el botón **Restaurar servidor** del panel anti-raid cuando el peligro haya pasado.`, 0xE74C3C)] }).catch(() => {});
}

function getSlashCommandPayload(existing) {
  const merged = new Map(existing.map(command => [command.name, command]));
  for (const command of commands) merged.set(command.name, command);
  return [...merged.values()];
}
async function register(client) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.DEV_GUILD_ID
    ? Routes.applicationGuildCommands(client.user.id, process.env.DEV_GUILD_ID)
    : Routes.applicationCommands(client.user.id);
  try {
    const current = await rest.get(route);
    await rest.put(route, { body: getSlashCommandPayload(current) });
    console.log('Comandos slash de bienvenida, anti-raid y verificación registrados.');
  } catch (error) {
    console.error('No se pudieron registrar los comandos de seguridad:', error.message);
  }
}
async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand() || !commands.some(command => command.name === interaction.commandName)) return false;
  try {
    requireManageGuild(interaction);
    requireBotPermission(interaction.guild, P.SendMessages, 'Enviar mensajes');
    if (interaction.commandName === 'setwelcome') {
      const channel = interaction.options.getChannel('canal');
      const message = interaction.options.getString('mensaje', true);
      const attachment = interaction.options.getAttachment('archivo');
      if (!isTextChannel(channel)) throw new Error('Selecciona un canal de texto válido.');
      const media = await prepareWelcomeMedia(interaction.guildId, attachment);
      const guildConfig = config(interaction.guildId);
      guildConfig.welcome = { channelId: channel.id, message, ...media };
      save();
      await interaction.reply({ embeds: [embed('Bienvenida configurada', `Canal: ${channel}\nMensaje: ${message}\nArchivo: ${attachment ? attachment.name : 'ninguno'}`, 0x2ECC71)], ephemeral: true });
      return true;
    }
    if (interaction.commandName === 'testwelcome') {
      const welcome = config(interaction.guildId).welcome;
      if (!welcome) throw new Error('Primero configura la bienvenida con `/setwelcome`.');
      const channel = interaction.guild.channels.cache.get(welcome.channelId);
      if (!channel) throw new Error('El canal configurado ya no existe. Ejecuta `/setwelcome` de nuevo.');
      await interaction.deferReply({ ephemeral: true });
      await postWelcome(channel, interaction.member, welcome, true);
      await interaction.editReply({ embeds: [embed('Vista previa enviada', `Revisa ${channel}.`, 0x2ECC71)] });
      return true;
    }
    if (interaction.commandName === 'anti-raid') {
      const raid = config(interaction.guildId).antiRaid;
      await interaction.reply({ embeds: [embed('Panel anti-raid', `Estado: **${raid.enabled ? 'activado' : 'desactivado'}**\nUmbral: **${raid.threshold} entradas en 10 segundos**\nLas cuentas de menos de 7 días se expulsan cuando se detecta el umbral.`, 0xE67E22)], components: createAntiRaidPanel(), ephemeral: true });
      return true;
    }
    if (interaction.commandName === 'verify') {
      const channel = interaction.options.getChannel('canal');
      const role = interaction.options.getRole('rol');
      if (!isTextChannel(channel)) throw new Error('Selecciona un canal de texto válido.');
      if (role.managed || role.id === interaction.guild.id) throw new Error('Ese rol no se puede asignar mediante verificación.');
      if (!interaction.guild.members.me.permissions.has(P.ManageRoles)) throw new Error('Al bot le falta el permiso Gestionar roles.');
      if (interaction.guild.members.me.roles.highest.comparePositionTo(role) <= 0) throw new Error('El rol del bot debe estar por encima del rol de verificación.');
      const button = new ButtonBuilder().setCustomId(`burning:verify:${role.id}`).setLabel('Verificarme').setEmoji('✅').setStyle(ButtonStyle.Success);
      await channel.send({ embeds: [embed('Verificación del servidor', 'Pulsa el botón para obtener acceso al servidor.', 0x2ECC71)], components: [new ActionRowBuilder().addComponents(button)] });
      await interaction.reply({ embeds: [embed('Panel de verificación publicado', `Canal: ${channel}\nRol: <@&${role.id}>`, 0x2ECC71)], ephemeral: true });
      return true;
    }
  } catch (error) {
    const payload = { embeds: [embed('No se pudo completar', error.message || 'Error inesperado.', 0xE74C3C)], ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
    return true;
  }
  return false;
}
async function handleInteraction(interaction) {
  if (interaction.isButton() && interaction.customId?.startsWith('burning:verify:')) {
    try {
      const roleId = interaction.customId.split(':')[2];
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) throw new Error('El rol de verificación ya no existe.');
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (member.roles.cache.has(role.id)) {
        await interaction.reply({ embeds: [embed('Ya verificado', 'Ya tienes el rol de acceso.', 0x5865F2)], ephemeral: true });
      } else {
        if (!interaction.guild.members.me.permissions.has(P.ManageRoles)) throw new Error('Al bot le falta el permiso Gestionar roles.');
        if (interaction.guild.members.me.roles.highest.comparePositionTo(role) <= 0) throw new Error('El rol del bot debe estar por encima del rol de verificación.');
        await member.roles.add(role, 'Verificación mediante panel');
        await interaction.reply({ embeds: [embed('Verificación completada', `Se te asignó el rol **${role.name}**.`, 0x2ECC71)], ephemeral: true });
      }
    } catch (error) {
      await interaction.reply({ embeds: [embed('No se pudo verificar', error.message || 'Error inesperado.', 0xE74C3C)], ephemeral: true }).catch(() => {});
    }
    return true;
  }
  return handlePanelInteraction(interaction);
}

function install() {
  const { Client } = require('discord.js');
  const originalOn = Client.prototype.on;
  const originalOnce = Client.prototype.once;
  Client.prototype.on = function patchedOn(eventName, listener) {
    if (eventName === 'interactionCreate') {
      return originalOn.call(this, eventName, async interaction => {
        if (await handleCommand(interaction)) return;
        if (await handleInteraction(interaction)) return;
        return listener.call(this, interaction);
      });
    }
    if (eventName === 'guildMemberAdd') {
      return originalOn.call(this, eventName, async member => {
        await onMemberJoin(member).catch(error => console.error('Error anti-raid:', error));
        return listener.call(this, member);
      });
    }
    return originalOn.call(this, eventName, listener);
  };
  Client.prototype.once = function patchedOnce(eventName, listener) {
    if (eventName !== 'ready') return originalOnce.call(this, eventName, listener);
    return originalOnce.call(this, eventName, async (...args) => {
      await listener.apply(this, args);
      await register(this).catch(error => console.error('Registro de comandos fallido:', error));
    });
  };
}

module.exports = { install, commands };
