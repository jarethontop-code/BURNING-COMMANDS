*** Begin Patch
*** Update File: src/prefix-commands.js
@@
       case 'nuke': {
         await requirePermission(message, P.ManageChannels);
-        // Explicit `.nuke true` is the sole confirmation and executes immediately.
-        if ((args[0] || '').toLowerCase() !== 'true') throw new Error('Acción irreversible. Confirma escribiendo exactamente `.nuke true`.');
+        // Accept true/false explicitly: false cancels; true executes immediately.
+        const confirmation = (args[0] || '').toLowerCase();
+        if (confirmation === 'false') {
+          await reply(message, 'Nuke cancelado', 'No se realizó ningún cambio en el canal.', COLORS.info);
+          return true;
+        }
+        if (confirmation !== 'true') throw new Error('Usa `.nuke true` para ejecutar o `.nuke false` para cancelar.');
*** End Patch
