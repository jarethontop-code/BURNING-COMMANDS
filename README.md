# BURNING-COMMANDS

Bot de Discord modular en JavaScript y discord.js v14. **Todos los comandos se usan exclusivamente con el prefijo `.`**; no registra comandos slash. Incluye moderación, protección, tickets, utilidades, juegos, economía y reacciones con GIFs.

## Requisitos e instalación

Se necesita Node.js 20 o superior y un bot creado en el [Discord Developer Portal](https://discord.com/developers/applications).

```bash
npm install
cp .env.example .env
# Edita .env y agrega el token
npm start
```

En Windows PowerShell, copia el archivo con `Copy-Item .env.example .env`. Configura `DISCORD_TOKEN` en `.env`; nunca publiques ese archivo ni compartas el token. Si se filtra, restablécelo en el Developer Portal.

En **Bot → Privileged Gateway Intents** activa `Message Content Intent` y `Server Members Intent`. Invita al bot con los permisos mínimos necesarios para las funciones que usarás, como ver/enviar mensajes, gestionar mensajes, moderar miembros, gestionar canales y leer el historial. No le otorgues `Administrator` salvo que sea imprescindible.

## Configuración opcional

- `REPORT_CHANNEL_ID`: canal privado al que se envían los reportes.
- `TICKET_CATEGORY_ID`: categoría donde crear tickets.
- `STAFF_ROLE_IDS`: IDs de roles de staff separados por comas; podrán ver los tickets.

## Comandos

**Moderación** (requieren `ManageMessages` o `ModerateMembers`, según el comando):
`.purge <1-100>`, `.kick @usuario [razón]`, `.ban @usuario [razón]`, `.unban <ID>`, `.mute @usuario <tiempo> [razón]`, `.unmute @usuario`, `.warn @usuario <razón>`, `.warnings @usuario`, `.clearwarns @usuario`, `.nick @usuario <nombre>`.

Los tiempos de mute admiten `30s`, `10m`, `2h`, `1d` y combinaciones como `1h30m` (máximo 28 días). Los avisos y saldos se guardan en `data.json`.

**Seguridad** (requiere `ManageGuild`, `ManageChannels` o `ManageMessages`):
`.antilink on|off`, `.antispam on|off`, `.lock`, `.unlock`, `.slowmode <0-21600>`, `.nuke`.

`.nuke` requiere confirmación explícita: escribe `.nuke` y luego `.nuke confirm` en el mismo canal dentro de 15 segundos. Clona la configuración del canal y elimina el original; el historial del canal original no se puede recuperar. Úsalo solo cuando sea necesario.

**Soporte y utilidad:** `.help` / `.ayuda`, `.ticket`, `.close` (confirma con `.close confirm` o cancela con `.close cancel`), `.report @usuario <motivo>`, `.userinfo [@usuario]`, `.serverinfo`, `.avatar [@usuario]`, `.ping`.

**Juegos y economía:** `.8ball <pregunta>`, `.coinflip`, `.rps <piedra|papel|tijera>`, `.roll [caras]`, `.trivia` (15 segundos), `.ship @usuario1 @usuario2`, `.work`, `.bal [@usuario]`.

**Interacción:** `.kiss @usuario`, `.hug @usuario`, `.slap @usuario`, `.pat @usuario`, `.poke @usuario`, `.cuddle @usuario`, `.kill @usuario`, `.cry`, `.dance`.

Los comandos administrativos validan permisos del usuario y del bot. Los errores y argumentos inválidos reciben una respuesta explicativa. Las acciones de moderación están sujetas a la jerarquía de roles y permisos configurada en Discord.
