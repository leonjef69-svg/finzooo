# Cajas privadas: copias recientes y conciliación conservadora

05/10/2026. Preparación local; no APK/OTA, despliegue, datos reales ni tarjetas.
Continúa los riesgos de pérdida/mezcla de datos. No declara terminada la auditoría.

## Fallas reproducidas

- La unión prefería siempre el teléfono: una edición de importe 120 en nube
  volvía a 100 al subir un teléfono atrasado. La prueba falla con `100 !== 120`
  contra `bcc34d3`, tanto con el helper original como con SDK/Firestore reales.
- La lectura podía usar caché y marcarla confirmada. No exigía generación local
  de cuenta; una respuesta/reintento A → B → A podía continuar en otra sesión.
- La subida contenía `undefined` opcionales, rechazados por Firestore, y su
  resultado no llegaba a la pantalla. Los fallos no se mostraban.
- Una reparación reemplazaba todo el movimiento de Personal, perdiendo campos
  adicionales y marcas de consumo. Tampoco adelantaba la referencia de borrados
  al reconstruir ni avanzaba la fecha de edición para sincronizar el arreglo.
- Dos gastos distintos que usaban el mismo saldo podían unirse sin detectar
  el sobregiro. Una ausencia sin marca se consideraba borrado de Personal.

## Correcciones y límites de comportamiento

1. Cajas/movimientos llevan `updatedAt` en sus ediciones. La siguiente edición
   local avanza respecto de la versión previa aunque se atrase el reloj. La
   unión elige la versión más nueva en ambos sentidos; IDs/marcas de borrado
   siguen prevaleciendo. Nuevos registros usan su fecha de creación como base.
2. Si dos contenidos distintos tienen la misma versión, incluidos datos
   antiguos sin marca, se aborta sin elegir una copia a ciegas. También se
   rechaza una unión cuyo saldo queda negativo. No se borra un gasto para ocultar
   el conflicto. Unidades de milésimas y BigInt evitan errores de acumulación.
3. `syncFormat: 2` conserva este protocolo. Las reglas admiten la primera
   actualización y después impiden que un cliente viejo quite el marcador o
   vuelva al formato 1. No impiden el borrado de la copia por su dueño Gratis.
4. Lectura financiera obligatoria del servidor, sin escrituras pendientes.
   Documento incompleto, tipos/IDs/importes inválidos, formato desconocido o
   problema de red no equivalen a datos vacíos. No se interpreta ausencia sin
   marca como eliminación, ni siquiera con una copia antigua confirmada.
5. Subida transaccional con unión actual, limpieza de `undefined` y control de
   cuenta/generación antes/después de cada espera. Un archivo local ilegible
   impide subir incluso si el fallo se descubre mientras se lee la transacción.
   Una petición ya enviada al servidor no puede retirarse retroactivamente.
6. La pantalla/cache se separa por UID/generación. Las acciones y respuestas
   anteriores no modifican otra sesión. Una referencia inmediata conserva los
   cambios locales todavía no pintados cuando llega la nube. El resultado
   confirmado vuelve a la pantalla sin otra consulta; recibir datos idénticos
   no provoca un bucle de subidas. Hay aviso traducido de fallo/conflicto y
   botón para actualizar. Si el archivo local no se puede comprobar, no se
   reemplaza; un conflicto requiere revisar las copias, no elegir automáticamente.
7. Conciliación de Personal solo desde carga disponible y cuenta actual;
   borrados únicamente con marca explícita de la Caja activa. Una reparación
   conserva campos no suministrados, no reabre registros ya liquidados/consumidos
   y avanza la marca de edición. La referencia de IDs restaurados se actualiza
   antes de la siguiente respuesta.
8. Al compartir se comprueba que Caja/movimientos capturados coinciden con la
   copia privada recién consultada, antes de crear el espacio. Si había otra
   edición/movimiento remoto no se retira su origen. Cada espera/lote está
   ligada a la misma sesión. Se bloquean acciones locales durante esa operación.
   Esto NO bloquea a un segundo teléfono durante toda la conversión (pendiente).

