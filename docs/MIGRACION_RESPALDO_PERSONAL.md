# Migración del historial Personal

Estado: código y pruebas locales preparados; producción sin cambios.

Cada movimiento de una cuenta migrada vive en `users/{uid}/history/{id}`.
`users/{uid}` conserva los demás datos y `historyFormat: 2`, sin los arreglos
`transactions` ni `deletedTransactionIds`. Los borrados se guardan como
documentos con `deleted: true`, para que otro teléfono no los restaure.

## Garantías y límites

- La lista antigua no se retira hasta comprobar cada movimiento y cada borrado.
  Se conserva el identificador; un borrado prevalece sobre una copia vieja.
- Entre ediciones gana la más reciente. Si dos contenidos distintos tienen la
  misma fecha de edición, se detiene la fusión para revisar el conflicto.
- El teléfono antiguo no puede sobrescribir una cuenta migrada. La app muestra
  un aviso de actualización; es mejor detener una escritura que perder datos.
- Una falla de lectura de Firestore no se trata como historial vacío.
- El tamaño máximo por movimiento individual sigue limitado por Firestore.

## Orden seguro para una entrega futura

1. Verificar una copia exportada y preparar una compilación de la app nueva.
2. Publicar reglas y Functions compatibles con ambos formatos.
3. Distribuir la app nueva y confirmar que los dispositivos antiguos dejaron
   de escribir en las cuentas que se van a migrar.
4. Migrar cada cuenta con `functions/scripts/migrate-personal-history.js`.
   El script exige confirmar exactamente el UID para producción. Nunca se
   ejecuta automáticamente. Si se corta, conserva la lista original y se
   puede repetir; solo retira la lista cuando verifica todas las filas y la
   revisión del documento principal sigue siendo la misma.
5. Comprobar en una cuenta de prueba restauración, edición, borrado, Telegram
   y eliminación de cuenta antes de ampliar la migración.

La app vieja queda bloqueada para escribir después de la migración. Eso evita
pérdida de datos, pero requiere que la persona actualice la app antes de seguir
registrando movimientos. Una eliminación de cuenta v2 marca primero el
documento principal como pendiente, bloquea nuevas escrituras y borra la
subcolección en lotes; un corte permite reintentar el borrado.

Validación local: `npx tsc --noEmit`, `npx eslint app screens components utils
constants contexts modules`, `node pruebas/correr.mjs`, `npm test --prefix
functions` y pruebas con el emulador de Firestore. Se probaron 10.000 filas,
dos clientes, copia mayor a 800 KB, migración interrumpida y reglas de acceso.

Antes de publicar faltan pruebas con dispositivos reales (restauración desde
otro móvil, exportación, cierre de sesión y red intermitente), medir tiempos y
costos con historiales grandes y comprobar una eliminación de cuenta completa
con 10.000 movimientos. El emulador prueba la lógica, pero no sustituye esas
pruebas. Tampoco hay migraciones ni publicaciones realizadas.
