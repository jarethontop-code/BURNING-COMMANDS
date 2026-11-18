'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  EmbedBuilder, ModalBuilder, PermissionFlagsBits: P, REST, Routes,
  TextInputBuilder, TextInputStyle
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const FILE = path.resolve(process.env.PACKAGE5_DATA_PATH || 'package5.json');
const BLUE = 0x5865F2;
const GOLD = 0xF1C40F;
const MAX_TIME_MS = 3650 * 86400000;
let data = { capsules: [], birthdays: {}, birthdayRole: {}, drops: {}, duels: {}, jails: {}, slowmodeAuto: {} };
try { if (fs.existsSync(FILE)) data = { ...data, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
catch (error) { console.error('No se pudo leer package5.json:', error.message); }
function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
const embed = (title, description, color = BLUE) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
const row = (...components) => [new ActionRowBuilder().addComponents(...components)];
const key = (guildId, userId) => `${guildId}:${userId}`;
const cmd = (name, description, options = [], defaultPermission) => ({ name, description, options, ...(defaultPermission ? { default_member_permissions: defaultPermission.toString() } : {}) });
const userOption = (required = true) => ({ type: 6, name: 'usuario', description: 'Selecciona un miembro', required });
const stringOption = (name, description, required = true, max_length = 1000) => ({ type: 3, name, description, required, max_length });
const commands = [
  cmd('timecapsule', 'Programa un mensaje para que se desentierre más adelante.', [stringOption('tiempo', 'Duración: 7d, 30d o 365d', true, 12), stringOption('mensaje', 'Mensaje futuro', true, 1000)]),
  cmd('birthday', 'Registra tu cumpleaños (día y mes).', [{ type: 4, name: 'dia', description: 'Día del mes', required: true, min_value: 1, max_value: 31 }, { type: 4, name: 'mes', description: 'Mes (1-12)', required: true, min_value: 1, max_value: 12 }]),
  cmd('secret-drop', 'Lanza una caja misteriosa con código secreto.', [stringOption('premio', 'Descripción del premio (rol o recompensa)', true, 100)]),
  cmd('slowmode-auto', 'Activa o desactiva el slowmode inteligente.', [{ type: 3, name: 'estado', description: 'Activar o desactivar', required: true, choices: [{ name: 'Activar', value: 'on' }, { name: 'Desactivar', value: 'off' }] }], P.ManageChannels),
  cmd('wanted', 'Genera un cartel de Se Busca estilo meme.', [userOption(false)]),
  cmd('fake-tweet', 'Crea una tarjeta de parodia claramente etiquetada.', [userOption(true), stringOption('texto', 'Texto para la tarjeta', true, 500)]),
  cmd('duel-rpg', 'Desafía a otro miembro a un duelo RPG por turnos.', [userOption(true)]),
  cmd('jail', 'Envía a un miembro a la celda del servidor.', [userOption(true), stringOption('razon', 'Razón de la sanción', false, 300)], P.ManageRoles),
  cmd('unjail', 'Restaura los roles y permisos de un miembro encarcelado.', [userOption(true)], P.ManageRoles),
  cmd('rate', 'Calcula estadísticas divertidas del día.', [userOption(false)])
];
const reactions = {
  kidnap: { text: '{author} metió a {target} en un saco y se lo llevó', gif: 'grab', actions: [['Pedir rescate','🆘','{target} pidió rescate a {author}','cry'],['Escapar del saco','🥷','{target} escapó del saco de {author}','run']] },
  revive: { text: '{author} usó magia oscura para revivir a {target}', gif: '魔法', actions: [['Caminar como zombie','🧟','{target} volvió como zombie gracias a {author}','zombie'],['Agradecer la vida','✨','{target} agradeció a {author} por devolverle la vida','happy']] },
  bribe: { text: '{author} le ofreció un maletín lleno de dinero en secreto a {target}', gif: 'handshake', actions: [['Aceptar soborno','💼','{target} aceptó el maletín de {author}','smug'],['Llamar a la policía','🚨','{target} llamó a la policía por el soborno de {author}','run']] },
  pout: { text: '{author} hizo un puchero súper tierno mirando a {target}', gif: 'pout', actions: [['Darle un dulce','🍬','{target} le dio un dulce a {author}','happy'],['Pellizcar cachetes','🤏','{target} le pellizcó los cachetes a {author}','pat']] },
  laugh: { text: '{author} se está riendo a carcajadas de {target}', gif: 'laugh', actions: [['Enojarse','😤','{target} se enojó con {author}','angry'],['Reírse juntos','🤡','{target} se rio junto a {author}','laugh']] }
};
const prefixOnly = new Set(['highlight','clonechannel','firstjoin', ...Object.keys(reactions)]);
const parseTime = input => {
  const match = /^(\d+)([smhd])$/i.exec(input || '');
  if (!match) return null;
  const duration = Number(match[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 })[match[2].toLowerCase()];
  return duration >= 60_000 && duration <= MAX_TIME_MS ? duration : null;
};
async function register(client) {
  if (!process.env.DISCORD_TOKEN) return;
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.DEV_GUILD_ID ? Routes.applicationGuildCommands(client.user.id, process.env.DEV_GUILD_ID) : Routes.applicationCommands(client.user.id);
  const current = await rest.get(route);
  const merged = new Map(current.map(item => [item.name, item]));
  for (const command of commands) merged.set(command.name, command);
  await rest.put(route, { body: [...merged.values()] });
  console.log('Comandos del paquete 5 registrados.');
}
function replyError(i, text) {
  const payload = { embeds: [embed('No se pudo completar', text, 0xE74C3C)], ephemeral: true };
  return i.deferred || i.replied ? i.followUp(payload).catch(() => {}) : i.reply(payload).catch(() => {});
}
function formatDuration(ms) {
  const units = [['d', 86400000], ['h', 3600000], ['m', 60000]];
  for (const [unit, size] of units) if (ms % size === 0) return `${ms / size}${unit}`;
  return `${Math.ceil(ms / 60000)}m`;
}
async function sendCapsule(client, capsule) {
  const guild = client.guilds.cache.get(capsule.guildId);
  const channel = guild?.channels.cache.get(capsule.channelId);
  if (!channel?.isTextBased()) return;
  await channel.send({ embeds: [embed('⏳ Cápsula del tiempo desenterrada', `<@${capsule.userId}> dejó este mensaje para el futuro:\n\n> ${capsule.message}\n\nGuardada el <t:${Math.floor(capsule.createdAt / 1000)}:F>.`, GOLD)], allowedMentions: { users: [capsule.userId] } }).catch(console.error);
  data.capsules = data.capsules.filter(item => item.id !== capsule.id);
  save();
}
function scheduleCapsules(client) {
  for (const capsule of [...data.capsules]) {
    if (capsule.dueAt <= Date.now()) void sendCapsule(client, capsule);
    else setTimeout(() => void sendCapsule(client, capsule), Math.min(capsule.dueAt - Date.now(), 2_147_000_000)).unref?.();
  }
}
async function processBirthdays(client) {
  const now = new Date();
  const todayKey = `${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
  const dateStamp = now.toISOString().slice(0, 10);
  for (const [guildId, entries] of Object.entries(data.birthdays)) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    for (const [userId, birthday] of Object.entries(entries)) {
      if (`${birthday.month}-${birthday.day}` !== todayKey || birthday.lastSent === dateStamp) continue;
      birthday.lastSent = dateStamp;
      const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.type === ChannelType.GuildText && ch.permissionsFor(guild.members.me)?.has(P.SendMessages));
      if (channel) await channel.send({ embeds: [embed('🎂 ¡Feliz cumpleaños!', `Hoy celebramos a <@${userId}>. ¡Que tengas un día increíble!`, GOLD)], allowedMentions: { users: [userId] } }).catch(() => {});
      try {
        let role = guild.roles.cache.find(item => item.name === '🎂 Cumpleañero del Día');
        if (!role) role = await guild.roles.create({ name: '🎂 Cumpleañero del Día', color: 0xFF69B4, reason: 'Rol temporal de cumpleaños' });
        const member = await guild.members.fetch(userId);
        await member.roles.add(role, 'Cumpleaños registrado');
        setTimeout(() => member.roles.remove(role, 'Fin del día de cumpleaños').catch(() => {}), 24 * 60 * 60 * 1000).unref?.();
      } catch (error) { console.warn('No se pudo asignar rol de cumpleaños:', error.message); }
    }
  }
  save();
}
async function makeWanted(member) {
  const canvas = createCanvas(720, 900); const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9b66f'; ctx.fillRect(0, 0, 720, 900);
  ctx.fillStyle = '#321c0c'; ctx.textAlign = 'center'; ctx.font = 'bold 84px sans-serif'; ctx.fillText('WANTED', 360, 105);
  ctx.font = 'bold 36px sans-serif'; ctx.fillText('SE BUSCA', 360, 155);
  const avatar = await loadImage(member.displayAvatarURL({ extension: 'png', size: 512 }));
  ctx.drawImage(avatar, 130, 195, 460, 460);
  ctx.font = 'bold 42px sans-serif'; ctx.fillText((member.displayName || member.user.username).slice(0, 24), 360, 710);
  ctx.font = 'bold 34px sans-serif'; ctx.fillText(`RECOMPENSA: ${Math.floor(Math.random() * 900000 + 100000)} monedas`, 360, 785);
  ctx.font = '20px sans-serif'; ctx.fillText('CARTEL DE BROMA', 360, 855);
  return new AttachmentBuilder(await canvas.encode('png'), { name: 'wanted.png' });
}
async function makeParody(member, text) {
  const canvas = createCanvas(1000, 620); const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f7fa'; ctx.fillRect(0, 0, 1000, 620);
  ctx.fillStyle = '#fff'; ctx.fillRect(35, 35, 930, 550);
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.strokeRect(35, 35, 930, 550);
  const avatar = await loadImage(member.displayAvatarURL({ extension: 'png', size: 256 }));
  ctx.save(); ctx.beginPath(); ctx.arc(105, 110, 42, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(avatar, 63, 68, 84, 84); ctx.restore();
  ctx.fillStyle = '#17202a'; ctx.font = 'bold 30px sans-serif'; ctx.fillText((member.displayName || member.user.username).slice(0, 28), 165, 105);
  ctx.fillStyle = '#657786'; ctx.font = '22px sans-serif'; ctx.fillText('PUBLICACIÓN DE PARODIA · GENERADA POR BOT', 165, 140);
  ctx.fillStyle = '#17202a'; ctx.font = '32px sans-serif';
  const words = text.split(/\s+/); let line = '', y = 235;
  for (const word of words) { const next = `${line}${word} `; if (ctx.measureText(next).width > 820) { ctx.fillText(line, 75, y); line = `${word} `; y += 48; } else line = next; }
  if (line) ctx.fillText(line, 75, y);
  ctx.fillStyle = '#e11d48'; ctx.font = 'bold 24px sans-serif'; ctx.fillText('PARODIA — NO ES UNA PUBLICACIÓN REAL', 500, 545);
  return new AttachmentBuilder(await canvas.encode('png'), { name: 'parodia.png' });
}
async function doJail(guild, member, reason) {
  if (!guild.members.me.permissions.has(P.ManageRoles) || !guild.members.me.permissions.has(P.ManageChannels)) throw new Error('El bot necesita Gestionar roles y canales.');
  const guildKey = guild.id;
  let jailRole = guild.roles.cache.find(role => role.name === 'Prisionero');
  if (!jailRole) jailRole = await guild.roles.create({ name: 'Prisionero', color: 0x555555, reason: 'Rol de cárcel visual' });
  let cell = guild.channels.cache.find(channel => channel.type === ChannelType.GuildText && channel.name === 'celda');
  if (!cell) cell = await guild.channels.create({ name: 'celda', type: ChannelType.GuildText, permissionOverwrites: [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: jailRole.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
    { id: guild.members.me.id, allow: [P.ViewChannel, P.SendMessages, P.ManageChannels] }
  ] });
  if (data.jails[key(guildKey, member.id)]) throw new Error('Ese miembro ya está en la cárcel visual.');
  const oldRoles = member.roles.cache.filter(role => role.id !== guild.id && !role.managed).map(role => role.id);
  data.jails[key(guildKey, member.id)] = { roleIds: oldRoles, jailRoleId: jailRole.id, cellId: cell.id, reason, jailedAt: Date.now() };
  save();
  await member.roles.set([jailRole.id], `Cárcel visual: ${reason}`);
  for (const channel of guild.channels.cache.values()) {
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type) || channel.id === cell.id) continue;
    await channel.permissionOverwrites.edit(jailRole, { ViewChannel: false }, { reason: 'Cárcel visual' }).catch(() => {});
  }
  const avatar = await loadImage(member.displayAvatarURL({ extension: 'png', size: 256 }));
  const canvas = createCanvas(512, 512); const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#333'; ctx.fillRect(0, 0, 512, 512); ctx.drawImage(avatar, 56, 35, 400, 400);
  ctx.strokeStyle = '#151515'; ctx.lineWidth = 16;
  for (let x = 70; x < 512; x += 95) { ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 460); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`DETENIDO: ${member.displayName.slice(0, 22)}`, 256, 495);
  await cell.send({ content: `🔒 ${member} fue enviado a la cárcel visual. Razón: ${reason}`, files: [new AttachmentBuilder(await canvas.encode('png'), { name: 'celda.png' })], allowedMentions: { users: [member.id] } });
}
async function doUnjail(guild, member) {
  const saved = data.jails[key(guild.id, member.id)];
  if (!saved) throw new Error('Ese miembro no tiene un registro de cárcel.');
  await member.roles.set(saved.roleIds.filter(id => guild.roles.cache.has(id)), 'Fin de cárcel visual');
  for (const channel of guild.channels.cache.values()) await channel.permissionOverwrites.delete(saved.jailRoleId, 'Fin de cárcel visual').catch(() => {});
  delete data.jails[key(guild.id, member.id)]; save();
}
async function runSlash(interaction) {
  const name = interaction.commandName;
  const guild = interaction.guild;
  const user = interaction.user;
  if (name === 'timecapsule') {
    const duration = parseTime(interaction.options.getString('tiempo'));
    if (!duration) throw new Error('Duración no válida. Usa 7d, 30d o 365d (entre 1 minuto y 10 años).');
    const capsule = { id: `${Date.now()}-${user.id}`, guildId: guild.id, channelId: interaction.channelId, userId: user.id, message: interaction.options.getString('mensaje', true), createdAt: Date.now(), dueAt: Date.now() + duration };
    data.capsules.push(capsule); save();
    setTimeout(() => void sendCapsule(interaction.client, capsule), Math.min(duration, 2_147_000_000)).unref?.();
    await interaction.reply({ embeds: [embed('⏳ Cápsula creada', `La desenterraremos <t:${Math.floor(capsule.dueAt / 1000)}:F>.`)], ephemeral: true }); return true;
  }
  if (name === 'birthday') {
    const day = interaction.options.getInteger('dia', true), month = interaction.options.getInteger('mes', true);
    const maxDay = new Date(Date.UTC(2024, month, 0)).getUTCDate();
    if (day > maxDay) throw new Error('Ese día no existe en el mes seleccionado.');
    data.birthdays[guild.id] ||= {};
    data.birthdays[guild.id][user.id] = { day, month, lastSent: null }; save();
    await interaction.reply({ content: `Cumpleaños guardado: **${day}/${month}**.`, ephemeral: true }); return true;
  }
  if (name === 'secret-drop') {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const message = await interaction.reply({ embeds: [embed('🎁 Caja misteriosa', 'Pulsa para intentar adivinar el código de 4 dígitos. ¡La primera persona en acertar gana!')], components: row(new ButtonBuilder().setCustomId('p5:drop:open:pending').setLabel('Abrir caja').setEmoji('🎁').setStyle(ButtonStyle.Success)), fetchReply: true });
    data.drops[message.id] = { guildId: guild.id, channelId: interaction.channelId, prize: interaction.options.getString('premio', true), code, winner: null, creatorId: user.id };
    save(); await message.edit({ components: row(new ButtonBuilder().setCustomId(`p5:drop:open:${guild.id}:${message.id}`).setLabel('Abrir caja').setEmoji('🎁').setStyle(ButtonStyle.Success)) }); return true;
  }
  if (name === 'slowmode-auto') {
    if (!interaction.memberPermissions?.has(P.ManageChannels)) throw new Error('Necesitas Gestionar canales.');
    data.slowmodeAuto[guild.id] = interaction.options.getString('estado') === 'on'; save();
    await interaction.reply({ content: `Slowmode inteligente ${data.slowmodeAuto[guild.id] ? 'activado' : 'desactivado'}.`, ephemeral: true }); return true;
  }
  const targetUser = interaction.options.getUser('usuario') || user;
  const target = await guild.members.fetch(targetUser.id).catch(() => null);
  if (name === 'wanted') {
    if (!target) throw new Error('No encontré ese miembro.');
    await interaction.deferReply(); await interaction.editReply({ files: [await makeWanted(target)] }); return true;
  }
  if (name === 'fake-tweet') {
    if (!target) throw new Error('No encontré ese miembro.');
    await interaction.deferReply(); await interaction.editReply({ files: [await makeParody(target, interaction.options.getString('texto', true))] }); return true;
  }
  if (name === 'rate') {
    const day = new Date().toISOString().slice(0, 10);
    const hash = [...`${guild.id}:${target.id}:${day}`].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
    const score = metric => (hash >>> metric) % 101;
    const bar = value => `${'█'.repeat(Math.round(value / 10))}${'░'.repeat(10 - Math.round(value / 10))} **${value}%**`;
    await interaction.reply({ embeds: [embed(`📊 Estadísticas de ${target.displayName}`, `🎮 Pro Gamer ${bar(score(1))}\n🍀 Suerte ${bar(score(9))}\n☣️ Tóxico ${bar(score(17))}`)] }); return true;
  }
  if (name === 'duel-rpg') {
    if (!target || target.id === user.id || target.user.bot) throw new Error('Desafía a otro miembro humano.');
    const id = `${Date.now()}-${user.id}`;
    data.duels[id] = { guildId: guild.id, channelId: interaction.channelId, player1: user.id, player2: target.id, hp: { [user.id]: 100, [target.id]: 100 }, turn: target.id, shield: {}, over: false };
    save();
    await interaction.reply({ embeds: [duelEmbed(data.duels[id])], components: row(new ButtonBuilder().setCustomId(`p5:duel:${id}:quick`).setLabel('Ataque rápido').setEmoji('⚔️').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`p5:duel:${id}:crit`).setLabel('Golpe crítico').setEmoji('💥').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`p5:duel:${id}:shield`).setLabel('Escudo').setEmoji('🛡️').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(`p5:duel:${id}:heal`).setLabel('Curarse').setEmoji('🧪').setStyle(ButtonStyle.Success)) }); return true;
  }
  if (name === 'jail' || name === 'unjail') {
    if (!interaction.memberPermissions?.has(P.ManageRoles)) throw new Error('Necesitas Gestionar roles.');
    if (!target || target.id === guild.ownerId || target.id === interaction.client.user.id) throw new Error('No se puede aplicar a ese usuario.');
    if (name === 'jail') await doJail(guild, target, interaction.options.getString('razon') || `Acción de ${user.tag}`);
    else await doUnjail(guild, target);
    await interaction.reply({ embeds: [embed(name === 'jail' ? '🔒 Cárcel visual' : '🔓 Liberado', `${target} ${name === 'jail' ? 'fue enviado a la celda' : 'fue liberado y sus roles fueron restaurados'}.`, 0x2ECC71)] }); return true;
  }
  return false;
}
function duelEmbed(duel, status = '') {
  const bar = hp => `${'🟥'.repeat(Math.ceil(hp / 10))}${'⬜'.repeat(10 - Math.ceil(hp / 10))} ${hp}/100`;
  return embed('⚔️ Duelo RPG', `<@${duel.player1}> ${bar(duel.hp[duel.player1])}\n<@${duel.player2}> ${bar(duel.hp[duel.player2])}\n\n${status || `Turno de <@${duel.turn}>`}`, GOLD);
}
async function handleComponent(i) {
  const id = i.customId || '';
  if (id.startsWith('p5:drop:open:')) {
    const [, , , guildId, messageId] = id.split(':'); const drop = data.drops[messageId];
    if (!drop || drop.guildId !== i.guildId || drop.winner) { await i.reply({ content: 'La caja ya fue reclamada o caducó.', ephemeral: true }); return true; }
    const modal = new ModalBuilder().setCustomId(`p5:drop:code:${guildId}:${messageId}:${i.user.id}`).setTitle('Adivina el código');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('code').setLabel('Código de 4 dígitos').setStyle(TextInputStyle.Short).setMinLength(4).setMaxLength(4).setRequired(true)));
    await i.showModal(modal); return true;
  }
  if (id.startsWith('p5:drop:code:') && i.isModalSubmit()) {
    const [, , , guildId, messageId, userId] = id.split(':'); const drop = data.drops[messageId];
    if (!drop || i.guildId !== guildId || i.user.id !== userId || drop.winner) { await i.reply({ content: 'Esta caja ya no está disponible.', ephemeral: true }); return true; }
    const guess = i.fields.getTextInputValue('code');
    if (guess !== drop.code) { await i.reply({ content: 'Código incorrecto. ¡Suerte la próxima!', ephemeral: true }); return true; }
    drop.winner = userId; save();
    await i.reply({ embeds: [embed('🎉 ¡Caja reclamada!', `<@${userId}> acertó y ganó: **${drop.prize}**. El premio es una recompensa anunciada; la entrega de rol/monedas debe configurarse manualmente.`, GOLD)] });
    const channel = i.guild.channels.cache.get(drop.channelId); await channel?.messages.fetch(messageId).then(msg => msg.edit({ components: [] })).catch(() => {}); return true;
  }
  if (id.startsWith('p5:duel:')) {
    const [, , duelId, move] = id.split(':'); const duel = data.duels[duelId];
    if (!duel || duel.over || i.guildId !== duel.guildId) { await i.reply({ content: 'Este duelo ya terminó.', ephemeral: true }); return true; }
    if (i.user.id !== duel.turn) { await i.reply({ content: `No es tu turno. Le toca a <@${duel.turn}>.`, ephemeral: true }); return true; }
    const opponent = duel.turn === duel.player1 ? duel.player2 : duel.player1;
    let status;
    if (move === 'shield') { duel.shield[duel.turn] = true; status = `<@${duel.turn}> levantó un escudo.`; }
    else if (move === 'heal') { duel.hp[duel.turn] = Math.min(100, duel.hp[duel.turn] + 20); status = `<@${duel.turn}> recuperó 20 HP.`; }
    else {
      let damage = move === 'crit' ? Math.floor(20 + Math.random() * 26) : Math.floor(10 + Math.random() * 16);
      if (duel.shield[opponent]) { damage = Math.ceil(damage / 2); duel.shield[opponent] = false; }
      duel.hp[opponent] = Math.max(0, duel.hp[opponent] - damage); status = `<@${duel.turn}> causó **${damage}** de daño a <@${opponent}>.`;
    }
    if (duel.hp[opponent] <= 0) { duel.over = true; status += `\n🏆 Ganó <@${duel.turn}>.`; }
    else duel.turn = opponent;
    save(); await i.update({ embeds: [duelEmbed(duel, status)], components: duel.over ? [] : i.message.components }); return true;
  }
  if (id.startsWith('p5:secret:')) return false;
  if (id.startsWith('p5:secret-drop:')) return false;
  if (id.startsWith('p5:')) return false;
  if (id.startsWith('p5reaction:')) {
    const [, guildId, actorId, targetId, reaction, index] = id.split(':');
    if (i.guildId !== guildId || i.user.id !== targetId) { await i.reply({ content: `Solo <@${targetId}> puede responder.`, ephemeral: true }); return true; }
    const action = reactions[reaction]?.actions[Number(index)]; if (!action) { await i.reply({ content: 'Acción vencida.', ephemeral: true }); return true; }
    const [label, emoji, text, gifCategory] = action; void label; void emoji;
    await i.update({ components: [] });
    const gif = await fetch(`https://nekos.best/api/v2/${encodeURIComponent(gifCategory)}`).then(async r => r.ok ? (await r.json()).results?.[0]?.url : null).catch(() => null);
    const result = embed('Respuesta', text.replaceAll('{author}', `<@${actorId}>`).replaceAll('{target}', `<@${targetId}>`), 0x9B59B6); if (gif) result.setImage(gif);
    await i.channel.send({ embeds: [result], allowedMentions: { parse: [] } }); return true;
  }
  return false;
}
async function runPrefix(message, next) {
  if (!message.guild || message.author.bot || !message.content?.startsWith('.')) return next();
  const [raw, ...args] = message.content.slice(1).trim().split(/\s+/).filter(Boolean); const name = (raw || '').toLowerCase();
  if (!prefixOnly.has(name) && !['wanted','fake-tweet','duel-rpg','jail','unjail','rate'].includes(name)) return next();
  const reply = (title, text, color = BLUE) => message.reply({ embeds: [embed(title, text, color)], allowedMentions: { repliedUser: false } });
  const target = message.mentions.members.first() || null;
  try {
    if (Object.hasOwn(reactions, name)) {
      if (!target || target.id === message.author.id || target.user.bot) throw new Error(`Uso: .${name} @usuario (menciona a otra persona).`);
      const config = reactions[name]; const gif = await fetch(`https://nekos.best/api/v2/${encodeURIComponent(config.gif)}`).then(async r => r.ok ? (await r.json()).results?.[0]?.url : null).catch(() => null);
      const buttons = config.actions.map(([label, emoji], index) => new ButtonBuilder().setCustomId(`p5reaction:${message.guild.id}:${message.author.id}:${target.id}:${name}:${index}`).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Secondary));
      const card = embed('Reacción', config.text.replaceAll('{author}', message.member.displayName).replaceAll('{target}', target.displayName), 0xE74C3C); if (gif) card.setImage(gif);
      await message.channel.send({ embeds: [card], components: row(...buttons), allowedMentions: { parse: [] } }); return;
    }
    if (name === 'highlight') {
      const word = args.join(' ').trim(); if (!word || word.length > 80) throw new Error('Uso: `.highlight palabra` (máximo 80 caracteres).');
      data.highlights ||= {}; data.highlights[key(message.guild.id, message.author.id)] = word.toLocaleLowerCase(); save(); await reply('🔔 Alerta configurada', `Te avisaré por DM si aparece **${word}**.`); return;
    }
    if (name === 'clonechannel') {
      if (!message.member.permissions.has(P.ManageChannels)) throw new Error('Necesitas Gestionar canales.');
      const copy = await message.channel.clone({ reason: `Clonado por ${message.author.tag}` }); await copy.setPosition(message.channel.rawPosition + 1).catch(() => {}); await copy.send({ embeds: [embed('Canal duplicado', `Clonado por ${message.author.tag}.`)] }); return;
    }
    if (name === 'firstjoin') {
      const member = target || message.member; await message.guild.members.fetch();
      const sorted = [...message.guild.members.cache.values()].sort((a,b) => (a.joinedTimestamp || 0) - (b.joinedTimestamp || 0));
      const rank = sorted.findIndex(m => m.id === member.id) + 1; await reply('👋 Entrada al servidor', `${member} fue el miembro **#${rank}** en unirse.`); return;
    }
    if (name === 'wanted') {
      const member = target || message.member; await message.reply({ files: [await makeWanted(member)], allowedMentions: { repliedUser: false } }); return;
    }
    if (name === 'fake-tweet') {
      if (!target) throw new Error('Uso: `.fake-tweet @usuario texto` (tarjeta marcada como parodia).');
      const text = message.content.slice(message.content.indexOf(args[1] || '')).trim(); if (!text) throw new Error('Escribe el texto de la parodia.');
      await message.reply({ files: [await makeParody(target, text)], allowedMentions: { repliedUser: false } }); return;
    }
    if (name === 'rate') {
      const member = target || message.member; const hash = [...`${message.guild.id}:${member.id}:${new Date().toISOString().slice(0,10)}`].reduce((n,c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
      const score = shift => (hash >>> shift) % 101; const bar = value => `${'█'.repeat(Math.round(value/10))}${'░'.repeat(10-Math.round(value/10))} **${value}%**`;
      await reply(`📊 Estadísticas de ${member.displayName}`, `🎮 Pro Gamer ${bar(score(1))}\n🍀 Suerte ${bar(score(9))}\n☣️ Tóxico ${bar(score(17))}`); return;
    }
    if (name === 'jail' || name === 'unjail') {
      if (!message.member.permissions.has(P.ManageRoles)) throw new Error('Necesitas Gestionar roles.'); if (!target) throw new Error(`Uso: .${name} @usuario`);
      if (name === 'jail') await doJail(message.guild, target, args.slice(1).join(' ') || `Acción de ${message.author.tag}`); else await doUnjail(message.guild, target);
      await reply(name === 'jail' ? '🔒 Cárcel visual' : '🔓 Liberado', `${target.displayName}: acción completada.`, 0x2ECC71); return;
    }
    if (name === 'duel-rpg') {
      if (!target || target.id === message.author.id || target.user.bot) throw new Error('Menciona a otro miembro humano.');
      const id = `${Date.now()}-${message.author.id}`; data.duels[id] = { guildId: message.guild.id, channelId: message.channel.id, player1: message.author.id, player2: target.id, hp: { [message.author.id]: 100, [target.id]: 100 }, turn: target.id, shield: {}, over: false }; save();
      await message.channel.send({ embeds: [duelEmbed(data.duels[id])], components: row(new ButtonBuilder().setCustomId(`p5:duel:${id}:quick`).setLabel('Ataque rápido').setEmoji('⚔️').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`p5:duel:${id}:crit`).setLabel('Golpe crítico').setEmoji('💥').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`p5:duel:${id}:shield`).setLabel('Escudo').setEmoji('🛡️').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(`p5:duel:${id}:heal`).setLabel('Curarse').setEmoji('🧪').setStyle(ButtonStyle.Success)) }); return;
    }
  } catch (error) { await reply('No se pudo ejecutar', error.message || 'Error inesperado.', 0xE74C3C).catch(() => {}); }
}
async function onMessage(message, next) {
  if (!message.guild || message.author.bot) return next();
  if (data.slowmodeAuto[message.guild.id]) {
    const now = Date.now(); data.chatRate ||= {}; const rate = data.chatRate[message.channel.id] || [];
    const recent = rate.filter(t => now - t < 10_000); recent.push(now); data.chatRate[message.channel.id] = recent;
    const desired = recent.length >= 15 ? 10 : recent.length >= 8 ? 5 : 0;
    if (message.channel.setRateLimitPerUser && message.channel.rateLimitPerUser !== desired) await message.channel.setRateLimitPerUser(desired, 'Slowmode automático por volumen de mensajes').catch(() => {});
  }
  const highlightEntries = Object.entries(data.highlights || {}).filter(([k]) => k.startsWith(`${message.guild.id}:`));
  for (const [entryKey, word] of highlightEntries) {
    if (!message.content.toLocaleLowerCase().includes(word)) continue;
    const userId = entryKey.split(':')[1];
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (member) await member.send({ embeds: [embed('🔔 Palabra destacada', `Detecté **${word}** en ${message.channel}: [ir al mensaje](${message.url})`)] }).catch(() => {});
  }
  await runPrefix(message, () => next());
}
function install() {
  const { Client } = require('discord.js'); const originalOn = Client.prototype.on; const originalOnce = Client.prototype.once;
  Client.prototype.on = function patchedOn(eventName, listener) {
    if (eventName === 'messageCreate') return originalOn.call(this, eventName, message => onMessage(message, () => listener.call(this, message)));
    if (eventName === 'interactionCreate') return originalOn.call(this, eventName, async interaction => {
      try {
        if (interaction.isChatInputCommand?.() && commands.some(command => command.name === interaction.commandName)) { await runSlash(interaction); return; }
        if (await handleComponent(interaction)) return;
      } catch (error) { console.error('Error paquete 5:', error); await replyError(interaction, error.message || 'Error inesperado.'); return; }
      return listener.call(this, interaction);
    });
    return originalOn.call(this, eventName, listener);
  };
  Client.prototype.once = function patchedOnce(eventName, listener) {
    if (eventName !== 'ready') return originalOnce.call(this, eventName, listener);
    return originalOnce.call(this, eventName, async (...args) => { await listener.apply(this, args); try { await register(this); scheduleCapsules(this); await processBirthdays(this); setInterval(() => processBirthdays(this).catch(console.error), 60 * 60 * 1000).unref?.(); } catch (error) { console.error('Inicialización paquete 5:', error); } });
  };
  const originalEmit = Client.prototype.emit;
  Client.prototype.emit = function patchedEmit(eventName, ...args) {
    if (eventName === 'guildMemberAdd' && args[0]) void onMemberJoin(this, args[0]).catch(console.error);
    return originalEmit.call(this, eventName, ...args);
  };
}
async function onMemberJoin(client, member) {
  if (!data.birthdays[member.guild.id]?.[member.id]) return;
  void processBirthdays(client);
}
module.exports = { install, commands };
