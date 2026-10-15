# Respaldo y versión publicada de Firebase — 12/10/2026

**Actualización 15/10/2026:** después de que el propietario vinculó la cuenta,
Cloud Billing confirma `billingEnabled=true` en dotero-2d430. Blaze ya está activo.
Siguen cero Functions y las mismas reglas del 02/10. La evidencia de abajo es
histórica; no volver a pedir activar Blaze. Servicios/reglas/app y controles de
consumo siguen pendientes de activación coordinada. Ver la auditoría del 15/10.

## Evidencia de solo lectura

Proyecto de la app: `dotero-2d430`.

- Reglas vigentes: publicación actualizada `2026-10-02T18:22:31.018596Z`.
- Hash SHA-256, normalizando CRLF: remoto
  `05fe9ae1f43dcb57f5b37799ed3c0f1ea4995cc6c420cd226d0ccc78bfda966a`;
  local `9e8306f313a327e5040d2b77c358c71f19b09252803bd9173c67325d6d0ece6b`.
- La lista de campos permitidos en la raíz Personal no incluye `syncFormat`,
  `recordIdentityFormat` ni `recordSyncAt`.
- `saveCloudData` envía esos campos. La regla `hasOnly` explica el rechazo
  de esa escritura sin necesidad de consultar el historial real ni escribirlo.
- Lista de Cloud Functions: cero funciones publicadas.
- Consulta Cloud Billing `projects/dotero-2d430/billingInfo`: facturación desactivada.

Las consultas usaron la sesión existente del CLI. No activaron APIs, vincularon
facturación, migraron datos ni publicaron nada. No muestran estado Pro individual,
correo del usuario del emulador o una confirmación de respaldo real exitoso.

## Cambio local seguro

Ajustes no puede deducir «correo sin verificar» de un rechazo de permisos.
Ahora pide confirmación solo si `emailVerified === false`; para correo confirmado
o sesión desconocida explica el rechazo y la conservación local. No elimina los
campos nuevos para guardar con reglas anteriores: eso retiraría protecciones.

`verificar-respaldo-permisos-real.mjs` ejecuta la expresión original JSX de
Ajustes, con Auth adaptado. Comprueba correo confirmado/no confirmado/desconocido,
demás motivos y texto en tres idiomas. Falla contra `f9e1f5b` por el mensaje falso
a una cuenta confirmada. No acredita pantalla Android o publicación de Firebase.

## Para continuar en producción

Firebase exige Blaze para publicar Cloud Functions:
https://firebase.google.com/docs/functions/get-started

El propietario debe decidir sobre el plan por consumo y su cuenta de pago.
Antes de desplegar hay que acordar controles/costos, revisar compatibilidad y
seleccionar servicios concretos de cuenta/Familia/Cajas. Telegram sigue en pausa
y no se publica por acompañamiento; los cambios ajenos de Functions no se incluyen
en esta corrección. Actualizar solo las reglas no proporciona los servicios
ausentes ni resuelve todas las operaciones compartidas de esta versión.

## Precaución con las credenciales

La consulta estándar `firebase login:list --json` imprimió tokens inesperadamente.
No repetirla ni compartir su salida. Se recomendó al propietario revocar esa
sesión del CLI y volver a autenticar; no se guardan credenciales en esta guía,
commits ni archivos de diagnóstico. Los siguientes diagnósticos solo imprimen
booleanos, nombres públicos de servicios y resúmenes de reglas.
