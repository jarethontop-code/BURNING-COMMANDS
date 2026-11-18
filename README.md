# BURNING-COMMANDS

Bot de Discord modular en JavaScript con discord.js v14. Los comandos de moderación, seguridad, soporte e interacción funcionan tanto con prefijo `.` como mediante Slash Commands `/`. Las respuestas de slash son efímeras por defecto; los GIF y las sugerencias se publican en el canal.

## Instalación

Requiere Node.js 20+. Crea la aplicación y el bot en [Discord Developer Portal](https://discord.com/developers/applications), habilita **Message Content Intent** y **Server Members Intent**, y concede los permisos necesarios (sin `Administrator` si no hace falta).

```bash
npm install
cp .env.example .env
# establece DISCORD_TOKEN en .env
npm start
```

En Windows: `Copy-Item .env.example .env`. Invita al bot con `applications.commands` además de `bot`. Para gestionar el modo antibot, concede también **View Audit Log**. El token debe permanecer privado; si se expone, rótalo en Developer Portal.

## Variables de entorno

- `DISCORD_TOKEN`: token secreto del bot (obligatorio).
- `DEV_GUILD_ID`: opcional, registra los slash commands en un servidor de pruebas. Si se omite, se registran globalmente.
- `REPORT_CHANNEL_ID`: canal privado para `.report` y `/report`.
- `TICKET_LOG_CHANNEL_ID`: canal opcional para transcripciones de tickets; si no se define, la transcripción se adjunta antes de borrar el ticket.

El rol de tickets se configura dentro del servidor con `.ticket-rol @rol` o `/ticket-rol`; la categoría con `.ticket-categoria nombre/ID` o `/ticket-categoria`. Si no se indica categoría, se crea/usa una categoría `tickets`.

## Comandos

**Moderación (staff):** `.purge` `/purge`, `.purgeuser` `/purgeuser`, `.kick` `/kick`, `.ban` `/ban`, `.softban` `/softban`, `.unban` `/unban`, `.mute` `/mute`, `.unmute` `/unmute`, `.warn` `/warn`, `.warnings` `/warnings`, `.clearwarns` `/clearwarns`, `.nick` `/nick`.

**Seguridad (staff):** `.antilink on|off` `/antilink`, `.antispam on|off` `/antispam`, `.antibot on|off` `/antibot`, `.lock` `/lock`, `.unlock` `/unlock`, `.lockall` `/lockall`, `.unlockall` `/unlockall`, `.slowmode` `/slowmode`, `.nuke confirm` `/nuke confirmar:true` (acción irreversible con confirmación).

**Soporte/administración:** `.help` `/help`, `.ticket-panel` `/ticket-panel`, `.ticket-rol` `/ticket-rol`, `.ticket-categoria` `/ticket-categoria`, `.ticket` `/ticket` o botón del panel, `.adduser` `/adduser`, `.removeuser` `/removeuser`, `.close` `/close`, `.report` `/report`, `.suggest` `/suggest`, `.userinfo` `/userinfo`, `.serverinfo` `/serverinfo`, `.ping` `/ping`.

**Interacción con GIF:** `.kiss` `/kiss`, `.hug` `/hug`, `.slap` `/slap`, `.pat` `/pat`, `.poke` `/poke`, `.cuddle` `/cuddle`, `.bite` `/bite`, `.highfive` `/highfive`, `.punch` `/punch`, `.cry` `/cry`, `.dance` `/dance`, `.blush` `/blush`, `.sleep` `/sleep`, `.happy` `/happy`.

Los avisos, configuración y tickets se guardan en `data.json` (ignorado por Git). Los GIF se consultan en Nekos.best. Discord aplica jerarquía de roles además de los permisos comprobados por el bot.
