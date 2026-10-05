# Devolución sin Pro: pruebas, recuperación y publicación pendiente

05/10/2026. Solo preparación local. No se publicó Firebase, app ni política web;
no se usaron datos reales. No representa una transferencia bancaria: concilia
los registros financieros de Personal y del espacio compartido en Fino.

## Regla y recorrido

1. Aportar S/100 y gastar S/60 deja S/40 disponibles. Con la prueba Pro vencida
   se puede devolver esos S/40; lo gastado sigue consumido, no deuda ficticia.
2. Antes de enviar se confirma en disco una orden cifrada por UID con un ID
   estable. Si no puede guardarse, no se pide ninguna devolución al servidor.
3. `returnPersonalContribution` verifica Auth/correo/cuenta habilitada,
   membresía, moneda, aportes propios y devoluciones existentes. Calcula con
   unidades monetarias enteras según los decimales de la moneda. Exige que el
   importe solicitado coincida con el recuperable: un saldo cambiado obliga
   a actualizar, no modifica silenciosamente el importe.
4. En una transacción escribe el movimiento de retorno, una confirmación
   privada y una versión en la raíz que serializa devoluciones del espacio.
   Repetir el mismo ID devuelve el resultado, no otro movimiento.
5. Personal registra un solo ingreso con los vínculos/asignaciones confirmados.
   La orden se retira únicamente cuando el ingreso está comprobado en disco.
   Una caída de conexión conserva la orden; se intenta recuperar al iniciar o
   volver a primer plano. La orden viaja en el archivo local de esa cuenta al
   cerrar sesión. Otra cuenta nunca la hereda; A→B→A rechaza respuestas viejas.
6. Con S/0 se permite cerrar; quedan salida S/100, retorno S/40 y consumido S/60.
   No se reconstruyen cierres históricos ni registros corruptos automáticamente.

## Protección y datos nuevos

- No exige Pro para esta devolución limitada. Crear movimientos comunes,
  nuevos aportes y copias Personal/Negocio/Cajas privadas mantienen sus permisos.
- El UID proviene de Auth, nunca del cuerpo de la petición. Solo se devuelve
  el neto propio y disponible, no el aporte de otro miembro.
- Confirmación `personalReturnReceipts/{uid}/operations/{id}`: importe, moneda,
  fecha, descripción, nombre/ID del espacio, UID e IDs/asignaciones de aportes.
  Los SDK no pueden leer/escribir esa colección. Solo la función autenticada
  devuelve la confirmación propia con parámetros/ID coincidentes.
- Permite recuperar una operación ya confirmada aunque se elimine el grupo o
  se retire al miembro. No consulta entonces el grupo ni concede su acceso.
- La confirmación privada se retiene hasta completar el borrado de Auth. Su
  limpieza por lotes de 200 es reintentable y limitada a ese UID. La cuenta
  marcada en eliminación no puede crear devoluciones nuevas. El movimiento
  compartido sigue la retención del espacio; al salir se retira también su UID
  anidado. No se afirma anonimización irreversible de IDs seudónimos.
- Todas las devoluciones nuevas de Familia/Caja compartida van por servidor,
  incluso Pro. Excepción histórica de Caja: copia exacta desde `cajas/{uid}`
  usando índice de origen, ID, monto, fecha, vínculo y descripción coincidentes,
  solo dueño Pro y `migrationComplete: false`. Se confirma primero la fuente;
  la transición a `true` no puede revertirse. Un fallo conserva la Caja privada.
- Archivos cifrados nuevos versión 2 incluyen la orden. Se leen archivos
  versión 1 con el inventario anterior y orden vacía, sin perder otros datos.
  La app anterior no conoce el nuevo inventario: no hacer reversión ciega.

## Comprobaciones

Resultado: TypeScript y ESLint aprobados, 129 pruebas locales y 8 auditores;
49 pruebas de Functions y 40 del emulador Firestore. Una prueba local es
preexistente ajena no registrada en Git (un clon limpio cuenta 128).
La primera ejecución paralela terminó con fallo de `auditar-codigo`, sin
diagnóstico conservado por el corredor; el auditor aislado y la repetición
completa aprobaron. No se modificó ni relajó ese auditor para obtener el verde.

