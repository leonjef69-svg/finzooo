# FINO-30 — archivo preparado no es envío confirmado

Revisión: 07/10/2026. Código preparado, no publicado.

## Problema y alcance

ExportPdfSheet marcaba la fecha de exportación/ejecución también cuando solo
abría WhatsApp, Gmail, correo o el selector. Incluso sin aplicación disponible
podía marcarla. Android no informa si el usuario envió/canceló ni recepción;
MailComposer retorna SENT igualmente en Android. Sharing resuelve void.

No se presenta como un fallo de entrega real probado ni se inventa recibo de
WhatsApp/correo. La marca antigua no aparecía como un historial de entregas
visible: hoy se conserva para uso futuro. El hallazgo se precisa con ese límite.

## Cambio

- Carpeta/Drive/Dropbox/OneDrive solo confirman tras el guardado aprobado;
  conserva mensajes de guardado, confirmación de la ejecución y errores.
- WhatsApp/Gmail/correo/selector no confirman guardado programado ni fecha de
  entrega. Dice «Archivo preparado. Termina el envío en la aplicación que elijas».
  Cancelar no genera una falsa confirmación; ausencia del selector se explica.
- Mismo archivo/destinatario/tipo/nombre y caminos de respaldo. No se verifica
  recepción por terceros. No se crean recibos ni nuevos datos/servicios/permisos.
- Bloqueo inmediato de dos toques durante el trabajo, liberado para reintentar
  tras error. Exportación automática sigue limitada a destinos sin intervención.
- Tres idiomas con texto de preparado/no aplicación. Voz mantiene autoFired;
  sus rutas silenciosas se cierran como antes, sin reclamar un envío confirmado.

## Prueba local y límites

`node pruebas/verificar-entrega-exportacion-real.mjs` ejecuta handleExport y
exportacionHecha ORIGINALES con IO sustituido: cuatro destinos externos, directos,
fallback, cancelado/SENT/saved, ausencia, error; cuatro destinos guardados con
respuesta pendiente/error/doble toque; tres formatos y reintento. Ejecuta catálogo
real es/en/pt y contrasta contrato de MailComposer instalado. No monta React ni
usa Android/nube/correos reales. No mantiene copia de la lógica del manejador.

Regresión contra `FINO_TEST_EXPORT_DELIVERY_BASELINE=ac8ebd7` falla al confirmar
WhatsApp; código preparado aprueba. TS/ESLint/batería se registran en seguimiento.

## Android pendiente

1. PDF/Excel/CSV a WhatsApp/Gmail/correo: cancelar, volver sin enviar, enviar y
   compartir con otra app. No afirmar entrega/recepción, adjunto correcto.
2. Sin aplicación disponible: mensaje sin confirmar ni quedarse ocupado.
3. Carpeta y cada nube: éxito, permiso revocado, sin conexión, fallo al escribir.
   Solo registrar confirmación después del guardado exitoso.
4. Doble toque y orden por voz: un archivo/una subida; error permite reintentar.
5. Pantalla con candado y regreso desde selector; ruta silenciosa se cierra.
   Comprobar visibilidad de mensajes al volver y permisos del adjunto.

Documentación oficial revisada de SDK54:
[Sharing](https://docs.expo.dev/versions/v54.0.0/sdk/sharing/) y
[MailComposer](https://docs.expo.dev/versions/v54.0.0/sdk/mail-composer/).

**Qué sigue:** restantes IDs (incluidos identificadores, firma/manifiesto,
consentimientos, costos, accesibilidad y políticas). **Qué falta:** Android,
consolas/trámites y entrega autorizada. Tarjetas/Sentry fuera. Auditoría no terminada.
