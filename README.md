# BURNING-COMMANDS

Módulo de interacciones sociales para Discord.js v14. Los comandos sociales existentes se interceptan antes del router actual y admiten prefijo `.` y slash `/`: `kiss`, `hug`, `slap`, `pat`, `bite`, `poke`, `cuddle`, `highfive`, `punch`, `tickle`, `cry`, `dance`, `blush`, `sleep`, `happy`.

Las reacciones con usuario muestran un embed y GIF de Nekos.best con botones. Solo el usuario mencionado puede responder; cada clic desactiva el mensaje de botones y publica la respuesta con otro GIF. Los botones caducan y se desactivan a los 120 segundos. En `kiss`, «Devolver beso» permite continuar la conversación con una nueva ronda de botones. No se permite mencionar al autor del comando, al propio bot ni a otro bot.

El arranque usa `src/start.js`, que instala el manejador social y después carga la aplicación existente. Ejecuta `npm install` y `npm start`. Para comandos `.` habilita `ENABLE_PRIVILEGED_INTENTS=true` en el entorno y activa **Message Content Intent** y **Server Members Intent** en Discord Developer Portal. Los comandos slash aparecen una vez que Discord sincronice el registro del bot.

Si Nekos.best no responde, se conserva el embed textual y la interacción sigue disponible.
