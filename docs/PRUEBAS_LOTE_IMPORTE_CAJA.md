# Lote monetario local — preparación, 06/10/2026

## Alcance

**Actualización posterior:** la selección/petición y conservación previa ya
están conectadas en el código de pantalla. Ver
`docs/PRUEBAS_FLUJO_IMPORTE_CAJA.md` para el alcance vigente y los pendientes.
Este documento registra la preparación anterior del lote, no una entrega.

En la fase anterior continuaba el punto 1 abierto. `commitPrivateBoxMoney` estaba
disponible en el contexto, pero **ninguna pantalla lo invocaba ni enviaba la nueva
petición**. Tarjetas
excluidas. Sin código nativo, APK/AAB/OTA, marca ni despliegue.

No se cambia el esquema, las claves ni la conservación ya documentada en
privacidad/Play: originales y marca permanecen en Cajas cifrado y bóveda por
cuenta existentes. Ninguna nueva colección o recibo permanente remoto.

## Contrato comprobado

1. Cuenta/generación vigentes, archivos legibles y Android. Exige el objeto de
   confirmación genuino del cliente HTTP en la misma cola de revisión. Copiar
   sus campos o calcularlos no autoriza una escritura local.
2. Dentro de la cola de cuenta y de escritura relee Cajas cifrado; exige los
   originales/elección idénticos a la fuente esperada. No utiliza una lectura
   previa a otras escrituras ni solo la referencia visual.
3. El plan puro comprueba Personal, borrados, moneda, enlaces, saldo y cuatro
   originales. Lote de tres claves: Personal, marcas de borrado y Cajas con
   revisión confirmada. Ambas mitades conservan la versión acordada con el
   servidor, sin fabricar otra con `Date.now()`.
4. Cifrado y preparación todavía permiten nuevas ediciones: si cambian las
   fuentes, se vuelve a preparar, hasta cuatro intentos. No elimina otro
   movimiento para lograr la corrección.
5. Reserva **solo** durante `multiSet` y comprobación de lectura. Los setters
   de Personal, borrados, moneda, datos/caché de Caja rechazan una mutación
   distinta antes de modificar memoria. Un updater funcional no se evalúa
   durante la reserva. El trabajo de captura que utiliza la cola de cuenta
   espera; no se descarta. No hay reserva durante HTTP ni durante el cifrado.
6. SQLite/lectura confirmados antes de memoria/callback. Una respuesta nativa
   perdida se reconoce por el texto cifrado exacto guardado. Fallo de escritura
   conserva originales y pendiente; fallo de verificación congela escrituras
   como almacenamiento no legible, sin prometer éxito ni borrar el archivo.
7. Cerrar solo la pantalla durante SQLite no deja memoria de esa cuenta vieja:
   refleja el lote comprobado y la caché, sin callback/éxito para esa pantalla.
   Cambiar cuenta/generación no recibe callbacks ni dinero de la anterior.
   La sustitución propia de la referencia de pantalla no se confunde con fallo.
8. Toda reserva se libera en `finally`, también por fallo, cambio de cuenta o
   validación rechazada. El lote invalida escrituras atrasadas de sus claves.

La reserva lanza `private-box-source-changed`, no confirma silenciosamente una
acción rechazada. **Requisito de la integración UI:** controles/acciones concurrentes deben
deshabilitarse o tratar ese rechazo con mensaje/reintento; revisar también una
pantalla nueva abierta durante el lote y su lectura local atrasada. Esta tanda
no declaraba resuelto ese recorrido visual. La actualización posterior añade
modal, avisos de caché y lecturas/efectos atrasados protegidos; Android sigue pendiente.

## Verificación

`node pruebas/verificar-lote-importe-caja.mjs` extrae los setters y función
originales del contexto y el setter original de pantalla. Usa cliente,
coordinador, cola de cuenta, almacén y validadores originales. Solo sustituye
React, cifrado/nativo y red para estas pruebas; SQLite es real.

Comprueba respuesta genuina/falsa, tres claves, versiones, originales,
otras filas/Cajas/borrados, cifrado fallido, rollback, respuesta perdida,
lectura fallida, fuente/moneda/elección/plataforma/cuenta/pantalla distintas,
mutación durante cifrado y reserva, captura en cola, intento repetido y
10.001 movimientos/1.001 Cajas sin pérdidas. No es una medición Android.

`FINO_TEST_MONEY_BATCH_BASELINE=ddde38d` falla por API nueva ausente. Es
regresión del contrato nuevo, **no evidencia de un bug en la app publicada**.

La suite SDK añade llamadas Auth/Functions/Firestore reales en el proyecto
**demo local**, con el mismo contexto/SQLite originales: ambos formatos,
fallo local tras HTTP y recuperación sin nueva escritura remota, y expiración
de Pro después de recibir una confirmación HTTP vigente. El servidor no cambia
su exigencia de Pro para pedir/repetir una operación remota.

Los lectores de tres pruebas previas ahora cargan también la protección
original, sin reemplazarla por una función vacía ni quitar sus aserciones.

Servidor: 73 unitarias y 120 SDK/reglas/HTTP/eventos aprobados bajo Node 22 real,
sin omisiones/cancelaciones/fallos. Incluye las tres pruebas nuevas que unen
HTTP real de emulador y contexto/SQLite originales.

La repetición local detectó una expiración de `auditar-codigo`: recorría cachés,
herramientas y resultados, además de las fuentes. Ahora excluye esos artefactos,
sin retirar carpetas de código propio. `verificar-auditoria-sin-artefactos.mjs`
ejecuta su recorrido original sobre carpetas reales; falla contra ddde38d y
pasa ahora. El auditor directo termina sin problemas, sin ampliar el timeout
ni fingir que una ejecución interrumpida aprobó.

TypeScript/ESLint sin errores ni advertencias. Repetición final: 143 pruebas
locales y 8 auditores aprobados; incluye una prueba ajena sin registrar, que
se conserva y no se incorpora al commit. Dos suites específicas de tarjetas
excluidas y no contadas como aprobadas.

## Qué sigue y qué falta

- Selección humana, guardado de originales antes de HTTP, petición + lote en
  misma cola, recuperación visible de pendiente/confirmada al volver/reiniciar.
- Decisión obsoleta y Pro vencido **antes** de recuperar una respuesta: siguen
  pendientes, no se descarta el archivo ni se exige adivinar qué copia ganó.
- Recorrido de UI y acciones concurrentes, Android real/cierres/espacio/tamaño,
  dos dispositivos, demás discrepancias y conciliación de los 61 hallazgos.
- Consolas/reglas publicadas e índices, políticas publicadas y entrega
  coordinada autorizada. No atomicidad global Firebase/teléfono ni auditoría
  cerrada. ADB no encontró dispositivos en esta sesión.
