# Funciones extra: reacciones, galleta y copias

- Todas las reacciones sociales disponibles en los paquetes anteriores aceptan comandos con punto (`.kiss`, `.slap`, `.hug`, `.cry`, `.dance`, `.boop`, `.kidnap`, etc.), mención obligatoria de otro miembro y botones que solo puede pulsar la persona mencionada.
- `/cookie-game` muestra cuenta atrás y habilita una única pulsación de 🍪; el primer clic gana y bloquea los siguientes.
- `/copia-seguridad` guarda de inmediato roles y canales/categorías compatibles y repite la copia cada 3 horas. Envía al usuario que la configuró un DM con un botón de restauración. La restauración requiere permisos de Gestionar servidor/canales/roles, solicita confirmación adicional y elimina canales/roles posteriores a la copia, salvo roles administrados o protegidos por jerarquía. Mantén almacenamiento persistente para `package6.json`.

Usa el comando de copia en un canal de texto; el bot necesita Manage Channels, Manage Roles y poder enviar DMs al configurador. La restauración es destructiva: revisa la advertencia y confirma manualmente antes de ejecutarla.