Gratis sigue trabajando localmente sin consultar la nube de Cajas. Pro usa el
mismo documento por cuenta; no se añaden servicios ni colecciones de fotos.
Se documentan fecha de edición/formato en política interna, web y PLAYSTORE.md.
El archivo cifrado por cuenta conserva su formato actual; lee datos antiguos.
No activar reglas/clientes por separado ni revertir sin revisar formato 2.

## Pruebas

Resultado final: TypeScript/ESLint aprobados, 132 pruebas locales y 8 auditores,
54 unitarias de Functions y 61 de reglas/SDK/HTTP/eventos bajo Node 22.23.3.
Una prueba preexistente ajena sigue sin registrar en Git: un clon limpio cuenta
131 locales. No se declara validada la UI nativa por estas cifras.

- `pruebas/verificar-cajas-sincronizacion.mjs`: TS original, auxiliares reales,
  callbacks de carga/aplicación/contexto extraídos por AST, SDK/dispositivo
  sustituidos para ordenar respuestas. Versiones, empates, sobregiro, borrados,
  estructura inválida, fallo local durante envío, `undefined`, caché/sesión,
  respuesta tardía, anotación encolada, Gratis y consumo. No monta toda React UI.
- `functions/integration-tests/private-boxes.test.js`: dos SDK reales con Auth
  y Firestore/reglas locales, código TS real de subir/bajar/union. Solo Firebase
  de prueba y generación/legibilidad del almacenamiento Android se sustituyen.
  Ediciones, escrituras simultáneas, resultado confirmado, sobregiro, conflicto,
  borrado, cliente antiguo, desconexión, copia inválida y protección Gratis.
- Las pruebas anteriores de ausencias ahora exigen marca explícita, conservando
  comprobaciones de Cajas cerradas, datos compartidos y borrado local Gratis.
  El auditor textual acepta la condición más fuerte de carga/cuenta; la prueba
  nueva también ejecuta esa condición. No se eliminó ninguna suite.
- Regresión local: `FINO_TEST_BASELINE=bcc34d3` y ejecutar la prueba nueva.
  Regresión SDK: `FINO_TEST_CAJAS_BASELINE=bcc34d3`, con Auth/Firestore locales,
  ejecutar solo `functions/integration-tests/private-boxes.test.js`. Ese modo
  se detiene tras el primer subcaso que demuestra la sobrescritura antigua;
  en ejecución normal corren todos. Ambas regresiones fallaron antes del arreglo.
- Suite completa: `node pruebas/correr.mjs`; TypeScript/ESLint según AGENTS.md.
  Servidor con Node 22 real: `scripts/verificar-servidor.mjs`, conforme a la guía
  `PRUEBAS_NODE22_BORRADO_CUENTA.md`. No utiliza una sesión de producción.

## Qué sigue y qué falta

- Conversión privada → compartida interrumpida o modificada desde otro teléfono
  durante la copia: bloqueo/protocolo global, revisión de lotes ya copiados,
  limpieza de espacios incompletos y finalización segura. Revisarlo antes de
  considerar cerrada la migración de Cajas.
- Personal y Cajas se guardan en documentos/archivos distintos. Detectar una
  unión negativa no garantiza una transferencia indivisible ni resuelve dos
  devoluciones offline con distintos IDs ya registradas en Personal. Necesita
  comprobación y protocolo de operación entre ambas mitades; no inventar ajustes.
- Relojes distintos entre teléfonos, empates/conflictos antiguos y resolución
  asistida de esos conflictos. No se garantiza orden global usando solo fechas
  del dispositivo; se conserva información y se avisa en vez de escoger empate.
- Historial de Cajas sigue en un documento con límite de tamaño de Firestore;
  queda paginación/tamaño/costos, en vez de prometer nube ilimitada.
- Android: renderizado, botón/avisos, cierre o muerte de proceso, moneda de tres
  decimales, dos teléfonos y recuperación tras fallos. No se probó UI nativa.
- Entrega conjunta reglas/app y lo preparado en Functions previamente, consolas
  y documentación final de tienda. No se repararon cuentas reales ni se publicó.