- `pruebas/verificar-devolucion-sin-pro.mjs` ejecuta el cliente TS real y el
  registro real de AppDataContext con SDK/React sustituidos: guardado previo,
  caída de respuesta, reinicio, confirmación en disco, no duplicación,
  moneda y cambio de sesión. Compara decimales de las 155 monedas con servidor.
- `FINO_TEST_BASELINE=1 node pruebas/verificar-devolucion-sin-pro.mjs` falla
  contra el manejador real anterior de Familia: intentaba escribir por SDK
  bajo la regla Pro. No usa una copia de la lógica del manejador.
- `verificar-cuenta-local.mjs` ejecuta archivo/cifrado reales con almacenamiento
  nativo sustituido: orden A→B→A aislada y lectura de archivo antiguo versión 1.
- `functions/test/personal-return.test.js`: helper real, montos, fechas, cierre,
  datos inválidos, pertenencia, ID repetido y confirmación después de borrar grupo.
- `functions/emulator-tests/personal-return.test.js`: Firestore y transacciones
  Admin/SDK reales; S/40 sin Pro, cierre, dos solicitudes concurrentes, propiedad,
  cliente directo bloqueado, copia histórica exacta, fase irreversible, salida
  y limpieza privada por UID. Ejecuta las envolturas de Functions; Auth es
  sustituido y no son llamadas HTTP ni comprobación real de tokens desplegados.

## Límites explícitos y pruebas pendientes

- No se montó toda la UI ni se ejecutó Android/Hermes. Pendientes reinicio
  real, memoria llena, cierre de sesión durante retorno, dos dispositivos,
  recepción real de Functions y borrado completo de cuenta. No confundir
  emulación Firestore con emulador Android ni banco de pruebas con producción.
- Registros antiguos inválidos, retornos sin dueño identificable o IDs propios
  duplicados se rechazan. Requieren revisión; no se cambian cifras para hacerlos
  pasar. Una colisión con otro movimiento local conserva ese movimiento y la
  orden pendiente, pero necesitará recuperación guiada; no se declara reparada.
- Se lee el historial compartido para calcular el saldo: el costo depende de
  su tamaño, aunque repetir una confirmación solo lee su comprobante. Máximo
  de confirmación 800.000 bytes y tiempo de función 120 s. Historias enormes
  necesitarán agregados/paginación y retención estudiada; no se promete escala
  ni gasto ilimitado. App Check/rate limiting/costos de abuso siguen pendientes.
- Se serializan devoluciones entre sí. No se declara corregida aquí toda la
  concurrencia de gastos ordinarios SDK, aportes, borrados y monedas del espacio.
- Node instalado 24.18; falta validar específicamente Node 22 antes de entregar.
  Tarjetas y cobros permanecen excluidos; no se creó plan de S/3 ni Play Billing.

## Entrega futura — requiere autorización

1. Validar Node 22, tokens/Functions/Auth en entorno autorizado y recorrido físico.
2. Preparar actualización compatible para usuarios antiguos antes de bloquear
   sus devoluciones SDK. No asumir que OTA alcanza todas las versiones instaladas.
3. Publicar primero Functions nuevas/actualizadas, incluida devolución y limpieza
   Auth; coordinar después reglas y app con `syncFormat: 2` y migración de Caja.
   Regla nueva + app vieja bloquea su retorno; app nueva + servidor ausente falla.
4. Publicar política coherente, verificar consolas y ejecutar S/100→S/60→S/40
   en Familia/Caja con Pro vencido, reconexión y cuenta eliminada. Conservar
   historial Personal y no emitir una devolución ficticia de S/60 consumidos.

**Qué sigue:** Node 22 y recorrido completo de eliminación.
**Qué falta:** pruebas físicas/Functions reales, consolas, transición y publicación.
