require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const moderation = require('./commands/moderation');
const security = require('./commands/security');
const support = require('./commands/support');
const games = require('./commands/games');
const reactions = require('./commands/reactions');
const { errorMessage } = require('./lib');

if (!process.env.DISCORD_TOKEN) {
  console.error('Falta DISCORD_TOKEN. Crea .env a partir de .env.example.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel, Partials.Message]
});
client.commands = new Collection();
for (const command of [...moderation, ...security, ...support, ...games, ...reactions]) {
  for (const name of [command.name, ...(command.aliases || [])]) client.commands.set(name, command);
}

client.once(Events.ClientReady, ready => console.log(`Conectado como ${ready.user.tag}. ${client.commands.size} nombres de comando cargados.`));
client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot || !message.content.startsWith('.')) return;
  const parts = message.content.slice(1).trim().split(/\s+/);
  const name = (parts.shift() || '').toLowerCase();
  if (!name) return;
  const command = client.commands.get(name);
  if (!command) return; // No responder a mensajes normales que empiezan por punto.
  try {
    await command.execute({ client, message, args: parts });
  } catch (error) {
    console.error(`Error en .${name}:`, error);
    await message.reply({ content: errorMessage(error), allowedMentions: { repliedUser: false } }).catch(() => {});
  }
});
client.on(Events.Error, error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
client.login(process.env.DISCORD_TOKEN);
