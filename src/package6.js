'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  PermissionFlagsBits: P, REST, Routes
} = require('discord.js');

const STORE = path.resolve(process.env.PACKAGE6_DATA_PATH || 'package6.json');
const BACKUP_EVERY_MS = 3 * 60 * 60 * 1000;
const REACTION_ID = 'p6r';
let state = { backups: {}, cookieGames: {} };
try { if (fs.existsSync(STORE)) state = { ...state, ...JSON.parse(fs.readFileSync(STORE, 'utf8')) }; }
catch (error) { console.error('No se pudo leer package6.json:', error.message); }
function save() {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  const tmp = `${STORE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, STORE);
}
const embed = (title, description, color = 0x5865F2) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
const actionRow = (...components) => new ActionRowBuilder().addComponents(...components);
const commands = [
  { name: 'cookie-game', description: 'Cuenta atrás y carrera para tocar la galleta.' },
  { name: 'copia-seguridad', description: 'Guarda ahora y cada 3 horas los roles, canales y categorías.', default_member_permissions: P.ManageGuild.toString() }
];
const reactions = {
  kiss: ['le dio un dulce beso a', 'kiss', [['Devolver beso','💋','le devolvió el beso a','kiss'],['Sonrojarse','😳','se sonrojó por el beso de','blush']]],
  hug: ['le dio un fuerte abrazo a', 'hug', [['Abrazar de vuelta','🫂','devolvió el abrazo a','hug'],['Acurrucarse','🥰','se acurrucó junto a','cuddle']]],
  slap: ['le dio una bofetada a', 'slap', [['Devolver bofetada','✋','devolvió la bofetada a','slap'],['Bloquear','🛡️','bloqueó el golpe de','smug']]],
  pat: ['acarició la cabeza de', 'pat', [['Disfrutar','😊','disfrutó las caricias de','happy'],['Picar mejilla','👉','le picó la mejilla a','poke']]],
  bite: ['le dio un mordisco a', 'bite', [['Morder de vuelta','🦷','mordió de vuelta a','bite'],['Enojarse','💢','se enfadó con','pout']]],
  poke: ['le picó la mejilla a', 'poke', [['Picar de vuelta','👉','le picó de vuelta a','poke'],['Reírse','😆','se rio con','laugh']]],
  cuddle: ['se acurrucó junto a', 'cuddle', [['Acurrucarse más','💞','se acurrucó aún más junto a','cuddle'],['Dormirse','😴','se durmió junto a','sleep']]],
  highfive: ['quiso chocar los cinco con', 'highfive', [['Chocar los cinco','🙌','chocó los cinco con','highfive'],['Dejar colgado','💨','dejó colgado a','shrug']]],
  punch: ['le lanzó un golpe de broma a', 'punch', [['Contraatacar','🥊','contraatacó a','punch'],['Esquivar','🤸','esquivó el golpe de','smug']]],
  tickle: ['le hizo cosquillas a', 'tickle', [['Reír','🤣','se rio con las cosquillas de','laugh'],['Venganza','👐','le devolvió las cosquillas a','tickle']]],
  cry: ['se puso a llorar en el hombro de', 'cry', [['Dar pañuelo','🧻','le dio un pañuelo a','cry'],['Consolar con abrazo','🫂','consoló con un abrazo a','hug']]],
  dance: ['sacó a bailar a', 'dance', [['Bailar juntos','💃','bailó junto a','dance'],['Quedarse sentado','🪑','se quedó sentado mientras bailaba','shrug']]],
  blush: ['se sonrojó muchísimo por culpa de', 'blush', [['Sonrojar más','😊','hizo sonrojar más a','blush'],['Taparse la cara','🙈','se tapó la cara por','shy']]],
  sleep: ['se quedó dormido encima de', 'sleep', [['Tapar con manta','🛌','tapó con una manta a','sleep'],['Despertar','⏰','despertó de golpe a','surprised']]],
  happy: ['se puso muy feliz gracias a', 'happy', [['Celebrar','🎉','celebró junto a','dance'],['Abrazar','🫂','abrazó a','hug']]],
  boop: ['le tocó la nariz a', 'poke', [['Boop de vuelta','👃','le hizo boop de vuelta a','poke'],['Arrugar nariz','😖','arrugó la nariz ante','pout']]],
  kill: ['eliminó dramáticamente de broma a', 'kill', [['Volver fantasma','👻','volvió como fantasma para asustar a','ghost'],['Revivir y vengarse','⚔️','revivió y se vengó de','fight']]],
  kidnap: ['metió en un saco y se llevó a', 'grab', [['Pedir rescate','🆘','pidió rescate a','cry'],['Escapar','🥷','escapó del saco de','run']]],
  revive: ['usó magia para revivir a', 'happy', [['Volver zombie','🧟','volvió como zombie gracias a','zombie'],['Agradecer','✨','agradeció a','happy']]],
  bribe: ['le ofreció un maletín de dinero a', 'handshake', [['Aceptar soborno','💼','aceptó el maletín de','smug'],['Llamar a la policía','🚨','llamó a la policía por','run']]],
  pout: ['hizo un puchero mirando a', 'pout', [['Darle un dulce','🍬','le dio un dulce a','happy'],['Pellizcar cachetes','🤏','le pellizcó los cachetes a','pat']]],
  laugh: ['se rio a carcajadas de', 'laugh', [['Enojarse','😤','se enojó con','angry'],['Reír juntos','🤡','se rio junto a','laugh']]]
};
const imageGIF = async category => fetch(`https://nekos.best/api/v2/${encodeURIComponent(category)}`, { signal: AbortSignal.timeout(5000) }).then(async r => r.ok ? (await r.json()).results?.[0]?.url || null : null).catch(() => null);
async function register(client) {
  if (!process.env.DISCORD_TOKEN) return;
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.DEV_GUILD_ID ? Routes.applicationGuildCommands(client.user.id, process.env.DEV_GUILD_ID) : Routes.applicationCommands(client.user.id);
  const current = await rest.get(route);
  const merged = new Map(current.map(command => [command.name, command]));
  for (const command of commands) merged.set(command.name, command);
  await rest.put(route, { body: [...merged.values()] });
}
async function sendReaction(message, name, target) {
  const [phrase, gifKind, actions] = reactions[name];
  const gif = await imageGIF(gifKind);
  const sessionId = `${message.guild.id}:${message.id}:${name}:${message.author.id}:${target.id}`;
  const buttons = actions.map(([label, emoji], index) => new ButtonBuilder().setCustomId(`${REACTION_ID}:${sessionId}:${index}`).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Secondary));
  const card = embed('Reacción', `${message.member?.displayName || message.author.username} ${phrase} ${target.displayName}`, 0xE74C3C);
  if (gif) card.setImage(gif);
  await message.channel.send({ embeds: [card], components: [actionRow(...buttons)], allowedMentions: { parse: [] } });
}
function snapshotGuild(guild, channelId, requestedBy) {
  const roles = guild.roles.cache.filter(role => role.id !== guild.id && !role.managed).map(role => ({
    id: role.id, name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable,
    permissions: role.permissions.bitfield.toString(), position: role.position
  }));
  const channels = guild.channels.cache.filter(channel => [ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)).map(channel => ({
    id: channel.id, name: channel.name, type: channel.type, parentId: channel.parentId || null,
    position: channel.rawPosition, topic: channel.topic || null, nsfw: Boolean(channel.nsfw),
    rateLimitPerUser: channel.rateLimitPerUser || 0, bitrate: channel.bitrate || null,
    userLimit: channel.userLimit || 0,
    overwrites: channel.permissionOverwrites.cache.map(overwrite => ({ id: overwrite.id, type: overwrite.type, allow: overwrite.allow.bitfield.toString(), deny: overwrite.deny.bitfield.toString() }))
  }));
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, guildId: guild.id, guildName: guild.name, channelId, requestedBy, createdAt: Date.now(), roles, channels };
}
async function createBackup(client, guildId) {
  const config = state.backups[guildId]; if (!config) return;
  const guild = client.guilds.cache.get(guildId); if (!guild) return;
  const backup = snapshotGuild(guild, config.channelId, config.requestedBy);
  config.latest = backup;
  save();
  const recipient = await client.users.fetch(config.requestedBy).catch(() => null);
  if (!recipient) return;
  const button = new ButtonBuilder().setCustomId(`p6:restore:${guildId}:${backup.id}:${config.requestedBy}`).setLabel('Restaurar').setEmoji('✅').setStyle(ButtonStyle.Danger);
  await recipient.send({ embeds: [embed('Copia de seguridad guardada', `Se guardó una copia de seguridad del servidor **${guild.name}**. Canales/categorías: ${backup.channels.length}; roles: ${backup.roles.length}. Se volverá a guardar cada 3 horas. La restauración es destructiva y eliminará los canales/roles que no estén en esta copia.`)], components: [actionRow(button)] }).catch(error => console.warn(`No se pudo enviar DM de copia de seguridad: ${error.message}`));
}
async function beginBackup(client, guild, channel, user) {
  if (!user || !guild) throw new Error('Este comando solo puede usarse en un servidor.');
  if (!channel.isTextBased()) throw new Error('Usa el comando en un canal de texto.');
  if (!guild.members.me.permissions.has(P.ManageChannels) || !guild.members.me.permissions.has(P.ManageRoles)) throw new Error('El bot necesita Gestionar canales y Gestionar roles para respaldar y restaurar.');
  state.backups[guild.id] = { channelId: channel.id, requestedBy: user.id, latest: null };
  save();
  await createBackup(client, guild.id);
}
async function restoreSnapshot(guild, backup) {
  if (!guild.members.me.permissions.has(P.ManageChannels) || !guild.members.me.permissions.has(P.ManageRoles)) throw new Error('Al bot le faltan permisos para restaurar canales y roles.');
  const snapshotRoleIds = new Set(backup.roles.map(role => role.id));
  // Remove roles added after the snapshot, except @everyone, managed roles, and roles at/above the bot.
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id || role.managed || snapshotRoleIds.has(role.id)) continue;
    if (role.position >= guild.members.me.roles.highest.position) continue;
    await role.delete('Restauración confirmada de copia de seguridad').catch(error => console.warn(`No se pudo eliminar rol ${role.name}: ${error.message}`));
  }
  const roleMap = new Map([[guild.id, guild.id]]);
  for (const saved of backup.roles) {
    let role = guild.roles.cache.get(saved.id) || guild.roles.cache.find(item => item.name === saved.name);
    if (!role) role = await guild.roles.create({ name: saved.name, color: saved.color, hoist: saved.hoist, mentionable: saved.mentionable, permissions: BigInt(saved.permissions), reason: 'Restauración confirmada de copia de seguridad' }).catch(() => null);
    if (!role) continue;
    roleMap.set(saved.id, role.id);
    await role.edit({ name: saved.name, color: saved.color, hoist: saved.hoist, mentionable: saved.mentionable, permissions: BigInt(saved.permissions) }, 'Restauración confirmada de copia de seguridad').catch(error => console.warn(`No se pudo restaurar rol ${saved.name}: ${error.message}`));
  }
  const savedIds = new Set(backup.channels.map(channel => channel.id));
  const extras = [...guild.channels.cache.values()].filter(channel => savedIds.has(channel.id) === false && [ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)).sort((a,b) => (b.parent ? 1 : 0) - (a.parent ? 1 : 0));
  for (const channel of extras) await channel.delete('Restauración confirmada: canal ausente en la copia').catch(error => console.warn(`No se pudo eliminar canal ${channel.name}: ${error.message}`));
  const channelMap = new Map();
  const ordered = [...backup.channels].sort((a,b) => (a.type === ChannelType.GuildCategory ? -1 : 0) - (b.type === ChannelType.GuildCategory ? -1 : 0) || a.position - b.position);
  for (const saved of ordered) {
    let channel = guild.channels.cache.get(saved.id) || guild.channels.cache.find(item => item.name === saved.name && item.type === saved.type);
    const overwrites = saved.overwrites.map(overwrite => ({
      id: overwrite.type === 0 ? (roleMap.get(overwrite.id) || overwrite.id) : overwrite.id,
      type: overwrite.type, allow: BigInt(overwrite.allow), deny: BigInt(overwrite.deny)
    })).filter(overwrite => overwrite.type !== 0 || overwrite.id === guild.id || guild.roles.cache.has(overwrite.id));
    const parent = saved.parentId ? (channelMap.get(saved.parentId) || saved.parentId) : null;
    const options = { name: saved.name, type: saved.type, position: saved.position, permissionOverwrites: overwrites };
    if (parent) options.parent = parent;
    if ([ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(saved.type)) Object.assign(options, { topic: saved.topic, nsfw: saved.nsfw, rateLimitPerUser: saved.rateLimitPerUser });
    if ([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(saved.type)) Object.assign(options, { bitrate: saved.bitrate || undefined, userLimit: saved.userLimit });
    if (!channel) channel = await guild.channels.create(options).catch(error => { console.warn(`No se pudo recrear canal ${saved.name}: ${error.message}`); return null; });
    if (!channel) continue;
    channelMap.set(saved.id, channel.id);
    await channel.edit(options, 'Restauración confirmada de copia de seguridad').catch(error => console.warn(`No se pudo restaurar canal ${saved.name}: ${error.message}`));
  }
  return { roles: backup.roles.length, channels: backup.channels.length };
}
async function handleCommand(i) {
  if (!i.isChatInputCommand?.() || !commands.some(command => command.name === i.commandName)) return false;
  if (i.commandName === 'cookie-game') {
    const gameId = `${i.guildId}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    await i.reply({ embeds: [embed('🍪 Cookie game', '5… 4… 3… 2… 1…\n\nTap the cookie to be the first 🍪', GOLD)], components: [], allowedMentions: { parse: [] } });
    const message = await i.fetchReply();
    state.cookieGames[message.id] = { guildId: i.guildId, channelId: i.channelId, winner: null, startsAt: Date.now() + 5000, id: gameId };
    save();
    for (let count = 4; count >= 1; count--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await message.edit({ embeds: [embed('🍪 Cookie game', `${count}…\n\nTap the cookie to be the first 🍪`, GOLD)] }).catch(() => {});
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    await message.edit({ embeds: [embed('🍪 Cookie game', 'Tap the cookie to be the first 🍪', GOLD)], components: actionRow(new ButtonBuilder().setCustomId(`p6:cookie:${i.guildId}:${message.id}`).setEmoji('🍪').setStyle(ButtonStyle.Primary)) }).catch(() => {});
    return true;
  }
  if (i.commandName === 'copia-seguridad') {
    if (!i.memberPermissions?.has(P.ManageGuild) && !i.memberPermissions?.has(P.Administrator)) throw new Error('Necesitas Gestionar servidor.');
    await i.deferReply({ ephemeral: true });
    await beginBackup(i.client, i.guild, i.channel, i.user);
    await i.editReply({ embeds: [embed('Copia de seguridad iniciada', 'La primera copia está guardada. Recibirás un DM con el botón de restauración y se generará una nueva cada 3 horas.', 0x2ECC71)] });
    return true;
  }
  return false;
}
async function handleComponent(i) {
  const id = i.customId || '';
  if (id.startsWith('p6:cookie:')) {
    const [, , guildId, messageId] = id.split(':');
    const game = state.cookieGames[messageId];
    if (!game || game.guildId !== guildId || Date.now() < game.startsAt) { await i.reply({ content: 'La galleta todavía no está disponible.', ephemeral: true }); return true; }
    if (game.winner) { await i.reply({ content: `La galleta ya la ganó <@${game.winner}>.`, ephemeral: true }); return true; }
    game.winner = i.user.id; save();
    await i.update({ embeds: [embed('🍪 Cookie game', `The one who touched the cookie first 🍪 was ${i.user}` , GOLD)], components: [] });
    return true;
  }
  if (id.startsWith('p6:restore:')) {
    const [, , guildId, backupId, ownerId] = id.split(':');
    const backup = state.backups[guildId]?.latest;
    if (!backup || backup.id !== backupId || i.user.id !== ownerId || !i.guilds) {
      // DMs have no guild property; authorization is tied to the configured backup owner.
      if (!backup || backup.id !== backupId || i.user.id !== ownerId) { await i.reply({ content: 'Esta copia no está disponible para tu usuario.', ephemeral: true }); return true; }
    }
    const confirm = new ButtonBuilder().setCustomId(`p6:restore-confirm:${guildId}:${backupId}:${ownerId}`).setLabel('Confirmar restauración').setEmoji('⚠️').setStyle(ButtonStyle.Danger);
    await i.reply({ embeds: [embed('⚠️ Restauración destructiva', `Se eliminarán los canales/categorías y roles que no aparezcan en la copia del servidor **${backup.guildName}**. Roles administrados y roles fuera de la jerarquía del bot no se pueden borrar. Confirma solo si entiendes el impacto.`, 0xE74C3C)], components: actionRow(confirm), ephemeral: true });
    return true;
  }
  if (id.startsWith('p6:restore-confirm:')) {
    const [, , guildId, backupId, ownerId] = id.split(':');
    if (i.user.id !== ownerId || !i.guilds) { await i.reply({ content: 'La confirmación debe hacerse desde el DM del configurador.', ephemeral: true }); return true; }
    const backup = state.backups[guildId]?.latest;
    const guild = i.client.guilds.cache.get(guildId);
    if (!backup || backup.id !== backupId || !guild) { await i.reply({ content: 'No se encontró la copia o el bot ya no está en ese servidor.', ephemeral: true }); return true; }
    const member = await guild.members.fetch(i.user.id).catch(() => null);
    if (!member?.permissions.has(P.ManageGuild) || !member.permissions.has(P.ManageChannels) || !member.permissions.has(P.ManageRoles)) { await i.reply({ content: 'Tu miembro necesita Gestionar servidor, canales y roles para restaurar.', ephemeral: true }); return true; }
    await i.deferReply({ ephemeral: true });
    const result = await restoreSnapshot(guild, backup);
    await i.editReply({ embeds: [embed('Restauración terminada', `Se intentó restaurar ${result.channels} canales/categorías y ${result.roles} roles. Algunos recursos pueden omitirse si los permisos o jerarquías de Discord lo impiden.`, 0x2ECC71)] });
    return true;
  }
  if (id.startsWith(`${REACTION_ID}:`)) {
    const [, session, indexText] = id.split(':');
    const [guildId, sourceMessageId, name, authorId, targetId] = session.split(':');
    if (i.guildId !== guildId || i.user.id !== targetId) { await i.reply({ content: `Solo <@${targetId}> puede responder a esta reacción.`, ephemeral: true }); return true; }
    const action = reactions[name]?.[2]?.[Number(indexText)];
    if (!action) { await i.reply({ content: 'Esta interacción ya no existe.', ephemeral: true }); return true; }
    const [label, emoji, response, gifCategory] = action; void label; void emoji;
    await i.update({ components: [] });
    const gif = await imageGIF(gifCategory);
    const message = embed('Respuesta', `<@${targetId}> ${response} <@${authorId}>.`, 0x9B59B6); if (gif) message.setImage(gif);
    await i.channel.send({ embeds: [message], allowedMentions: { parse: [] } });
    void sourceMessageId;
    return true;
  }
  return false;
}
async function handlePrefix(message, next) {
  if (!message.guild || message.author.bot || !message.content?.startsWith('.')) return next();
  const [raw, ...args] = message.content.slice(1).trim().split(/\s+/).filter(Boolean);
  const name = (raw || '').toLowerCase();
  if (!Object.hasOwn(reactions, name)) return next();
  const target = message.mentions.members.first();
  if (!target || target.id === message.author.id || target.user.bot) {
    await message.reply({ embeds: [embed('Uso del comando', `Menciona a otro usuario: \.${name} @usuario`, 0xE74C3C)], allowedMentions: { repliedUser: false } });
    return;
  }
  const [phrase, gifCategory] = reactions[name];
  const gif = await imageGIF(gifCategory);
  const session = `${message.guild.id}:${message.id}:${name}:${message.author.id}:${target.id}`;
  const buttons = reactions[name][2].map(([label, emoji], index) => new ButtonBuilder().setCustomId(`${REACTION_ID}:${session}:${index}`).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Secondary));
  const card = embed('Reacción', `${message.member?.displayName || message.author.username} ${phrase} ${target.displayName}`, 0xE74C3C); if (gif) card.setImage(gif);
  await message.channel.send({ embeds: [card], components: [actionRow(...buttons)], allowedMentions: { parse: [] } });
  void args;
}
async function tickSchedulers(client) {
  for (const [guildId, config] of Object.entries(state.backups)) await createBackup(client, guildId).catch(error => console.error('Copia programada fallida:', error));
}
function install() {
  const { Client } = require('discord.js'); const originalOn = Client.prototype.on; const originalOnce = Client.prototype.once;
  Client.prototype.on = function patchedOn(eventName, listener) {
    if (eventName === 'messageCreate') return originalOn.call(this, eventName, async message => {
      try { await handlePrefix(message, () => listener.call(this, message)); }
      catch (error) { console.error('Error en reacción .:', error); await message.reply({ embeds: [embed('Error', error.message || 'No se pudo completar.', 0xE74C3C)], allowedMentions: { repliedUser: false } }).catch(() => {}); }
    });
    if (eventName === 'interactionCreate') return originalOn.call(this, eventName, async interaction => {
      try { if (await handleCommand(interaction)) return; if (await handleComponent(interaction)) return; }
      catch (error) { console.error('Error paquete 6:', error); if (interaction.deferred || interaction.replied) await interaction.followUp({ embeds: [embed('Error', error.message || 'No se pudo completar.', 0xE74C3C)], ephemeral: true }).catch(() => {}); else await interaction.reply({ embeds: [embed('Error', error.message || 'No se pudo completar.', 0xE74C3C)], ephemeral: true }).catch(() => {}); return; }
      return listener.call(this, interaction);
    });
    return originalOn.call(this, eventName, listener);
  };
  Client.prototype.once = function patchedOnce(eventName, listener) {
    if (eventName !== 'ready') return originalOnce.call(this, eventName, listener);
    return originalOnce.call(this, eventName, async (...args) => {
      await listener.apply(this, args);
      try { await register(this); } catch (error) { console.error('No se pudieron registrar comandos paquete 6:', error.message); }
      const due = Math.max(1000, ...Object.values(state.backups).map(config => BACKUP_EVERY_MS - (Date.now() - (config.latest?.createdAt || 0))));
      setTimeout(() => { void tickSchedulers(this); setInterval(() => void tickSchedulers(this), BACKUP_EVERY_MS).unref?.(); }, Math.min(due, BACKUP_EVERY_MS)).unref?.();
    });
  };
}
module.exports = { install, commands };
