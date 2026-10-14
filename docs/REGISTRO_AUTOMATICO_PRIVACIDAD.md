# Registro automático: permiso y filtro previo — 14/10/2026

Marca `14oct-privacidad-registro`. Preparado en código; no certifica aprobación
legal, autorización de Yape ni aceptación/publicación en Play.

## Qué se corrige

- Dar acceso y Encender comparten un aviso explícito previo: datos leídos,
  trabajo con la app cerrada, descarte de otras apps/códigos, diagnóstico local
  cifrado y posible respaldo Pro en Firebase. Cancelar, volver o cerrar no
  activa nada. No apila avisos y comprueba la misma sesión al aceptar.
- Android guarda únicamente la versión del aviso aceptado en este teléfono,
  sin correo, identificador de cuenta ni fecha, y sin enviarla a Firebase.
  No es un certificado de consentimiento jurídico. Aceptar no enciende por
  sí solo la captura: siguen siendo necesarios interruptor y permiso Android.
- El servicio no captura sin esa aceptación vigente, incluso si una versión
  anterior dejó el interruptor encendido. El puente nativo tampoco abre el
  permiso sin ella. Un APK anterior se identifica como pendiente de actualizar;
  una actualización JavaScript no puede corregir su servicio antiguo cerrado.
- Los avisos de seguridad se descartan antes del buzón, las marcas de
  duplicados, la voz y el trabajo de fondo. Hay otra comprobación en el
  almacén. Se reconocen tildes, espacios duros y frases españolas/inglesas;
  no se afirma reconocer cualquier formato futuro desconocido.
- Al abrir/migrar el buzón se retiran avisos de seguridad anteriores de cola,
  lote reclamado y marcas. Los avisos financieros se conservan. Las marcas
  restantes pasan a SHA-256 en lugar de conservar el texto completo, además
  del cifrado existente. Una clave ausente, corrupción o fallo al guardar
  bloquea la operación: no se sustituye la información por vacíos.
- Se elimina «Nada sale de tu celular» en español, inglés y portugués.
  Nube sigue siendo Pro: no se cambian planes, cobros, precios ni permisos
  remotos. No se cambia el nombre de la app, logotipo ni marcas comerciales.

## Comprobaciones y límites

`pruebas/verificar-consentimiento-avisos.mjs` ejecuta los manejadores y puente
originales con IO sustituido: aceptación/cancelación/cierre, toques repetidos,
sesión cambiada, guardado rechazado, aceptación vigente, APK anterior y textos.
Regresión `FINO_NOTIFICATION_CONSENT_BASELINE=d156abe`: debe fallar por abrir
Android antes del aviso, no por una API nueva ausente.

`node scripts/probar-receptores-kotlin.mjs --notification-privacy` ejecuta
NotificationStore/Privacy/Cipher/Preferences originales con JSON/JCE reales.
Comprueba apagado por falta de aceptación, filtro anterior al disco, limpieza
selectiva, duplicados, reinicio, cifrado y fallos de clave/guardado. Android
SharedPreferences/Keystore se adaptan: no es una prueba física del teléfono.
Regresión `FINO_TEST_NOTIFICATION_PRIVACY_BASELINE=d156abe` falla por captura
heredada activa sin aceptación, no por ausencia de métodos al compilar.

## Qué sigue y qué falta

Validación local: TypeScript/ESLint aprobados; 218 pruebas y 8 auditores
verdes sin tarjetas (una suite local ajena; 217 previstas en Git limpio,
no se ejecutó otro checkout). Kotlin/JCE original verde; ambas regresiones
d156abe rojas por comportamiento anterior. Compilación Debug x86_64 aprobada
con SDK local, tras reintentar en proceso nuevo por restricciones del compilador.
APK de desarrollo instalado con `install -r` en emulator-5554: Success,
mismo paquete/versión, sin desinstalar ni borrar datos. SHA-256:
`E6AE06AD5FC1AC8E9EA20550682409A24F6ADF92983C57E89F8173B118AF1D92`.
No es APK de distribución/Play. Captura visual no disponible: FrameArrived y
window capture agotaron su espera; no se automatizó ni aceptó un permiso.

Hace falta comprobar visualmente el nuevo aviso y el permiso en la app,
aviso real
de pago, rechazo de un aviso de código, reapertura y captura con app cerrada
en Android/fabricante real. No usar códigos ni notificaciones privadas en logs.

Preparar y autorizar conjuntamente los textos públicos antes de publicar.
No se edita `docs/privacidad.html` ni se cambian hashes legales en este arreglo:
la web podría actualizarse automáticamente al subir al repositorio. El texto
público debe describir la versión del aviso guardada solo en este teléfono,
su conservación mientras se mantengan los datos de la aplicación, y el descarte
previo de códigos y limpieza selectiva. No se guarda un historial de decisiones.
La aceptación vigente no sustituye la confirmación de permisos de Android.

Confirmar el uso informativo de la marca con asesoría competente; el aviso
de independencia no concede derechos ni evita reclamaciones. Pendientes
consola/Seguridad de los datos, vídeo de permisos y revisión final de políticas.
No Firebase, HTML público, APK de distribución/AAB/OTA/Play ni Telegram publicados aquí.
