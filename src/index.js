require('dotenv').config();
const fs = require('node:fs');
const {
  Client, GatewayIntentBits, Partials, PermissionFlagsBits: P,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, REST, Routes, AuditLogEvent
} = require('discord.js');

const STORE = 'data.json';
let data = { guilds: {}, warnings: {}, allowedBots: {} };
try { if (fs.existsSync(STORE)) data = { ...data, ...JSON.parse(fs.readFileSync(STORE, 'utf8')) }; } catch {}
const save = () => fs.writeFileSync(STORE, JSON.stringify(data, null, 2));
const cfg = (guildId) => data.guilds[guildId] ||= { antilink: false, antispam: false, antibot: false, ticketRole: null, ticketCategory: null, reportChannel: null, logChannel: null };
const embed = (title, text, color = 0x5865F2) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(text).setTimestamp();
const ok = (context, text) => context.reply({ embeds: [embed('Acción completada', text, 0x2ECC71)], ephemeral: true });
const fail = (context, text) => context.reply({ embeds: [embed('No se pudo completar', text, 0xE74C3C)], ephemeral: true });

if (!process.env.DISCORD_TOKEN) { console.error('Falta DISCORD_TOKEN en el entorno.'); process.exit(1); }

const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (process.env.ENABLE_PRIVILEGED_INTENTS === 'true') intents.push(GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration);
const client = new Client({ intents, partials: [Partials.Channel, Partials.Message] });

const slash = [];
const prefix = new Map();
function command(name, description, options, permission, run) {
  const spec = { name, description, options: options || [], permission, run };
  slash.push(spec); prefix.set(name, spec);
}
const opt = {
  user: (name = 'usuario', required = true) => ({ type: 6, name, description: 'Selecciona un miembro', required }),
  role: (name = 'rol', required = true) => ({ type: 8, name, description: 'Selecciona un rol', required }),
  channel: (name = 'canal', required = true, types = [ChannelType.GuildText, ChannelType.GuildAnnouncement]) => ({ type: 7, name, description: 'Selecciona un canal', required, channel_types: types }),
  integer: (name, desc, required = true, min, max) => ({ type: 4, name, description: desc, required, ...(min != null ? { min_value: min } : {}), ...(max != null ? { max_value: max } : {}) }),
  string: (name, desc, required = true, choices) => ({ type: 3, name, description: desc, required, ...(choices ? { choices } : {}) }),
  boolean: (name, desc, required = true) => ({ type: 5, name, description: desc, required })
};

function duration(text) {
  if (!/^\d+[smhd]$/i.test(text || '')) return null;
  const n = parseInt(text, 10), u = text.toLowerCase().slice(-1);
  const ms = n * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[u]);
  return ms >= 1000 && ms <= 28 * 86400000 ? ms : null;
}
function memberFromInteraction(i) { return i.options.getMember('usuario') || i.guild.members.cache.get(i.options.getUser('usuario')?.id); }
function value(i, name) { return i.options.get(name)?.value; }
async function requireStaff(i, permission) {
  if (!i.memberPermissions?.has(permission) && !i.member?.permissions?.has(permission)) throw new Error('Necesitas permisos de staff para usar este comando.');
  if (!i.guild.members.me.permissions.has(permission)) throw new Error('El bot no tiene el permiso necesario para esta acción.');
}

