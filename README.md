# BURNING-COMMANDS

Bot de Discord con comandos híbridos y reacciones sociales. Arranca mediante `npm start` (Node.js 20+).

## Comandos con prefijo `.`

- `.purge 13` — elimina hasta 100 mensajes recientes.
- `.lock` / `.unlock` — bloquea o desbloquea el canal actual.
- `.timeout @usuario 13m` o responde al mensaje de un usuario con `.timeout 13m`; `.mute` es alias.
- `.ban @usuario [razón]` y `.kick @usuario [razón]`; también puedes responder al mensaje del usuario y escribir `.ban [razón]` o `.kick [razón]`.
- `.serverinfo` — estadísticas del servidor.
- `.userinfo [@usuario]` — consulta tu perfil, menciona a un miembro o responde a su mensaje.
- `.nuke true` — recrea inmediatamente el canal. Esta acción borra el historial del canal original y es irreversible; solo ejecuta el comando si realmente deseas borrarlo.
- `.help` — lista de comandos principales.

Las reacciones `.kiss`, `.hug`, `.slap`, `.pat`, `.bite`, `.poke`, `.cuddle`, `.highfive`, `.punch`, `.tickle`, `.cry`, `.dance`, `.blush`, `.sleep` y `.happy` están incluidas en `src/social-interactions.js`.

## Configuración de Discord

Define `DISCORD_TOKEN` en el entorno de ejecución. Activa **Message Content Intent** y **Server Members Intent** en Developer Portal; son necesarios para comandos de prefijo y consultar miembros. Dale al bot permisos mínimos: gestionar mensajes, canales, miembros, moderar miembros y ver mensajes. El bot debe tener un rol superior al de los usuarios que modera.

```bash
npm install
npm start
```
