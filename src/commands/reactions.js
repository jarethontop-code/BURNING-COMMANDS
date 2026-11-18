const { memberMention } = require('../lib');
const actions = {
  kiss: { text: 'le dio un dulce beso a', endpoint: 'kiss' },
  hug: { text: 'le dio un fuerte abrazo a', endpoint: 'hug' },
  slap: { text: 'le dio una bofetada a', endpoint: 'slap' },
  pat: { text: 'acarició la cabeza de', endpoint: 'pat' },
  poke: { text: 'le picó la mejilla a', endpoint: 'poke' },
  cuddle: { text: 'se acurrucó junto a', endpoint: ' cuddle' },
  kill: { text: 'eliminó de broma a', endpoint: 'kill' }
};
const commands = Object.entries(actions).map(([name, action]) => ({
  name, category: 'Interacción', description: `Acción interactiva ${name} con GIF.`,
  async execute({ message }) {
    const member = memberMention(message); if (!member) return message.reply(`Uso: \\`.${name} @usuario\\``);
    const endpoint = action.endpoint.trim();
    try {
      const response = await fetch(`https://nekos.best/api/v2/${endpoint}`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`API status ${response.status}`);
      const data = await response.json(); const image = data.results?.[0]?.url;
      if (!image) throw new Error('GIF no disponible');
      return message.channel.send({ content: `${message.author} ${action.text} ${member}.`, embeds: [{ image: { url: image }, color: 0xE74C3C }] });
    } catch (error) {
      console.warn(`No se pudo obtener GIF ${endpoint}:`, error.message);
      return message.channel.send(`${message.author} ${action.text} ${member}. (GIF no disponible por ahora)`);
    }
  }
}));
for (const [name, endpoint, text] of [['cry', 'cry', 'se puso a llorar 😢'], ['dance', 'dance', 'se puso a bailar 💃']]) {
  commands.push({ name, category: 'Interacción', description: 'Envía una reacción con GIF.', async execute({ message }) {
    try {
      const response = await fetch(`https://nekos.best/api/v2/${endpoint}`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`API status ${response.status}`);
      const data = await response.json(); const image = data.results?.[0]?.url;
      if (!image) throw new Error('GIF no disponible');
      return message.channel.send({ content: `${message.author} ${text}`, embeds: [{ image: { url: image }, color: 0xE74C3C }] });
    } catch (error) { console.warn(`No se pudo obtener GIF ${endpoint}:`, error.message); return message.channel.send(`${message.author} ${text} (GIF no disponible por ahora)`); }
  } });
}
module.exports = commands;
