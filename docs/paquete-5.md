# Paquete 5

- Slash-only: `/timecapsule`, `/birthday`, `/secret-drop`, `/slowmode-auto`.
- Hybrid: `/wanted` + `.wanted`, `/fake-tweet` + `.fake-tweet`, `/duel-rpg` + `.duel-rpg`, `/jail` + `.jail`, `/unjail` + `.unjail`, `/rate` + `.rate`.
- Dot-only: `.highlight`, `.clonechannel`, `.firstjoin`, `.kidnap`, `.revive`, `.bribe`, `.pout`, `.laugh`.

Las tarjetas generadas usan PNG con `@napi-rs/canvas`. Las publicaciones estilo red social llevan marca visible de parodia; el bot no suplanta cuentas ni envía webhooks aparentando ser usuarios. El premio de `secret-drop` se anuncia y registra al primer acertante; para otorgar automáticamente un rol hace falta definir qué rol configura el servidor. Configura almacenamiento persistente para `package5.json`. Activa Message Content Intent y concede los permisos de servidor estrictamente necesarios.
