const { EmbedBuilder } = require('discord.js');

function install(hybrid) {
  for (const spec of hybrid.specs) {
    const originalRun = spec.run;
    spec.run = async context => {
      const originalReply = context.reply;
      context.reply = payload => {
        // Avoid secondary TypeErrors when a handler accidentally replies without a payload.
        const safePayload = payload ?? { content: 'Comando completado.' };
        if (typeof safePayload === 'string') {
          return originalReply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(safePayload)] });
        }
        if (safePayload && typeof safePayload === 'object' && safePayload.content && !safePayload.embeds?.length) {
          const { content, ...rest } = safePayload;
          return originalReply({ ...rest, embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(String(content).slice(0, 4000))] });
        }
        return originalReply(safePayload);
      };
      return originalRun(context);
    };
  }
}

module.exports = { install };
