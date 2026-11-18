'use strict';

const { Client, EmbedBuilder } = require('discord.js');
const afkUsers = new Map();
const COLOR = 0x3498DB;
const card = (title, description) => new EmbedBuilder().setColor(COLOR).setTitle(title).setDescription(description).setTimestamp();
const handled = new WeakSet();

async function resolveMember(message, token) {
  const mentioned = message.mentions.members.first();
  if (mentioned) return mentioned;
  if (message.reference?.messageId) {
    const original = await message.fetchReference().catch(() => null);
    if (original) return message.guild.members.fetch(original.author.id).catch(() => null);
  }
  const id = token?.match(/\d{17,20}/)?.[0];
  return id ? message.guild.members.fetch(id).catch(() => null) : null;
}
async function runCommand(message, command, args) {
  if (command === 'afk') {
    const reason = args.join(' ').trim() || 'AFK';
    afkUsers.set(`${message.guild.id}:${message.author.id}`, { reason, since: Date.now() });
    await message.reply({ embeds: [card('💤 Modo AFK activado', `Motivo: ${reason}`)], allowedMentions: { repliedUser: false } });
    return true;
  }
  if (command === 'banner') {
    const member = await resolveMember(message, args[0]);
    const user = member?.user || message.author;
    const fetched = await user.fetch(true).catch(() => user);
    const animated = fetched.banner?.startsWith('a_');
    const bannerUrl = fetched.bannerURL({ size: 4096, extension: animated ? 'gif' : 'png' });
    if (!bannerUrl) {
      await message.reply({ embeds: [card('Banner no disponible', `${fetched.tag} no tiene un banner de perfil visible.`)], allowedMentions: { repliedUser: false } });
      return true;
    }
    await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`Banner de ${fetched.tag}`).setImage(bannerUrl)], allowedMentions: { repliedUser: false } });
    return true;
  }
  if (command === 'serverinfo') {
    const guild = message.guild;
    const owner = await guild.fetchOwner().catch(() => null);
    const embed = new EmbedBuilder().setColor(COLOR).setTitle(guild.name).setThumbnail(guild.iconURL({ size: 512 })).addFields(
      { name: 'Miembros', value: String(guild.memberCount), inline: true },
      { name: 'Canales', value: String(guild.channels.cache.size), inline: true },
      { name: 'Roles', value: String(guild.roles.cache.size), inline: true },
      { name: 'Propietario', value: owner ? owner.user.tag : 'No disponible', inline: true },
      { name: 'Creado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true }
    );
    await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    return true;
  }
  if (command === 'ping') {
    const latency = Math.max(0, Date.now() - message.createdTimestamp);
    const api = message.client.ws.ping;
    await message.reply({ embeds: [card('🏓 Pong', `Latencia del mensaje: **${latency} ms**\nLatencia de Discord API: **${Math.round(api)} ms**`)], allowedMentions: { repliedUser: false } });
    return true;
  }
  return false;
}
async function onMessage(message, next) {
  if (!message.guild || message.author.bot) return next();

  // Remove AFK status when the AFK member speaks, before checking mentions.
  const ownKey = `${message.guild.id}:${message.author.id}`;
  const ownStatus = afkUsers.get(ownKey);
  if (ownStatus) {
    afkUsers.delete(ownKey);
    await message.reply({ embeds: [card('Ya no estás AFK', 'Tu estado de ausencia se eliminó.')], allowedMentions: { repliedUser: false } }).catch(() => {});
  }

  const notified = new Set();
  for (const user of message.mentions.users.values()) {
    const status = afkUsers.get(`${message.guild.id}:${user.id}`);
    if (!status || notified.has(user.id)) continue;
    notified.add(user.id);
    await message.reply({ embeds: [card('Usuario AFK', `**${user.tag}** está ausente. Motivo: ${status.reason}`)], allowedMentions: { repliedUser: false } }).catch(() => {});
  }

  if (!message.content?.startsWith('.')) return next();
  const [name, ...args] = message.content.slice(1).trim().split(/\s+/).filter(Boolean);
  const command = (name || '').toLowerCase();
  if (!['afk', 'banner', 'serverinfo', 'ping'].includes(command)) return next();
  if (handled.has(message)) return;
  handled.add(message);
  try { await runCommand(message, command, args); }
  catch (error) {
    console.error(`.${command}:`, error);
    await message.reply({ embeds: [card('No se pudo completar', 'Ocurrió un error al ejecutar el comando. Revisa los permisos e inténtalo de nuevo.')], allowedMentions: { repliedUser: false } }).catch(() => {});
  }
}
function install() {
  const originalOn = Client.prototype.on;
  Client.prototype.on = function patchedOn(eventName, listener) {
    if (eventName !== 'messageCreate') return originalOn.call(this, eventName, listener);
    return originalOn.call(this, eventName, message => onMessage(message, () => listener.call(this, message)));
  };
}
module.exports = { install };
