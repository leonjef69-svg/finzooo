# Comparar y recuperar importes de Personal/Caja — 06/10/2026

Continúa el punto 1 de la auditoría; no cierra los 61 hallazgos. Tarjetas de
crédito excluidas. Código local, sin APK/AAB/OTA, código nativo, marca ni
despliegue a producción. La función y las reglas preparadas requieren una
entrega coordinada antes de publicar esta pantalla.

## Recorrido incorporado

1. Cajas ofrece comparar una transferencia con enlaces exactos y desacuerdo
   de monto/fecha. La opción permanece accesible ante conflicto de nube; un
   pendiente se muestra aunque la descarga ordinaria esté pausada.
2. Consulta las fuentes de servidor dentro de la cola auténtica. Muestra las
   cuatro filas con su origen, monto, moneda y fecha completa: Personal/Caja
   del teléfono y Personal/Caja de nube. No guarda ni corrige al consultar.
   Las filas iguales no se ocultan. Opciones con saldo/identidad no seguros
   quedan desactivadas; ninguna se elige automáticamente.
3. Tocar una copia abre confirmación explícita. Cancelar no envía. El flujo
   reconsulta las fuentes después del Sí y exige que coincidan con las vistas;
   comprueba también textos/alternativas del formulario, cuenta y fuentes vivas.
4. `stagePrivateBoxMoney` relee Cajas cifrado dentro de la cola de escritura y
   conserva originales/elección/versiones en un lote de Personal, borrados y
   Cajas. No cambia dinero: conserva juntas las fuentes vivas aunque Personal
   aún tuviera un guardado ordinario pendiente. No envía si el lote falla.
   Antes de releer, termina los guardados agrupados ya pendientes; una copia
   recién normalizada/cargada no se rechaza solo por esperar esos 400 ms.
5. El SDK envía la elección conservada y exige respuesta genuina. El contexto
   confirma localmente las tres claves con la misma versión del servidor.
   No anuncia éxito antes de la comprobación en disco.
6. Ante fallo de red/SQLite o respuesta perdida, el diario pendiente mantiene
   las cuatro fuentes y la elección. Reintentar, incluso tras reiniciar, usa
   el mismo ID/versión/elección; el servidor acepta repetición vigente sin
   duplicar otra escritura. Un cambio posterior detiene el proceso.
7. Originales confirmados se consultan en «Ver versiones conservadas».
   Una cuenta sin Pro conserva y puede ver originales; no inicia la corrección
   de nube. Si Pro vence después de HTTP confirmado, termina ese lote local.
   La actualización siguiente prepara recuperar un resultado exacto ya aplicado
   incluso si se perdió HTTP antes de vencer Pro; ver
   `docs/PRUEBAS_RECUPERACION_IMPORTE_SIN_PRO.md`.

No se cambia el esquema, claves, conservación ni colección remota. Se usa el
diario ya documentado en privacidad/Play: cifrado y archivo por UID, máximo
50 revisiones/400 kB agregados y 150 kB por revisión. No elimina un original
para hacer espacio.

## Pantalla y concurrencia

- Los dos toques se bloquean con referencia inmediata, sin esperar a React.
  Durante la operación una hoja modal impide acciones/navegación de usuario;
  una salida real del proceso no se interpreta como confirmación.
- La reserva nativa sigue siendo corta: solo escritura/lectura. No reserva
  durante HTTP/cifrado. Capturas en la cola de cuenta esperan; no se descartan.
- La caché visual notifica los lotes verificados a una pantalla nueva. Una
  lectura iniciada antes de ese aviso usa la caché nueva, no fusiona la lectura
  vieja. Un efecto con render atrasado o guardado en curso no programa otra
  escritura. La pantalla originadora aplica su resultado tras verificar disco.
- La confirmación visible pertenece al formulario vigente. Un aviso antiguo,
  pantalla cerrada, cuenta/copia/moneda cambiadas no anuncian éxito.
  Cancelar invalida la referencia del formulario inmediatamente, sin esperar
  al render. Una acción ya iniciada no se cancela por un control atrasado.

## Evidencia y limitaciones

`pruebas/verificar-flujo-importe-caja.mjs` ejecuta el flujo, cliente,
almacenamiento/colas/guardias originales y funciones extraídas del contexto
y pantalla. SQLite es real; red, cifrado/puente nativo y primitivas React se
sustituyen. Comprueba fuentes, confirmación/cancelación, dos toques, errores,
reconsulta, originales antes de envío, fallos por fase, respuesta perdida,
reinicio, Pro antes/después de HTTP, copia obsoleta, saldo y notificación de
caché. Renderiza el componente original para revisar sus textos/eventos;
**no** mide disposición visual, velocidad ni ciclo de vida Android.

La regresión `FINO_TEST_MONEY_FLOW_BASELINE=cbe2b08` falla por el contrato nuevo
ausente. No demuestra un bug de una entrega publicada. Las pruebas anteriores
siguen comprobando recibos genuinos y rechazan falsos; sus lectores ahora
permiten la conexión por el flujo, sin permitir fabricar confirmaciones en UI.

La integración Firebase añade el recorrido completo de consulta/reconsulta
SDK, diario/contexto/SQLite y HTTP auténticos, en ambos formatos de historial,
en el proyecto demo local y bajo Node 22 real. No usa Firebase de producción.

Validación final: TypeScript y ESLint completos sin errores ni advertencias;
144 pruebas locales y 8 auditores aprobados, con las dos suites de tarjetas
excluidas (no contadas como aprobadas). El total local incluye una prueba
ajena sin registrar: se conserva y no se incorpora al commit. No se ejecutó
un checkout limpio para atribuirle ese total. 73 unitarias del servidor y
121 SDK/reglas/HTTP/eventos aprobados bajo Node 22 real, con cero fallos,
omisiones o cancelaciones. El subtest nuevo une todas las fases con SDK/HTTP
auténticos y contexto/SQLite originales en ambos formatos.

La prueba negativa de Auth eliminado genera el error esperado
`auth/user-not-found`; el caso confirma rechazo y pasa. No es un fallo nuevo
de la pasada ni una omisión. ADB volvió a devolver una lista vacía.

## Qué sigue y qué falta

- Una elección pendiente obsoleta o nunca aplicada cuando Pro venció sigue
  conservada y bloqueada. Un resultado exacto ya aplicado puede recuperarse
  sin Pro con la actualización siguiente. No hay aún un mecanismo para
  reemplazar/retirar esa elección y desbloquear copias sin perder originales.
  La protección está probada; ese protocolo de recuperación queda pendiente.
- Pruebas Android: disposición/lectura de los cuatro valores, lector de
  pantalla/letra grande, cierre forzado/reinicio, navegación y captura durante
  la reserva, poco espacio/historial grande y dos dispositivos. ADB no encontró
  dispositivos. No se presenta el render sustituido como prueba de teléfono.
- No hay atomicidad global Firebase/teléfono: un corte puede dejar remoto
  confirmado y local pendiente, a recuperar mediante el mismo diario.
- Consolas/reglas/índices reales, publicación conjunta autorizada de
  servidor/reglas/app y demás hallazgos de la auditoría siguen pendientes.
  Tarjetas permanecen fuera, sin correcciones ni pruebas específicas.
