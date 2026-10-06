# Nombres distintos de Caja entre celular y nube — 06/10/2026

Avance limitado del punto 1: nombres, no corrección de importes. Código
preparado, no publicado ni instalado. Tarjetas y código nativo sin cambios.

## Qué se resolvió

Dos copias de la misma Caja con igual versión y nombres distintos bloqueaban
la unión. Se conservaban, pero no había una elección explícita. Ahora se
muestran ambos nombres y se confirma cuál usar. Cancelar no escribe nada.

- Solo ofrece nombres válidos de la misma Caja, igual versión y demás campos
  iguales, sin borrado, conversión pendiente/completada o cambio de creación.
- Conserva primero ambos originales y la elección en disco. No envía la
  petición si ese guardado falla. No crea ni borra movimientos o dinero.
- Una transacción Firestore lee el servidor de nuevo y exige que ESA Caja siga
  exactamente como se mostró. Modifica solo su nombre/versión y el formato
  compatible; conserva otros campos raíz, otras Cajas, movimientos, marcas y
  recibos de conversión. No fusiona dinero para aceptar la elección.
- Si llega otra edición primero, rechaza la elección vieja, sin sobrescribirla.
  Dos elecciones distintas concurrentes no pueden imponerse ambas.
- Una respuesta perdida deja la revisión pendiente; repetir una elección ya
  escrita devuelve la confirmación sin nueva escritura si sigue exactamente
  vigente. Se confirma localmente solo tras respuesta propia y guardado válido.
- Cuenta/sesión, pantalla desmontada, Pro vencido, fuente local cambiada,
  almacenamiento ilegible o respuesta inválida no producen éxito ficticio.
- La consulta/escritura de la nube sigue siendo Pro, protegida por reglas;
  conservar y ver las revisiones locales no concede acceso Gratis al servidor.

## Información conservada y compatibilidad

`revisionesNombre` vive en el contenedor cifrado existente `cajasDinero`:
UID, ID de operación/Caja, ambas versiones de nombre, elección, fecha y
confirmación pendiente/completada. Es local: no viaja a Firebase. Se conserva
al cerrar sesión en la copia por cuenta y se limpia con los datos locales de
esa cuenta. No cambia claves ni formato de la copia por cuenta.

Hasta 50 revisiones: el límite rechaza otra, no elimina una vieja. Se pueden
ver todas las revisiones propias conservadas y todos los reintentos pendientes.
Las políticas interna/web y PLAYSTORE están preparadas, no publicadas.

Una versión antigua de la app puede quitar este campo local al normalizar
Cajas. No volver a ella después de escribir revisiones sin comprobar primero
una estrategia de compatibilidad/restauración que conserve estas copias.

## Qué se comprobó

`verificar-nombres-caja-nube.mjs` ejecuta los auxiliares, API de transacción y
manejadores de pantalla originales, no una copia de su lógica. Sustituye React,
Auth/red y cifrado donde corresponde. Comprueba cancelar, elección celular/nube,
guardado antes de red, fallo de cada guardado, red, respuesta incorrecta,
fuente/cuenta/plan cambiado, datos ilegibles, historial lleno, copias aisladas,
reintento idempotente y conservación de dinero/campos. El contexto/almacén
originales se ejecutan además sobre SQLite real con rollback/respuesta perdida.
Eso no ejecuta Android ni prueba cifrado nativo.

`verificar-cuenta-local.mjs` confirma que A recupera ambas versiones al entrar,
que B no las recibe y que quedan en la copia cifrada por cuenta existente.
`verificar-cajas-sincronizacion.mjs` comprueba el conflicto desde la carga real
de pantalla, conservando ambos nombres y rechazando la unión automática.

`functions/integration-tests/private-boxes.test.js` usa dos SDK, Auth y
Firestore reales locales: nombre elegido, reintento sin escritura adicional,
dos elecciones simultáneas, edición/borrado posterior, cambios de otra Caja,
preservación del formato 3/recibos/campos desconocidos y rechazo sin Pro.
No usa cuentas reales ni accede a producción.

Regresión sin modificar archivos:

```powershell
$env:FINO_TEST_NAME_BASELINE='482f2fd'
node pruebas/verificar-nombres-caja-nube.mjs
```

La versión anterior falla porque no admite la elección explícita; la nueva
pasa. Quitar esa variable de la sesión antes de ejecutar la suite normal.

## Qué sigue y qué falta

- **Punto 1 abierto:** dinero distinto entre dispositivos, mitad ausente,
  devolución/reparto no demostrable y elección pendiente que quedó obsoleta
  por otra edición de esa misma Caja. No se borran copias ni se fuerza ninguna.
  Cambiar un nombre no resuelve conflictos de importes que coexistan.
- **Punto 2 pendiente:** Android/visual, reinicio/cierre forzado, disco lleno,
  datos grandes, conexión inestable y dos cuentas/dispositivos. SDK local y
  SQLite no sustituyen estas comprobaciones físicas.
- **Punto 3 pendiente:** consolas y autorización/publicación coordinada del
  conjunto preparado, política web y verificación posterior. Git no instala
  la app ni despliega Firebase; CODE_MARKER sin cambios.
- No es una transacción global servidor/celular ni garantiza resolver doble
  gasto desconectado. Se conserva para reintentar/revisar, no se declara cerrado
  el bloque ni la auditoría completa.

## Resultado

TypeScript/ESLint aprobados; 139 pruebas locales y 8 auditores (una prueba
ajena preexistente sin registrar: 138 en copia limpia), 63 unitarias Functions
y 97 de SDK/reglas/HTTP/eventos bajo Node 22 real. Sin fallos, canceladas u
omitidas. La regresión contra 482f2fd falla por la elección bloqueada anterior;
la versión nueva pasa. ADB no mostró dispositivos conectados. Sin pruebas
físicas, APK/OTA, despliegue Firebase ni cuentas reales consultadas.
