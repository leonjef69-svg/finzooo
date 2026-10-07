# Sustituir una elección pendiente conservando sus originales — 06/10/2026

## Problema comprobado y alcance

En `1084e38` una revisión monetaria pendiente impedía comparar de nuevo esa
pareja: `prepararRevisionImporte` rechazaba otra revisión con
`cajas-money-pending`, incluso si la nube ya tenía un cambio distinto.
La protección conservaba los datos, pero no ofrecía una elección actualizada.

La regresión `FINO_TEST_MONEY_SUPERSESSION_BASELINE=1084e38` carga módulos
anteriores originales de Cajas/plan/flujo y ejecuta el mismo recorrido. Falla
por ese bloqueo; la integración nueva permite continuar. No se afirma que
esa preparación hubiera sido publicada ni que dañara datos reales.

Se cubre una pareja exacta Personal/Caja privada, con ambos IDs presentes,
moneda estable, metadata compatible, fechas/importes válidos y al menos dos
alternativas de monto/fecha. La nueva corrección requiere Pro y confirmación
humana. Tarjetas de crédito permanecen fuera.

## Recorrido

1. Una elección pendiente ofrece «Revisar las copias actuales · Pro». Comprobar
   un resultado terminado sin Pro mantiene su botón separado.
2. Consulta de servidor en cola auténtica, después de que terminen las
   operaciones anteriores. Invalida respuestas de la cola vieja. Mostrar el
   formulario nuevo no escribe dinero ni retira la elección anterior.
3. Cuatro alternativas actuales, con monto/moneda/fecha/origen. Al confirmar
   se reconsultan; si cambiaron datos, elección, cuenta, moneda o Pro, no se
   sustituye la revisión. Se informa que también se conservan los originales
   y elección anteriores. No se selecciona ningún monto automáticamente.
4. Nueva elección lleva `reemplaza` (ID anterior). `stagePrivateBoxMoney`
   guarda conjuntamente Personal/borrados/Caja: la anterior queda `sustituido`
   con `reemplazadaPor` y la nueva `pendiente`. **No hay un paso que retire la
   anterior sin conservar su sucesora.** Importes locales todavía no cambian.
5. El nuevo pendiente mantiene ambas subidas ordinarias pausadas. La petición
   financiera no envía los enlaces de historial local; el servidor compara
   exactamente las fuentes y la nueva versión. El recibo genuino permite el
   lote local financiero. La nueva versión supera todas las fuentes **y** la
   revisión anterior, incluso con reloj atrasado.
6. La nueva queda confirmada, la anterior sigue visible en versiones
   conservadas. Una revisión sustituida no tiene botón de reenvío. No se
   modifica su elección, notas, imágenes, fechas ni cuatro originales.
7. Fallo antes de conservar mantiene la pendiente vieja. Fallo tras conservar
   deja el nuevo pendiente con la anterior archivada; reintento/reinicio
   recupera el mismo ID/versión y originales, sin otro movimiento remoto.

Una petición vieja que ya estaba enviada podría terminar remotamente **antes**
de la nueva corrección. No se promete cancelarla: las fuentes se reconsultan,
el servidor vuelve a comprobarlas y, si cambiaron, se mantiene el nuevo pendiente
para otra revisión. Su respuesta no se aplica localmente con una cola obsoleta.
Después de confirmar la versión nueva, fuentes/versiones de la petición vieja
no coinciden y el servidor la rechaza. No hay atomicidad global teléfono/nube.

## Archivo y compatibilidad

- Estado local nuevo `sustituido` y dos referencias técnicas entre revisiones.
  Cada enlace debe ser mutuo, misma cuenta/moneda/IDs y versión creciente.
  No acepta referencias huérfanas, ramas incompatibles, ciclos ni dos
  pendientes para el mismo Personal. Confirmada no puede sustituirse.
