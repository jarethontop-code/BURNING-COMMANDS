const { EmbedBuilder } = require('discord.js');
const { memberMention, balance, addCoins, lastWork, setLastWork } = require('../lib');
const commands = [];
function command(name, description, execute) { commands.push({ name, description, category: 'Juegos y economía', execute }); }
command('8ball', 'Responde una pregunta al azar.', async ({ message, args }) => {
  if (!args.length) return message.reply('Uso: `.8ball <pregunta>`');
  const answers = ['Sí, sin duda.', 'Es muy probable.', 'Las señales apuntan que sí.', 'Todo indica que sí.', 'No lo creo.', 'Es poco probable.', 'No cuentes con ello.', 'Tal vez.', 'No puedo predecirlo ahora.', 'Pregunta de nuevo más tarde.'];
  await message.reply(`🎱 ${answers[Math.floor(Math.random() * answers.length)]}`);
});
command('coinflip', 'Lanza una moneda.', async ({ message }) => message.reply(`🪙 Salió **${Math.random() < 0.5 ? 'cara' : 'cruz'}**.`));
command('rps', 'Juega piedra, papel o tijera.', async ({ message, args }) => {
  const choices = { piedra: 'piedra', papel: 'papel', tijera: 'tijera' }, user = (args[0] || '').toLowerCase();
  if (!choices[user]) return message.reply('Uso: `.rps <piedra|papel|tijera>`');
  const bot = Object.keys(choices)[Math.floor(Math.random() * 3)];
  const result = user === bot ? 'Empate.' : ((user === 'piedra' && bot === 'tijera') || (user === 'papel' && bot === 'piedra') || (user === 'tijera' && bot === 'papel')) ? '¡Ganaste!' : 'Gané yo.';
  await message.reply(`Tú: **${user}** · Bot: **${bot}**. ${result}`);
});
command('roll', 'Lanza un dado del 1 al máximo indicado (1000000).', async ({ message, args }) => {
  const sides = args[0] === undefined ? 6 : Number(args[0]);
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000000) return message.reply('Uso: `.roll [caras: 2-1000000]`');
  await message.reply(`🎲 Resultado: **${Math.floor(Math.random() * sides) + 1}** (1–${sides}).`);
});
const trivia = [
  { q: '¿Cuál es el planeta más grande del sistema solar?', a: 'jupiter', options: 'Marte · Júpiter · Saturno' },
  { q: '¿Cuántos lados tiene un hexágono?', a: '6', options: '5 · 6 · 8' },
  { q: '¿Cuál es la capital de Japón?', a: 'tokio', options: 'Seúl · Tokio · Pekín' },
  { q: '¿Qué gas absorben principalmente las plantas?', a: 'dioxido de carbono', options: 'Oxígeno · Dióxido de carbono · Helio' },
  { q: '¿Quién escribió Don Quijote de la Mancha?', a: 'miguel de cervantes', options: 'Lope de Vega · Miguel de Cervantes · Quevedo' }
];
command('trivia', 'Hace una pregunta de cultura general (15 segundos).', async ({ message }) => {
  const item = trivia[Math.floor(Math.random() * trivia.length)];
  await message.channel.send(`🧠 **${item.q}**\nOpciones: ${item.options}\nResponde en 15 segundos.`);
  const collected = await message.channel.awaitMessages({ filter: m => !m.author.bot, max: 1, time: 15000 });
  if (!collected.size) return message.channel.send(`⌛ Se acabó el tiempo. La respuesta era **${item.a}**.`);
  const answer = collected.first();
  if (answer.content.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === item.a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()) await answer.reply('✅ ¡Correcto!');
  else await answer.reply(`❌ No era esa. La respuesta correcta era **${item.a}**.`);
});
command('ship', 'Calcula una compatibilidad divertida.', async ({ message }) => {
  const users = message.mentions.users;
  if (users.size < 2) return message.reply('Uso: `.ship @usuario1 @usuario2`');
  const [a, b] = [...users.values()].slice(0, 2), percentage = Math.floor(Math.random() * 101), filled = Math.round(percentage / 10);
  await message.reply(`💞 **${a.username} + ${b.username}**\n${'❤️'.repeat(filled)}${'🤍'.repeat(10 - filled)} **${percentage}%** de compatibilidad (solo por diversión).`);
});
command('work', 'Trabaja para ganar monedas (cooldown de 20 minutos).', async ({ message }) => {
  const wait = 20 * 60 * 1000 - (Date.now() - lastWork(message.guild.id, message.author.id));
  if (wait > 0) return message.reply(`Ya trabajaste. Vuelve en **${Math.ceil(wait / 60000)} minuto(s)**.`);
  const earned = 50 + Math.floor(Math.random() * 151); setLastWork(message.guild.id, message.author.id, Date.now());
  const total = addCoins(message.guild.id, message.author.id, earned);
  await message.reply(`💼 Ganaste **${earned}** monedas. Saldo: **${total}** 🪙`);
});
command('bal', 'Muestra tu saldo o el de otro miembro.', async ({ message }) => {
  const member = memberMention(message) || message.member;
  await message.reply(`🪙 Saldo de **${member.user.tag}**: **${balance(message.guild.id, member.id)}** monedas.`);
});
module.exports = commands;
