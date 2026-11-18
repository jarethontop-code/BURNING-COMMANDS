# BURNING-COMMANDS

Bot de Discord con comandos de prefijo y módulos separados de Slash Commands. Las funciones de bienvenida, anti-raid y verificación son **exclusivas de `/`**; no tienen alias con punto.

## Slash Commands

- `/setwelcome canal mensaje [archivo]`: configura bienvenida; variables de texto `{user}` y `{server}`. Acepta imágenes o videos MP4/MOV de hasta 10 segundos. Para video se usa `ffprobe` para validar la duración y `ffmpeg` para convertirlo a GIF en bucle. Instala ambas herramientas del sistema y monta almacenamiento persistente para `welcome-media/` si el despliegue usa disco efímero. Límite del archivo: 25 MB.
- `/testwelcome`: publica la vista previa en el canal configurado.
- `/anti-raid`: abre un panel privado con botones activar/restaurar y selector de umbral (3/5/7/10 entradas por 10 segundos). Al dispararse bloquea canales de texto y expulsa cuentas recién creadas hace menos de 7 días si el bot tiene permisos. El botón verde restaura los permisos previos que se pudieron guardar y desactiva el escudo.
- `/verify canal rol`: publica un botón que asigna el rol seleccionado, siempre respetando la jerarquía de roles del bot.

Los comandos existentes con `.` permanecen separados. No se crean aliases híbridos para las cuatro funciones anteriores.

## Requisitos y permisos

Node.js 20+, token `DISCORD_TOKEN`, activar **Message Content Intent** y **Server Members Intent** en Developer Portal para conservar los comandos de prefijo y la detección de miembros. Concede al bot solo los permisos necesarios, entre ellos gestionar canales/roles/miembros y leer el registro de auditoría para la respuesta anti-raid. El rol del bot debe superar al rol de verificación.

```bash
npm install
npm start
```
