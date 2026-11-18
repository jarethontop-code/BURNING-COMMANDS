const {
  ApplicationCommandOptionType: O,
  PermissionFlagsBits: P,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  REST,
  Routes
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const STORE = path.join(__dirname, '..', 'data.json');
const defaults = { guilds: {}, warnings: {}, tickets: {}, suggestions: {} };
let store = defaults;
try { if (fs.existsSync(STORE)) store = { ...defaults, ...JSON.parse(fs.readFileSync(STORE, 'utf8')) }; }
catch (error) { console.error('No se pudo leer data.json:', error.message); }
function save() { const tmp = `${STORE}.tmp`; fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 }); fs.renameSync(tmp, STORE); }
function settings(guildId) { return store.guilds[guildId] ||= { antilink: false, antispam: false, antibot: false, ticketRoleId: null, ticketCategoryId: null }; }
function warnings(gid, uid) { return store.warnings[`${gid}:${uid}`] || []; }
function embed(title, description, color = 0xD83C3E) { return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp(); }
const userOption = (name = 'usuario', description = 'Miembro del servidor', required = true) => ({ type: O.User, name, description, required });
const strOption = (name, description, required = true, choices) => ({ type: O.String, name, description, required, ...(choices ? { choices } : {}) });
const intOption = (name, description, required = true, min_value, max_value) => ({ type: O.Integer, name, description, required, ...(min_value !== undefined ? { min_value } : {}), ...(max_value !== undefined ? { max_value } : {}) });
const boolOption = (name, description) => ({ type: O.Boolean, name, description, required: false });
const specs = [];
function define(name, description, options, permission, run) { specs.push({ name, description, options: options || [], permission, run }); }
const reason = strOption('razon', 'Motivo de la acción', false);
const target = userOption();
const targetArgs = (ctx, index = 0) => ctx.targets[index] || null;
function staff(ctx, permission) { return ctx.member?.permissions?.has(permission) || false; }
function botPerm(ctx, permission) { if (!ctx.guild.members.me?.permissions.has(permission)) throw new Error('Me falta el permiso necesario. Revisa mis permisos y la jerarquía de roles.'); }
function checkTarget(ctx, member) {
  if (!member) throw new Error('No encontré a ese miembro. Menciónalo correctamente o selecciónalo en el comando slash.');
  if (member.id === ctx.user.id) throw new Error('No puedes usar esta acción sobre ti mismo.');
  if (member.id === ctx.guild.ownerId) throw new Error('Esta acción no se puede aplicar al propietario del servidor.');
}
function channelText(channel) { return channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement; }
function parsePrefixTargets(message) {
  const ids = [...message.content.matchAll(/<@!?(\d{17,20})>/g)].map(m => m[1]);
  return ids;
}
function ticketOwner(channel) { return channel.topic?.match(/burning-ticket:(\d{17,20})/)?.[1] || null; }

