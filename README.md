# BURNING-COMMANDS

Bot de Discord con comandos de moderación, comunidad y seguridad en módulos separados. AutoMod es exclusivo de Slash Commands; los comandos de utilidad indicados aquí solo se usan con `.` y no se registran como slash.

## AutoMod: solo `/automod`

`/automod` abre un panel privado con botones para activar/desactivar filtros de mayúsculas excesivas, spam de menciones (`@everyone`, `@here` y menciones masivas), enlaces externos/invitaciones y palabras prohibidas. «Editar palabras» abre un modal: escribe palabras separadas por comas para añadirlas, antepón `-` para retirar una palabra o escribe `*` para vaciar la lista. La configuración persiste en `automod.json`; los mensajes que coincidan se borran si el bot tiene **Manage Messages**.

## Utilidades: solo prefijo `.`

- `.afk [motivo]`: activa tu estado AFK; se anuncia cuando te mencionan y se quita al volver a escribir.
- `.banner [@usuario]`: muestra tu banner o el del usuario mencionado/respondido.
- `.serverinfo`: miembros, canales, roles, propietario y fecha de creación.
- `.ping`: latencia del mensaje y de la API de Discord.

El resto de comandos y prefijos existentes se mantienen en sus módulos. No se hacen alias híbridos para AutoMod ni estas utilidades.

Inicia con `npm start` (Node.js 20+). El bot requiere `DISCORD_TOKEN`; Message Content Intent y Server Members Intent deben estar activados en Developer Portal para los comandos con `.` y la detección de AFK. Para AutoMod concede **Manage Messages** al bot; las opciones del panel requieren **Manage Server**.
