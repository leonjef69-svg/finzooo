# FINO-20 — invitaciones de un solo uso

Preparado el 07/10/2026. No publicado. No se tocaron datos reales.

## Qué se corrigió

La app ya borraba el código al entrar, pero las reglas no lo exigían. Una
llamada directa podía crear la membresía y dejar vigente el código. Se exige
ahora que exista antes y desaparezca después del mismo guardado. El destino,
vencimiento, correo verificado, espacio abierto y Pro del dueño siguen siendo
obligatorios. Entrar como invitado no exige Pro al invitado.

Solo el creador puede revocar libremente su código. El invitado puede consumir
únicamente el que le autoriza su membresía nueva en ese mismo guardado; un
miembro existente no puede borrar otros códigos ajenos. Una cuenta marcada en
el servidor como en eliminación no crea una membresía mediante petición vieja.
Esto no elimina miembros existentes ni modifica sus movimientos/saldos.

No añade funciones del servidor, claves, colecciones, datos personales, permisos
Android ni destinatarios. Las invitaciones consumidas se eliminan como ya hacía
la app; no hay un registro nuevo de retención. No cambia precios ni planes.

## Evidencia

Cierre aprobado: TypeScript, ESLint sin avisos, 148 pruebas del proyecto y 8
auditores (147 pruebas en Git limpio), 82 unitarias del servidor y 142 pruebas
de reglas/SDK/HTTP/eventos en Firebase local bajo Node 22. La suite de invitaciones
incluye 12 casos y su contenedor (13 en TAP). La regresión contra `d9c3d01`
falló por los tres riesgos en ambas clases de espacio; luego la suite actual
pasó. No hubo pruebas omitidas en la batería del servidor. Tarjetas y cuatro
simulaciones antiguas de navegación siguen fuera del conteo de la app.
ADB no encontró dispositivos conectados en esta sesión.

`functions/emulator-tests/invitations.test.js` ejecuta las reglas reales en
Firestore local y los métodos originales `unirseAFamilia`/`unirseACaja` extraídos
de TypeScript. Solo se sustituye el formato de la fecha devuelta; las lecturas,
transacciones, índices y permisos son del SDK real, no de una copia de su lógica.
El emulador de Auth no interviene en esta suite de reglas: los tokens se simulan
con `authenticatedContext`. No es una prueba del login ni de Android.

La primera ejecución falló contra las reglas anteriores: se permitía entrar sin
consumir el código. Las comprobaciones de entradas válidas usan un usuario/código
distinto al caso rechazado, para no contaminarse si se ejecuta la regresión.
Con Firestore local activo, `FINO_TEST_INVITES_BASELINE=d9c3d01` vuelve a usar las
reglas vulnerables sin cambiar archivos ni las reglas del proyecto de la suite
normal: utiliza un proyecto `demo-*` separado. Debe fallar, no es una validación
verde. La variable solo se aplica al proceso de comprobación, nunca a producción.
La ejecución posterior pasó los casos iniciales; la batería completa añade el
rechazo de cuentas en eliminación. Se comprueba, para Familia y Caja:

- entrada directa sin consumo, consumo sin entrada y reutilización;
- recorrido original con membresía/índices/consumo juntos;
- revocación del creador, no de un miembro cualquiera;
- destino incorrecto, caducidad, correo sin verificar y lote rechazado;
- dos entradas simultáneas: una sola confirmada;
- espacio cerrado/en cierre/en borrado y dueño sin Pro;
- cuenta del invitado en eliminación, tanto en `users` como en su registro
  privado de prueba; el código se conserva cuando el guardado se rechaza.

## Revalidación relacionada: FINO-06 y FINO-31

- FINO-06 ya estaba corregido. `activatePremiumTrial` usa una transacción y
  `premiumTrialClaims/{uid}` independiente del respaldo financiero; borrar solo
  este último no reinicia la prueba. El servidor comprueba identidad existente,
  no admite nuevas activaciones durante el borrado y usa su propia fecha.
  Se volvieron a ejecutar `functions/test/premium-trial.test.js` y
  `pruebas/verificar-nube-pro-servidor.mjs`. La primera usa un adaptador falso
  de Firestore; no se presenta como prueba de transacciones reales concurrentes.
- FINO-31 ya estaba corregido. `loadCloudData` consulta permisos antes del
  documento financiero; el servidor usa una máscara de campos para no descargar
  movimientos/fotos/perfil. La prueba ejecuta el método original: Gratis hace
  cero lecturas del documento financiero, incluye cambio de cuenta y respuesta
  inválida. `cloud-pro.test.js` comprueba reglas reales y no concede lectura por
  manipular el cliente. Siguen pendientes consolas/configuración desplegada.

## Qué sigue y qué falta

Límite de la protección de identidad: el rechazo agregado cubre la cuenta mientras
existe su marca de eliminación en Firestore, no acredita invalidar un token aún
vigente después de terminar el borrado Auth y retirar las marcas. Las reglas no
consultan directamente la existencia en Auth. Ese caso requiere prueba real
Auth/SDK y una corrección coordinada si permite recrear membresía; no se declara
resuelto ni se cambia la retención por inferencia en esta tanda.

Probar en dos dispositivos/cuentas de prueba: invitar a Gratis, consumir una vez,
repetir/reiniciar, red cortada, vencimiento y dueño sin Pro. Publicar las reglas
solo dentro de la entrega coordinada autorizada. Las reglas en GitHub no protegen
el proyecto hasta desplegarlas; no se hizo despliegue en esta tanda.

FINO-21 sigue pendiente: el receptor Android de exportación combina arranque y
acción privada en un componente público. El filtro por nombre de acción no
autentica al remitente. Revisar/separar esas entradas y comprobar Android antes
de entregar. FINO-09 (puntualidad), restantes IDs, políticas/consolas y publicación
siguen pendientes. Sentry y tarjetas permanecen excluidos.

Referencia técnica: [operaciones atómicas y reglas de Firebase](https://firebase.google.com/docs/firestore/manage-data/transactions#data_validation_for_atomic_operations).
