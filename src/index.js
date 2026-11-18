require('dotenv').config();
const { Client, GatewayIntentBits, Events, Partials } = require('discord.js');
const hybrid = require('./hybrid');
const antibot = require('./antibot');
require('./presentation').install(hybrid);

if (!process.env.DISCORD_TOKEN) {
  console.error('Falta DISCORD_TOKEN. Copia .env.example a .env y configúralo.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration],
  partials: [Partials.Channel, Partials.Message]
});

client.once(Events.ClientReady, async ready => {
  console.log(`Conectado como ${ready.user.tag}.`);
  try {
    await hybrid.registerCommands(ready);
  } catch (error) {
    console.error('No se pudieron registrar los slash commands:', error);
  }
});
client.on(Events.MessageCreate, message => hybrid.onMessage(client, message));
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (await antibot.onInteraction(interaction, hybrid)) return;
    await hybrid.onInteraction(client, interaction);
  } catch (error) {
    console.error('Error procesando interacción:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ embeds: [{ color: 0xE74C3C, title: 'No se pudo completar', description: 'Ocurrió un error inesperado. Inténtalo de nuevo más tarde.' }], ephemeral: true }).catch(() => {});
    }
  }
});
client.on(Events.GuildMemberAdd, member => antibot.onMemberAdd(member, client, hybrid));
client.on(Events.Error, error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('No se pudo iniciar sesión:', error.message);
  process.exitCode = 1;
});
