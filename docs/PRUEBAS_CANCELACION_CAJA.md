# Cancelación de conversión privada/compartida — 05/10/2026

## Flujo preparado

1. Compartir guarda `sharingPending` y un `sharingAttempt` UUID cifrados antes
   de enviar. Solo el segundo inicia el protocolo 3; una espera vieja sin UUID
   puede recuperar/finalizar protocolo 2 o cancelar, no reactivar una barrera.
2. Reintentar conserva el mismo UUID. Cancelar no pide renovar Pro: exige cuenta
   verificada/vigente, origen/intento propio y destino nuevo sin miembros invitados.
3. El servidor decide en transacción frente a finalizar: o devuelve el recibo
   ya completado, o congela el destino con una barrera que las reglas no dejan
   modificar/borrar/reactivar desde el SDK. También cubre un destino inexistente.
4. Si congela, elimina solo clones de ese intento en lotes de 200 y su índice.
   Origen privado y dinero Personal no se tocan. Después el celular confirma su
   guardado de la Caja sin señales; solo entonces vuelve a permitir usarla.
5. Si ya completó, la pantalla conserva importes y remapea enlaces mediante
   el guardado conjunto anterior; no restaura una segunda copia privada.

Sin internet, respuesta no comprobada, disco fallido, fuente cambiada, otra sesión
o enlace inconsistente se conservan originales/bloqueo. Dos toques antes de
repintar comparten un bloqueo inmediato. Una respuesta `complete:false` a secas
no sirve para cancelar: el cliente valida UID, origen, moneda, huella y UUID.

## Protección de intentos y retención

- `privateBoxMigrations/{uid}/attempts/{uuid}` conserva cancelaciones y evita un
  inicio atrasado. Un nuevo intento Pro necesita UUID distinto y clones ya limpios.
- Copiar/finalizar/resetear requieren el UUID activo y no cancelado. Las reglas
  comparan `migrationAttemptId` de la fila con el destino. Invitar/usar dinero de
  copias incompletas sigue prohibido. Origen se confirma con la huella exacta.
- Intentos heredados distintos, raíces ajenas, miembros invitados y cuentas en
  borrado o sin ningún registro vigente (cuenta/prueba/tester) fallan sin purgar
  datos legítimos. Un tester sin copia Personal puede cancelar tras vencer su
  acceso, sin necesidad de subir su historial.
- 30 intentos nuevos por UID/día UTC; reintento/recuperación propia no consume
  otro. Limita creación de metadata, no todos los costos/solicitudes del proyecto.
- UUID local se excluye de la firma/huella y del documento de Cajas en Firebase.
  La metadata de intento sí se envía al servidor; no confundir ambos conceptos.
- El borrado Auth elimina los intentos, el contador y barreras canceladas con
  hijos propios. La barrera no se borra antes: una app atrasada podría recrear
  el mismo destino. Las políticas y PLAYSTORE describen esa retención/finalidad.

## Comprobaciones

- `node pruebas/verificar-cancelacion-caja.mjs` ejecuta la acción y el cliente
  reales aislando React/almacén/API: Gratis, resultado cancelado/completado,
  fallo de red/disco, cuenta/fuente cambiadas, enlace inválido, doble toque y
  respuestas ajenas/incompletas. La prueba falla contra `f3822db`, que no tiene
  la acción; no se cambia ningún archivo del repositorio para la regresión.
- `verificar-nube-pro-servidor.mjs` ejecuta la limpieza real con adaptador de
  Firestore: borra metadata/hijos propios y preserva otras cuentas/raíces activas.
  Contra `f3822db` falla por el intento que antes quedaba sin borrar.
- `functions/integration-tests/private-box-migration.test.js` usa SDK real,
  callable HTTP y transacciones de Firestore emulado: cancelación sin destino/
  sin Pro, reintento/respuesta perdida, más de 400 clones, intento nuevo frente
  a peticiones viejas, confirmación versus cancelación concurrentes, legado/
  miembros/cuenta ajenos y cupo sin penalizar recuperación. No es un mapa falso.
- `account-lifecycle.test.js` elimina Auth por SDK y comprueba el evento real:
  intentos/barrera/clones desaparecen, una barrera de otra cuenta permanece.
- `FINO_TEST_CANCEL_BASELINE=f3822db` en la prueba Firebase usa el helper original
  sin cambiar archivos: la operación falla con `migration-invalid-request`.
  La misma cancelación queda aprobada con la versión preparada y servidor local.
- Primera ejecución local falló por el límite de arranque de Functions (30 s),
  no cuenta como aprobación. Repetir con `scripts/verificar-servidor.mjs` usa
  `FUNCTIONS_DISCOVERY_TIMEOUT=60`, Node 22 y únicamente `demo-fino-node22`.
- La comprobación adicional paralela aprobó conversión/tester, pero el recorrido
  de borrado alcanzó el límite global de 180 s por preparación/arranques lentos.
  No se cuenta como aprobación total. Las suites globales admiten ahora 360 s
  y se repiten en serie; no cambia el límite HTTP de la app ni se quitan pruebas.

## Qué sigue y qué falta

Validación aprobada: TypeScript/ESLint, 135 pruebas locales y 8 auditores
(una prueba ajena preexistente sin registrar: 134 en copia limpia), 57 unitarias
Functions y 80 SDK/reglas/HTTP/eventos con Node 22. Ninguna prueba omitida en
la repetición completa; el primer intento con arranque fallido no se cuenta.
La repetición final en serie aprobó nuevamente las 80 comprobaciones, incluida
la cuenta tester sin copia Personal y los borrados, con cero fallos/cancelaciones.

Sigue la limpieza de conversiones **activas/incompletas** e índices al eliminar
cuenta; aquí se limpian las canceladas. Faltan pares heredados, conflicto entre
dispositivos, Android físico/emulador y cierres forzados, disco lleno/historial
grande y equivalente iOS/web para dinero enlazado. No hay garantía financiera
global entre teléfono/Firestore/dos dispositivos: no se presenta como resuelta.

No se modificaron tarjetas ni código nativo, no se compiló APK ni publicó OTA,
Firebase o las políticas web. Git prepara código/documentos, no actualiza teléfonos
ni sustituye desplegar juntas reglas, funciones y app después de las pruebas.
