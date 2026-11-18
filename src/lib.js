const fs = require('node:fs');
const path = require('node:path');
const { PermissionFlagsBits } = require('discord.js');
const file = path.join(__dirname, '..', 'data.json');
let data = { guilds: {}, warnings: {}, balances: {}, work: {} };
try { if (fs.existsSync(file)) data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; }
catch (error) { console.error('No se pudo leer data.json; se iniciará con datos vacíos:', error.message); }
function save() { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(data, null, 2)); fs.renameSync(tmp, file); }
function guildSettings(id) { return data.guilds[id] ||= { antilink: false, antispam: false }; }
function warnKey(guildId, userId) { return `${guildId}:${userId}`; }
function getWarnings(guildId, userId) { return data.warnings[warnKey(guildId, userId)] || []; }
function addWarning(guildId, userId, record) { const key = warnKey(guildId, userId); (data.warnings[key] ||= []).push(record); save(); return data.warnings[key].length; }
function clearWarnings(guildId, userId) { delete data.warnings[warnKey(guildId, userId)]; save(); }
function balanceKey(guildId, userId) { return `${guildId}:${userId}`; }
function balance(guildId, userId) { return data.balances[balanceKey(guildId, userId)] || 0; }
function addCoins(guildId, userId, amount) { const key = balanceKey(guildId, userId); data.balances[key] = balance(guildId, userId) + amount; save(); return data.balances[key]; }
function lastWork(guildId, userId) { return data.work[balanceKey(guildId, userId)] || 0; }
function setLastWork(guildId, userId, time) { data.work[balanceKey(guildId, userId)] = time; save(); }
function hasPermission(member, permission) { return member.permissions.has(permission); }
function staffOnly(permission) {
  return async ({ message }) => {
    if (!hasPermission(message.member, permission)) { await message.reply('No tienes permiso para usar este comando.'); return false; }
    return true;
  };
}
function botHas(message, permission) { return message.guild.members.me?.permissions.has(permission) ?? false; }
function requireBot(message, permission) {
  if (!botHas(message, permission)) throw new Error('Me falta el permiso necesario para realizar esa acción. Pide a un administrador que revise mis permisos.');
}
function memberMention(message, index = 0) { return message.mentions.members.at(index) || null; }
function parseDuration(value) {
  if (!value) return null;
  const regex = /(\d+)([smhd])/gi; let match; let total = 0; let consumed = '';
  while ((match = regex.exec(value)) !== null) {
    consumed += match[0];
    const scale = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2].toLowerCase()];
    total += Number(match[1]) * scale;
  }
  if (consumed.toLowerCase() !== value.toLowerCase() || total < 1000 || total > 28 * 86400000) return null;
  return total;
}
function formatDuration(ms) {
  const parts = []; for (const [unit, size] of [['d', 86400000], ['h', 3600000], ['m', 60000], ['s', 1000]]) {
    const n = Math.floor(ms / size); if (n) { parts.push(`${n}${unit}`); ms %= size; }
  } return parts.join(' ') || 'menos de 1s';
}
function errorMessage(error) {
  if (error?.code === 50013 || error?.code === 50001) return 'Discord no me permite hacerlo. Comprueba mis permisos y mi posición en la jerarquía de roles.';
  if (error?.code === 10007) return 'No encontré a ese miembro en el servidor.';
  if (error?.code === 10003) return 'No encontré ese canal.';
  return `No se pudo completar el comando: ${error?.message || 'error desconocido'}`;
}
function staffRoleIds() { return (process.env.STAFF_ROLE_IDS || '').split(',').map(x => x.trim()).filter(Boolean); }
module.exports = { PermissionFlagsBits, guildSettings, getWarnings, addWarning, clearWarnings, balance, addCoins, lastWork, setLastWork, staffOnly, requireBot, memberMention, parseDuration, formatDuration, errorMessage, staffRoleIds };
