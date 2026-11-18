const { EmbedBuilder } = require('discord.js');
const { PermissionFlagsBits: P, staffOnly, requireBot, memberMention, parseDuration, formatDuration, getWarnings, addWarning, clearWarnings } = require('../lib');
const commands = [];
function command(name, description, execute, aliases = []) { commands.push({ name, description, category: 'Moderación', execute, aliases }); }
command('purge', 'Borra de 1 a 100 mensajes recientes.', async ({ message, args }) => {
  if (!await staffOnly(P.ManageMessages)({ message })) return;
  const amount = Number(args[0]);
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) return message.reply('Uso: `.purge <1-100>`');
  requireBot(message, P.ManageMessages);
  const deleted = await message.channel.bulkDelete(amount, true);
  const reply = await message.channel.send(`🧹 Se borraron ${deleted.size} de ${amount} mensajes recientes.`);
  setTimeout(() => reply.delete().catch(() => {}), 5000);
});
command('kick', 'Expulsa a un miembro mencionado.', async ({ message, args }) => {
  if (!await staffOnly(P.KickMembers)({ message })) return;
  const member = memberMention(message); if (!member) return message.reply('Uso: `.kick @usuario [razón]`');
  if (!member.kickable) return message.reply('No puedo expulsar a ese usuario: revisa la jerarquía de roles y mis permisos.');
  requireBot(message, P.KickMembers); await member.kick(args.slice(1).join(' ') || `Expulsado por ${message.author.tag}`);
  await message.reply(`👢 ${member.user.tag} fue expulsado.`);
});
command('ban', 'Banea permanentemente a un miembro mencionado.', async ({ message, args }) => {
  if (!await staffOnly(P.BanMembers)({ message })) return;
  const member = memberMention(message); if (!member) return message.reply('Uso: `.ban @usuario [razón]`');
  if (!member.bannable) return message.reply('No puedo banear a ese usuario: revisa la jerarquía de roles y mis permisos.');
  requireBot(message, P.BanMembers); await member.ban({ reason: args.slice(1).join(' ') || `Baneado por ${message.author.tag}` });
  await message.reply(`🔨 ${member.user.tag} fue baneado.`);
});
command('unban', 'Quita el baneo usando el ID del usuario.', async ({ message, args }) => {
  if (!await staffOnly(P.BanMembers)({ message })) return;
  if (!/^\d{17,20}$/.test(args[0] || '')) return message.reply('Uso: `.unban <ID_usuario>`');
  requireBot(message, P.BanMembers); await message.guild.members.unban(args[0]); await message.reply(`✅ Se quitó el baneo de ${args[0]}.`);
});
command('mute', 'Aplica timeout temporal (ej. 10m, 2h, 1d).', async ({ message, args }) => {
  if (!await staffOnly(P.ModerateMembers)({ message })) return;
  const member = memberMention(message), duration = parseDuration(args[1]);
  if (!member || !duration) return message.reply('Uso: `.mute @usuario <tiempo> [razón]` (ej. `.mute @Juan 10m spam`; máximo 28d).');
  if (!member.moderatable) return message.reply('No puedo silenciar a ese usuario por sus permisos o su posición en la jerarquía.');
  requireBot(message, P.ModerateMembers);
  await member.timeout(duration, args.slice(2).join(' ') || `Silenciado por ${message.author.tag}`);
  await message.reply(`🔇 ${member.user.tag} fue silenciado durante ${formatDuration(duration)}.`);
});
command('unmute', 'Retira el timeout de un miembro.', async ({ message }) => {
  if (!await staffOnly(P.ModerateMembers)({ message })) return;
  const member = memberMention(message); if (!member) return message.reply('Uso: `.unmute @usuario`');
  if (!member.moderatable) return message.reply('No puedo quitar el silencio a ese usuario por la jerarquía de roles.');
  requireBot(message, P.ModerateMembers); await member.timeout(null, `Silencio retirado por ${message.author.tag}`);
  await message.reply(`🔊 Se retiró el silencio de ${member.user.tag}.`);
});
command('warn', 'Añade una advertencia al historial.', async ({ message, args }) => {
  if (!await staffOnly(P.ManageMessages)({ message })) return;
  const member = memberMention(message), reason = args.slice(1).join(' ');
  if (!member || !reason) return message.reply('Uso: `.warn @usuario <razón>`');
  const count = addWarning(message.guild.id, member.id, { reason, moderatorId: message.author.id, at: new Date().toISOString() });
  await message.reply(`⚠️ ${member.user.tag} recibió una advertencia (${count} en total). Motivo: ${reason}`);
});
command('warnings', 'Consulta las advertencias de un miembro.', async ({ message }) => {
  if (!await staffOnly(P.ManageMessages)({ message })) return;
  const member = memberMention(message); if (!member) return message.reply('Uso: `.warnings @usuario`');
  const list = getWarnings(message.guild.id, member.id);
  if (!list.length) return message.reply(`${member.user.tag} no tiene advertencias.`);
  const lines = list.slice(-10).map((w, i) => `**${Math.max(1, list.length - Math.min(list.length, 10) + i + 1)}.** ${w.reason} — <@${w.moderatorId}>`);
  await message.reply({ embeds: [new EmbedBuilder().setColor(0xE6A23C).setTitle(`Advertencias de ${member.user.tag} (${list.length})`).setDescription(lines.join('\n'))] });
});
command('clearwarns', 'Borra el historial de advertencias de un miembro.', async ({ message }) => {
  if (!await staffOnly(P.ManageMessages)({ message })) return;
  const member = memberMention(message); if (!member) return message.reply('Uso: `.clearwarns @usuario`');
  clearWarnings(message.guild.id, member.id); await message.reply(`✅ Se borraron las advertencias de ${member.user.tag}.`);
});
command('nick', 'Cambia el apodo de un miembro.', async ({ message, args }) => {
  if (!await staffOnly(P.ManageNicknames)({ message })) return;
  const member = memberMention(message), nickname = args.slice(1).join(' ');
  if (!member || !nickname) return message.reply('Uso: `.nick @usuario <nuevo_nombre>`');
  if (!member.manageable) return message.reply('No puedo cambiar ese apodo por la jerarquía de roles.');
  requireBot(message, P.ManageNicknames); await member.setNickname(nickname.slice(0, 32), `Apodo cambiado por ${message.author.tag}`);
  await message.reply(`✅ Apodo actualizado para ${member.user.tag}.`);
});
module.exports = commands;