// Moderación
const staffOption = [target, reason];
define('purge', 'Borra mensajes recientes (1-100).', [intOption('cantidad', 'Número de mensajes', true, 1, 100)], P.ManageMessages, async c => {
  const amount = c.value('cantidad', 0); if (!Number.isInteger(amount) || amount < 1 || amount > 100) throw new Error('Indica una cantidad entre 1 y 100.');
  botPerm(c, P.ManageMessages); const deleted = await c.channel.bulkDelete(amount, true);
  await c.reply({ embeds: [embed('Mensajes eliminados', `Se eliminaron **${deleted.size}** de ${amount} mensajes.`, 0x2ECC71)] });
});
define('purgeuser', 'Borra mensajes recientes de un usuario.', [target, intOption('cantidad', 'Número de mensajes que se revisarán (1-100)', true, 1, 100)], P.ManageMessages, async c => {
  const user = c.userOption('usuario'); const amount = c.value('cantidad', 1);
  if (!user || amount < 1 || amount > 100) throw new Error('Selecciona un usuario y una cantidad de 1 a 100.');
  botPerm(c, P.ManageMessages); const messages = await c.channel.messages.fetch({ limit: amount });
  const deleted = await c.channel.bulkDelete(messages.filter(m => m.author.id === user.id), true);
  await c.reply({ embeds: [embed('Mensajes eliminados', `Se eliminaron **${deleted.size}** mensajes de ${user}.`, 0x2ECC71)] });
});
async function kick(c) { const m = targetArgs(c); checkTarget(c, m); if (!m.kickable) throw new Error('No puedo expulsar a ese miembro por la jerarquía de roles.'); botPerm(c, P.KickMembers); await m.kick(c.value('razon') || `Acción de ${c.user.tag}`); await c.reply({ embeds: [embed('Miembro expulsado', `${m.user.tag} fue expulsado.`)] }); }
define('kick', 'Expulsa a un miembro del servidor.', staffOption, P.KickMembers, kick);
async function ban(c, soft = false) { const m = targetArgs(c); checkTarget(c, m); if (!m.bannable) throw new Error('No puedo banear a ese miembro por la jerarquía de roles.'); botPerm(c, P.BanMembers); const why = c.value('razon') || `Acción de ${c.user.tag}`; await m.ban({ reason: why, ...(soft ? { deleteMessageSeconds: 86400 } : {}) }); if (soft) await c.guild.members.unban(m.id, `Softban de ${c.user.tag}`); await c.reply({ embeds: [embed(soft ? 'Softban completado' : 'Miembro baneado', `${m.user.tag}${soft ? ' fue expulsado y sus mensajes recientes eliminados.' : ' fue baneado.'}`)] }); }
define('ban', 'Banea permanentemente a un miembro.', staffOption, P.BanMembers, c => ban(c));
define('softban', 'Banea y desbanea para expulsar y borrar mensajes recientes.', staffOption, P.BanMembers, c => ban(c, true));
define('unban', 'Retira un baneo mediante ID.', [strOption('id_usuario', 'ID de Discord', true)], P.BanMembers, async c => { const id = c.value('id_usuario', 0); if (!/^\d{17,20}$/.test(id)) throw new Error('El ID debe contener entre 17 y 20 dígitos.'); botPerm(c, P.BanMembers); await c.guild.members.unban(id); await c.reply({ embeds: [embed('Baneo retirado', `Se retiró el baneo de ${id}.`, 0x2ECC71)] }); });
define('mute', 'Aplica timeout temporal (ej. 10m, 2h, 1d; máximo 28d).', [target, strOption('tiempo', 'Ejemplo: 10m, 2h o 1d', true), reason], P.ModerateMembers, async c => { const m = targetArgs(c); checkTarget(c, m); const duration = c.value('tiempo', 1); const ms = parseDuration(duration); if (!ms) throw new Error('Tiempo inválido. Usa valores como 10m, 2h o 1d (máximo 28 días).'); if (!m.moderatable) throw new Error('No puedo aplicar timeout por la jerarquía de roles.'); botPerm(c, P.ModerateMembers); await m.timeout(ms, c.value('razon') || `Timeout de ${c.user.tag}`); await c.reply({ embeds: [embed('Timeout aplicado', `${m.user.tag} — ${duration}`)] }); });
define('unmute', 'Retira el timeout de un miembro.', [target], P.ModerateMembers, async c => { const m = targetArgs(c); checkTarget(c, m); if (!m.moderatable) throw new Error('No puedo retirar el timeout por la jerarquía de roles.'); botPerm(c, P.ModerateMembers); await m.timeout(null, `Timeout retirado por ${c.user.tag}`); await c.reply({ embeds: [embed('Timeout retirado', `Se retiró el aislamiento de ${m.user.tag}.`, 0x2ECC71)] }); });
define('warn', 'Registra una advertencia formal.', [target, reason], P.ManageMessages, async c => { const m = targetArgs(c); checkTarget(c, m); const why = c.value('razon'); if (!why?.trim()) throw new Error('Debes indicar la razón.'); const key = `${c.guild.id}:${m.id}`; (store.warnings[key] ||= []).push({ reason: why, moderatorId: c.user.id, at: new Date().toISOString() }); save(); await c.reply({ embeds: [embed('Advertencia registrada', `${m.user.tag} tiene **${store.warnings[key].length}** advertencia(s).\nMotivo: ${why}`)] }); });
define('warnings', 'Consulta las advertencias de un miembro.', [target], P.ManageMessages, async c => { const m = targetArgs(c); checkTarget(c, m); const list = warnings(c.guild.id, m.id); const text = list.slice(-10).map((w, i) => `**${list.length - Math.min(10, list.length) + i + 1}.** ${w.reason} — <@${w.moderatorId}>`).join('\n') || 'No tiene advertencias.'; await c.reply({ embeds: [embed(`Advertencias de ${m.user.tag} (${list.length})`, text)] }); });
define('clearwarns', 'Limpia las advertencias de un miembro.', [target], P.ManageMessages, async c => { const m = targetArgs(c); checkTarget(c, m); delete store.warnings[`${c.guild.id}:${m.id}`]; save(); await c.reply({ embeds: [embed('Historial limpiado', `Se borraron las advertencias de ${m.user.tag}.`, 0x2ECC71)] }); });
define('nick', 'Cambia el apodo de un miembro.', [target, strOption('nuevo_apodo', 'Nuevo apodo (1-32 caracteres)', true)], P.ManageNicknames, async c => { const m = targetArgs(c); checkTarget(c, m); const nick = c.value('nuevo_apodo', 1); if (!nick?.trim() || nick.length > 32) throw new Error('El apodo debe tener entre 1 y 32 caracteres.'); if (!m.manageable) throw new Error('No puedo cambiar ese apodo por la jerarquía de roles.'); botPerm(c, P.ManageNicknames); await m.setNickname(nick, `Apodo cambiado por ${c.user.tag}`); await c.reply({ embeds: [embed('Apodo actualizado', `${m.user.tag}: **${nick}**`, 0x2ECC71)] }); });

