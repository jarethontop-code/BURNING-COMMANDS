require('dotenv').config();
const { Client, GatewayIntentBits, Events, Partials } = require('discord.js');
const hybrid = require('./hybrid');
if (!process.env.DISCORD_TOKEN) {
  console.error('Falta DISCORD_TOKEN. Copia .env.example a .env y configúralo.');
  process.exit(1);
}
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration], partials: [Partials.Channel, Partials.Message] });
client.once(Events.ClientReady, async ready => {
  console.log(`Conectado como ${ready.user.tag}.`);
  try { await hybrid.registerCommands(ready); }
  catch (error) { console.error('No se pudieron registrar los slash commands:', error); }
});
client.on(Events.MessageCreate, message => hybrid.onMessage(client, message));
client.on(Events.InteractionCreate, interaction => hybrid.onInteraction(client, interaction));
client.on(Events.GuildMemberAdd, member => hybrid.onMemberAdd(member));
client.on(Events.Error, error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
client.login(process.env.DISCORD_TOKEN).catch(error => { console.error('No se pudo iniciar sesión:', error.message); process.exitCode = 1; });
