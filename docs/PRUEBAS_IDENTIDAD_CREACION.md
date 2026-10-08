# FINO-52: altas nuevas distinguibles, datos antiguos conservados

08/10/2026. Continuación del refuerzo de orígenes. Preparado, no publicado;
no equivale a cerrar FINO-52 ni toda la auditoría.

## Cambio y compatibilidad

- `nextId` conserva el número y el máximo conocido, pero añade 24 bits de
  entropía nativa aun cuando el reloj queda por debajo del máximo restaurado.
  No cae en el antiguo `máximo + 1` compartido. Comprueba entero seguro y
  detiene el alta antes de agotarse; no promete números matemáticamente únicos.
  El espacio restante no es infinito: desde la base actual, el salto medio
  permite aproximadamente 180 millones de altas (unos 90 millones con salto
  máximo). No se extrapola esa cuenta a datos cuyo máximo ya sea mayor.
- UUID de creación independiente, en memoria al emitir el número, se conserva
  en movimientos personales nuevos, importados, Yape y metas. Editar conserva
  esa identidad; el formulario de meta ya no descarta campos existentes.
  No se etiquetan ni renumeran automáticamente movimientos/metas antiguos.
- Una coincidencia numérica con identidades distintas, o con identidad retirada,
  interrumpe fusión/recepción/guardado/importación antes de reemplazar originales.
  Aportes/devoluciones siguen usando sus referencias financieras existentes:
  no se agrega un UUID únicamente a su mitad local guardada por el servidor.
  No se modificaron pantallas, cálculos ni servicios de tarjetas de crédito.
- App nueva guarda `recordIdentityFormat: 1`. Reglas preparadas permiten ese
  campo y no dejan retirarlo: una app anterior que descarte campos nuevos no
  podrá volver a guardar esa cuenta. Coordinar actualización/reglas y advertir
  a los usuarios antes de aplicar esto en producción.
- Reglas v2 también conservan `creationId` por fila. Migrador administrativo JS
  ahora rechaza origen diferente en elección y cobertura, no solo empates de
  fecha. Admin omite reglas: su comprobación es independiente y no se ejecutó
  una migración real ni se escribió en Firebase de producción.

## Evidencia ejecutada

`node pruebas/verificar-identidad-creacion-real.mjs` ejecuta generador y fusión
originales mediante TypeScript, y manejadores originales del contexto extraídos
por AST. Adaptadores de IO: reloj/bytes fijos, UUID de Node independiente y
setters/mensajes; no acredita entropía nativa ni UI Android.

Incluye máximo común con azar distinto, 100.000 altas con salto máximo,
agotamiento/entropía fallida, y **coincidencia numérica forzada con UUID distintos**:
manuales y metas no se reemplazan, objetos intactos, edición del mismo origen
permitida y creación/edición en contexto sin falso éxito. Regresión
`FINO_TEST_CREATION_ID_BASELINE=72e816b` roja por el antiguo mismo número,
no por ausencia de una API. Diagnóstico histórico del máximo común ahora verde;
no se usa ese único caso como prueba del hallazgo completo.

Servidor original: `functions/test/personal-history-migration.test.js` comprueba
UUID/aviso/aporte, ambas direcciones, edición compatible y rechazo antes de
considerar una fila copiada. Regresión
`FINO_TEST_HISTORY_ADMIN_ORIGIN_BASELINE=72e816b` roja. Batería Node 22 del
servidor: 83 pruebas aprobadas, sin producción ni módulo de tarjetas.

SDK/reglas reales de Firestore local: 40 comprobaciones aprobadas en archivos
`personal-history-client`, `personal-history`, `personal-fields`, `cloud-pro`
y `account-currency`. Caso de orígenes incluye ocho comprobaciones contando el
padre: manual v2 rechaza sustitución/retirada, meta v1 rechaza otra identidad,
reglas bloquean app que quite el marcador y misma edición sigue admitida.
Regresión `FINO_TEST_MOVEMENT_ORIGIN_RULES_BASELINE=72e816b` roja; reglas actuales
repetidas verdes. Se conserva prueba de 10.000 filas y migración ordinaria.
No prueba específicamente todos los cortes de una migración con colisión.

## Lo que sigue abierto

1. Historial/metas antiguos sin referencias inequívocas no permiten distinguir
   todas las ediciones de todas las colisiones. No se reconstruye un dato ya
   perdido. Necesita revisión de copias reales y estrategia compatible, sin
   asignar UUID a dos versiones antiguas a ciegas ni renumerar enlaces.
2. Lápidas actuales identifican por número, no por UUID: no se demuestra el
   caso de borrado de una de dos altas independientes con el mismo número.
3. Reglas v1 no validan individualmente identidades dentro de listas; marcador
   bloquea clientes que lo quiten, no todo escritor directo que lo conserve.
   No se afirma protección completa contra SDK/Admin/cliente malicioso.
4. Parejas financieras existentes y sus conversiones/reparaciones necesitan
   recorrido combinado. No certifica todas las entradas nativas, Telegram,
   retorno recuperado, escritura indirecta ni carrera de migración por pasar
   estas pruebas. Nunca restaurar/copiar datos dañados sin comprobación.
5. Se conserva en memoria un máximo de 100.000 identidades emitidas; no es un
   registro persistente. El UUID debe viajar en el dato al guardarlo. Los
   originales ya guardados no dependen de ese caché ni se retiran por su límite.
6. Android, dos teléfonos, actualización sobre datos antiguos, rendimiento
   nativo y publicación coordinada aún pendientes. Tarjetas y Sentry externo
   fuera. No APK/AAB/OTA/EAS/despliegue; Git no actualiza los teléfonos.

**Qué sigue:** completar compatibilidad/lápidas/migración y los siete IDs de
revalidación; **qué falta:** pruebas físicas, consolas, políticas/trámites,
cobros y entrega autorizada. Auditoría abierta.
