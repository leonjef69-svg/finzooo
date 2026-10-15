# Familia y Cajas — auditoría del 15/10/2026

Alcance: Cajas privadas y compartidas, Familia, aportes/ediciones/borrados,
devoluciones, cierre/salida, invitaciones, lectura y conservación de originales.
Tarjetas, Telegram, cobros, cambios de facturación y publicación fuera del cambio.
No se crean, corrigen ni borran movimientos de la cuenta del propietario.

## Orden y hallazgos

1. **Saldo compartido (alto, reproducido):** el teléfono validaba un saldo viejo
   y escribía cada gasto sin comprobar el libro en servidor. Dos gastos de 80
   sobre 100 podían aceptarse. Nuevo callable `mutateSharedMovement` suma el
   historial en unidades enteras de la moneda dentro de una transacción y
   escribe una versión de la raíz. Todos los nuevos gastos/ingresos de espacios
   existentes pasan por él. Cambios/borrados de aportes también escriben la
   raíz; devoluciones ya lo hacían. Cierre/salida leen la misma raíz.
2. **Borrar ingresos usados (alto):** el borrado directo podía retirar dinero
   ya gastado. Se comprueba disponibilidad actual en servidor. Solo el creador
   o dueño puede borrar un movimiento externo; los enlaces con Personal siguen
   en su flujo especializado. Retirar dinero disponible no exige renovar Pro
   ni aceptar documentos nuevos. Crear movimientos sí exige aceptación y Pro
   del propietario; los miembros invitados no necesitan Pro individual.
3. **Confirmación Personal/Familia (medio):** alta/aporte inicial y ediciones
   usaban un actualizador sin confirmación de disco. Ahora esperan el guardado
   conjunto de los movimientos locales antes de anunciar éxito. Si el servidor
   respondió pero falla el disco, se conserva en la pantalla la misma pareja
   para confirmar de nuevo sin otro aporte remoto. Edición compartida de Cajas
   usa la misma confirmación de disco.
4. **Reintentos (medio):** IDs estables ante respuesta perdida en esta sesión;
   recibo servidor transaccional con huella de orden y fecha, sin textos ni
   importes. Repetir no duplica y una orden anulada no revive ni confirma un
   débito nuevo. Se rechaza reutilizar la referencia Personal de otro aporte.
5. **Listas incompletas por red (medio):** listarFamilias/listarCajasCompartidas
   atrapaban cualquier fallo de lectura como si el espacio faltara. Un fallo
   de red ahora llega al manejador de error; no se publica una lista parcial.
   Un vínculo sin permiso continúa sin ocultar los otros espacios válidos.
6. **Validación y textos (bajo):** nombre familiar vacío se rechaza antes de
   enviar. Fechas reales, importes compatibles con decimales de la moneda,
   límites y enlaces se validan también en servidor. Los errores distinguen
   saldo insuficiente, Pro del propietario, datos inválidos y cierre; no llaman
   «Familia» a una Caja ni presentan datos inválidos como caída de red.

## Protección de datos y activación

No se migra automáticamente «hj», no se renumeran IDs ni se elige una fuente
por fecha. Archivar sigue siendo reversible y distinto de borrar. Se mantienen
las protecciones de sincronización, originales y marcas de borrado.

La primera consulta remota del 15/10 encontró facturación desactivada. Tras
vincularla el propietario, una segunda consulta confirmó `billingEnabled=true`
en dotero-2d430: Blaze ACTIVO. Siguen cero Functions y reglas del 02/10.
Faltan syncFormat/recordIdentityFormat/recordSyncAt en la lista remota de campos.
Blaze no es un despliegue ni una reparación remota del respaldo.

**No publicar reglas solas:** las versiones antiguas escriben dinero directo.
Primero preparar servicios compatibles, después entregar la app y coordinar el
cambio de reglas, que rechaza altas normales SDK y borrar ingresos sin servidor.
Se conserva únicamente la creación atómica del primer ingreso de una Familia
nueva y la copia exacta de Cajas privadas aún en conversión. No activar Telegram.

`moneyOperations` se guarda debajo del espacio compartido, no lo lee el cliente
ni contiene UID en claro, descripción o importe; conserva una huella derivada
de la orden y fecha para impedir duplicados/resurrección. Se retira al borrar
explícitamente el espacio preparado, no al cerrarlo. La versión de raíz es
metadato financiero. Revisión de conservación/política final aún obligatoria.
Cada operación añade lecturas del libro y escrituras de movimiento/recibo/raíz;
los reintentos pueden repetir lecturas. maxInstances=3 NO es un límite de gasto.

## Qué falta y límites de esta entrega

- Activación coordinada real de servicios/reglas/app y alertas de consumo.
  Blaze ya está confirmado, no está pendiente volver a activarlo.
- Dos cuentas/dispositivos Android y red intermitente en producción controlada.
  Firebase Emulator Suite no equivale a dos teléfonos ni a la APK distribuida.
- **Personal y Firebase no son una sola transacción:** el cierre del proceso
  entre ambos guardados depende de la conciliación existente. Falta un diario
  durable de aportes, incluido crear Familia con respuesta perdida, y probar
  reinicio/cambio de cuenta antes de afirmar garantía integral sin duplicados.
  El reintento estable nuevo dura la sesión, no sobrevive por sí solo al cierre.
- Revisar los tres casos originales de «hj» con evidencia del propietario;
  conservarlos no significa haber reparado su significado financiero.
- Historiales grandes: las sumas financieras siguen leyendo todo el libro.
  Falta medir/cotar coste y paginar presentación sin calcular saldo con una
  página incompleta. Cajas privadas mantienen el límite documental de Firebase.
- Moderación/SMTP/bloqueo efectivo antes de publicar espacios compartidos.
- Revisar cierre/retirada con monedas de tres decimales: ayudantes antiguos
  conservan tolerancia 0.005, no una escala monetaria universal. Las nuevas
  altas/borrados del callable sí usan unidades enteras; no declarar cerrado
  este punto para todas las monedas.

## Pruebas

Se ejecutan fuentes originales de pantalla, transacciones/rules SDK y HTTP
locales, sin credenciales o datos financieros reales. La prueba nueva de
pantalla falla contra ab441d3 porque anunciaba guardado sin confirmación; la
prueba concurrente contra los escritores originales anteriores debe detectar
dos gastos aceptados sobre un mismo saldo. Registrar resultados finales en
ESTADO/ENTREGAS, sin presentar una ejecución roja como aprobada.

Se actualiza además una integración de acceso obsoleta: buscaba Register.tsx,
que ya no existe. Usa registerSubmit del formulario Login vigente con SDK Auth
real exclusivamente local; no se cambia el acceso de producción por ello.

Resultado final estable: TypeScript/ESLint completos, 223 pruebas y 8 auditores
de app (tarjetas excluidas), 97 unitarias Functions y 245 Firebase emulado
aprobados. Las regresiones contra ab441d3 fallan por guardar sin confirmar disco
y por aceptar ambos gastos de 80 con saldo 100. Un helper faltante detectado
en una ejecución intermedia se corrigió; el servidor completo se repitió y
aprobó 245/245. Sin prueba física ni escrituras financieras de la cuenta real.
El dueño confirmó que solo prueba en el emulador; no hay otros clientes activos
que obliguen a mantener el escritor SDK antiguo durante la activación.
