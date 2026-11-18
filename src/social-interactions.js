const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Client
} = require('discord.js');

const BUTTON_PREFIX = 'social-reaction:';
const TIMEOUT_MS = 120_000;

// Central registry: labels, response text and Nekos.best GIF categories live together.
const SOCIAL = {
  kiss: {
    initial: '{author} le dio un dulce beso a {target}', gif: 'kiss', chain: true,
    buttons: [
      { id: 'return', label: 'Devolver beso', emoji: '💋', text: '{target} le devolvió el beso apasionadamente a {author}', gif: 'kiss', chain: true },
      { id: 'blush', label: 'Sonrojarse', emoji: '😳', text: '{target} se puso rojo como un tomate por el beso de {author}', gif: 'blush' },
      { id: 'dodge', label: 'Esquivar', emoji: '👋', text: '{target} esquivó el beso de {author} y salió corriendo', gif: 'run' }
    ]
  },
  hug: {
    initial: '{author} le dio un fuerte abrazo a {target}', gif: 'hug',
    buttons: [
      { id: 'return', label: 'Abrazar de vuelta', emoji: '🫂', text: '{target} abrazó de vuelta con mucho cariño a {author}', gif: 'hug' },
      { id: 'cuddle', label: 'Acurrucarse', emoji: '🥰', text: '{target} se acurrucó cómodamente junto a {author}', gif: 'cuddle' }
    ]
  },
  slap: {
    initial: '{author} le dio una tremenda bofetada a {target}', gif: 'slap',
    buttons: [
      { id: 'return', label: 'Devolver bofetada', emoji: '✋', text: '{target} no se quedó atrás y le devolvió la bofetada a {author}', gif: 'slap' },
      { id: 'cry', label: 'Llorar', emoji: '😢', text: '{target} se puso a llorar por el golpe de {author}', gif: 'cry' },
      { id: 'block', label: 'Bloquear', emoji: '🛡️', text: '{target} detuvo la mano de {author} en el aire', gif: 'smug' }
    ]
  },
  pat: {
    initial: '{author} acarició suavemente la cabeza de {target}', gif: 'pat',
    buttons: [
      { id: 'happy', label: 'Disfrutar', emoji: '😊', text: '{target} cerró los ojos y disfrutó las caricias de {author}', gif: 'happy' },
      { id: 'poke', label: 'Picar mejilla', emoji: '👉', text: '{target} le picó la mejilla en respuesta a {author}', gif: 'poke' }
    ]
  },
  bite: {
    initial: '{author} le dio un mordisco a {target}', gif: 'bite',
    buttons: [
      { id: 'return', label: 'Morder de vuelta', emoji: '🦷', text: '{target} mordió de vuelta a {author} por venganza', gif: 'bite' },
      { id: 'angry', label: 'Enojarse', emoji: '💢', text: '{target} se enfadó muchísimo con {author}', gif: 'pout' }
    ]
  },
  poke: {
    initial: '{author} le picó la mejilla a {target} para llamar su atención', gif: 'poke',
    buttons: [
      { id: 'return', label: 'Picar de vuelta', emoji: '👉', text: '{target} empezó una guerra de piquetes con {author}', gif: 'poke' },
      { id: 'laugh', label: 'Reírse', emoji: '😆', text: '{target} se murió de risa por las cosquillas de {author}', gif: 'laugh' }
    ]
  },
  cuddle: {
    initial: '{author} se acurrucó junto a {target}', gif: 'cuddle',
    buttons: [
      { id: 'closer', label: 'Acurrucarse más', emoji: '💞', text: '{target} abrazó aún más fuerte a {author}', gif: 'cuddle' },
      { id: 'sleep', label: 'Dormirse', emoji: '😴', text: '{target} se quedó profundamente dormido junto a {author}', gif: 'sleep' }
    ]
  },
  highfive: {
    initial: '{author} levantó la mano para chocar los cinco con {target}', gif: 'highfive',
    buttons: [
      { id: 'return', label: 'Chocar los cinco', emoji: '🙌', text: '¡{target} chocó los cinco épica y fuertemente con {author}!', gif: 'highfive' },
      { id: 'ignore', label: 'Dejar en visto', emoji: '💨', text: '{target} ignoró la mano de {author} y lo dejó colgado', gif: 'shrug' }
    ]
  },
  punch: {
    initial: '{author} le lanzó un golpe directo a {target}', gif: 'punch',
    buttons: [
      { id: 'counter', label: 'Contraatacar', emoji: '🥊', text: '{target} contraatacó con un golpe más fuerte hacia {author}', gif: 'punch' },
      { id: 'dodge', label: 'Esquivar', emoji: '🤸', text: '{target} esquivó el ataque de {author} con reflejos ninja', gif: 'smug' }
    ]
  },
  tickle: {
    initial: '{author} empezó a hacerle cosquillas sin parar a {target}', gif: 'tickle',
    buttons: [
      { id: 'laugh', label: 'Reír a carcajadas', emoji: '🤣', text: '{target} no puede parar de reír por culpa de {author}', gif: 'laugh' },
      { id: 'revenge', label: 'Venganza de cosquillas', emoji: '👐', text: '{target} le devolvió las cosquillas a {author}', gif: 'tickle' }
    ]
  }
};

