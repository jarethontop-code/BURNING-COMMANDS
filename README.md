# BURNING-COMMANDS

Bot de moderación y comunidad para Discord con JavaScript y discord.js v14. **Todos los comandos funcionan exclusivamente con el prefijo `.`**; no se registran comandos slash.

## Instalar y arrancar

Requisitos: Node.js 20 o superior y una aplicación de bot en [Discord Developer Portal](https://discord.com/developers/applications).

```bash
npm install
cp .env.example .env
# Edita .env y configura DISCORD_TOKEN
npm start
```

En Windows PowerShell, usa `Copy-Item .env.example .env`. Nunca subas `.env` ni compartas el token; si se expone, restablécelo en Developer Portal. Activa **Message Content Intent** y **Server Members Intent** en la configuración del bot. Otorga solo los permisos que vayas a utilizar; no es necesario dar `Administrator`.

## Ajustes opcionales en `.env`

- `REPORT_CHANNEL_ID`: ID del canal privado de reportes.
- `TICKET_CATEGORY_ID`: ID de la categoría de tickets.
- `STAFF_ROLE_IDS`: IDs de roles del staff separados por comas. Estos roles pueden ver tickets.

## Comandos

**Moderación:** `.purge <1-100>`, `.kick @usuario [razón]`, `.ban @usuario [razón]`, `.unban <ID>`, `.mute @usuario <tiempo> [razón]`, `.unmute @usuario`, `.warn @usuario <razón>`, `.warnings @usuario`, `.clearwarns @usuario`, `.nick @usuario <nombre>`.

**Seguridad:** `.antilink on|off`, `.antispam on|off`, `.lock`, `.unlock`, `.slowmode <0-21600>`, `.nuke` (requiere `.nuke confirm` en 15 segundos; la eliminación del historial es irreversible).

**Soporte/utilidad:** `.help` / `.ayuda`, `.ticket`, `.close` (confirma con `.close confirm` o cancela con `.close cancel`), `.report @usuario <motivo>`, `.userinfo [@usuario]`, `.serverinfo`, `.avatar [@usuario]`, `.ping`.

**Juegos/economía:** `.8ball <pregunta>`, `.coinflip`, `.rps <piedra|papel|tijera>`, `.roll [caras]`, `.trivia` (15 segundos), `.ship @usuario1 @usuario2`, `.work`, `.bal [@usuario]`.

**Interacción:** `.kiss @usuario`, `.hug @usuario`, `.slap @usuario`, `.pat @usuario`, `.poke @usuario`, `.cuddle @usuario`, `.kill @usuario`, `.cry`, `.dance`. Los GIFs se consultan en Nekos.best; si la API falla, los comandos responden con texto.

Los avisos, ajustes de seguridad y monedas se guardan localmente en `data.json` (no se sube al repositorio). Los comandos de staff verifican permisos; Discord además aplica jerarquía de roles y permisos del bot. Para `mute`, usa duraciones como `30s`, `10m`, `2h`, `1d` o `1h30m` (máximo 28 días).
