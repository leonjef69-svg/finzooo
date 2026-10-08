# FINO-49 — denuncias de contenido compartido, preparación parcial

Fecha: 08/10/2026. Responsable/destinatario confirmado por el propietario:
dinero123xc@gmail.com. No está publicado ni conectado a un servicio de correo.
No se modificó dinero, no se enviaron correos reales ni se tocaron tarjetas.

## Recorrido preparado

Familia y Cajas compartidas muestran una bandera para señalar un nombre o
texto visible. La ficha muestra ese texto, motivo y aclaración opcional; explica
qué se transmite. Gratis también puede denunciar: no requiere renovar Pro.
El servidor exige cuenta real verificada, pertenencia al espacio y coincidencia
con el texto/autor visto. Si cambiaron, rechaza y pide revisarlo de nuevo.
Una transferencia agrupada señala el nombre del espacio mostrado, no una
descripción financiera invisible. Se protegen la ficha con candado y los
resultados de una sesión/pantalla ya cerrada.

El acuse solo dice denuncia guardada, NO correo recibido ni denuncia atendida.
Sin configuración privada habilitada/comprobada, falla sin guardar ni enviar y
ofrece el contacto de soporte. No activar `privateSettings/moderation` solo para
hacer que el botón muestre éxito: primero hace falta el servicio real probado.

## Datos y límites

- `contentReports`: UID del denunciante/autor, IDs del espacio/elemento/intento,
  texto señalado hasta 120 caracteres, motivo, aclaración hasta 500, fechas,
  huella SHA-256, permiso de procesamiento y versión de política, pendiente.
- `moderationMail`: destinatario fijo, IDs, vencimiento y mensaje de denuncia.
  Preparada para integración SMTP/Trigger Email; no tiene un consumidor instalado.
- `reportRateLimits`: día UTC y cupo, sin historial; tres denuncias aceptadas
  al día. Repetir mismo intento/cuerpo no vuelve a consumir cupo ni crear correo.
  Un cuerpo distinto con el mismo ID se rechaza. No es límite de factura global.
- El SDK de cliente no puede leer ni escribir esas colecciones ni configuración.
  El servidor usa máscaras para no leer historial personal, monto o notas.
  No adjunta automáticamente fotos, notas, montos, PIN ni todo el historial.
  El texto señalado/voluntario puede contener información sensible: advertencia
  visible y declaración de Play deben contemplarlo.
- Limpieza desde 30 días, máximo 500 denuncias y 100 barreras por ejecución
  horaria. Errores/acumulación pueden retrasarla; no se promete borrado puntual.
- Borrado Auth cierra primero el cupo y limpia las denuncias enviadas por/sobre
  la cuenta, así una petición en vuelo no recrea su propia denuncia después.
  Barrera solo UID/fecha hasta 30 días; las nuevas llamadas además comprueban
  existencia en Auth. No se recuperan correos ya entregados por borrar Firestore.
  Definir conservación/borrado en Gmail/proveedor antes de habilitar el envío.

## Comprobaciones ejecutadas

`node pruebas/verificar-denuncia-contenido-real.mjs`: cliente, tarea por sesión
y manejador originales con IO adaptado. Cuenta/correo, acuse incorrecto, sesión
obsoleta, doble toque, respuesta perdida y mismo cuerpo/ID al reintentar,
pantalla desmontada. Conexiones UI son contratos estáticos, no prueba Android.
El intento solo sobrevive mientras vive el componente: reiniciar/desmontarlo
puede producir un nuevo reporte si el anterior se guardó y su respuesta se perdió.
No se promete deduplicación permanente del mismo contenido ni recepción SMTP.

`functions/emulator-tests/content-reports.test.js`: 10 casos + prueba padre
(11 comprobaciones), SDK/Admin originales y reglas reales de Firestore local:
configuración ausente, Gratis, máscaras/datos mínimos, no cambiar libros,
reintento, acceso ajeno/datos inválidos/cierre, reglas denegadas, cuatro
solicitudes concurrentes con tres cupos, limpieza/expiración, nombres/autores
y Caja compartida incompleta. Obliga a `127.0.0.1:8080`, proyecto demo;
no producción. Ejecución Node 22.23.3, 11 aprobadas, ninguna omitida/cancelada.

Comparación roja con la captura original anterior a la barrera de cuenta
en `.tmp/content-reports-before-account-barrier-20261008.js`: la solicitud
atrasada recreaba datos tras limpiar. Versión actual verde. Es una captura
local durante el desarrollo de esta función nueva, NO un APK/commit histórico
de la aplicación. El archivo temporal no se entrega ni se considera prueba
de la versión publicada. La función inexistente en `d965d47` no puede compararse
como si fuese el mismo comportamiento.

`verificar-extractor-ts-original.mjs`: extractor original de manejadores compila
`.ts` genérico como TypeScript, no TSX. Regresión Git `d965d47` roja por error
de sintaxis, actual verde; evita una falsa prueba de código convertido mal.
`verificar-nube-pro-servidor.mjs` ejecuta además la limpieza original con IO
adaptado y confirma barrera/identidad de Auth en las envolturas de la denuncia.
Esto no prueba el disparador Auth en producción ni envío real.

Repetición general: TypeScript/ESLint sin avisos, 165 pruebas de la app y ocho
auditores sin tarjetas, 83 unitarias de Functions y 80 comprobaciones SDK/reglas
Firestore locales aprobadas (las 11 de denuncias están incluidas, no sumarlas
otra vez). Una prueba local ajena sigue sin versionar: 164 previstas en una
copia Git limpia, no ejecutada. La pasada inicial con el adaptador de Firestore
sin `.set` falló; se completó ese IO y se repitió sin retirar aserciones.
Una invocación equivocada de carpeta de pruebas encontró cero tests y NO se
cuenta como aprobación; la repetición con los archivos reales aprobó las 83.

## Qué sigue y qué falta

1. FINO-47/49: aceptación explícita/versionada de términos antes del contenido,
   bloqueo adecuado sin esconder dinero del saldo y moderación real por soporte.
2. Elegir/configurar proveedor SMTP, credenciales privadas y límites/costos;
   autorización separada para instalar/desplegar. Probar entrega, fallos,
   destinatario, retención y acceso al buzón. Nunca poner contraseñas en Git.
3. Recorrido Android/TalkBack/teclado, dos cuentas, cancelación/red/reinicio,
   puerta de acceso sin Pro, cuenta eliminada y contenido que cambia.
4. Revisión jurídica, privacidad web/Play actualizadas a la versión final,
   clasificación CGU y publicación coordinada autorizada. No acredita aprobación.

Fuentes oficiales revisadas:
[Expo SDK 54 Crypto](https://docs.expo.dev/versions/v54.0.0/sdk/crypto/),
[política CGU de Google Play](https://support.google.com/googleplay/android-developer/answer/9876937?hl=es-419),
[Trigger Email/SMTP de Firebase](https://firebase.google.com/docs/extensions/official/firestore-send-email).

FINO-49 y la auditoría siguen abiertos. Tarjetas y Sentry externo excluidos.