// Moderación
command('purge', 'Borra mensajes recientes', [opt.integer('cantidad', 'Cantidad', true, 1, 100)], P.ManageMessages, async c => {
  await requireStaff(c.i, P.ManageMessages);
  const n = c.i ? value(c.i, 'cantidad') : c.argsInt(0);
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('Indica una cantidad entre 1 y 100.');
  const deleted = await c.channel.bulkDelete(n, true); await ok(c, `Se eliminaron **${deleted.size}** mensajes.`);
});
command('purgeuser', 'Borra mensajes de un usuario', [opt.user(), opt.integer('cantidad', 'Cantidad', true, 1, 100)], P.ManageMessages, async c => {
  await requireStaff(c.i, P.ManageMessages); const u = c.i ? memberFromInteraction(c.i) : c.memberAt(0); const n = c.i ? value(c.i, 'cantidad') : c.argsInt(1);
  if (!u) throw new Error('Selecciona o menciona un usuario.');
  if (!n || n > 100) throw new Error('Indica una cantidad entre 1 y 100.');
  const fetched = await c.channel.messages.fetch({ limit: n }); const deleted = await c.channel.bulkDelete(fetched.filter(m => m.author.id === u.id), true);
  await ok(c, `Se eliminaron **${deleted.size}** mensajes de ${u.user.tag}.`);
});
command('kick', 'Expulsa a un miembro', [opt.user(), opt.string('razon', 'Motivo', false)], P.KickMembers, async c => {
  await requireStaff(c.i, P.KickMembers); const u = c.i ? memberFromInteraction(c.i) : c.memberAt(0); if (!u) throw new Error('Selecciona o menciona un usuario.');
  if (!u.kickable) throw new Error('No puedo expulsar a ese miembro por jerarquía de roles.');
  await u.kick(c.i ? value(c.i, 'razon') || `Acción de ${c.user.tag}` : c.rest(1) || `Acción de ${c.user.tag}`); await ok(c, `**${u.user.tag}** fue expulsado.`);
});
command('ban', 'Banea a un miembro', [opt.user(), opt.string('razon', 'Motivo', false)], P.BanMembers, async c => {
  await requireStaff(c.i, P.BanMembers); const u = c.i ? memberFromInteraction(c.i) : c.memberAt(0); if (!u) throw new Error('Selecciona o menciona un usuario.');
  if (!u.bannable) throw new Error('No puedo banear a ese miembro por jerarquía de roles.');
  await u.ban({ reason: c.i ? value(c.i, 'razon') || `Acción de ${c.user.tag}` : c.rest(1) || `Acción de ${c.user.tag}` }); await ok(c, `**${u.user.tag}** fue baneado.`);
});
command('softban', 'Banea y desbanea para borrar mensajes', [opt.user(), opt.string('razon', 'Motivo', false)], P.BanMembers, async c => {
  await requireStaff(c.i, P.BanMembers); const u = c.i ? memberFromInteraction(c.i) : c.memberAt(0); if (!u) throw new Error('Selecciona o menciona un usuario.');
  if (!u.bannable) throw new Error('No puedo aplicar softban por jerarquía de roles.');
  const reason = c.i ? value(c.i, 'razon') || `Acción de ${c.user.tag}` : c.rest(1) || `Acción de ${c.user.tag}`;
  await u.ban({ reason, deleteMessageSeconds: 86400 }); await c.guild.members.unban(u.id, 'Softban completado'); await ok(c, `Softban completado para **${u.user.tag}**.`);
});
command('unban', 'Quita un baneo', [opt.string('id_usuario', 'ID de Discord')], P.BanMembers, async c => {
  await requireStaff(c.i, P.BanMembers); const id = c.i ? value(c.i, 'id_usuario') : c.args[0]; if (!/^\d{17,20}$/.test(id || '')) throw new Error('Indica un ID válido de 17 a 20 dígitos.');
  await c.guild.members.unban(id); await ok(c, `Se retiró el baneo de **${id}**.`);
});
command('mute', 'Aplica timeout', [opt.user(), opt.string('tiempo', 'Ejemplo: 10m, 2h, 1d'), opt.string('razon', 'Motivo', false)], P.ModerateMembers, async c => {
  await requireStaff(c.i, P.ModerateMembers); const u = c.i ? memberFromInteraction(c.i) : c.memberAt(0); const time = c.i ? value(c.i, 'tiempo') : c.args[1];
  if (!u) throw new Error('Selecciona o menciona un usuario.'); const ms = duration(time); if (!ms) throw new Error('Usa 30s, 10m, 2h o 1d (máximo 28 días).');
  if (!u.moderatable) throw new Error('No puedo aplicar timeout por jerarquía de roles.');
  await u.timeout(ms, c.i ? value(c.i, 'razon') || `Timeout de ${c.user.tag}` : c.rest(2)); await ok(c, `**${u.user.tag}** fue silenciado durante ${time}.`);
});
command('unmute', 'Retira el timeout', [opt.user()], P.ModerateMembers, async c => {
  await requireStaff(c.i, P.ModerateMembers); const u = c.i ? memberFromInteraction(c.i) : c.memberAt(0); if (!u) throw new Error('Selecciona o menciona un usuario.');
  if (!u.moderatable) throw new Error('No puedo retirar el timeout por jerarquía de roles.'); await u.timeout(null); await ok(c, `Se retiró el aislamiento de **${u.user.tag}**.`);
});
command('warn', 'Registra una advertencia', [opt.user(), opt.string('razon', 'Motivo')], P.ManageMessages, async c => {
  await requireStaff(c.i, P.ManageMessages); const u = c.i ? memberFromInteraction(c.i) : c.memberAt(0); const reason = c.i ? value(c.i, 'razon') : c.rest(1); if (!u || !reason) throw new Error('Selecciona un usuario y escribe el motivo.');
  const key = `${c.guild.id}:${u.id}`; (data.warnings[key] ||= []).push({ reason, staff: c.user.id, date: new Date().toISOString() }); save(); await ok(c, `Advertencia registrada para **${u.user.tag}** (${data.warnings[key].length} total).`);
});
command('warnings', 'Consulta advertencias', [opt.user()], P.ManageMessages, async c => {
  await requireStaff(c.i, P.ManageMessages); const u = c.i ? memberFromInteraction(c.i) : c.memberAt(0); if (!u) throw new Error('Selecciona o menciona un usuario.');
  const list = data.warnings[`${c.guild.id}:${u.id}`] || []; const text = list.length ? list.slice(-10).map((w,i) => `**${i+1}.** ${w.reason} — <@${w.staff}>`).join('\n') : 'Este usuario no tiene advertencias.';
  await c.reply({ embeds: [embed(`Advertencias de ${u.user.tag}`, text)] , ephemeral: true});
});
command('clearwarns', 'Limpia advertencias', [opt.user()], P.ManageMessages, async c => { await requireStaff(c.i, P.ManageMessages); const u = c.i ? memberFromInteraction(c.i) : c.memberAt(0); if (!u) throw new Error('Selecciona un usuario.'); delete data.warnings[`${c.guild.id}:${u.id}`]; save(); await ok(c, `Se limpiaron las advertencias de **${u.user.tag}**.`); });
command('nick', 'Cambia el apodo', [opt.user(), opt.string('nuevo_apodo', 'Nuevo apodo')], P.ManageNicknames, async c => { await requireStaff(c.i, P.ManageNicknames); const u = c.i ? memberFromInteraction(c.i) : c.memberAt(0); const nick = c.i ? value(c.i, 'nuevo_apodo') : c.rest(1); if (!u || !nick || nick.length > 32) throw new Error('Selecciona un usuario y escribe un apodo de 1 a 32 caracteres.'); if (!u.manageable) throw new Error('No puedo cambiar ese apodo por jerarquía.'); await u.setNickname(nick); await ok(c, `Apodo cambiado a **${nick}**.`); });

