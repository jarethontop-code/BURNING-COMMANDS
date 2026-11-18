# BURNING-COMMANDS

Bot de Discord modular en JavaScript con discord.js v14. Los comandos se usan tanto con prefijo `.` como mediante Slash Commands `/`. Las respuestas de comandos se presentan en embeds; las respuestas slash y los errores de uso son efímeros por defecto. Los mensajes que no sean comandos se ignoran sin generar errores.

## Instalación

Requiere Node.js 20+. Crea la aplicación en [Discord Developer Portal](https://discord.com/developers/applications), activa **Message Content Intent** y **Server Members Intent**, e invita con los scopes `bot` y `applications.commands`.

```bash
npm install
cp .env.example .env
# configura DISCORD_TOKEN
npm start
```

Para antibot concede al bot **View Audit Log**, **Kick Members** y permiso para enviar DMs al propietario. No es necesario darle Administrator. El antibot retira inmediatamente cada bot no autorizado, envía al propietario un DM con botones **Acceder** y **Negar**; al autorizar, guarda solo el ID de ese bot para ese servidor y ofrece un enlace OAuth limitado a ese ID. El propietario pulsa el enlace para volver a invitarlo. Si los DMs del propietario están cerrados, la solicitud no podrá entregarse.

`DEV_GUILD_ID` es opcional: registra slash commands en un servidor de pruebas. Si se omite, se registran globalmente. `REPORT_CHANNEL_ID` y `TICKET_LOG_CHANNEL_ID` son opcionales para reportes/transcripciones.

La configuración de antibot se activa con `.antibot on` o `/antibot estado:on`; se desactiva con `off`. Todos los controles de usuario se seleccionan desde las opciones de slash, mientras que los comandos de prefijo aceptan menciones (`@usuario`). Los estados `on/off` aparecen como opciones seleccionables en slash commands.

Los avisos, ajustes y bots autorizados se guardan en `data.json`, ignorado por Git. Nekos.best se usa para los GIF. Revisa permisos y jerarquía de roles del bot antes de habilitar moderación.
