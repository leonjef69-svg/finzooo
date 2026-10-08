# FINO-47/49 — aceptación en servidor, parcial (08/10/2026)

## Preparado, no desplegado

`acceptLegalDocuments` exige Auth con correo verificado y consulta la cuenta
real para rechazar deshabilitados/borrados. El UID procede del token, nunca del
cuerpo. Solo recibe dos SHA-256 y dos elecciones explícitas; rechaza campos
extra, UID/fecha elegidos, ausencia de elección y documentos no vigentes.

`legalAcceptances/{uid}` conserva únicamente formato, UID, versión, huellas,
elección y fecha del servidor. No copia textos, dinero, foto ni perfil; solo
la versión vigente, sin historia jurídica de consentimientos. Reintentos y
concurrencia conservan la primera fecha confirmada de esa versión. El SDK
no puede leer/escribir/borrar recibos, tampoco los propios. El callable no
concede Pro ni crea un respaldo Personal a Gratis.

La transacción comprueba con máscaras los marcadores de borrado de users,
premiumTrialClaims y reportRateLimits. La barrera existente de reportes evita
recrear recibos después de borrar Auth; su limpieza desde 30 días tiene los
mismos límites ya documentados. El evento Auth retira el recibo junto a las
colecciones propias existentes. No se borra un libro compartido al aceptar.

Reglas preparadas exigen el recibo exacto antes de crear Familia/Caja,
miembros, movimientos, invitaciones o cambiar el nombre. La función de
edición de aportes exige lo mismo dentro de la transacción. Iniciar una
conversión también lo exige; estado/finalización/cancelación anteriores
conservan su recorrido financiero. Una confirmación de conversión ya guardada
no vuelve a exigir aceptación. No se agrega la barrera a leer, devolver,
deshacer/borrar registros, salir, cerrar o eliminar cuenta.

## Cliente y límites de gasto

La elección local sigue separada/cifrada por UID y no depende de internet para
guardar la casilla. Solo una acción compartida, después de verificar esa
elección vigente, pide la confirmación remota. No se acepta desde un efecto de
arranque. Comprobar Legal no confirma en silencio en Firebase. No existe una
protección contra clientes que afirmen programáticamente haber aceptado: un
registro técnico NO demuestra que la persona leyó ni acredita por sí solo
consentimiento jurídico para datos sensibles.

El cliente verifica UID, huellas, elecciones, formato/versión/fecha del ACK.
Agrupa dos llamadas simultáneas; memoria limitada a 32 cuentas, sesión/usuario/
documentos exactos y cinco minutos. Cambiar sesión, volver a elegir o eliminar
cuenta invalida confirmaciones; errores permiten reintentar sin falsa caché.
Las reglas comprueban el recibo actual aunque el celular tenga caché.

Hay uso nuevo de Firebase: primera aceptación/versión cambia escribe un
documento; repetir la misma no lo reescribe pero realiza lecturas, una llamada
y una consulta Auth. La transacción lee cuatro documentos, con máscaras de
marcas en tres, no un historial. Las reglas añaden una comprobación de recibo
y aprovechan comprobaciones de cuenta ya existentes. No es costo cero ni
límite duro de facturación: App Check, abuso directo y gasto general FINO-15
siguen pendientes. No se ajustaron precios, planes ni cuotas de producción.

## Evidencia local y qué NO comprueba

La batería integral aprobó 184 casos SDK/HTTP/Auth/Firestore locales y 86
unitarias Node 22, sin cancelados/omitidos. La app aprobó 169 pruebas y ocho
auditores sin tarjetas; incluye una prueba local ajena no versionada (168
previstas en Git limpio, no otro checkout ejecutado). La pasada inicial
detectó preparación incompleta de algunas pruebas financieras/nativas; se
adaptaron y se repitió la batería, sin retirar sus aserciones. La prueba nueva
de SDK tiene regresión `FINO_LEGAL_RULES_BASELINE=87ed0ba`: reglas anteriores
permiten crear Familia sin aceptación, mientras las actuales rechazan. No
compara un callable antiguo inexistente ni acredita publicación de reglas.

Tras aclarar en Privacidad que la limpieza puede retrasarse, se actualizó
su huella idéntica en servidor/reglas y se repitió el contrato original. La
comparación SDK anterior/actual se ejecuta contra esa huella final. El cambio
es de texto y constante, no de la lógica financiera/retención programada.

- Unitarias Node 22: validación/idempotencia, cuenta propia/versión/fecha,
  cierre y datos financieros intactos. IO Firestore adaptado, no red.
- `verificar-aceptacion-remota-real.mjs`: módulo cliente original con IO
  adaptado; ACK propio/exacto, doble llamada, caducidad, invalidación,
  errores y A→B→A. Contrato calcula SHA-256 reales de los textos exportados
  y los compara con servidor/reglas. No sustituye SDK/HTTP ni Android.
- `functions/emulator-tests/legal-acceptance.test.js`: SDK/Admin/reglas
  originales contra Firestore demo local. Deniega Pro sin aceptación,
  recibos ajenos/antiguos/futuros y fabricación SDK. Aceptación válida abre
  altas con los permisos anteriores; miembro Gratis requiere elección propia.
  Lectura/borrado anteriores continúan sin aceptación; cierre bloquea altas.
- `functions/integration-tests/legal-acceptance.test.js`: Auth, callable HTTP
  y evento de borrado reales emulados. Cuenta Gratis, elección propia,
  idempotencia/primera concurrencia, UID/versiones falsos, no verificado/
  deshabilitado, cierre/borrado y token atrasado; edición y conversión exigen
  recibo, sus salidas financieras no. No usa usuarios reales ni SMTP.
- Invitaciones/devoluciones/copias anteriores se preparan con elección
  válida para seguir comprobando sus permisos financieros, sin retirar
  aserciones. Los casos de salida sin aceptación se mantienen expresos.
  IO nativo del cifrado adaptado, algoritmo original, no Keystore físico.
  Tarjetas se excluyen también en las pruebas de eliminación por SDK.

## Activación y qué sigue/qué falta

NO distribuir esta app sola ni publicar las reglas solas: requiere callable,
reglas/huellas y documentos/app compatibles, con comprobación y autorización
de entrega conjunta. Clientes sin aceptación vigente no podrán crear nuevo
contenido; leer/salir/recuperar dinero permanece disponible. Una cuenta que
ya aceptó en otro dispositivo tiene recibo de cuenta válido, no prueba de
que una app antigua muestre documentos/moderación. El cliente nuevo también
exige su elección local. Un cambio de texto requiere actualizar huellas en
servidor/reglas y app; el contrato impide separarlas en las pruebas.

**Qué sigue:** bloqueo/moderación efectiva, restantes FINO-15/16/34/37/50/52.
**Qué falta:** Android/TalkBack/cuentas existentes/dos teléfonos, SMTP/atención,
consolas y políticas publicadas, revisión jurídica/trámites FINO-48, cobros,
migración y despliegue coordinado autorizado. FINO-47/49 siguen parciales;
auditoría NO terminada, tarjetas/Sentry externo excluidos. No APK/AAB/OTA ni
servicio habilitado en producción. Ninguna prueba acredita cumplimiento legal.