// Seguridad
for (const [name, key, title] of [['antilink','antilink','Anti-enlaces'], ['antispam','antispam','Anti-spam'], ['antibot','antibot','Anti-bot']]) {
  command(name, `${title}: activa o desactiva`, [opt.string('estado', 'Estado', true, [{name:'Activado',value:'on'},{name:'Desactivado',value:'off'}])], P.ManageGuild, async c => { await requireStaff(c.i,P.ManageGuild); const state=(c.i?value(c.i,'estado'):c.args[0]||'').toLowerCase(); if (!['on','off'].includes(state)) throw new Error('Usa on o off.'); cfg(c.guild.id)[key]=state==='on'; save(); await ok(c, `**${title}** ${state==='on'?'activado':'desactivado'}.`); });
}
command('lock', 'Bloquea el canal', [], P.ManageChannels, async c => { await requireStaff(c.i,P.ManageChannels); await c.channel.permissionOverwrites.edit(c.guild.roles.everyone,{SendMessages:false}); await ok(c,'El canal fue bloqueado para @everyone.'); });
command('unlock', 'Desbloquea el canal', [], P.ManageChannels, async c => { await requireStaff(c.i,P.ManageChannels); await c.channel.permissionOverwrites.edit(c.guild.roles.everyone,{SendMessages:null}); await ok(c,'El canal fue desbloqueado.',); });
command('lockall', 'Bloquea todos los canales', [], P.ManageChannels, async c => { await requireStaff(c.i,P.ManageChannels); let n=0; for(const ch of c.guild.channels.cache.values()) if([ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(ch.type)){await ch.permissionOverwrites.edit(c.guild.roles.everyone,{SendMessages:false}).catch(()=>{});n++;} await ok(c,`Se bloquearon **${n}** canales.`); });
command('unlockall', 'Desbloquea todos los canales', [], P.ManageChannels, async c => { await requireStaff(c.i,P.ManageChannels); let n=0; for(const ch of c.guild.channels.cache.values()) if([ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(ch.type)){await ch.permissionOverwrites.edit(c.guild.roles.everyone,{SendMessages:null}).catch(()=>{});n++;} await ok(c,`Se desbloquearon **${n}** canales.`); });
command('slowmode', 'Modo lento', [opt.integer('segundos','0 para desactivar',true,0,21600)], P.ManageChannels, async c => { await requireStaff(c.i,P.ManageChannels); const n=c.i?value(c.i,'segundos'):Number(c.args[0]); if(!Number.isInteger(n)||n<0||n>21600)throw new Error('Usa una cantidad entre 0 y 21600 segundos.'); await c.channel.setRateLimitPerUser(n); await ok(c,`Modo lento establecido en **${n}** segundos.`); });
const nukes=new Map();
command('nuke', 'Recrea el canal', [opt.boolean('confirmar','Confirma el borrado irreversible',false)], P.ManageChannels, async c => { await requireStaff(c.i,P.ManageChannels); const confirmed=c.i?value(c.i,'confirmar')===true:c.args[0]?.toLowerCase()==='confirm'; const key=c.channel.id; if(!confirmed){nukes.set(key,{id:c.user.id,time:Date.now()+20000});throw new Error('Acción irreversible. Usa `.nuke confirm` o `/nuke confirmar:true` en 20 segundos.');} const p=nukes.get(key); if(!p||p.id!==c.user.id||p.time<Date.now())throw new Error('Primero inicia la confirmación.'); nukes.delete(key); const old=c.channel; const fresh=await old.clone({reason:`Nuke confirmado por ${c.user.tag}`}); await fresh.setPosition(old.position).catch(()=>{}); await old.delete(`Nuke por ${c.user.tag}`); await fresh.send({embeds:[embed('Canal recreado','El historial anterior fue eliminado.',0xE74C3C)]}); });

// Soporte y configuración
command('help','Muestra todos los comandos',[],null,async c=>c.reply({embeds:[embed('BURNING COMMANDS','**Moderación:** purge, purgeuser, kick, ban, softban, unban, mute, unmute, warn, warnings, clearwarns, nick\n**Seguridad:** antilink, antispam, antibot, lock, unlock, lockall, unlockall, slowmode, nuke\n**Soporte:** ticket-panel, ticket-rol, ticket-categoria, report-channel, ticket-log-channel, adduser, removeuser, close, report, suggest, userinfo, serverinfo, ping\n**Interacción:** kiss, hug, slap, pat, poke, cuddle, bite, highfive, punch, cry, dance, blush, sleep, happy')],ephemeral:true}));
command('ticket-panel','Publica el panel de tickets',[],P.ManageGuild,async c=>{await requireStaff(c.i,P.ManageGuild);const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket:create').setLabel('Crear ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary));await c.channel.send({embeds:[embed('Centro de soporte','Pulsa el botón para abrir un ticket privado.',0x5865F2)],components:[row]});await ok(c,'Panel publicado.');});
command('ticket-rol','Selecciona el rol de soporte',[opt.role()],P.ManageGuild,async c=>{await requireStaff(c.i,P.ManageGuild);const role=c.i?c.i.options.getRole('rol'):c.guild.roles.cache.find(r=>r.id===c.args[0]||r.name===c.args.join(' '));if(!role)throw new Error('Selecciona un rol válido.');cfg(c.guild.id).ticketRole=role.id;save();await ok(c,`Rol de soporte: <@&${role.id}>`);});
command('ticket-categoria','Selecciona la categoría de tickets',[opt.channel('categoria',true,[ChannelType.GuildCategory])],P.ManageGuild,async c=>{await requireStaff(c.i,P.ManageGuild);let category=c.i?c.i.options.getChannel('categoria'):null;if(!category&&c.args.join(' '))category=c.guild.channels.cache.find(ch=>ch.type===ChannelType.GuildCategory&&ch.name.toLowerCase()==c.args.join(' ').toLowerCase());if(!category||category.type!==ChannelType.GuildCategory)throw new Error('Selecciona una categoría válida.');cfg(c.guild.id).ticketCategory=category.id;save();await ok(c,`Categoría de tickets: **${category.name}**`);});
command('report-channel','Selecciona el canal de reportes',[opt.channel('canal')],P.ManageGuild,async c=>{await requireStaff(c.i,P.ManageGuild);const ch=c.i?c.i.options.getChannel('canal'):c.guild.channels.cache.get(c.args[0]?.replace(/[^0-9]/g,''));if(!ch||![ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(ch.type))throw new Error('Selecciona un canal de texto.');cfg(c.guild.id).reportChannel=ch.id;save();await ok(c,`Reportes: ${ch}`);});
command('ticket-log-channel','Selecciona el canal de transcripciones',[opt.channel('canal')],P.ManageGuild,async c=>{await requireStaff(c.i,P.ManageGuild);const ch=c.i?c.i.options.getChannel('canal'):c.guild.channels.cache.get(c.args[0]?.replace(/[^0-9]/g,''));if(!ch||![ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(ch.type))throw new Error('Selecciona un canal de texto.');cfg(c.guild.id).logChannel=ch.id;save();await ok(c,`Transcripciones: ${ch}`);});

async function createTicket(c){const gcfg=cfg(c.guild.id);let cat=gcfg.ticketCategory&&c.guild.channels.cache.get(gcfg.ticketCategory);if(!cat){cat=c.guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&x.name.toLowerCase()==='tickets');if(!cat)cat=await c.guild.channels.create({name:'tickets',type:ChannelType.GuildCategory});gcfg.ticketCategory=cat.id;save();}const ow=[{id:c.guild.roles.everyone.id,deny:[P.ViewChannel]},{id:c.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]},{id:c.guild.members.me.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.ManageChannels]}];if(gcfg.ticketRole&&c.guild.roles.cache.has(gcfg.ticketRole))ow.push({id:gcfg.ticketRole,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]});return c.guild.channels.create({name:`ticket-${c.user.username}`.replace(/[^a-z0-9-]/gi,'-').toLowerCase(),type:ChannelType.GuildText,parent:cat.id,topic:`ticket-owner:${c.user.id}`,permissionOverwrites:ow});}
command('ticket','Abre un ticket',[],null,async c=>{if(!c.guild.members.me.permissions.has(P.ManageChannels))throw new Error('El bot necesita permiso para gestionar canales.');const existing=c.guild.channels.cache.find(ch=>ch.topic?.includes(`ticket-owner:${c.user.id}`));const ch=existing||await createTicket(c);await ch.send({embeds:[embed('Ticket de soporte',`Hola ${c.user}, explica tu consulta aquí.`)]});await ok(c,`Ticket creado: ${ch}`);});
command('adduser','Añade un usuario al ticket',[opt.user()],P.ManageChannels,async c=>{await requireStaff(c.i,P.ManageChannels);const u=c.i?memberFromInteraction(c.i):c.memberAt(0);if(!u||!c.channel.topic?.startsWith('ticket-owner:'))throw new Error('Selecciona un usuario y usa el comando dentro de un ticket.');await c.channel.permissionOverwrites.edit(u,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});await ok(c,`${u} fue añadido al ticket.`);});
command('removeuser','Retira un usuario del ticket',[opt.user()],P.ManageChannels,async c=>{await requireStaff(c.i,P.ManageChannels);const u=c.i?memberFromInteraction(c.i):c.memberAt(0);if(!u||!c.channel.topic?.startsWith('ticket-owner:'))throw new Error('Selecciona un usuario y usa el comando dentro de un ticket.');await c.channel.permissionOverwrites.delete(u.id);await ok(c,`${u} fue retirado del ticket.`);});
command('close','Cierra el ticket',[],null,async c=>{if(!c.channel.topic?.startsWith('ticket-owner:'))throw new Error('Este canal no es un ticket.');if(!c.guild.members.me.permissions.has(P.ManageChannels))throw new Error('El bot necesita permiso para gestionar canales.');const msgs=await c.channel.messages.fetch({limit:100}).catch(()=>new Map());const lines=[...msgs.values()].reverse().map(m=>`[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content||'[adjunto/embed]'}`).join('\n');const gcfg=cfg(c.guild.id);let target=gcfg.logChannel&&c.guild.channels.cache.get(gcfg.logChannel);if(target)await target.send({content:`Transcripción de ${c.channel.name}`,files:[{attachment:Buffer.from(lines||'Ticket vacío','utf8'),name:`ticket-${c.channel.id}.txt`}]}).catch(()=>{});await ok(c,'Ticket cerrado y transcripción guardada.');setTimeout(()=>c.channel.delete().catch(()=>{}),1500);});
command('report','Envía un reporte',[opt.user(),opt.string('motivo','Motivo')],null,async c=>{const u=c.i?memberFromInteraction(c.i):c.memberAt(0);const reason=c.i?value(c.i,'motivo'):c.rest(1);if(!u||!reason)throw new Error('Selecciona un usuario y escribe el motivo.');const chId=cfg(c.guild.id).reportChannel||process.env.REPORT_CHANNEL_ID;const ch=chId&&c.guild.channels.cache.get(chId);if(!ch)throw new Error('No hay canal de reportes configurado. Usa `/report-channel`.');await ch.send({embeds:[embed('Nuevo reporte',`**Reportado:** ${u.user.tag} (${u.id})\n**Reporta:** ${c.user.tag}\n**Motivo:** ${reason}`,0xE67E22)]});await ok(c,'Reporte enviado al staff.');});
command('suggest','Publica una sugerencia',[opt.string('idea','Sugerencia')],null,async c=>{const idea=c.i?value(c.i,'idea'):c.rest(0);if(!idea)throw new Error('Escribe una sugerencia.');const m=await c.channel.send({embeds:[embed('Nueva sugerencia',`${idea}\n\nPropuesta por ${c.user}`,0x3498DB)]});await m.react('👍').catch(()=>{});await m.react('👎').catch(()=>{});await ok(c,'Sugerencia publicada.');});
command('userinfo','Información de usuario',[opt.user('usuario',false)],null,async c=>{const u=c.i?(c.i.options.getUser('usuario')||c.user):c.memberAt(0)?.user||c.user;const m=await c.guild.members.fetch(u.id).catch(()=>null);await c.reply({embeds:[new EmbedBuilder().setColor(0x3498DB).setTitle(u.tag).setThumbnail(u.displayAvatarURL({size:512})).addFields({name:'ID',value:u.id},{name:'Creada',value:`<t:${Math.floor(u.createdTimestamp/1000)}:F>`},{name:'Se unió',value:m?.joinedTimestamp?`<t:${Math.floor(m.joinedTimestamp/1000)}:F>`:'No disponible'})],ephemeral:true});});
command('serverinfo','Información del servidor',[],null,async c=>c.reply({embeds:[new EmbedBuilder().setColor(0x3498DB).setTitle(c.guild.name).setThumbnail(c.guild.iconURL({size:512})).addFields({name:'Miembros',value:String(c.guild.memberCount),inline:true},{name:'Canales',value:String(c.guild.channels.cache.size),inline:true},{name:'Creado',value:`<t:${Math.floor(c.guild.createdTimestamp/1000)}:F>`})],ephemeral:true}));
command('ping','Muestra la latencia',[],null,async c=>ok(c,`Latencia de API: **${client.ws.ping} ms**`));

