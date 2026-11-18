'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  Client
} = require('discord.js');

const DATA_FILE = path.resolve(process.env.DATA_PATH || 'data.json');
const EMBED_COLOR = 0x2ECC71;
function readGuildConfig(guildId) {
  try {
    const contents = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return contents.guilds?.[guildId] || null;
  } catch (error) {
    console.error('No se pudo leer configuración de bienvenida:', error.message);
    return null;
  }
}
function welcomeDescription(template, member) {
  const mentionedMember = `<@${member.id}> (**${member.displayName}**)`;
  const configuredText = String(template || '').replaceAll('{user}', mentionedMember).replaceAll('{server}', member.guild.name);
  // Ensure the new member is shown even if the configured custom message omits {user}.
  return template?.includes('{user}') ? configuredText : `${mentionedMember}\n${configuredText}`;
}
async function sendWelcome(member) {
  if (member.user.bot) return;
  const config = readGuildConfig(member.guild.id);
  const welcome = config?.welcome;
  if (!welcome?.channelId) return;
  const channel = member.guild.channels.cache.get(welcome.channelId);
  if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return;

  const card = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`¡Bienvenido/a a ${member.guild.name}!`)
    .setDescription(welcomeDescription(welcome.message, member))
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();
  const payload = { embeds: [card], allowedMentions: { users: [member.id] } };
  if (welcome.imageUrl) card.setImage(welcome.imageUrl);
  if (welcome.gifPath && fs.existsSync(welcome.gifPath)) {
    payload.files = [new AttachmentBuilder(welcome.gifPath, { name: 'welcome.gif' })];
    card.setImage('attachment://welcome.gif');
  }
  await channel.send(payload);
}
function install() {
  const originalOn = Client.prototype.on;
  Client.prototype.on = function patchedOn(eventName, listener) {
    if (eventName !== 'guildMemberAdd') return originalOn.call(this, eventName, listener);
    return originalOn.call(this, eventName, async member => {
      try { await sendWelcome(member); }
      catch (error) { console.error(`No se pudo enviar bienvenida a ${member.id}:`, error); }
      return listener.call(this, member);
    });
  };
}
module.exports = { install, sendWelcome };
