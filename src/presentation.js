const { EmbedBuilder } = require('discord.js');

// Normaliza las respuestas de texto de los comandos para que el proyecto mantenga
// una presentación consistente. Las excepciones también las convierte el router
// híbrido en embeds, y los slash replies se mantienen efímeros por defecto.
function install(hybrid) {
  for (const spec of hybrid.specs) {
    const originalRun = spec.run;
    spec.run = async context => {
      const originalReply = context.reply;
      context.reply = payload => {
        if (typeof payload === 'string') {
          return originalReply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(payload)] });
        }
        if (payload && typeof payload === 'object' && payload.content && !payload.embeds?.length) {
          const { content, ...rest } = payload;
          return originalReply({ ...rest, embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(String(content).slice(0, 4000))] });
        }
        return originalReply(payload);
      };
      return originalRun(context);
    };
  }
}

module.exports = { install };