// Seguridad y control
for (const [name, title, setting] of [['antilink', 'Antilink', 'antilink'], ['antispam', 'Antispam', 'antispam'], ['antibot', 'Antibot', 'antibot']]) define(name, `${title}: activa o desactiva la protección.`, [strOption('estado', 'Activar o desactivar', true, [{ name: 'on', value: 'on' }, { name: 'off', value: 'off' }])], P.ManageGuild, async c => { const value = c.value('estado'); settings(c.guild.id)[setting] = value === 'on'; save(); await c.reply({ embeds: [embed(`${title} ${value === 'on' ? 'activado' : 'desactivado'}`, value === 'on' && setting === 'antibot' ? 'Se expulsarán bots añadidos por personas sin permiso de gestionar el servidor.' : 'La configuración se guardó.', 0x2ECC71)] }); });
async function setLock(channel, guild, locked) { await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: locked ? false : null }); }
define('lock', 'Bloquea el canal para @everyone.', [], P.ManageChannels, async c => { botPerm(c, P.ManageChannels); await setLock(c.channel, c.guild, true); await c.reply({ embeds: [embed('Canal bloqueado', 'Se bloqueó el envío de mensajes para @everyone.')] }); });
define('unlock', 'Desbloquea el canal para @everyone.', [], P.ManageChannels, async c => { botPerm(c, P.ManageChannels); await setLock(c.channel, c.guild, false); await c.reply({ embeds: [embed('Canal desbloqueado', 'Se restauró el permiso de envío de mensajes para @everyone.', 0x2ECC71)] }); });
define('lockall', 'Bloquea todos los canales de texto del servidor.', [], P.ManageChannels, async c => { botPerm(c, P.ManageChannels); const channels = c.guild.channels.cache.filter(ch => channelText(ch) && ch.permissionOverwrites); let done = 0; for (const ch of channels.values()) { try { await setLock(ch, c.guild, true); done++; } catch (e) { console.warn(`No se pudo bloquear ${ch.id}:`, e.message); } } await c.reply({ embeds: [embed('Bloqueo de emergencia', `Bloqueados ${done}/${channels.size} canales.`)] }); });
define('unlockall', 'Desbloquea todos los canales de texto del servidor.', [], P.ManageChannels, async c => { botPerm(c, P.ManageChannels); const channels = c.guild.channels.cache.filter(ch => channelText(ch) && ch.permissionOverwrites); let done = 0; for (const ch of channels.values()) { try { await setLock(ch, c.guild, false); done++; } catch (e) { console.warn(`No se pudo desbloquear ${ch.id}:`, e.message); } } await c.reply({ embeds: [embed('Canales desbloqueados', `Desbloqueados ${done}/${channels.size} canales.`, 0x2ECC71)] }); });
define('slowmode', 'Establece el modo lento (0-21600 segundos).', [intOption('segundos', '0 para desactivar', true, 0, 21600)], P.ManageChannels, async c => { botPerm(c, P.ManageChannels); const n = c.value('segundos', 0); await c.channel.setRateLimitPerUser(n); await c.reply({ embeds: [embed('Modo lento actualizado', `${n} segundo(s).`, 0x2ECC71)] }); });
const pendingNukes = new Map();
define('nuke', 'Clona y elimina este canal (acción irreversible).', [boolOption('confirmar', 'Confirmo la eliminación irreversible del canal')], P.ManageChannels, async c => { botPerm(c, P.ManageChannels); const key = c.channel.id; const confirmed = c.isSlash ? c.value('confirmar') === true : c.args[0] === 'confirm'; if (!confirmed) { pendingNukes.set(key, { userId: c.user.id, expires: Date.now() + 20000 }); throw new Error('Esto elimina el historial de forma irreversible. Ejecuta `.nuke confirm` o `/nuke confirmar:true` en 20 segundos.'); } const pending = pendingNukes.get(key); if (!pending || pending.userId !== c.user.id || pending.expires < Date.now()) throw new Error('No hay una confirmación activa tuya. Ejecuta primero `.nuke` o `/nuke`.'); pendingNukes.delete(key); const old = c.channel; const fresh = await old.clone({ reason: `Nuke confirmado por ${c.user.tag}` }); await fresh.setPosition(old.position).catch(() => {}); await old.delete(`Nuke confirmado por ${c.user.tag}`); await fresh.send({ embeds: [embed('Canal recreado', `Canal limpiado por ${c.user}.`)] }); if (c.isSlash) await c.reply({ content: `Canal recreado: ${fresh}`, ephemeral: true }); });

