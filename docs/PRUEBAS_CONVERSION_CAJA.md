# Conversión privada → compartida — 05/10/2026

## Problemas corregidos

- El reintento omitía cualquier documento con el mismo ID, aunque tuviera otro
  monto. La app podía declarar completa una copia incorrecta.
- Completar la copia y retirar el origen eran pasos separados, sin una
  comprobación indivisible en Firebase.
- Un fallo creando la invitación dejaba la pantalla sin retirar/remapear la
  Caja ya compartida. No equivale a una conversión fallida.
- Las marcas de borrado remotas podían descartar ediciones de otro teléfono
  atrasado, sin comprobar que fueran la misma versión convertida.

## Protección preparada

1. `private-box-source.js` es la única definición compartida de la huella
   SHA-256 y de los campos copiados. App Expo Crypto y Node usan el mismo texto,
   con orden estable, versiones de edición y valores exactos.
2. El cliente consulta primero una confirmación propia; una respuesta perdida
   se recupera sin otra copia ni lectura del historial privado. Sin Pro solo
   recupera/finaliza una conversión ya preparada, no inicia una nueva.
3. Las copias nuevas llevan `migrationProtocol: 2`. Las reglas bloquean
   invitaciones, movimientos normales, devoluciones y finalización SDK mientras
   están incompletas; únicamente se permite copiar exactamente el origen privado.
4. El servidor compara todos los IDs y todos los campos de la copia, membresía
   única del dueño, moneda, cuenta abierta y huella del origen en una transacción.
   En ella publica el destino, retira únicamente el origen seleccionado y guarda
   su confirmación. Reintentos concurrentes obtienen el mismo resultado.
5. `reset` solo limpia clones nuevos, incompletos y sin otros miembros. No toca
   el origen ni purga copias heredadas distintas. Mantiene el bloqueo entre lotes;
   cada lote vuelve a comprobarlo, incluso con dos reintentos/interrupciones.
6. El formato privado 3 conserva las confirmaciones del servidor. Las reglas
   no permiten quitarlas/falsificarlas ni rebajar el formato. La unión rechaza
   una Caja local aún presente con confirmación remota, conservando sus ediciones.
7. La pantalla vuelve a comprobar su copia actual antes de retirarla y pausa
   envíos privados durante la conversión. Solo remapea contrapartes conocidas por
   ID, espacio y enlace; no suma dinero, cambia montos ni reabre consumidos.
   La confirmación en datos privados permite recuperar enlaces al volver a cargar.
8. Invitar ocurre después de terminar el cambio local. Si falla, se abre la Caja
   y avisa que el código se puede pedir otra vez. No restaura una copia privada.
9. Las confirmaciones privadas se limpian al completar el evento de borrado Auth.
   La política interna/web y PLAYSTORE reflejan sus campos y retención.

## Comprobaciones reproducibles

```powershell
npx tsc --noEmit
npx eslint app screens components utils constants contexts modules
node pruebas/correr.mjs
node pruebas/verificar-conversion-caja.mjs
```

Regresión local: ejecutar la última prueba con `FINO_TEST_BASELINE=b502b9a`.
Debe fallar porque la versión anterior descarta la copia local por las marcas
remotas en vez de conservarla y señalar un conflicto. No reemplaza archivos.

Pruebas de servidor: usar Node 22 real y `scripts/verificar-servidor.mjs`, según
`PRUEBAS_NODE22_BORRADO_CUENTA.md`; solo Auth/Functions/Firestore locales y cuentas
ficticias. `private-box-migration.test.js` ejecuta el cliente real compilado con
esbuild, los SDK y la nueva función por HTTP. Solo sustituye configuración,
sesión/legibilidad nativas y SHA-256 nativo por SHA-256 real de Node.

Casos: mismo ID con monto distinto, copia incompleta, atajo SDK prohibido,
invitación y borrado de clones prohibidos, reparación de clones nuevos,
confirmación/retirada atómica, respuesta perdida sin Pro, copia atrasada,
formato/confirmación inmutables, origen cambiado, miembro ajeno, cuenta en
borrado, copia heredada distinta, dos confirmaciones concurrentes, limpieza
interrumpida y 405 movimientos en dos lotes conservando otra Caja.
También se comprueba la limpieza de confirmaciones en el evento Auth real.

Validación: TypeScript/ESLint aprobados; 133 pruebas locales y 8 auditores
(una prueba preexistente ajena no está registrada en Git: 132 en una copia
limpia), 57 unitarias de Functions y 72 comprobaciones de reglas/SDK/HTTP/eventos
con Node 22 real. Las regresiones local y SDK fallan contra `b502b9a`;
la del SDK demuestra también la incompatibilidad del atajo del cliente antiguo
con las reglas nuevas. La acción real de pantalla conserva una edición local
durante la espera y termina la conversión antes de intentar Invitar.

La regresión SDK admite `FINO_TEST_MIGRATION_BASELINE=b502b9a` y solo se ejecuta
contra esta prueba en emuladores locales. El cliente anterior intenta finalizar
por SDK, lo que las reglas nuevas impiden. No es una medición de producción ni
una sustitución de toda la versión antigua del servidor.

## Qué sigue y qué falta

- No es todavía una transferencia indivisible entre los archivos de Personal
  y Cajas en Android. Faltan pruebas físicas de cierre forzado entre guardados,
  dos dispositivos y vuelta de Google; no se instaló/compiló un APK.
- Conflictos heredados se conservan, no se reparan por conjetura. Hace falta
  diseñar una resolución explícita de ediciones locales posteriores a la
  conversión y de destinos heredados con contenido diferente.
- Falta revisar el borrado/abandono de copias incompletas y sus índices al
  eliminar una cuenta; no se afirma que todos esos huérfanos estén resueltos.
- Confirmaciones y marcas aumentan el tamaño del documento privado: aún rige
  el límite de Firestore y faltan mediciones de crecimiento/costos a gran escala.
  Un fallo de tamaño debe abortar la confirmación completa, no retirar el origen.
- Publicación coordinada pendiente: funciones (incluida `privateBoxMigration`),
  reglas y app. El cliente nuevo necesita el servidor; el viejo ya no puede
  declarar una copia completa. No volver a una app que quite formato 3.
- No se modificaron registros de producción, tarjetas ni código nativo. Git
  no entrega por sí mismo el arreglo a los teléfonos ni publica reglas.