- Una fusión con copia atrasada no revive la elección retirada. Dos sucesoras
  distintas o confirmación/sustitución incompatibles se rechazan sin elegir.
- Conserva todos los originales. Hasta 50 revisiones y 400.000 bytes UTF-8
  agregados, cada una 150.000; cuenta todos los estados y reserva confirmación.
  Si no cabe el enlace/sucesora, conserva la pendiente anterior. La capacidad
  se comprueba también antes del almacén para informar el límite con precisión.
- Mismo archivo Cajas cifrado y copia local por UID; sin clave/colección,
  permiso, destinatario o recibo remoto nuevos. Los enlaces no se transmiten
  a Firebase. Privacidad interna/web y PLAYSTORE actualizados en archivos.
- Lee las revisiones anteriores sin enlaces. Una versión antigua que no conoce
  `sustituido` no es un destino de rollback seguro: verificar compatibilidad/
  migración antes de entregar o retroceder. No quitar la cadena para hacerla
  parecer compatible. No se publicó ningún APK/AAB/OTA/función/regla/política,
  ni se modificó código nativo o CODE_MARKER.

## Evidencia

`pruebas/verificar-sustitucion-importe-caja.mjs` ejecuta módulos, SDK/colas,
funciones extraídas de contexto/setters y SQLite originales. Sustituye red,
cifrado/puente Android y React; no es prueba visual/ciclo de vida Android.
Comprueba comparación sin guardado, confirmación, dos revisiones retenidas,
versiones/otras filas, fuente/Pro/cuenta alteradas, fallo por fase, pausa de
subidas, reinicio, cadena de tres revisiones, referencias inválidas, reloj
atrasado, capacidad/bytes y respuesta atrasada. Renderiza el componente
original para confirmar que solo el pendiente ofrece acciones y el historial
conserva las versiones sustituidas.

Dos subtests SDK/HTTP/Firestore/Auth demo, bajo Node 22 real, unen el flujo y
contexto/SQLite originales. Ambos formatos de historial, nueva revisión tras
cambio remoto, conservación de metadata/originales, rechazo de petición vieja
sin modificar documento/fecha y fallo local seguido de recuperación sin otra
escritura remota. No se consulta producción.

Resultados finales de esta tanda:

- `npx tsc --noEmit` y ESLint completo: salida 0.
- `node pruebas/correr.mjs --sin-tarjetas`: 146 pruebas y 8 auditores aprobados.
  Incluye una prueba ajena sin registrar, conservada fuera del commit. No se
  ejecutó un checkout limpio. Dos suites específicas de tarjetas excluidas;
  no se cuentan como verificadas.
- Unitarias de servidor con Node 22: 77 aprobadas.
- `scripts/verificar-servidor.mjs`, SDK/HTTP/Auth/Firestore/reglas/eventos con
  Node 22 real y proyecto demo local: 126 aprobadas. Sin fallos, omisiones ni
  cancelaciones. No hay escrituras de producción ni despliegue.
- Regresión de módulos originales `1084e38`: falla por `cajas-money-pending`;
  el mismo recorrido con la implementación actual pasa.

## Qué sigue y qué falta

- Retirar una elección sin crear otra, especialmente sin Pro y con respuesta
  incierta, no está implementado: podría dejar pasar una petición remota vieja.
  La recuperación de un resultado exacto terminado sin Pro sí se mantiene.
- Fuentes que ya coinciden completamente, mitad ausente/borrada, devolución/
  conversión, moneda o metadata incompatibles, y límites llenos quedan
  conservados para otro protocolo de revisión. No se inventa ni reembolsa dinero.
- Android/lector de pantalla, interrupciones/espacio/tamaño/captura y dos
  dispositivos reales; ADB devolvió una lista vacía. No declarar el render
  sustituido como verificación física.
- Demás hallazgos/conflictos, consolas/políticas reales y publicación conjunta
  autorizada del servidor/reglas/app preparados. Punto 1 y auditoría no cerrados.