// Reacciones
const reactions={kiss:['le dio un beso a','kiss'],hug:['le dio un abrazo a','hug'],slap:['le dio una bofetada a','slap'],pat:['acarició la cabeza de','pat'],poke:['le picó la mejilla a','poke'],cuddle:['se acurrucó con','cuddle'],bite:['mordió a','bite'],highfive:['chocó los cinco con','highfive'],punch:['golpeó de broma a','punch']};
for(const [name,[text,api]] of Object.entries(reactions))command(name,'Reacción con GIF',[opt.user()],null,async c=>{const u=c.i?memberFromInteraction(c.i):c.memberAt(0);if(!u)throw new Error('Selecciona o menciona un usuario.');const gif=await fetchGif(api);await c.channel.send({embeds:[embed(`${name[0].toUpperCase()+name.slice(1)}`,`${c.user} ${text} ${u.user}${gif?'':' · GIF no disponible'}`,0xE74C3C).setImage(gif||null)]});await c.ack();});
for(const [name,text,api] of [['cry','se puso a llorar','cry'],['dance','se puso a bailar','dance'],['blush','se sonrojó','blush'],['sleep','se quedó dormido','sleep'],['happy','está feliz','happy']])command(name,'Reacción individual',[],null,async c=>{const gif=await fetchGif(api);await c.channel.send({embeds:[embed(name[0].toUpperCase()+name.slice(1),`${c.user} ${text}${gif?'':' · GIF no disponible'}`,0xE74C3C).setImage(gif||null)]});await c.ack();});
async function fetchGif(api){try{const r=await fetch(`https://nekos.best/api/v2/${api}`,{signal:AbortSignal.timeout(5000)});if(!r.ok)return null;const j=await r.json();return j.results?.[0]?.url||null;}catch{return null;}}

