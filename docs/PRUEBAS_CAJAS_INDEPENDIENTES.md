# Cajas independientes de registros antiguos

## Problema y alcance

Una incidencia de una Caja antigua bloqueaba todas las operaciones, incluida
la creación de una Caja nueva sin relación. El arreglo localiza el bloqueo y
conserva por separado las fuentes del teléfono y servidor de la Caja afectada.
No decide que esos registros fueron borrados ni cambia su dinero.

## Pruebas ejecutables

`node pruebas/verificar-cajas-independientes-real.mjs` ejecuta el guardado de
nube, las acciones y la expresión de bloqueo originales, con React, sesión y
Firestore adaptados. Comprueba:

- Crear desde Personal o dinero externo aunque «hj» tenga tres casos pendientes.
- Mantener los registros dudosos y las marcas de borrado; bloquear tocar «hj».
- Bloquear problemas sin Caja identificable, datos inválidos, comprobaciones
  iniciales y revisión monetaria pendiente.
- Aceptar grupos antiguos de IDs repetidos solo si permanecen idénticos;
  rechazar cambios, borrados o reutilización de sus enlaces.
- Subir la Caja sana sin reemplazar la fuente antigua local o remota.
- No volver a subir una Caja que el servidor marca borrada.
- Rechazar un enlace que cruza entre una Caja sana y otra protegida.
- Rechazar la unión de dos gastos que excedan el saldo de una Caja sana.

`node pruebas/verificar-guardado-personal-cajas.mjs` añade cuatro casos con las
acciones, contexto, almacén y lote SQLite originales: Personal/externo y enlaces
antiguos únicos/repetidos. Comprueba el contenido escrito y no solo la memoria.
El cifrado y Android se adaptan; no es una prueba del Keystore o teléfono físico.

Regresión contra `9c146c1`: configurar `FINO_TEST_INDEPENDENT_BOX_BASELINE` y,
por separado, `FINO_TEST_INDEPENDENT_BOX_CASE` a `screen`, `cloud`, `duplicate`.
Las tres fallan respectivamente por el bloqueo global, reemplazo de la fuente
local y rechazo global de enlaces repetidos. Borrar esas variables al finalizar.

Las suites de sincronización, aportes consumidos, conversión y aceptación de
documentos conservan sus verificaciones anteriores; sus adaptadores incorporan
las nuevas dependencias de la pantalla.

## Límites y siguiente comprobación

No se modifica ningún dato real en estas pruebas. Falta comprobar visualmente
en Android la creación con ambos orígenes y la navegación, y repetir con dos
cuentas/dispositivos y reglas Firebase reales. La revisión de los casos antiguos
de «hj» sigue pendiente. Compartir no se desbloquea ante incidencias de otra Caja
porque ese camino todavía respalda la fuente completa sin aislamiento.

No se modifica Pro, moneda, idioma, código nativo, Firebase publicado ni tarjetas.
El resto de hallazgos de Familia/Cajas compartidas permanece abierto en ESTADO.md.