// Tickets, soporte y administración
const helpDescription = '**Moderación**\n`.purge`, `.purgeuser`, `.kick`, `.ban`, `.softban`, `.unban`, `.mute`, `.unmute`, `.warn`, `.warnings`, `.clearwarns`, `.nick`\n\n**Seguridad**\n`.antilink`, `.antispam`, `.antibot`, `.lock`, `.unlock`, `.lockall`, `.unlockall`, `.slowmode`, `.nuke`\n\n**Soporte**\n`.ticket-panel`, `.ticket-rol`, `.ticket-categoria`, `.adduser`, `.removeuser`, `.close`, `.report`, `.suggest`, `.userinfo`, `.serverinfo`, `.ping`, `.help`\n\n**Interacción**\n`.kiss`, `.hug`, `.slap`, `.pat`, `.poke`, `.cuddle`, `.bite`, `.highfive`, `.punch`, `.cry`, `.dance`, `.blush`, `.sleep`, `.happy`';
define('help', 'Muestra los comandos disponibles.', [], null, async c => c.reply({ embeds: [embed('BURNING COMMANDS · Ayuda', helpDescription, 0x5865F2)] }));
define('ticket-panel', 'Publica un panel para abrir tickets.', [], P.ManageGuild, async c => { const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('burning:ticket:create').setLabel('Crear ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary)); await c.channel.send({ embeds: [embed('Centro de soporte', 'Pulsa el botón para abrir un canal privado con el equipo de soporte.', 0x5865F2)], components: [row] }); await c.reply({ content: 'Panel publicado.', ephemeral: true }); });
define('ticket-rol', 'Configura el rol que verá los tickets.', [strOption('rol', 'Mención o ID del rol; vacío para quitarlo', false)], P.ManageGuild, async c => { const input = c.value('rol') || c.args.join(' '); const id = input?.match(/\d{17,20}/)?.[0]; if (input && (!id || !c.guild.roles.cache.has(id))) throw new Error('Menciona un rol válido o indica su ID.'); settings(c.guild.id).ticketRoleId = id || null; save(); await c.reply({ content: id ? `Rol de soporte configurado: <@&${id}>` : 'Se quitó el rol de soporte.', ephemeral: true }); });
define('ticket-categoria', 'Configura la categoría de tickets; omite para crear una automáticamente.', [strOption('categoria', 'ID o nombre de categoría; vacío para automática', false)], P.ManageGuild, async c => { const input = c.value('categoria') || c.args.join(' '); let category = null; if (input) { const id = input.match(/\d{17,20}/)?.[0]; category = id ? c.guild.channels.cache.get(id) : c.guild.channels.cache.find(ch => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase() === input.toLowerCase()); if (!category || category.type !== ChannelType.GuildCategory) throw new Error('No encontré esa categoría. Usa su nombre o ID.'); } settings(c.guild.id).ticketCategoryId = category?.id || null; save(); await c.reply({ content: category ? `Categoría configurada: ${category.name}` : 'Se creará o utilizará automáticamente la categoría «tickets».', ephemeral: true }); });
async function createTicket(c, user = c.user) { const existing = c.guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ticketOwner(ch) === user.id); if (existing) return existing; let categoryId = settings(c.guild.id).ticketCategoryId; let category = categoryId ? c.guild.channels.cache.get(categoryId) : null; if (!category) { category = c.guild.channels.cache.find(ch => ch.type === ChannelType.GuildCategory && ch.name.toLowerCase() === 'tickets'); if (!category) category = await c.guild.channels.create({ name: 'tickets', type: ChannelType.GuildCategory, reason: 'Categoría automática de soporte' }); settings(c.guild.id).ticketCategoryId = category.id; save(); } const overwrites = [{ id: c.guild.roles.everyone.id, deny: [P.ViewChannel] }, { id: user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles] }, { id: c.guild.members.me.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels] }]; const roleId = settings(c.guild.id).ticketRoleId; if (roleId && c.guild.roles.cache.has(roleId)) overwrites.push({ id: roleId, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] }); return c.guild.channels.create({ name: `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90), type: ChannelType.GuildText, parent: category.id, topic: `burning-ticket:${user.id}`, permissionOverwrites: overwrites, reason: `Ticket de ${user.tag}` }); }
define('ticket', 'Abre un ticket privado de soporte.', [], null, async c => { botPerm(c, P.ManageChannels); const ch = await createTicket(c); if (!ch.lastMessageId) await ch.send({ embeds: [embed('Ticket de soporte', `Hola <@${c.user.id}>, explica tu consulta y el staff te ayudará. Usa \.close para cerrar.`, 0x5865F2)], allowedMentions: { users: [c.user.id] } }); await c.reply({ content: `Ticket creado: ${ch}`, ephemeral: true }); });
define('adduser', 'Añade un miembro al ticket actual.', [target], P.ManageChannels, async c => { const owner = ticketOwner(c.channel); if (!owner) throw new Error('Este canal no es un ticket.'); if (owner !== c.user.id && !staff(c, P.ManageChannels)) throw new Error('Solo quien abrió el ticket o el staff puede modificarlo.'); const u = c.userOption('usuario'); if (!u) throw new Error('Selecciona un usuario.'); botPerm(c, P.ManageChannels); await c.channel.permissionOverwrites.edit(u.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); await c.reply({ embeds: [embed('Usuario añadido', `${u} ya puede ver este ticket.`, 0x2ECC71)] }); });
define('removeuser', 'Retira un miembro del ticket actual.', [target], P.ManageChannels, async c => { const owner = ticketOwner(c.channel); if (!owner) throw new Error('Este canal no es un ticket.'); if (owner !== c.user.id && !staff(c, P.ManageChannels)) throw new Error('Solo quien abrió el ticket o el staff puede modificarlo.'); const u = c.userOption('usuario'); if (!u) throw new Error('Selecciona un usuario.'); if (u.id === owner) throw new Error('No puedes retirar al propietario del ticket.'); botPerm(c, P.ManageChannels); await c.channel.permissionOverwrites.delete(u.id).catch(() => {}); await c.reply({ embeds: [embed('Usuario retirado', `${u} ya no puede ver este ticket.`, 0x2ECC71)] }); });
define('close', 'Cierra ticket y guarda una transcripción de texto.', [], null, async c => { const owner = ticketOwner(c.channel); if (!owner) throw new Error('Este canal no es un ticket.'); if (owner !== c.user.id && !staff(c, P.ManageChannels)) throw new Error('Solo el propietario o el staff pueden cerrar el ticket.'); botPerm(c, P.ManageChannels); const messages = await c.channel.messages.fetch({ limit: 100 }); const transcript = [...messages.values()].reverse().map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || '[adjunto/embed]'}`).join('\n'); const fileName = `ticket-${c.channel.id}.txt`; const attachment = { attachment: Buffer.from(transcript || 'Ticket vacío', 'utf8'), name: fileName }; const logId = process.env.TICKET_LOG_CHANNEL_ID; if (logId) { const log = await c.client.channels.fetch(logId).catch(() => null); if (log?.isTextBased()) await log.send({ content: `Transcripción del ticket #${c.channel.name}`, files: [attachment] }); } else { await c.channel.send({ content: 'Transcripción guardada antes del cierre:', files: [attachment] }); } await c.reply({ content: 'Ticket cerrado. La transcripción se guardó en el canal de registros configurado (o aquí).', ephemeral: true }); setTimeout(() => c.channel.delete(`Ticket cerrado por ${c.user.tag}`).catch(() => {}), 2500); });
define('report', 'Envía un reporte privado al staff.', [target, strOption('motivo', 'Describe el reporte', true)], null, async c => { const u = c.userOption('usuario'); const why = c.value('motivo') || c.args.slice(1).join(' '); if (!u || !why) throw new Error('Uso: `.report @usuario <motivo>`.'); const ch = process.env.REPORT_CHANNEL_ID && await c.client.channels.fetch(process.env.REPORT_CHANNEL_ID).catch(() => null); if (!ch?.isTextBased()) throw new Error('REPORT_CHANNEL_ID no está configurado correctamente.'); await ch.send({ embeds: [embed('Nuevo reporte', `**Reportado:** ${u.tag} (${u.id})\n**Reporta:** ${c.user.tag} (${c.user.id})\n**Motivo:** ${why}\n**Servidor:** ${c.guild.name}`)] }); await c.reply({ content: 'Reporte enviado de forma privada al staff.', ephemeral: true }); });
define('suggest', 'Publica una sugerencia para votación.', [strOption('idea', 'Tu sugerencia', true)], null, async c => { const idea = c.value('idea') || c.args.join(' '); if (!idea?.trim()) throw new Error('Escribe una idea para sugerir.'); const sent = await c.channel.send({ embeds: [embed('Nueva sugerencia', `${idea}\n\nPropuesta por ${c.user}`, 0x3498DB)] }); await sent.react('👍'); await sent.react('👎'); await c.reply({ content: 'Sugerencia publicada para votación.', ephemeral: true }); });
define('userinfo', 'Muestra información de un miembro.', [userOption('usuario', 'Miembro (opcional)', false)], null, async c => { const u = c.userOption('usuario') || c.user; const m = await c.guild.members.fetch(u.id).catch(() => null); const fields = [{ name: 'ID', value: u.id, inline: true }, { name: 'Cuenta creada', value: `<t:${Math.floor(u.createdTimestamp / 1000)}:F>`, inline: true }]; if (m) fields.push({ name: 'Se unió', value: m.joinedTimestamp ? `<t:${Math.floor(m.joinedTimestamp / 1000)}:F>` : 'Desconocido', inline: true }, { name: 'Roles', value: m.roles.cache.filter(r => r.id !== c.guild.id).map(r => r.toString()).slice(0, 15).join(', ') || 'Ninguno' }); await c.reply({ embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle(u.tag).setThumbnail(u.displayAvatarURL({ size: 512 })).addFields(fields)] }); });
define('serverinfo', 'Muestra estadísticas del servidor.', [], null, async c => { const g = c.guild; await c.reply({ embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle(g.name).setThumbnail(g.iconURL({ size: 512 })).addFields({ name: 'ID', value: g.id, inline: true }, { name: 'Miembros', value: String(g.memberCount), inline: true }, { name: 'Canales', value: String(g.channels.cache.size), inline: true }, { name: 'Roles', value: String(g.roles.cache.size), inline: true }, { name: 'Creado', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:F>`, inline: true })] }); });
define('ping', 'Muestra la latencia del bot.', [], null, async c => c.reply({ embeds: [embed('Pong 🏓', `Latencia de API: **${Math.round(c.client.ws.ping)} ms**`, 0x2ECC71)] }));

// Reacciones con GIFs de Nekos.best
const actions = { kiss: ['le dio un dulce beso a', 'kiss'], hug: ['le dio un fuerte abrazo a', 'hug'], slap: ['le dio una bofetada a', 'slap'], pat: ['acarició la cabeza de', 'pat'], poke: ['le picó la mejilla a', 'poke'], cuddle: ['se acurrucó junto a', 'cuddle'], bite: ['mordió suavemente a', 'bite'], highfive: ['chocó los cinco con', 'highfive'], punch: ['le dio un puñetazo de broma a', 'punch'] };
for (const [name, [text, endpoint]] of Object.entries(actions)) define(name, `Reacción ${name} con GIF.`, [target], null, async c => { const u = c.userOption('usuario'); if (!u) throw new Error('Selecciona o menciona a un usuario.'); const res = await fetch(`https://nekos.best/api/v2/${endpoint}`, { signal: AbortSignal.timeout(5000) }); if (!res.ok) throw new Error('El servicio de GIFs no está disponible ahora.'); const image = (await res.json()).results?.[0]?.url; if (!image) throw new Error('No se encontró un GIF para esta acción.'); const msg = `${c.user} ${text} ${u}.`; await c.public({ content: msg, embeds: [new EmbedBuilder().setColor(0xE74C3C).setImage(image)], allowedMentions: { users: [c.user.id, u.id] } }); await c.ackIfNeeded(); });
for (const [name, text, endpoint] of [['cry', 'se puso a llorar 😢', 'cry'], ['dance', 'se puso a bailar 💃', 'dance'], ['blush', 'se sonrojó 😊', 'blush'], ['sleep', 'se quedó dormido 💤', 'sleep'], ['happy', 'está muy feliz ✨', 'happy']]) define(name, `Reacción ${name} con GIF.`, [], null, async c => { const res = await fetch(`https://nekos.best/api/v2/${endpoint}`, { signal: AbortSignal.timeout(5000) }); if (!res.ok) throw new Error('El servicio de GIFs no está disponible ahora.'); const image = (await res.json()).results?.[0]?.url; if (!image) throw new Error('No se encontró un GIF.'); await c.public({ content: `${c.user} ${text}`, embeds: [new EmbedBuilder().setColor(0xE74C3C).setImage(image)], allowedMentions: { users: [c.user.id] } }); await c.ackIfNeeded(); });

function parseDuration(value) { const matches = [...String(value || '').matchAll(/(\d+)([smhd])/gi)]; if (!matches.length || matches.map(m => m[0]).join('').toLowerCase() !== value.toLowerCase()) return null; const total = matches.reduce((n, m) => n + Number(m[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()]), 0); return total >= 1000 && total <= 28 * 86400000 ? total : null; }
function optionValue(interaction, option) { if (option.type === O.User) return interaction.options.getMember(option.name) || interaction.options.getUser(option.name); if (option.type === O.Integer) return interaction.options.getInteger(option.name); if (option.type === O.Boolean) return interaction.options.getBoolean(option.name); return interaction.options.getString(option.name); }
function makeContext({ client, interaction, message, spec, args }) {
  const isSlash = Boolean(interaction); const guild = isSlash ? interaction.guild : message.guild; const user = isSlash ? interaction.user : message.author; const member = isSlash ? interaction.member : message.member; const channel = isSlash ? interaction.channel : message.channel;
  const optionMap = new Map((spec.options || []).map((opt, i) => [opt.name, isSlash ? optionValue(interaction, opt) : args[i]]));
  const targets = [];
  if (isSlash) for (const opt of spec.options || []) if (opt.type === O.User) { const value = interaction.options.getMember(opt.name); targets.push(value || (interaction.options.getUser(opt.name) ? guild.members.cache.get(interaction.options.getUser(opt.name).id) : null)); }
  else for (const id of parsePrefixTargets(message)) targets.push(guild.members.cache.get(id) || null);
  const value = (name, position) => optionMap.get(name) ?? args[position];
  const userOptionValue = name => { const opt = (spec.options || []).find(o => o.name === name && o.type === O.User); if (!opt) return null; if (isSlash) return interaction.options.getUser(name); const idx = (spec.options || []).filter(o => o.type === O.User).indexOf(opt); return targets[idx]?.user || null; };
  let replied = false;
  const reply = async payload => {
    const data = typeof payload === 'string' ? { content: payload } : { ...payload };
    if (isSlash) { if (interaction.deferred || interaction.replied || replied) { await interaction.followUp({ ...data, ephemeral: data.ephemeral ?? true }); } else { await interaction.reply({ ...data, ephemeral: data.ephemeral ?? true }); replied = true; } }
    else await message.reply(data);
  };
  const publicSend = async payload => channel.send(payload);
  return { client, interaction, message, isSlash, guild, user, member, channel, args, targets, value, userOption: userOptionValue, reply, public: publicSend, ackIfNeeded: async () => { if (isSlash && !interaction.replied && !interaction.deferred) { await interaction.reply({ content: 'Listo.', ephemeral: true }); replied = true; } }, get replied() { return replied; } };
}
function prefixArguments(spec, raw, message) {
  const mentions = parsePrefixTargets(message); let mentionIndex = 0;
  return (spec.options || []).map(opt => {
    if (opt.type === O.User) return message.guild.members.cache.get(mentions[mentionIndex++]) || null;
    if (opt.type === O.Integer) { const match = raw.find(x => /^\d+$/.test(x)); if (match) raw.splice(raw.indexOf(match), 1); return match ? Number(match) : null; }
    if (opt.type === O.Boolean) { const i = raw.findIndex(x => ['true', 'false', 'confirm', 'on', 'off'].includes(x.toLowerCase())); if (i < 0) return null; const v = raw.splice(i, 1)[0].toLowerCase(); return ['true', 'confirm', 'on'].includes(v); }
    if (opt.name === 'razon' || opt.name === 'motivo' || opt.name === 'idea' || opt.name === 'nuevo_apodo') return raw.join(' ') || null;
    if (opt.name === 'tiempo' || opt.name === 'id_usuario' || opt.name === 'estado' || opt.name === 'rol' || opt.name === 'categoria') return raw.shift() || null;
    return raw.shift() || null;
  });
}
function contextForPrefix(client, message, spec, raw) {
  const args = prefixArguments(spec, [...raw], message); const ctx = makeContext({ client, message, spec, args: [] });
  // Prefix arguments are also exposed through named option lookups and target resolution.
  const map = new Map((spec.options || []).map((opt, i) => [opt.name, args[i]]));
  ctx.value = (name, position) => map.get(name) ?? args[position];
  ctx.userOption = name => { const opt = (spec.options || []).find(o => o.name === name && o.type === O.User); if (!opt) return null; const m = args[(spec.options || []).indexOf(opt)]; return m?.user || null; };
  ctx.targets = args.filter((v, i) => spec.options?.[i]?.type === O.User);
  return ctx;
}
function slashData() { return specs.map(s => ({ name: s.name, description: s.description.slice(0, 100), options: s.options })); }
async function registerCommands(client) { const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN); const route = process.env.DEV_GUILD_ID ? Routes.applicationGuildCommands(client.user.id, process.env.DEV_GUILD_ID) : Routes.applicationCommands(client.user.id); await rest.put(route, { body: slashData() }); console.log(`Registrados ${specs.length} slash commands${process.env.DEV_GUILD_ID ? ' en el servidor de desarrollo' : ' globalmente'}.`); }
async function run(client, spec, context) {
  if (!context.guild) throw new Error('Este comando solo se puede usar dentro de un servidor.');
  if (spec.permission && !staff(context, spec.permission)) throw new Error('No tienes permiso para usar este comando.');
  await spec.run(context);
}
async function onMessage(client, message) {
  if (!message.guild || message.author.bot || !message.content.startsWith('.')) return;
  const [name, ...raw] = message.content.slice(1).trim().split(/\s+/); const spec = specs.find(s => s.name === name?.toLowerCase()); if (!spec) return;
  try { const context = contextForPrefix(client, message, spec, raw); await run(client, spec, context); }
  catch (error) { console.error(`.${name}:`, error); await message.reply({ embeds: [embed('No se pudo ejecutar el comando', friendlyError(error), 0xE74C3C)], allowedMentions: { repliedUser: false } }).catch(() => {}); }
}
function friendlyError(error) { if (error?.code === 50013 || error?.code === 50001) return 'El bot no tiene los permisos necesarios o su rol está demasiado bajo.'; return error.message || 'Error desconocido.'; }
async function onInteraction(client, interaction) {
  if (interaction.isButton() && interaction.customId === 'burning:ticket:create') {
    try { const guild = interaction.guild; if (!guild) throw new Error('Usa el panel en un servidor.'); const ctx = { guild, user: interaction.user, client }; if (!guild.members.me.permissions.has(P.ManageChannels)) throw new Error('El bot necesita permiso para gestionar canales.'); const channel = await createTicket(ctx); await channel.send({ embeds: [embed('Ticket de soporte', `Hola <@${interaction.user.id}>, explica tu consulta. Usa \.close cuando hayas terminado.`, 0x5865F2)], allowedMentions: { users: [interaction.user.id] } }); await interaction.reply({ content: `Tu ticket: ${channel}`, ephemeral: true }); }
    catch (error) { await interaction.reply({ content: friendlyError(error), ephemeral: true }).catch(() => {}); }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  const spec = specs.find(s => s.name === interaction.commandName); if (!spec) return;
  try { const ctx = makeContext({ client, interaction, spec, args: [] }); await run(client, spec, ctx); }
  catch (error) { console.error(`/${interaction.commandName}:`, error); const payload = { embeds: [embed('No se pudo ejecutar el comando', friendlyError(error), 0xE74C3C)], ephemeral: true }; if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {}); else await interaction.reply(payload).catch(() => {}); }
}
async function onMemberAdd(member) {
  const cfg = settings(member.guild.id); if (!cfg.antibot || !member.user.bot) return;
  try {
    const logs = await member.guild.fetchAuditLogs({ type: 28, limit: 5 });
    const entry = logs.entries.find(e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 15000);
    if (!entry || entry.executor?.id === member.guild.ownerId) return;
    const executor = await member.guild.members.fetch(entry.executor.id).catch(() => null);
    if (!executor || executor.permissions.has(P.ManageGuild)) return;
    if (member.kickable) await member.kick('Antibot: incorporación realizada por una persona sin permiso para gestionar el servidor.');
  } catch (error) { console.error('Antibot no pudo verificar auditoría:', error.message); }
}
module.exports = { specs, registerCommands, onMessage, onInteraction, onMemberAdd, settings, save };
