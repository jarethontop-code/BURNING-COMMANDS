# BURNING-COMMANDS

## Bienvenidas

Configura `/setwelcome` con canal, mensaje y archivo opcional. En el mensaje puedes incluir `{user}` y `{server}`. La bienvenida automática siempre incluye al nuevo miembro mencionado y su avatar, aunque el texto personalizado no contenga `{user}`. La vista previa se ejecuta con `/testwelcome`.

## AutoMod

Abre `/automod`. Cada botón de filtro individual funciona como interruptor: una pulsación activa el filtro y otra lo desactiva. El botón **Activar todas** enciende todos los filtros a la vez; cuando ya están todos activos cambia a **Desactivar todas**. Los términos se gestionan con **Editar palabras**.

Arranca con `npm start` (Node.js 20+), `DISCORD_TOKEN` y los permisos/intents de Discord configurados.
