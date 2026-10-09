# FINO-52 — borrados e identidades todavía pendientes

09/10/2026. Hallazgo confirmado, NO resuelto globalmente. No ejecutar una
migración de usuarios ni distribuir este bloque como cierre total de pérdida de
datos. Las tarjetas de crédito permanecen excluidas.

## Qué se comprobó realmente

`node pruebas/diagnosticos/reproducir-borrados-identidad.mjs` terminó ROJO
con siete casos. Está deliberadamente fuera del corredor de pruebas aprobadas:
no se borró ni se ocultó para mostrar una batería verde. Solo usa registros
ficticios y módulos originales; ningún dato o credencial real.

El diagnóstico fuerza dos números iguales con UUID de creación distintos.
Seis casos muestran que una marca antigua de borrado, que conserva solo el
número, prevalece sobre un alta independiente:

- mergeHistoryEntries y planLocalHistoryChanges, en cloudHistoryMigration.ts.
- stageLegacyHistory, en TypeScript.
- applyImportedTransactions: devuelve cero altas sin conservar la independiente.
- chooseEntry y covers del migrador administrativo: consideran el borrado
  suficiente incluso para una identidad independiente.

El séptimo caso muestra la ambigüedad de dos registros antiguos sin identidad:
mergeTransactions elige por fecha/número y no puede saber si son una edición
normal o dos altas distintas. No demuestra que todas las ediciones antiguas
sean colisiones. Por eso no se renumeran ni se duplican automáticamente.

El salto aleatorio/UUID anterior sí protege otras colisiones de altas nuevas;
sus pruebas verdes no cubren estos siete casos. No se afirma que un usuario
real haya perdido datos: se reproduce la ruta susceptible con datos ficticios.

## Arreglo acotado ya preparado

Telegram v1 rechaza agregar un número presente en deletedTransactionIds.
Antes podía confirmar el alta y el teléfono retirarla al sincronizar.
La prueba unitaria ejecuta el módulo original con Firebase/IO adaptados,
preserva bytes/listas y admite un número no eliminado. Contra b6cccc0 falla
por ausencia del rechazo; el código actual pasa. No añade campos ni cambia
IDs, montos o referencias. No soluciona por sí solo el protocolo de borrados.

## Marcas que se olvidaban por cantidad — corregido

El teléfono recortaba a 5000 movimientos o 1000 metas borrados, y Telegram v1
a 5000. Eso permitía que una copia antigua volviera a aportar un elemento cuyo
borrado se había olvidado. Los normalizadores originales y Telegram conservan
ahora todas las marcas válidas, sin añadir campos ni alterar IDs/importe.
Filtros y comparación de listas usan Set al recibir, restaurar y abrir, para
evitar búsquedas por cada registro cuando el historial es grande.

verificar-conservacion-borrados-real.mjs: 5001/1001 y 100000 marcas; regresión
b6cccc0 roja por el recorte. Telegram original: prueba con 5000 previas y una
eliminación adicional, objeto inicial intacto; anterior pierde la primera.
SDK/reglas/HTTP se verifican aparte. Si la copia no cabe, el guardado remoto
rechaza antes de escribir, sin recortar marcas para fingir éxito; contrato
estático comprobado, no una prueba de todos los casos de capacidad.

No reconstruye marcas ya perdidas ni garantiza que aplicaciones anteriores
no las recorten. No corrige marcas sin UUID ni restauración intencional remota:
eso necesita el contrato de origen/versiones siguiente y activación compatible.

## Condiciones antes de una solución integral

1. Diseñar marcas que conserven origen/versión, por cuenta, sin reutilizar IDs
   de referencias financieras ni asignar UUID diferentes a la misma edición.
2. Compatibilidad explícita con marcas numéricas antiguas y clientes viejos;
   una marca sin origen no permite inventar cuál de dos movimientos borraba.
3. Guardado/restauración/fusión/importación, cliente v1/v2, Admin, Telegram,
   Yape/metas y reglas deben aplicar el mismo contrato.
4. Copias originales preservadas; conflictos visibles y sin sobrescritura ni
   falso éxito. Migración reanudable y comprobada antes de retirar fuentes.
5. Probar borrado normal, colisión forzada, edición del mismo origen, respuesta
   atrasada, cortes, dos dispositivos y actualización con datos antiguos.
6. Autorizar y coordinar después el cambio de formatos/reglas/servidor/app.
   Revisar copias reales exige acceso expreso a esas cuentas, no está autorizado.

**Qué sigue:** el protocolo compatible y la prueba de esos casos hasta que
dejen de perder o descartar copias. **Qué falta:** revisión humana de antiguos
ambiguos, recorridos Android/dos teléfonos y entrega coordinada autorizada.
No renumerar, migrar ni «resolver» el conflicto eligiendo una copia a ciegas.
