# FINO-47 — aceptación antes de crear una cuenta, parcial

08/10/2026. Preparado en código; no publicado ni probado en Android.

Ampliación posterior del mismo día: PRUEBAS_ACEPTACION_POR_CUENTA.md detalla
el recibo/versionado local y su comprobación original. Este apartado conserva
el alcance histórico del primer paso; no describe todo el código actual.

## Cambio y alcance

Registro por correo y los dos botones de Google ahora muestran una casilla
sin marcar, un enlace a los documentos internos y su fecha. Google puede
crear una cuenta incluso desde Iniciar sesión, por eso ese botón requiere
la elección antes de enviar credenciales. La casilla queda deshabilitada
durante el acceso, junto con el enlace. El correo de una cuenta existente
no crea una cuenta y conserva su flujo de inicio.

Los tres manejadores comprueban también la casilla: no depende solo del
botón deshabilitado. No modifica datos financieros, Pro, nube ni tarjetas.
La casilla dice aceptar Términos y haber leído Privacidad: NO la presentar
como consentimiento jurídico acreditado para datos sensibles.

## Evidencia

`node pruebas/verificar-aceptacion-antes-auth.mjs` ejecuta cuerpos originales
con IO sustituido. Comprueba ausencia de llamadas Auth/perfil/verificación/
navegación sin marcar, flujo aceptado, validación de correo, doble toque y
cancelación de Google. Ejecuta el JSX del componente con árbol/adaptadores
para elección, rol/estado, enlace y deshabilitación; no monta React/Android.
La conexión y el valor inicial sin marcar son contratos estáticos.

Regresión: `FINO_LEGAL_AUTH_BASELINE=a80a09b` reproduce la creación anterior
sin aceptar y falla en la primera aserción. La versión actual pasa. La
primera ejecución actual reveló que al adaptador le faltaba `setError`;
se añadió ese IO sin cambiar la lógica de la aplicación ni quitar aserciones.

La primera batería se lanzó sin `--sin-tarjetas` por error y ejecutó dos
pruebas de tarjetas de solo lectura/adaptadores. No se modificó ese módulo
ni datos. El cierre se repite con `node pruebas/correr.mjs --sin-tarjetas`;
esas dos pruebas NO forman parte del conteo declarado de esta entrega.

## Sigue pendiente, no cerrar FINO-47/48/49

- No se almacena un recibo por UID/versionado; la casilla se reinicia al
  montar cada formulario. No se inventa aceptación de cuentas antiguas.
- Una sesión ya abierta/restaurada no pasa por estos botones; tampoco el
  inicio por correo de una cuenta existente. Falta una comprobación de
  versión por cuenta y un acceso previo al contenido compartido.
- No es un bloqueo del servidor de clientes antiguos/directos. No se
  añadieron campos o permisos en Firebase ni se desplegó nada.
- Documentos legales completos están en español; la elección y los avisos
  se traducen a tres idiomas. Falta revisar la comprensión y la validez
  jurídica, consentimiento de datos sensibles y las declaraciones externas.
- Comprobar en Android: Google desde ambos formularios, casilla/enlace,
  volver sin marcar, cancelar Google, doble toque, texto grande/TalkBack,
  teclado/pantalla pequeña, verificación y recuperación de copia Gratis/Pro.

Referencia de requisito previo al contenido compartido:
[Política de contenido generado por usuarios de Google Play](https://support.google.com/googleplay/android-developer/answer/9876937?hl=es-419).
El botón por sí solo no acredita moderación eficaz ni cumplimiento completo.

**Qué sigue:** recibo/versión por cuenta y aceptación de sesiones existentes,
bloqueo y demás IDs abiertos. **Qué falta:** Android, envío real de denuncias,
consolas/trámites/cobros y publicación autorizada. Tarjetas/Sentry fuera.
