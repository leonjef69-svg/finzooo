# Node 22 y borrado de cuenta: evidencia local y límites

05/10/2026. Sin despliegues, datos reales, APK/AAB, OTA ni cambios en consolas.

## Runtime comprobado

- `functions/package.json`, su lock y `firebase.json` ya indicaban Node 22.
  Las comprobaciones anteriores solo habían usado Node 24 instalado.
- Se descargó Node 22.23.3 Windows x64 desde `nodejs.org`, en una carpeta
  portátil `.tmp/node22-validation-20261005`, sin sustituir el Node del sistema.
  SHA-256 del ZIP verificado contra su archivo oficial de sumas:
  `2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71`.
- CLI Firebase 15.32.1, SDK Functions 6.6.0 y Admin 13 instalados; se cargaron
  las Functions reales bajo Node 22. No se actualizó a ciegas el SDK por el
  aviso de versión antigua: la CLI advierte que la actualización puede romper
  compatibilidad. Su revisión de dependencias permanece como tarea separada.
- Firebase documenta Node 22 y la prioridad de `firebase.json` sobre `engines`.
  Cambiar archivos no actualiza lo desplegado: hay que volver a desplegar las
  funciones. [Configuración oficial](https://firebase.google.com/docs/functions/manage-functions).
- Google sitúa el retiro de Node 20 el 30/10/2026: no admite nuevos despliegues
  con ese runtime y los servicios existentes pueden ser deshabilitados; no es
  una promesa de apagado instantáneo ese día. Node 22 figura para ambas
  generaciones. [Calendario oficial](https://docs.cloud.google.com/functions/docs/runtime-support).

## Falla real encontrada y corrección

`borrarVinculoFamiliaDeCuenta` leía `familyUsers/{otroMiembro}` para limpiar su
índice. La regla permite esa lectura solo al propio miembro. El caso SDK/HTTP
falló de verdad por `permission-denied`; no era un falso positivo de un sustituto.
Además, intentar borrar la membresía del dueño antes de acabar podía quitarle
acceso para reanudar y dejar un índice que apunta a un grupo incompleto.

Nuevo servicio `finalizeLinkedSpaceDeletion`:

1. UID de Auth, correo/cuenta habilitada e identidad confirmada hace menos de
   cinco minutos. No toma el UID de un campo del cuerpo y no exige Pro.
2. Exige ser dueño de ese espacio, que el servidor ya lo haya marcado para
   borrar y que no queden movimientos. No permite saltarse la validación de
   saldos de `manageLinkedSpace` ni empezar por limpiar un grupo activo.
3. Limpia los miembros no propietarios en transacciones por miembro. Quita
   solo el vínculo correspondiente, y solo vacía `activeFamilyId` si coincide;
   retira ese ID de `closedFamilyIds` conservando otras Familias y otros campos.
4. Mantiene acceso e índice del propietario para reanudar después de un fallo.
   Retira invitaciones del mismo destino por lotes. La confirmación final une
   raíz, membresía, vínculo e índice propios en una transacción.
5. Los clientes de Familia/Caja llaman al servicio en vez de leer índices
   privados de otro miembro. Las reglas privadas no se ampliaron.

La aplicación aún valida primero todos los espacios antes de borrar datos,
retira movimientos/invitaciones autorizados, finaliza grupos, borra copias
auxiliares y Personal, y finalmente elimina Auth. El evento Auth termina la
limpieza privada. Una interrupción en la limpieza conserva el dueño; si la
confirmación final se hizo pero se perdió la respuesta, reintentar el flujo
completo ya no descubre el espacio finalizado por sus índices.

## Pruebas reales locales

Resultado: TypeScript/ESLint aprobados, 129 pruebas locales y 8 auditores,
53 pruebas unitarias de Functions y 48 de reglas/SDK/HTTP/eventos bajo Node 22
(40 de la suite Firestore anterior y 8, contando el grupo, de integración).
Una prueba local preexistente ajena sigue sin registrar en Git; un clon limpio
cuenta 128. La regresión contra el cliente anterior falló por el índice privado
y la repetición completa corregida aprobó, sin relajar reglas.

`functions/integration-tests/account-lifecycle.test.js` usa cuentas ficticias y
SDK reales de Firebase conectados a localhost; no sustituye callable, reglas,
Firestore ni Auth. Compila los módulos originales de borrado de la app; solo
cambia su configuración Firebase y sustituye las dependencias de almacenamiento
nativo para poder cargarlas en Node. No monta React ni valida almacenamiento Android.

- Gratis con prueba vencida consulta permisos, sin descargar Personal ni leer
  índices privados de otros miembros.
- Un miembro no dueño no puede finalizar un grupo ajeno; grupo activo se rechaza.
- Saldo recuperable bloquea el borrado antes de tocar copias/Telegram.
- Aporte S/100, gasto S/60, devolución S/40 por HTTP: reintento con mismo ID
  conserva un único movimiento. Caja con aporte totalmente consumido permite borrar.
- El borrado del cliente limpia grupos, miembros e índices; elimina 405
  documentos de historial, comprobando más de dos lotes, y conserva otra cuenta.
- Borrar Auth mediante SDK dispara el evento auténtico del emulador Functions
  que limpia permiso, prueba y comprobantes privados. Los eventos Firestore
  limpian Telegram sin borrar borradores ni permisos de otra cuenta.
- Correo no verificado se rechaza por HTTP. Los tokens son los emitidos por
  Auth emulado (sin firma de producción), no una verificación del proveedor Google.

`functions/test/linked-space-cleanup.test.js` ejecuta el helper propio con
almacenamiento sustituto: grupos ajenos, preparación, movimientos pendientes,
conservación de otra Familia, interrupción/reanudación y varias páginas de 205
miembros/invitaciones. No sustituye la prueba del SDK y eventos anteriores.

Regresión: `FINO_TEST_BASELINE=1` carga solo `utils/cloudFamilia.ts` de HEAD
anterior al arreglo dentro de la prueba de integración. Debe fallar por el
acceso al índice ajeno; las APIs siguen siendo las reales de los emuladores.
Tras registrar el commit, usar `FINO_TEST_BASELINE=6998e4c` para repetir esa
regresión contra la revisión anterior: HEAD ya pasa a ser la versión corregida.

## Reproducir sin producción

Usar Node 22 real, Java 21 para Firestore y Firebase CLI. Configuración
`firebase.pruebas.json` separada de producción, servicios ligados a 127.0.0.1
y proyecto fijo `demo-fino-node22`. `scripts/verificar-servidor.mjs`:

- rechaza otro Node; no transforma un verde en Node 24 en una validación Node 22;
- rechaza archivos de configuración/secretos locales en Functions para no
  leerlos ni enviarlos; no necesita claves de servicio reales;
- elimina la variable de credencial de servicio del proceso hijo;
- inicia solo Auth, Functions y Firestore emulados y corre ambas suites en serie;
- da 60 segundos a la carga/discovery en Windows. La primera ejecución falló
  al superar el límite local de 10 segundos; repetir con margen cargó correctamente.

Desde Node 22, definir `FINO_FIREBASE_CLI` con la ruta del CLI si no está
instalado como dependencia resoluble, Java en PATH y `FIREBASE_EMULATORS_PATH`
para reutilizar la descarga del emulador; ejecutar `node scripts/verificar-servidor.mjs`.
Los logs contienen únicamente datos de prueba, no deben subirse al repositorio.

## Qué sigue y qué falta

- Sigue: recorrido Android/dos cuentas y revisión de riesgos de datos restantes.
- No hay dispositivo ni emulador Android conectado en la comprobación ADB de
  esta sesión. Los emuladores Firebase no sustituyen ese recorrido físico.
- Falta: inicio/reauth Google real, efectos de cierres de Android, memoria llena,
  PIN/lector/avisos nativos al eliminar, dos dispositivos y recuperación de
  índices huérfanos heredados. No se repararon grupos/cuentas de producción.
- El borrado Auth debe ser individual para disparar ese evento. No se probó
  eliminación administrativa masiva, APIs de producción, IAM, límites de la
  plataforma ni toda la carrera entre borrar y crear una cuenta con UID manual.
- No se ejerció el webhook externo de Telegram ni su tarea programada (no hay
  Pub/Sub en esta suite). App Check aparece ausente; no queda resuelto aquí.
- Antes de distribuir la app, publicar también `finalizeLinkedSpaceDeletion`
  y las demás funciones preparadas con Node 22; coordinar reglas compatibles,
  actualización de clientes antiguos y políticas/declaraciones reales.
- Node 22 configurado y probado localmente no prueba el runtime que está
  desplegado. No se declara FINO-05 ni toda la auditoría resueltos en producción.
  Tarjetas de crédito y cobros continúan fuera de estos arreglos.