async function register(){const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);const route=process.env.DEV_GUILD_ID?Routes.applicationGuildCommands(client.user.id,process.env.DEV_GUILD_ID):Routes.applicationCommands(client.user.id);await rest.put(route,{body:slash.map(s=>({name:s.name,description:s.description.slice(0,100),options:s.options}))});}
function contextSlash(i){return {i,guild:i.guild,user:i.user,channel:i.channel,member:i.member,args:[],memberAt:()=>null,rest:()=>'',argsInt:()=>null,reply:p=>i.reply({...p,ephemeral:p.ephemeral!==false}),ack:async()=>{if(!i.replied&&!i.deferred)await i.reply({embeds:[embed('Listo','Comando completado.',0x2ECC71)],ephemeral:true});}}}
function contextPrefix(message,args){return {i:null,guild:message.guild,user:message.author,channel:message.channel,member:message.member,args,memberAt:n=>message.guild.members.cache.get([...message.mentions.members.keys()][n]||'')||null,rest:n=>args.slice(n).join(' '),argsInt:n=>Number(args[n]),reply:p=>message.reply(p),ack:async()=>{}}}

client.once('ready',async()=>{console.log(`Conectado como ${client.user.tag}`);try{await register();console.log(`${slash.length} comandos registrados`);}catch(e){console.error('No se pudieron registrar los slash:',e.message);}});
client.on('interactionCreate',async i=>{if(i.isChatInputCommand()){const spec=slash.find(s=>s.name===i.commandName);if(!spec)return;try{await spec.run(contextSlash(i));}catch(e){const text=e instanceof Error?e.message:'Ocurrió un error inesperado.';const payload={embeds:[embed('No se pudo completar',text,0xE74C3C)],ephemeral:true};if(i.replied||i.deferred)await i.followUp(payload).catch(()=>{});else await i.reply(payload).catch(()=>{});}}else if(i.isButton()){
  if(i.customId==='ticket:create')try{await i.deferReply({ephemeral:true});const cat=cfg(i.guild.id).ticketCategory&&i.guild.channels.cache.get(cfg(i.guild.id).ticketCategory);const ow=[{id:i.guild.roles.everyone.id,deny:[P.ViewChannel]},{id:i.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]},{id:i.guild.members.me.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.ManageChannels]}];const role=cfg(i.guild.id).ticketRole;if(role)i.guild.roles.cache.has(role)&&ow.push({id:role,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]});let parent=cat;if(!parent)parent=i.guild.channels.cache.find(ch=>ch.type===ChannelType.GuildCategory&&ch.name.toLowerCase()==='tickets');const ch=await i.guild.channels.create({name:`ticket-${i.user.username}`.replace(/[^a-z0-9-]/gi,'-').toLowerCase(),type:ChannelType.GuildText,parent:parent?.id,topic:`ticket-owner:${i.user.id}`,permissionOverwrites:ow});await ch.send({embeds:[embed('Ticket de soporte',`Hola ${i.user}, explica tu consulta aquí.`)]});await i.editReply({embeds:[embed('Ticket creado',`Abierto: ${ch}`,0x2ECC71)]});}catch(e){if(i.deferred)await i.editReply({embeds:[embed('No se pudo abrir',e.message,0xE74C3C)]});}
  if(i.customId.startsWith('antibot:')){await i.update({embeds:[embed('Solicitud procesada','Esta solicitud ya fue procesada.',0x5865F2)],components:[]}).catch(()=>{});}
}});
client.on('messageCreate',async message=>{if(!message.guild||message.author.bot||!message.content.startsWith('.'))return;const parts=message.content.slice(1).trim().split(/\s+/);const name=(parts.shift()||'').toLower();const spec=prefix.get(name);if(!spec)return;try{await spec.run(contextPrefix(message,parts));}catch(e){await message.reply({embeds:[embed('No se pudo completar',e instanceof Error?e.message:'Error inesperado.',0xE74C3C)]}).catch(()=>{});}});

