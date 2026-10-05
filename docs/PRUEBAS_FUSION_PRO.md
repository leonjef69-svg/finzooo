# Gratis → Pro: unión de la copia Personal

Preparado el 05/10/2026. Este documento no autoriza despliegues ni cambios
en cuentas reales. Las tarjetas de crédito continúan fuera de esta corrección.

## Qué se cambió y se comprobó

- La subida atómica, la recepción y la restauración con copia local existente
  usan `mergeCloudFields`: perfil por campo, presupuestos por mes, límites
  y comercios por clave, categorías por ID/campo, pagos por ID/campo/mes,
  saldo anterior y favoritos por pertenencia.
- `recordCloudGroupChange` conserva escrituras y borrados concretos dentro
  de la clave local cifrada `cloudSyncMeta` y del mapa remoto `syncUpdatedAt`.
  La ausencia sola nunca significa borrar. Borrar un registro prevalece sobre
  editar una copia vieja; recrearlo expresamente requiere una marca posterior.
- Editar un campo no actualiza la fecha de los otros. Una fecha desconocida
  se representa con cero, no con la fecha del momento de restaurar. Empates
  nuevos usan una comparación canónica para converger, no el orden de llegada.
- La referencia de campos se actualiza en el mismo gesto y se vacía al cambiar
  de cuenta. Los guardados inmediatos usan valores y marcas coherentes, aunque
  el temporizador se haya creado con un dibujado anterior.
- Las fotos omitidas en una copia grande se conservan localmente. Los favoritos
  con foto y las fotos de pagos no se añaden a la nube, ni siquiera dentro de
  las claves de las marcas. Borrar una foto de forma expresa sí se sincroniza.
- `sinFotos` también quita valores `undefined`: Firestore los rechaza incluso
  cuando están dentro de un mapa o una lista. Si la copia sigue sin caber, la
  operación falla y la última copia confirmada queda intacta.
- Google desde Bienvenida recupera primero la copia cifrada de ese UID, igual
  que los otros accesos. No restaura automáticamente una nube vieja encima.
- La recepción rechaza arrays/mapas mal formados e IDs duplicados sin aplicar
  los movimientos de esa respuesta. Esto no sustituye una validación exhaustiva
  del esquema ni de todos los campos de cada movimiento o pago.

## Evidencia automática

- `pruebas/verificar-fusion-pro.mjs` ejecuta las funciones reales de unión,
  mutación, recepción, armado, restauración y subida (formatos de historial
  1 y 2). Solo reemplaza Android/autenticación/red. Cubre datos independientes,
  ediciones, borrados, recreación, desmarcado, fotos, límites de tamaño y
  respuestas anteriores al siguiente dibujado.
- Con `FINO_TEST_BASELINE=1`, falla contra el código previo porque conserva
  una sola categoría en vez de las dos existentes.
- `functions/emulator-tests/personal-fields.test.js` comprueba las reglas
  reales con clientes ficticios: migración, bloqueo de sobrescritura antigua,
  acceso ajeno y cuenta sin verificar. Con la misma opción de baseline falla
  contra las reglas anteriores: rechazan el formato nuevo y dejan escribir
  la lista antigua.
- Toda la batería del emulador pasa ejecutada en serie: 15 comprobaciones,
  incluido el historial separado con 10.000 movimientos y dos clientes.
  Son pruebas locales, no comprobaciones de Firebase publicado.
- TypeScript, ESLint, 126 pruebas locales y 8 auditores; 39 pruebas de Functions.
  Una prueba local preexistente no registrada pertenece a otro cambio.

## Entrega y comprobación pendiente en Android

1. Terminar la protección Pro del servidor y revisar los cambios de reglas y
   Functions pendientes. Preservar copias originales fuera de Git antes de
   cualquier migración real. No activar por separado una mitad de la entrega.
2. Publicar reglas compatibles con `syncFormat: 2` **antes** de distribuir esta
   app. Una cuenta antigua sin ese marcador sigue siendo compatible hasta
   su primera escritura nueva. Desde ese momento un APK antiguo no podrá
   reemplazarla; debe actualizarse. No borrar el marcador para hacer un rollback.
3. Instalar la versión de prueba en dos Android, usando la misma cuenta de
   prueba y datos ficticios. La concesión Pro debe venir del mecanismo del
   servidor, nunca editando un indicador local.
4. Tener septiembre/categoría/pago en nube y octubre/otra categoría/otro pago
   en teléfono Gratis. Activar Pro y verificar que ambos conjuntos se conservan
   al subir, volver al frente, cerrar y entrar de nuevo.
5. Borrar una categoría/límite/pago en A. Editar otro registro en B con su copia
   anterior. Sincronizar y verificar que no reaparece el eliminado.
6. Cambiar nombre en A y color de esa misma categoría en B. Verificar ambos
   cambios. Cambiar el mismo campo en ambos: debe quedar un resultado idéntico
   en ambos teléfonos, no dos versiones según el orden de conexión.
7. Marcar meses diferentes de un pago en A/B, luego desmarcar uno. Verificar
   meses, enlaces y gastos conservados. La confirmación simultánea del mismo
   mes se debe probar aparte: véase el límite de alcance siguiente.
8. Recibir una copia sin fotos de pagos/favoritos o reducida por tamaño.
   Verificar que la foto sigue en el teléfono que la tenía; quitarla expresamente
   de una categoría y comprobar que el borrado sí se respeta.
9. A → cerrar sesión → B → cerrar sesión → A: comprobar recuperación y que
   una respuesta tardía de Firebase de A no aparece en B. Repetir sin conexión.
   También comprobar la recuperación tras interrupciones de escritura Android.

## Límites y qué sigue

- Una edición concurrente del MISMO campo no conserva automáticamente un
  historial de todas sus versiones. Hay un ganador determinista; los cambios
  en campos/registros distintos sí se unen. El reloj es monotónico desde las
  marcas observadas, no una garantía de hora física exacta entre equipos sin red.
- Confirmar el MISMO pago/mes en dos teléfonos puede generar dos movimientos
  diferentes: no se borran a ciegas porque podrían tener ediciones o notas.
  Esa deduplicación necesita una corrección y prueba específica.
- Negocio/Cajas y los espacios compartidos no utilizan este documento Personal.
  Su unión, autorización Pro y borrados requieren su propia comprobación.
- Las marcas de borrado se conservan sin purga insegura. También ocupan el
  documento de 1 MB. Para calendarios muy largos o gran volumen de categorías
  será necesario separar esa información en documentos y planificar migración,
  no truncar marcas ni prometer respaldos ilimitados en el formato actual.
- Encolar datos/marcas en el mismo gesto no convierte claves distintas de
  Android en una transacción de disco. La última escritura puede interrumpirse
  si el sistema mata el proceso. La prueba física de recuperación y una posible
  escritura transaccional local siguen pendientes, sin afirmar protección total.
- La nube exclusiva Pro aún no está garantizada en las reglas de producción
  (FINO-04). Los aportes de Familia/Caja (FINO-02), Node 22, políticas/consolas
  y las pruebas físicas también siguen pendientes. No hubo despliegue ni APK.
