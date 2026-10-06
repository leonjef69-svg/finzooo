# Borrado de cuenta y conversiones incompletas — 05/10/2026

## Falla y flujo preparado

La copia compartida pendiente podía contener el mismo aporte S/100 de la Caja
privada. El preflight la trataba como aportación real pendiente y no dejaba
borrar cuenta. Un índice cuyo destino había desaparecido se intentaba borrar
con SDK, pero las reglas no autorizaban ese caso.

1. `prepareIncompleteBoxDeletion(inspect)` comprueba las raíces incompletas
   propias sin escribir. Los clones no se cuentan como saldo real para el
   preflight. Lo compartido publicado conserva sus límites/aportes normales.
2. Después de aprobar todas las validaciones, `discard` vuelve a comprobar
   cada raíz en transacción con membresías/recibo. Si finalizar ganó, no la
   purga. Protocolo 2/3 requiere propiedad e inexistencia de invitados/recibo.
3. Para legado sin protocolo exige raíz determinista, nombre/moneda válidos,
   origen privado íntegro y todos los clones idénticos a sus filas originales.
   Un subconjunto correcto es una copia parcial; una fila ajena/distinta o
   ausencia de origen no se descarta por inferencia.
4. Se congela/cierra la raíz antes de limpiar movimientos/invitaciones en lotes
   de 200. Se retira su índice, incluso si faltaba inicialmente. Se conservan
   barrera y membresía propias hasta borrar Auth. No modifica Personal, no
   devuelve dinero ni borra origen en este paso; Cajas privadas se elimina
   después como parte del borrado expreso y normal de la cuenta.
5. Auth limpia pendientes/barreras en páginas de 100 **antes** de retirar
   recibos: una confirmación todavía permite reconocer dinero ya publicado.
   Después desaparecen miembros/raíz/índices y metadata. Reintento idempotente.

La función pública exige correo verificado/identidad reciente y usa el UID
de Auth, no el enviado en el cuerpo. Solo acepta inspect/discard; deleted se
usa únicamente en el evento administrativo de Auth. Respuesta ok/UID mínimo,
sin historial, fotos, importes ni listas compartidas de otra persona. El cliente
comprueba generación/cuenta y no sigue con una respuesta incompleta o ajena.

## Reglas y compatibilidad

- Un índice SDK nuevo requiere membresía en getAfter, raíz no cerrada/borrada/
  cancelada, copia abierta y forma boxId/unidoEn exacta. Permite crear/unirse
  atómicamente; no admite índices arbitrarios sin espacio.
- SDK no puede borrar raíz/membresía con migrationDeletionPending: borrar la
  barrera antes de Auth permitiría que una petición vieja recreara el destino.
- Una conversión nueva incompleta requiere protocolo 2 (el 3 lo crea Admin).
  Una app antigua no inicia un legado nuevo cuando su origen ya fue retirado.
  Las raíces normales publicadas y lectura propia de índices conservan permisos.
- El origen privado no se entrega a Gratis para comprobar el legado: Admin lo
  comprueba internamente y no devuelve su contenido.
- Publicar juntas función, evento Auth, reglas y app; no entregar el cliente
  antes del servidor ni revertir a reglas/app que reactiven barreras.

## Pruebas

- `pruebas/verificar-borrado-caja-incompleta.mjs` ejecuta las funciones reales
  de cliente con SDK/servidor aislados: inspect sin cambios, descarte solo
  comprobado, saldo publicado protegido y fallo que impide iniciar borrados.
  Contra 51a57d0 falla por unsettled-personal-contributions para el clon de S/100.
- `functions/test/incomplete-box-cleanup.test.js`: sin mutaciones previas,
  interrupción/reintento, legado exacto/distinto, recibo/miembros/IDs ambiguos,
  protección de origen/otras cuentas y más de 100 raíces/400 clones.
- `functions/integration-tests/incomplete-boxes.test.js`: SDK/callables HTTP,
  transacciones reales, cuenta Gratis, legado correcto/inconsistente, raíz sin
  índice y enlace sin destino, SDK directo bloqueado, 106 raíces/405 clones,
  finalizar frente a purgar y recorrido completo deleteCloudAccount → Auth.
  Incluye JWT anterior a borrar Auth que no puede recrear el índice por REST.
- `FINO_TEST_INCOMPLETE_BASELINE=51a57d0` carga el cliente original desde Git
  sin modificar archivos de trabajo; su preflight bloquea la misma copia.
- La prueba previa de sincronización solo aísla el import del nuevo borrado
  (lo prohíbe si se llama compartiendo). No sustituye la lógica ni retira sus
  comprobaciones de versiones, sesiones y copia actual.

## Qué sigue y qué falta

TypeScript/ESLint aprobados; 136 pruebas locales y 8 auditores (135 en copia
limpia: una prueba ajena previa no registrada), 63 unitarias Functions y 89
SDK/reglas/HTTP/eventos con Node 22, cero fallos. Regresión local y de SDK contra
51a57d0 fallan por unsettled-personal-contributions del clon de S/100. La prueba
inicial de sincronización falló por import no aislado; tras corregir su adaptación
se aprobó la suite completa sin quitar verificaciones. Guardias reales cubren
respuesta mínima inválida/ajena y generación de sesión A → B → A.

Sigue comprobar la reparación automática de pares Personal/Caja heredados y
dar resolución explícita a conflictos. Faltan teléfono/emulador Android,
cierres forzados/dos dispositivos, tamaño/espacio lleno, legado que no se
puede demostrar e índices publicados. No se certifica lo publicado en consolas.

El borrado completo de cuenta sigue siendo una secuencia, no una sola operación
entre teléfono/Firestore/Auth. Si otro paso falla después de iniciar limpieza,
puede haber borrados parciales en nube: conservar teléfono y reintentar; no
prometer deshacer la eliminación ni declarar resuelta la atomicidad global.
Un legado sin origen, con invitados o con diferencias requiere revisión explícita,
no una purga automática. No se arreglaron datos reales ni se publicó app/servidor/
política web. Tarjetas y código nativo quedan fuera.