const INDIVIDUAL = {
  cry: { text: '{author} se puso a llorar', gif: 'cry' },
  dance: { text: '{author} se puso a bailar', gif: 'dance' },
  blush: { text: '{author} se sonrojó', gif: 'blush' },
  sleep: { text: '{author} se quedó dormido', gif: 'sleep' },
  happy: { text: '{author} está muy feliz', gif: 'happy' }
};
const SOCIAL_NAMES = new Set([...Object.keys(SOCIAL), ...Object.keys(INDIVIDUAL)]);
const COLORS = { initial: 0xE74C3C, response: 0x9B59B6 };

function format(text, author, target) {
  return text.replaceAll('{author}', author).replaceAll('{target}', target || '');
}
function makeEmbed(text, image, color = COLORS.initial) {
  const result = new EmbedBuilder().setColor(color).setDescription(text).setTimestamp();
  if (image) result.setImage(image);
  return result;
}
async function randomGif(category) {
  try {
    const response = await fetch(`https://nekos.best/api/v2/${encodeURIComponent(category)}`, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    return (await response.json()).results?.[0]?.url || null;
  } catch (error) {
    console.warn(`GIF ${category} no disponible:`, error.message);
    return null;
  }
}
function disabledRows(rows) {
  return rows.map(row => ActionRowBuilder.from(row).setComponents(
    ...row.components.map(button => ButtonBuilder.from(button).setDisabled(true))
  ));
}
function buttonRows(commandName, sessionId, buttons) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5).map(button =>
      new ButtonBuilder()
        .setCustomId(`${BUTTON_PREFIX}${sessionId}:${commandName}:${button.id}`)
        .setLabel(button.label)
        .setEmoji(button.emoji)
        .setStyle(ButtonStyle.Secondary)
    )));
  }
  return rows;
}
async function sendSocialMessage(channel, { commandName, text, gifCategory, author, target, responder, buttons = [], chain = false }) {
  const gif = await randomGif(gifCategory);
  const message = await channel.send({
    embeds: [makeEmbed(format(text, author, target), gif)],
    components: buttons.length ? buttonRows(commandName, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, buttons) : [],
    allowedMentions: { parse: [] }
  });
  if (!buttons.length) return message;

  const collector = message.createMessageComponentCollector({
    time: TIMEOUT_MS,
    filter: component => component.customId.startsWith(BUTTON_PREFIX)
  });
  collector.on('collect', async component => {
    if (component.user.id !== responder.id) {
      await component.reply({ content: `¡Estos botones son solo para ${responder}!`, ephemeral: true }).catch(() => {});
      return;
    }
    const [, , sessionId, actionCommand, actionId] = component.customId.split(':');
    if (!message.components.some(row => row.components.some(button => button.customId === component.customId))) {
      await component.reply({ content: 'Esta interacción ya terminó.', ephemeral: true }).catch(() => {});
      return;
    }
    const parentConfig = SOCIAL[actionCommand];
    const action = parentConfig?.buttons.find(item => item.id === actionId);
    if (!action) {
      await component.reply({ content: 'Esta interacción ya no está disponible.', ephemeral: true }).catch(() => {});
      return;
    }

    collector.stop('answered');
    await component.update({ components: disabledRows(message.components) }).catch(() => {});
    const shouldChain = Boolean(action.chain && actionCommand === 'kiss');
    await sendSocialMessage(component.channel, {
      commandName: actionCommand,
      text: action.text,
      gifCategory: action.gif,
      author: target,
      target: author,
      responder: author,
      buttons: shouldChain ? parentConfig.buttons : [],
      chain: shouldChain
    });
  });
  collector.on('end', async (_collected, reason) => {
    if (reason === 'answered' || !message.components.length) return;
    await message.edit({ components: disabledRows(message.components) }).catch(() => {});
  });
  return message;
}

