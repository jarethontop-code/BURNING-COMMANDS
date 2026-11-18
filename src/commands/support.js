const { ChannelType, PermissionFlagsBits: P, EmbedBuilder } = require('discord.js');
const { staffOnly, requireBot, memberMention, staffRoleIds } = require('../lib');
const pendingCloses = new Map();
const commands = [];
function command(name, description, execute, aliases = []) { commands.push({ name, description, category: 'Soporte y utilidad', execute, aliases }); }
const groups = {
  'Moderación': 'purge, kick, ban, unban, mute, unmute, warn, warnings, clearwarns, nick',
  'Seguridad': 'antilink, antispam, lock, unlock, slowmode, nuke',
  'Soporte y utilidad': 'help, ticket, close, report, userinfo, serverinfo, avatar, ping',
  'Juegos y economía': '8ball, coinflip, rps, roll, trivia, ship, work, bal',
  'Interacción': 'kiss, hug, slap, pat, poke, cuddle, kill, cry, dance'
};
command('help', 'Muestra los comandos disponibles.', async ({ message, client }) => {
  const embeds = Object.entries(groups).map(([category, names]) => new EmbedBuilder().setColor(0xE74C3C).setTitle(category).setDescription(names.split(', ').map(n => {
    const c = client.commands.get(n); return `\`.${n}\` — ${c?.description || 'Comando'}`;
  }).join('\n')));
  await message.reply({ content: 'Todos los comandos usan exclusivamente el prefijo `.`.', embeds, allowedMentions: { repliedUser: false } });
}, ['ayuda']);
command('ticket', 'Crea un canal privado de soporte.', async ({ message }) => {
  const existing = message.guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.topic?.includes(`burning-ticket:${message.author.id}`));
  if (existing) return message.reply(`Ya tienes un ticket abierto: ${existing}`);
  requireBot(message, P.ManageChannels);
  const overwrites = [
    { id: message.guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: message.author.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles] },
    { id: message.guild.members.me.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels] }
  ];
  for (const roleId of staffRoleIds()) if (message.guild.roles.cache.has(roleId)) overwrites.push({ id: roleId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] });
  const category = process.env.TICKET_CATEGORY_ID && message.guild.channels.cache.get(process.env.TICKET_CATEGORY_ID);
  const channel = await message.guild.channels.create({ name: `ticket-${message.author.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90), type: ChannelType.GuildText, topic: `burning-ticket:${message.author.id}`, parent: category?.type === ChannelType.GuildCategory ? category.id : undefined, permissionOverwrites: overwrites, reason: `Ticket solicitado por ${message.author.tag}` });
  await channel.send({ content: `🎫 Hola ${message.author}, el equipo de soporte te atenderá aquí. Usa \.close para solicitar el cierre.`, allowedMentions: { users: [message.author.id] } });
  await message.reply(`Ticket creado: ${channel}`);
});
command('close', 'Solicita el cierre con confirmación.', async ({ message, args }) => {
  const marker = message.channel.topic?.match(/burning-ticket:(\d{17,20})/);
  if (!marker) return message.reply('Este comando solo funciona dentro de un ticket creado por el bot.');
  const isOwner = marker[1] === message.author.id;
  if (!isOwner && !message.member.permissions.has(P.ManageChannels)) return message.reply('Solo quien abrió el ticket o el staff puede cerrarlo.');
  const key = message.channel.id;
  if ((args[0] || '').toLowerCase() === 'cancel') { pendingCloses.delete(key); return message.reply('Cierre cancelado.'); }
  if ((args[0] || '').toLowerCase() === 'confirm') {
    const pending = pendingCloses.get(key); if (!pending || pending.userId !== message.author.id || pending.expires < Date.now()) return message.reply('No hay una confirmación activa tuya. Escribe `.close` primero.');
    pendingCloses.delete(key); await message.reply('Cerrando el ticket…'); setTimeout(() => message.channel.delete(`Ticket cerrado por ${message.author.tag}`).catch(() => {}), 1500); return;
  }
  pendingCloses.set(key, { userId: message.author.id, expires: Date.now() + 30000 });
  setTimeout(() => { const p = pendingCloses.get(key); if (p?.expires <= Date.now()) pendingCloses.delete(key); }, 31000);
  await message.reply('¿Cerrar y eliminar este ticket? Escribe `.close confirm` en 30 segundos, o `.close cancel`.');
});
command('report', 'Envía un reporte privado al canal de staff.', async ({ message, args, client }) => {
  const member = memberMention(message), reason = args.slice(1).join(' ');
  if (!member || !reason) return message.reply('Uso: `.report @usuario <motivo>`');
  const channel = process.env.REPORT_CHANNEL_ID && await client.channels.fetch(process.env.REPORT_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return message.reply('El canal de reportes no está configurado. Pide al administrador que defina REPORT_CHANNEL_ID.');
  await channel.send({ embeds: [new EmbedBuilder().setColor(0xE67E22).setTitle('Nuevo reporte').addFields({ name: 'Reportado', value: `${member.user.tag} (${member.id})` }, { name: 'Reporta', value: `${message.author.tag} (${message.author.id})` }, { name: 'Motivo', value: reason }).setFooter({ text: `Servidor: ${message.guild.name} (${message.guild.id})` }).setTimestamp()] });
  await message.reply('✅ Tu reporte fue enviado al equipo de staff.');
});
command('userinfo', 'Muestra información de un usuario.', async ({ message }) => {
  const member = memberMention(message) || message.member;
  const roles = member.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.toString()).slice(0, 15);
  const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`Información de ${member.user.tag}`).setThumbnail(member.displayAvatarURL({ size: 512 })).addFields(
    { name: 'ID', value: member.id, inline: true },
    { name: 'Cuenta creada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true },
    { name: 'Se unió', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Desconocido', inline: true },
    { name: 'Roles', value: roles.join(', ') || 'Ninguno' }
  ); await message.reply({ embeds: [embed] });
});
command('serverinfo', 'Muestra estadísticas del servidor.', async ({ message }) => {
  const g = message.guild;
  const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(g.name).setThumbnail(g.iconURL({ size: 512 })).addFields(
    { name: 'ID', value: g.id, inline: true }, { name: 'Miembros', value: String(g.memberCount), inline: true },
    { name: 'Canales', value: String(g.channels.cache.size), inline: true }, { name: 'Roles', value: String(g.roles.cache.size), inline: true },
    { name: 'Creado', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:F>`, inline: true }
  ); await message.reply({ embeds: [embed] });
});
command('avatar', 'Muestra el avatar en tamaño grande.', async ({ message }) => {
  const user = message.mentions.users.first() || message.author;
  const url = user.displayAvatarURL({ size: 4096, extension: 'png' });
  await message.reply({ content: `[Abrir o descargar avatar de ${user.tag}](${url})`, embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle(user.tag).setImage(url)] });
});
command('ping', 'Muestra latencia de Discord y del bot.', async ({ message, client }) => {
  const sent = await message.reply('Midiendo latencia…');
  await sent.edit(`🏓 API: ${Math.round(client.ws.ping)} ms · Respuesta: ${sent.createdTimestamp - message.createdTimestamp} ms`);
});
module.exports = commands;
