# Devolución anulada: no recuperar como vigente un retorno deshecho

05/10/2026. Preparación local sin publicar Functions/app, sin datos reales y
sin tarjetas. Continúa FINO-02 y la guía `PRUEBAS_DEVOLUCION_SIN_PRO.md`.

## Falla comprobada antes del arreglo

El retorno compartido se borraba, pero su comprobante privado seguía vigente.
Repetir `returnPersonalContribution` devolvía el comprobante y podía volver a
registrar el ingreso. La prueba real de Firestore falló por "Missing expected
rejection". El contexto también aceptaba un ID borrado; su prueba falló por
`true !== false`, incluso retrasando el procesamiento de React.

## Corrección y ejemplo

- Aportar S/100 y gastar S/60 deja S/40 disponibles. Devolverlos crea un ingreso
  S/40 en Personal y deja S/0 en el espacio.
- Deshacer la devolución borra ese retorno y marca el comprobante `cancelled`
  con `cancelledAt` en la misma transacción. El espacio vuelve a tener S/40;
  el cliente retira el ingreso de Personal como ya hacía. No se inventa dinero.
- Repetir la devolución con el ID anterior se rechaza: no devuelve una
  confirmación vigente ni modifica el saldo. Se retira la orden local únicamente
  con guardado comprobado. Error de red, otra sesión o fallo de disco la conserva.
- Repetir la anulación ya confirmada devuelve éxito sin escribir ni exigir Pro
  nuevamente. Anular por primera vez mantiene la comprobación Pro existente.
- Una devolución nueva de los S/40 usa otro ID y sigue funcionando sin Pro.
- La recepción comprueba los IDs borrados antes de encolar y al aplicar. El
  borrado cambia su referencia de inmediato y retira su confirmación local
  pendiente; una respuesta atrasada no añade ese ingreso después del borrado.

Cerrar/eliminar un espacio sin anular la devolución no equivale a deshacerla:
su comprobante legítimo continúa recuperable. Las cuentas ajenas no pueden
editar comprobantes. La marca no es un nuevo respaldo financiero Gratis.
Retención de comprobantes hasta completar borrado de Auth, sin cambios; política
interna/web actualizada para explicar marca y fecha. No hay nueva clave local
ni nuevo formato de archivo por cuenta.

## Qué se prueba

Resultado: TypeScript/ESLint aprobados, 130 pruebas locales y 8 auditores;
54 unitarias de Functions y 50 de reglas/SDK/HTTP/eventos con Node 22. Una prueba
local preexistente ajena sigue sin registrar en Git; un clon limpio cuenta 129.
La recepción y la cancelación se probaron por separado; no se montó toda la UI.

- `pruebas/verificar-devolucion-anulada.mjs` ejecuta los manejadores originales
  del contexto con colas diferidas y el cliente TS real con SDK/almacenamiento
  sustituidos. Reproducción de respuesta vieja, retiro verificado de orden,
  fallo de disco, error de red y cambio de sesión. No monta toda la UI React.
- `functions/test/personal-return.test.js`: comprobante cancelado rechaza replay
  sin nuevas escrituras. Fixture de almacenamiento, helper propio real.
- `functions/emulator-tests/personal-return.test.js`: reglas/Firestore y
  transacciones Admin reales; devuelve, anula por la envoltura original, rechaza
  replay, confirma nuevamente anulación tras vencer Pro y crea retorno nuevo.
- `functions/integration-tests/account-lifecycle.test.js`: SDK/HTTP y Auth
  emulado reales bajo Node 22, con el mismo ciclo en Familia y Caja compartida.
  No se sustituye la función financiera ni se conecta a servicios de producción.
- Ambas regresiones fallaron antes del arreglo. Después del commit se puede
  repetir la local con `FINO_TEST_BASELINE=e4a58c8`; la de Firestore carga la
  envoltura anterior con `FINO_TEST_RETURN_BASELINE=e4a58c8`. El helper actual
  rechaza anulaciones, pero la envoltura anterior no marca el comprobante.

## Alcance y pendientes

- No se declara resuelta toda la conciliación de SDK ni las respuestas de
  consultas antiguas de Familia/Caja. Una anulación desde otro dispositivo
  requiere que su marca llegue por sincronización o conciliación; una respuesta
  emitida antes de anular puede seguir siendo vieja en ese dispositivo hasta
  actualizar. Si el ingreso ya estaba guardado, el retiro de orden por esa
  comprobación local no sustituye esa actualización remota.
- No se repararon anulaciones históricas sin marcador. No se interpreta
  desaparición de grupo como anulación ni se borran movimientos por adivinarla.
- Pendientes Android/Hermes, dos teléfonos, cierre durante anulación, disco
  lleno real, recepción de marcas y comportamiento ante grandes historiales.
- Se necesita desplegar ambas Functions actualizadas junto al cliente. Una
  app antigua carece de las guardias locales; no hacer entrega parcial ni
  declarar reparado el servidor que realmente está en producción.

**Qué sigue:** consultas atrasadas y conciliación entre dispositivos.
**Qué falta:** recorrido Android, pruebas entre teléfonos, consolas y publicación.
