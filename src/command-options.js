const { ApplicationCommandOptionType: O, ChannelType, EmbedBuilder, PermissionFlagsBits: P } = require('discord.js');

const ROLE = O.Role;
const CHANNEL = O.Channel;
const CATEGORY_CHANNEL_TYPES = [ChannelType.GuildCategory];
const SETTINGS = [
  { name: 'ticket-rol', option: 'rol', type: ROLE },
  { name: 'ticket-categoria', option: 'categoria', type: CHANNEL, channel_types: CATEGORY_CHANNEL_TYPES }
];

function makeEmbed(title, description, color = 0x5865F2) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}
function addOptionCommands(hybrid) {
  // Discord's native Role/Channel option pickers replace error-prone string IDs.
  for (const config of SETTINGS) {
    const spec = hybrid.specs.find(item => item.name === config.name);
    if (!spec) continue;
    const option = spec.options.find(item => item.name === config.option);
    if (option) {
      option.type = config.type;
      if (config.channel_types) option.channel_types = config.channel_types;
    }
  }

  // Provide explicit channel selectors for report delivery and ticket transcripts.
  const channelCommands = [
    { name: 'report-channel', description: 'Elige el canal privado que recibirá los reportes.', option: 'canal', setting: 'reportChannelId' },
    { name: 'ticket-log-channel', description: 'Elige el canal donde se guardan las transcripciones.', option: 'canal', setting: 'ticketLogChannelId' }
  ];
  for (const item of channelCommands) {
    if (hybrid.specs.some(spec => spec.name === item.name)) continue;
    hybrid.specs.push({
      name: item.name,
      description: item.description,
      permission: P.ManageGuild,
      options: [{ type: CHANNEL, name: item.option, description: 'Selecciona un canal de texto', required: true, channel_types: [ChannelType.GuildText, ChannelType.GuildAnnouncement] }],
      async run(ctx) {
        const channelId = ctx.value(item.option);
        if (!channelId || !ctx.guild.channels.cache.has(channelId)) throw new Error('Selecciona un canal válido de este servidor.');
        hybrid.settings(ctx.guild.id)[item.setting] = channelId;
        hybrid.save();
        await ctx.reply({ embeds: [makeEmbed('Configuración actualizada', `Canal seleccionado: <#${channelId}>`, 0x2ECC71)] });
      }
    });
  }

  // Resolve typed slash options to IDs for existing handlers that persist IDs.
  for (const spec of hybrid.specs) {
    const originalRun = spec.run;
    spec.run = async ctx => {
      const originalValue = ctx.value;
      ctx.value = (name, position) => {
        if (ctx.isSlash && spec.name === 'ticket-rol' && name === 'rol') return ctx.interaction.options.getRole('rol')?.id ?? null;
        if (ctx.isSlash && spec.name === 'ticket-categoria' && name === 'categoria') return ctx.interaction.options.getChannel('categoria')?.id ?? null;
        if (ctx.isSlash && ['report-channel', 'ticket-log-channel'].includes(spec.name) && name === 'canal') return ctx.interaction.options.getChannel('canal')?.id ?? null;
        return originalValue(name, position);
      };
      try {
        return await originalRun(ctx);
      } catch (error) {
        // Keep actionable validation errors, but never expose raw implementation exceptions to users.
        if (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError) {
          console.error(`Error interno en ${ctx.isSlash ? '/' : '.'}${spec.name}:`, error);
          throw new Error('Ocurrió un error interno al ejecutar el comando. Inténtalo de nuevo más tarde.');
        }
        throw error;
      }
    };
  }
}

module.exports = { addOptionCommands };
