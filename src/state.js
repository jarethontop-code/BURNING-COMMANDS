const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'data.json');
let data = { guilds: {}, warnings: {}, balances: {}, work: {} };
try { if (fs.existsSync(file)) data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
function save() { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(data, null, 2)); fs.renameSync(tmp, file); }
module.exports = { save };