function mentionTarget(message) {
  return message.mentions.members.first() || null;
}
function rejectTarget(target, author, client) {
  if (!target) return 'Menciona a un usuario del servidor.';
  if (target.id === author.id) return 'No puedes usar este comando contigo mismo.';
  if (target.user.bot || target.id === client.user.id) return 'No puedes usar este comando mencionando un bot.';
  return null;
}

async function runPrefix(client, message, name) {
  const config = SOCIAL[name];
  if (config) {
    const target = mentionTarget(message);
    const error = rejectTarget(target, message.author, client);
    if (error) {
      await message.reply({ embeds: [makeEmbed(error, null, 0xE74C3C)], allowedMentions: { repliedUser: false } }).catch(() => {});
      return true;
    }
    await sendSocialMessage(message.channel, {
      commandName: name,
      text: config.initial,
      gifCategory: config.gif,
      author: message.member.displayName,
      target: target.displayName,
      responder: target.user,
      buttons: config.buttons
    });
    return true;
  }
  const individual = INDIVIDUAL[name];
  if (individual) {
    await sendSocialMessage(message.channel, {
      commandName: name, text: individual.text, gifCategory: individual.gif,
      author: message.member.displayName, target: null, responder: message.author
    });
    return true;
  }
  return false;
}

async function runSlash(client, interaction) {
  const name = interaction.commandName;
  const config = SOCIAL[name];
  if (config) {
    const member = interaction.options.getMember('usuario');
    const user = interaction.options.getUser('usuario');
    const target = member || (user ? await interaction.guild.members.fetch(user.id).catch(() => null) : null);
    const error = rejectTarget(target, interaction.user, client);
    if (error) {
      await interaction.reply({ embeds: [makeEmbed(error, null, 0xE74C3C)], ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    await sendSocialMessage(interaction.channel, {
      commandName: name,
      text: config.initial,
      gifCategory: config.gif,
      author: interaction.member.displayName || interaction.user.username,
      target: target.displayName,
      responder: target.user,
      buttons: config.buttons
    });
    await interaction.editReply({ embeds: [makeEmbed(`Acción enviada a ${target.user.tag}.`, null, 0x2ECC71)] });
    return true;
  }
  const individual = INDIVIDUAL[name];
  if (individual) {
    await interaction.deferReply({ ephemeral: true });
    await sendSocialMessage(interaction.channel, {
      commandName: name, text: individual.text, gifCategory: individual.gif,
      author: interaction.member.displayName || interaction.user.username,
      target: null, responder: interaction.user
    });
    await interaction.editReply({ embeds: [makeEmbed('Reacción publicada.', null, 0x2ECC71)] });
    return true;
  }
  return false;
}

function install() {
  const originalOn = Client.prototype.on;
  Client.prototype.on = function patchedOn(eventName, listener) {
    if (eventName === 'messageCreate') {
      const wrapped = async message => {
        if (message.guild && !message.author.bot && message.content?.startsWith('.')) {
          const [name] = message.content.slice(1).trim().split(/\s+/);
          if (SOCIAL_NAMES.has((name || '').toLowerCase())) {
            try { if (await runPrefix(this, message, name.toLowerCase())) return; }
            catch (error) {
              console.error(`Error en comando social .${name}:`, error);
              await message.reply({ embeds: [makeEmbed('No se pudo completar', 'La reacción no está disponible ahora. Inténtalo de nuevo.', 0xE74C3C)], allowedMentions: { repliedUser: false } }).catch(() => {});
            }
            return;
          }
        }
        return listener.call(this, message);
      };
      return originalOn.call(this, eventName, wrapped);
    }
    if (eventName === 'interactionCreate') {
      const wrapped = async interaction => {
        if (interaction.isChatInputCommand?.() && SOCIAL_NAMES.has(interaction.commandName)) {
          try { if (await runSlash(this, interaction)) return; }
          catch (error) {
            console.error(`Error en comando social /${interaction.commandName}:`, error);
            const payload = { embeds: [makeEmbed('No se pudo completar', 'La reacción no está disponible ahora. Inténtalo de nuevo.', 0xE74C3C)], ephemeral: true };
            if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
            else await interaction.reply(payload).catch(() => {});
          }
          return;
        }
        return listener.call(this, interaction);
      };
      return originalOn.call(this, eventName, wrapped);
    }
    return originalOn.call(this, eventName, listener);
  };
}

module.exports = { install, SOCIAL, INDIVIDUAL };