client.on('guildMemberAdd',async member=>{if(!member.user.bot||!cfg(member.guild.id).antibot)return;const allowed=(data.allowedBots[member.guild.id]||[]).includes(member.id);if(allowed)return;try{await member.kick('Anti-bot: requiere autorización');}catch{}try{const owner=await member.guild.fetchOwner();let executor='Usuario no identificado';try{const logs=await member.guild.fetchAuditLogs({type:AuditLogEvent.BotAdd,limit:5});const e=logs.entries.find(x=>x.target?.id===member.id&&Date.now()-x.createdTimestamp<600000);if(e?.executor)executor=`${e.executor.tag} (${e.executor.id})`;}catch{}const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`antibot:allow:${member.guild.id}:${member.id}`).setLabel('Acceder').setEmoji('🟢').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`antibot:deny:${member.guild.id}:${member.id}`).setLabel('Negar').setEmoji('🔴').setStyle(ButtonStyle.Danger));await owner.send({embeds:[embed('Solicitud de acceso de bot',`${executor} intentó añadir **${member.user.tag}** (${member.id}) al servidor **${member.guild.name}**. Por seguridad, todavía no puede entrar.`)],components:[row]});}catch{}});
client.on('interactionCreate',async i=>{if(!i.isButton()||!i.customId.startsWith('antibot:'))return;const [,action,guildId,botId]=i.customId.split(':');if(i.user.id!==i.guild?.ownerId){await i.reply({embeds:[embed('Acceso denegado','Solo el propietario puede autorizar bots.',0xE74C3C)],ephemeral:true}).catch(()=>{});return;}if(action==='deny'){await i.update({embeds:[embed('Bot denegado',`No se autorizó el bot **${botId}**.`,0xE74C3C)],components:[]}).catch(()=>{});return;}data.allowedBots[guildId]||=[];if(!data.allowedBots[guildId].includes(botId))data.allowedBots[guildId].push(botId);save();const url=`https://discord.com/oauth2/authorize?client_id=${botId}&scope=bot%20applications.commands&permissions=0`;await i.update({embeds:[embed('Bot autorizado',`Solo el bot **${botId}** fue autorizado en este servidor.`,0x2ECC71)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Añadir bot autorizado').setStyle(ButtonStyle.Link).setURL(url))]}).catch(()=>{});});

client.on('error',e=>console.error('Discord:',e.message));
client.login(process.env.DISCORD_TOKEN).catch(e=>{console.error('No se pudo iniciar sesión:',e.message);process.exitCode=1;});
