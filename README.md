# BURNING-COMMANDS

Bot de Discord con módulo de reacciones sociales para discord.js v14. Los comandos sociales se pueden usar con el prefijo `.`: `.kiss @usuario`, `.hug @usuario`, `.slap @usuario`, `.pat @usuario`, `.bite @usuario`, `.poke @usuario`, `.cuddle @usuario`, `.highfive @usuario`, `.punch @usuario`, `.tickle @usuario`, y `.cry`, `.dance`, `.blush`, `.sleep`, `.happy` sin mención.

## Activar comandos con `.`

El proceso arranca con `npm start` (usa `src/start.js`, que instala primero el manejador social). En Discord Developer Portal, abre **Bot → Privileged Gateway Intents** y activa **Message Content Intent**, **Server Members Intent** y **Server Members Moderation Intent**; el entrypoint solicita esos intents para el bot. También configura `DISCORD_TOKEN` en el entorno de despliegue. Si Discord muestra `Used disallowed intents`, falta activar uno o más intents en Developer Portal. Reinicia el servicio después de cambiarlo.

Las reacciones con usuario muestran embed y GIF de Nekos.best, y botones que solo puede pulsar la persona mencionada. Al responder, se desactivan los botones originales y se publica el embed de respuesta. Caducan a los 120 segundos. No se permite mencionar al autor, al propio bot ni a otro bot.

Instalación: `npm install`; ejecución: `npm start`. Si falla la API de GIF, la reacción se envía sin imagen.
