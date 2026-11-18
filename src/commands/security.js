const { PermissionFlagsBits: P, guildSettings, save, staffOnly, requireBot } = require('../lib');
const pendingNukes = new Map();
const antispamState = new Map();
const commands = [];
function command(name, description, execute) { commands.push({ name, description, category: 'Seguridad', execute }); }
command('antilink', 'Activa o desactiva la eliminación de enlaces.', async ({ message, args }) => {
  if (!await staffOnly(P.ManageGuild)({ message })) return;
  const value = (args[0] || '').toLowerCase();
  if (!['on', 'off'].includes(value)) return message.reply('Uso: `.antilink on|off`');
  guildSettings(message.guild.id).antilink = value === 'on';
  save();
  await message.reply(`🛡️ Antilink ${value === 'on' ? 'activado' : 'desactivado'}.`);
});
command('antispam', 'Activa o desactiva la detección de spam.', async ({ message, args }) => {
  if (!await staffOnly(P.ManageGuild)({ message })) return;
  const value = (args[0] || '').toLowerCase();
  if (!['on', 'off'].includes(value)) return message.reply('Uso: `.antispam on|off`');
  guildSettings(message.guild.id).antispam = value === 'on';
  save();
  await message.reply(`🚦 Antispam ${value === 'on' ? 'activado (5 mensajes / 5 segundos; timeout automático de 5 minutos)' : 'desactivado'}.`);
});
command('lock', 'Bloquea el canal para @everyone.', async ({ message }) => {
  if (!await staffOnly(P.ManageChannels)({ message })) return;
  requireBot(message, P.ManageChannels);
  await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
  await message.channel.send('🔒 Canal bloqueado para @everyone.');
});
command('unlock', 'Permite de nuevo escribir a @everyone.', async ({ message }) => {
  if (!await staffOnly(P.ManageChannels)({ message })) return;
  requireBot(message, P.ManageChannels);
  await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
  await message.channel.send('🔓 Canal desbloqueado para @everyone.');
});
command('slowmode', 'Establece el modo lento (0-21600 segundos).', async ({ message, args }) => {
  if (!await staffOnly(P.ManageChannels)({ message })) return;
  const seconds = Number(args[0]);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21600) return message.reply('Uso: `.slowmode <0-21600>`');
  requireBot(message, P.ManageChannels);
  await message.channel.setRateLimitPerUser(seconds);
  await message.reply(`⏱️ Modo lento establecido en ${seconds} segundo(s).`);
});
command('nuke', 'Clona el canal y elimina el original tras confirmación.', async ({ message, args }) => {
  if (!await staffOnly(P.ManageChannels)({ message })) return;
  requireBot(message, P.ManageChannels);
  const key = `${message.guild.id}:${message.channel.id}`;
  if ((args[0] || '').toLowerCase() !== 'confirm') {
    pendingNukes.set(key, { userId: message.author.id, expires: Date.now() + 15000 });
    setTimeout(() => { const p = pendingNukes.get(key); if (p?.expires <= Date.now()) pendingNukes.delete(key); }, 16000);
    return message.reply('⚠️ Esto eliminará el canal y su historial no se puede recuperar. Escribe `.nuke confirm` en 15 segundos para continuar.');
  }
  const pending = pendingNukes.get(key);
  if (!pending || pending.userId !== message.author.id || pending.expires < Date.now()) return message.reply('No hay una confirmación activa tuya. Ejecuta `.nuke` primero.');
  pendingNukes.delete(key);
  const old = message.channel;
  const fresh = await old.clone({ reason: `Nuke confirmado por ${message.author.tag}` });
  await fresh.setPosition(old.position).catch(() => {});
  await fresh.send(`🧹 Canal recreado por ${message.author}. El historial anterior fue eliminado.`);
  await old.delete(`Nuke confirmado por ${message.author.tag}`);
});
async function onMessage(message) {
  if (!message.guild || message.author.bot) return;
  const settings = guildSettings(message.guild.id);
  if (settings.antilink && /(?:https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/)/i.test(message.content)) {
    if (message.member?.permissions.has(P.ManageMessages)) return;
    if (message.guild.members.me?.permissions.has(P.ManageMessages)) await message.delete().catch(() => {});
    return;
  }
  if (!settings.antispam) return;
  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const times = (antispamState.get(key) || []).filter(t => now - t < 5000);
  times.push(now);
  antispamState.set(key, times);
  if (times.length >= 5 && !message.member?.permissions.has(P.ManageMessages)) {
    antispamState.delete(key);
    if (message.member?.moderatable && message.guild.members.me?.permissions.has(P.ModerateMembers)) {
      await message.member.timeout(5 * 60 * 1000, 'Antispam automático: 5 mensajes en 5 segundos').catch(() => {});
      await message.channel.send(`🚦 ${message.author}, se aplicó un timeout de 5 minutos por spam.`).catch(() => {});
    }
  }
}
module.exports = { commands, onMessage };
