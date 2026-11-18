# Paquete social y eventos (módulo 4)

Se mantienen separados los prefijos: matrimonios, perfiles, biografía, torneos y bienvenida por DM solo usan Slash Commands. Las utilidades, reacciones y moderación rápida listadas aquí solo usan `.`.

## Slash Commands
- `/marry usuario`: propuesta interactiva; solo el destinatario puede aceptar/rechazar. Las parejas y aniversarios se guardan en `social-data.json`.
- `/divorce`: confirmación privada para disolver el vínculo.
- `/profile [usuario]`: pareja, reputación, insignias, cumpleaños y biografía. El cumpleaños aparece como no configurado porque no se incluyó un comando para editarlo.
- `/setbio`: formulario modal para editar la biografía.
- `/tournament nombre cupos`: crea un panel con botón de inscripción y límite de plazas.
- `/welcome-dm`: modal para texto, reglas y hasta dos IDs de canal de acceso rápido; envía un DM a los nuevos miembros si aceptan mensajes privados.

## Prefijo `.`
- `.lockall` / `.unlockall`, `.purgeembeds 1-100`, `.threadlock` / `.threadunlock`, `.firstmessage`, `.inrole @rol`, `.permissions [@usuario]`.
- `.boop`, `.blush`, `.kill`, `.dance`, `.cry`, `.sleep` requieren mencionar a otro miembro; solo esa persona puede usar los botones de respuesta.
- `.rep @usuario` da un punto con enfriamiento de 12 horas por autor y servidor.
- `.say texto` requiere **Gestionar mensajes**, borra el comando original y evita menciones masivas.
- `.jumbo emoji` y `.botinfo` muestran emoji e información técnica.

Los datos sociales persisten en `social-data.json`. Se requieren Node.js 20+, `DISCORD_TOKEN`, Message Content Intent y permisos de Discord adecuados (gestionar canales/mensajes/hilos para comandos staff). Reinicia el bot para registrar los nuevos slash commands.
