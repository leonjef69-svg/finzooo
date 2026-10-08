# FINO-52: protección parcial de orígenes conocidos

08/10/2026. FINO-52 sigue abierto. Esta entrega NO cambia el generador de
identificadores ni renumera movimientos, metas o referencias de dinero.

## Qué se protege

Cuando el mismo número pertenece a dos avisos Yape con `captureId` distintos,
o a dos aportes con vínculo, tipo o espacio distintos, la unión se interrumpe
antes de escoger el más reciente. Conserva los objetos originales; no inventa
qué movimiento es correcto. Una edición con el mismo origen sigue admitida.

- Fusión en memoria/disco, incluido el atajo `hayNovedades`: comprueba todos
  los registros antes de decidir si hay novedades, también con listas aisladas.
- Importación: no sustituye ni descarta silenciosamente un origen diferente
  bajo un número existente. Historial separado: planificación, unión y
  comprobación de la copia sombra rechazan esos conflictos.
- Recepción/restauración del contexto comprueban los movimientos antes de
  aplicar perfil, presupuestos o marcas. Settings explica conservar las copias
  y no desinstalar ni borrar datos; respaldo devuelve un motivo específico.
- Reglas preparadas del historial por documentos: un cliente directo tampoco
  puede cambiar o quitar un origen ya guardado. Permiten editar el mismo origen,
  borrar explícitamente y conservar registros antiguos sin referencias o nulos.

## Qué se ejecutó

`node pruebas/verificar-origen-movimientos-conflicto.mjs`

Ejecuta módulos originales compilados con esbuild, no una copia de su lógica.
Incluye ambos órdenes, duplicados internos, referencias enlazadas y controles
positivos (edición, importación idempotente, borrado y formato antiguo).
También ejecuta recepción, restauración, setter inmediato y recogida del disco
originales extraídos por AST, con adaptadores de IO. En conflicto: no cambian
listas/metadatos ni se escriben datos, y la recogida devuelve `ok=false`.
No monta React, ni acredita Android/Keystore/servicio real.

Regresión: `FINO_TEST_MOVEMENT_ORIGIN_BASELINE=0a6b9a9` falla por ausencia de
rechazo del conflicto, no por falta de una API. Todas las dependencias del
módulo de prueba proceden de la misma revisión.

Con Firestore local en 127.0.0.1:8080 y Node 22 se ejecutó:

```
node --test functions/emulator-tests/personal-history-client.test.js functions/emulator-tests/account-currency.test.js functions/emulator-tests/cloud-pro.test.js
node --test functions/emulator-tests/personal-fields.test.js functions/emulator-tests/personal-history.test.js
```

SDK/reglas reales locales, 38 comprobaciones aprobadas (26 + 12). Dos clientes
de la misma cuenta conservan el original al intentar subir otro origen;
respaldo v1 también devuelve conflicto sin escribir lista ni metadatos. Reglas
rechazan cambios y eliminación de referencias desde el SDK directo. Controles
positivos: misma edición, borrado, origen ausente/nulo, 10.000 filas, Pro,
moneda y migración ordinaria reanudable. Auth nativo/caché usan adaptadores;
proyectos `demo-*`, no cuentas ni datos de producción.

Regresión de reglas: `FINO_TEST_MOVEMENT_ORIGIN_RULES_BASELINE=0a6b9a9` en el
caso «orígenes distintos» falla: las escrituras directas indebidas sí pasan con
las reglas anteriores (2 controles fallan y causan otro conflicto posterior;
6 comprobaciones, 4 fallos contando el padre). Después se repitió con reglas
actuales y pasó. No se publicaron reglas ni se ejecutó una migración real.

## Límites y trabajo restante (no omitir)

1. Movimientos manuales y metas sin identidad de creación siguen expuestos:
   el diagnóstico `pruebas/diagnosticos/reproducir-colision-identificadores.mjs`
   sigue rojo y fuera del conteo aprobado. El generador NO está corregido.
2. La guardia de la app exige referencias existentes en ambos registros; si
   una falta, no puede demostrar que sean orígenes diferentes. El mismo origen
   tampoco demuestra que el resto del dato sea correcto.
3. Reglas nuevas cubren historial por documentos, no identidades dentro de
   la lista raíz v1. Clientes antiguos/directos v1 y Admin requieren protección
   adicional; Admin omite reglas. El migrador JS administrativo aún debe
   incorporar esta comprobación, no basta la copia sombra TypeScript.
4. No se certifican todos los caminos de creación/edición individual, captura
   de fondo, registro de diagnóstico, confirmación nativa ni limpieza. El caso
   de recogida del disco ejecutado no acredita todo el servicio Android.
5. Borrados siguen marcados por número: no se acredita distinguir los dos
   orígenes en una lápida. No se recupera automáticamente un movimiento que ya
   fue reemplazado. Hace falta migración compatible con referencias e
   importaciones, pruebas independientes y dos teléfonos antes del cierre.
6. TypeScript/ESLint y corredor local se comprobaron aparte; tests verdes no
   son equivalentes a publicación ni a cobertura completa.

**Qué sigue:** identidad estable de creación para manuales/metas y protección
compatible de referencias, sin renumerar datos a ciegas; revalidar
FINO-15/16/34/37/47/49/50. **Qué falta:** Android/dos teléfonos,
consolas/políticas/trámites, cobros y entrega coordinada autorizada. Tarjetas
de crédito y Sentry externo permanecen fuera. Auditoría no terminada.
