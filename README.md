# BURNING-COMMANDS

Bot de Discord modular en JavaScript con discord.js v14. Los comandos se usan tanto con `.` como con Slash Commands `/`. Las respuestas de comandos y errores se presentan en embeds; las respuestas slash y errores de uso son efímeros. Los mensajes normales que no sean comandos se ignoran.

## Instalación

Requiere Node.js 20+. Activa **Message Content Intent** y **Server Members Intent** en Developer Portal. Invita con los scopes `bot` y `applications.commands`, y concede solo los permisos usados.

```bash
npm install
cp .env.example .env
# configura DISCORD_TOKEN
npm start
```

El slash `/ticket-rol` muestra un selector de roles; `/ticket-categoria` un selector de categorías; `/report-channel` y `/ticket-log-channel` permiten seleccionar canales de texto. En los comandos con prefijo puedes usar menciones o IDs. Estas opciones son solo para administradores con `Manage Server`.

El antibot se activa con `.antibot on` o `/antibot estado:on`. Un bot no autorizado se retira y el propietario recibe un DM con botones para autorizar o denegar ese ID de bot. El bot necesita **View Audit Log**, **Kick Members** y poder enviar DM al propietario.

Las configuraciones y avisos se guardan en `data.json` (ignorado por Git). `DEV_GUILD_ID`, `REPORT_CHANNEL_ID` y `TICKET_LOG_CHANNEL_ID` son opcionales.
