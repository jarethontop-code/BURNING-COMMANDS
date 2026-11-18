'use strict';

const {
  Client,
  EmbedBuilder,
  PermissionFlagsBits: P,
  ChannelType
} = require('discord.js');

const handled = new WeakSet();
const PREFIX = '.';
const DURATION_PARTS = /^(?:\d+[smhd])+$/i;
const COLORS = { success: 0x2ECC71, error: 0xE74C3C, info: 0x5865F2 };

function card(title, description, color = COLORS.info) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}
function reply(message, title, description, color = COLORS.info) {
  return message.reply({ embeds: [card(title, description, color)], allowedMentions: { repliedUser: false } });
}
function parseDuration(input) {
  if (!input || !DURATION_PARTS.test(input)) return null;
  const parts = [...input.matchAll(/(\d+)([smhd])/gi)];
  const total = parts.reduce((sum, [, count, unit]) => sum + Number(count) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 })[unit.toLowerCase()], 0);
  return total >= 1000 && total <= 28 * 86400000 ? total : null;
}
function can(member, permission) { return Boolean(member?.permissions?.has(permission)); }
async function requirePermission(message, userPermission, botPermission = userPermission) {
  if (!can(message.member, userPermission)) throw new Error('No tienes permiso para usar este comando.');
  if (!message.guild.members.me?.permissions.has(botPermission)) throw new Error('Al bot le falta el permiso necesario. Revisa sus permisos y la jerarquía de roles.');
}
function idsFromText(message) {
  return [...message.content.matchAll(/<@!?(\d{17,20})>/g)].map(match => match[1]);
}
async function resolveTarget(message) {
  const mention = message.mentions.members.first();
  if (mention) return mention;
  if (message.reference?.messageId) {
    const referenced = await message.fetchReference().catch(() => null);
    if (referenced) return message.guild.members.fetch(referenced.author.id).catch(() => null);
  }
  return null;
}
function remainingArgs(message, args) {
  const ids = new Set(idsFromText(message));
  return args.filter(arg => !ids.has(arg.replace(/[<@!>]/g, '')));
}
function assertTarget(message, member) {
  if (!member) throw new Error('Menciona a un usuario o responde a uno de sus mensajes.');
  if (member.id === message.author.id) throw new Error('No puedes aplicarte esta acción a ti mismo.');
  if (member.id === message.guild.ownerId) throw new Error('No se puede aplicar esta acción al propietario del servidor.');
}
async function run(client, message) {
  if (!message.guild || message.author.bot || !message.content.startsWith(PREFIX)) return false;
  const tokens = message.content.slice(1).trim().split(/\s+/).filter(Boolean);
  const name = (tokens.shift() || '').toLowerCase();
  if (!name) return false;
  const args = tokens;
  try {
    switch (name) {
      case 'purge': {
        await requirePermission(message, P.ManageMessages);
        const amount = Number(args[0]);
        if (!Number.isInteger(amount) || amount < 1 || amount > 100) throw new Error('Uso: `.purge <1-100>`.');
        const deleted = await message.channel.bulkDelete(amount, true);
        await reply(message, '🧹 Purge completado', `Se eliminaron ${deleted.size} mensajes recientes.`, COLORS.success);
        return true;
      }
      case 'lock':
      case 'unlock': {
        await requirePermission(message, P.ManageChannels);
        const locked = name === 'lock';
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
          SendMessages: locked ? false : null,
          SendMessagesInThreads: locked ? false : null
        });
        await reply(message, locked ? '🔒 Canal bloqueado' : '🔓 Canal desbloqueado', locked ? 'Se bloqueó la escritura para @everyone.' : 'Se restauró el permiso de escritura para @everyone.', COLORS.success);
        return true;
      }
      case 'timeout':
      case 'mute': {
        await requirePermission(message, P.ModerateMembers);
        const member = await resolveTarget(message);
        const rest = remainingArgs(message, args);
        const durationToken = member ? rest[0] : args.find(arg => DURATION_PARTS.test(arg));
        const duration = parseDuration(durationToken);
        if (!member) throw new Error('Uso: `.timeout @usuario 13m` o responde al usuario con `.timeout 13m`.');
        assertTarget(message, member);
        if (!duration) throw new Error('Tiempo inválido. Usa, por ejemplo, `13m`, `2h` o `1d` (máximo 28 días).');
        if (!member.moderatable) throw new Error('No puedo silenciar a ese miembro por la jerarquía de roles.');
        const durationIndex = rest.indexOf(durationToken);
        const reasonText = (member ? rest.slice(durationIndex + 1) : args.filter(arg => arg !== durationToken)).join(' ') || `Timeout de ${message.author.tag}`;
        await member.timeout(duration, reasonText);
        await reply(message, '🔇 Timeout aplicado', `${member.user.tag} fue aislado durante ${durationToken}.`, COLORS.success);
        return true;
      }
      case 'ban':
      case 'kick': {
        const permission = name === 'ban' ? P.BanMembers : P.KickMembers;
        await requirePermission(message, permission);
        const member = await resolveTarget(message);
        assertTarget(message, member);
        const reasonText = remainingArgs(message, args).join(' ') || `${name} por ${message.author.tag}`;
        if (name === 'ban') {
          if (!member.bannable) throw new Error('No puedo banear a ese miembro por la jerarquía de roles.');
          await member.ban({ reason: reasonText });
        } else {
          if (!member.kickable) throw new Error('No puedo expulsar a ese miembro por la jerarquía de roles.');
          await member.kick(reasonText);
        }
        await reply(message, name === 'ban' ? '🔨 Usuario baneado' : '👢 Usuario expulsado', `${member.user.tag}\nMotivo: ${reasonText}`, COLORS.success);
        return true;
      }
      case 'serverinfo': {
        const guild = message.guild;
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle(guild.name).setThumbnail(guild.iconURL({ size: 512 })).addFields(
          { name: 'Miembros', value: String(guild.memberCount), inline: true },
          { name: 'Canales', value: String(guild.channels.cache.size), inline: true },
          { name: 'Roles', value: String(guild.roles.cache.size), inline: true },
          { name: 'Creado', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false }
        )], allowedMentions: { repliedUser: false } });
        return true;
      }
      case 'userinfo': {
        const member = await resolveTarget(message) || message.member;
        const roles = member.roles.cache.filter(role => role.id !== message.guild.id).map(role => role.toString()).slice(0, 15);
        await message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle(`Información de ${member.user.tag}`).setThumbnail(member.displayAvatarURL({ size: 512 })).addFields(
          { name: 'ID', value: member.id, inline: true },
          { name: 'Cuenta creada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`, inline: true },
          { name: 'Se unió', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'No disponible', inline: true },
          { name: 'Roles', value: roles.join(', ') || 'Ninguno' }
        )], allowedMentions: { repliedUser: false } });
        return true;
      }
      case 'nuke': {
        await requirePermission(message, P.ManageChannels);
        // Explicit `.nuke true` is the sole confirmation and executes immediately.
        if ((args[0] || '').toLowerCase() !== 'true') throw new Error('Acción irreversible. Confirma escribiendo exactamente `.nuke true`.');
        const oldChannel = message.channel;
        const replacement = await oldChannel.clone({ reason: `Canal recreado por ${message.author.tag}` });
        await replacement.setPosition(oldChannel.position).catch(() => {});
        await oldChannel.delete(`Nuke confirmado por ${message.author.tag}`);
        await replacement.send({ embeds: [card('🧹 Canal recreado', `Acción ejecutada por ${message.author.tag}.`, COLORS.success)] });
        return true;
      }
      case 'help':
      case 'ayuda':
        await message.reply({ embeds: [card('Comandos con prefijo punto', [
          '`.purge 13` — borra 1–100 mensajes.',
          '`.lock` / `.unlock` — bloquea o desbloquea el canal.',
          '`.timeout @usuario 13m` o responder con `.timeout 13m`.',
          '`.ban @usuario razón` / `.kick @usuario razón` (también se puede responder al usuario).',
          '`.serverinfo` — estadísticas del servidor.',
          '`.userinfo [@usuario]` o responder a un mensaje.',
          '`.nuke true` — recrea el canal; operación irreversible.',
          'Reacciones: `.kiss`, `.hug`, `.slap`, `.pat`, `.bite`, `.poke`, `.cuddle`, `.highfive`, `.punch`, `.tickle`, `.cry`, `.dance`, `.blush`, `.sleep`, `.happy`.'
        ].join('\n'))], allowedMentions: { repliedUser: false } });
        return true;
      default:
        return false;
    }
  } catch (error) {
    console.error(`.${name}:`, error);
    await reply(message, 'No se pudo ejecutar el comando', error.message || 'Ocurrió un error inesperado.', COLORS.error).catch(() => {});
    return true;
  }
}

function install() {
  const originalOn = Client.prototype.on;
  Client.prototype.on = function patchedOn(eventName, listener) {
    if (eventName !== 'messageCreate') return originalOn.call(this, eventName, listener);
    const wrapped = async message => {
      if (handled.has(message)) return;
      if (message.guild && !message.author.bot && message.content?.startsWith(PREFIX)) {
        const name = message.content.slice(1).trim().split(/\s+/)[0]?.toLowerCase();
        const commands = new Set(['purge', 'lock', 'unlock', 'timeout', 'mute', 'ban', 'kick', 'serverinfo', 'userinfo', 'nuke', 'help', 'ayuda']);
        if (commands.has(name)) {
          handled.add(message);
          await run(this, message);
          return;
        }
      }
      return listener.call(this, message);
    };
    return originalOn.call(this, eventName, wrapped);
  };
}

module.exports = { install };
