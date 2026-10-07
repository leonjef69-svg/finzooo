# Mapas de código de Sentry (Android)

La app puede enviar fallos a Sentry, pero sin el mapa del JavaScript los
mensajes son difíciles de leer. El proyecto mantiene la compilación habitual
sin subida de mapas porque antes fallaba cuando faltaban credenciales.

`app.json` incorpora el plugin oficial de Sentry y `metro.config.js` prepara
los identificadores de los mapas con Sentry, conservando NativeWind. La
protección detecta la ausencia de `sentry.gradle` y detiene una activación
incompleta. La configuración necesita regenerar Android antes de compilar;
no basta compilar una carpeta Android antigua.

Para una futura compilación con mapas, configurar
en el entorno de EAS Build estas cuatro variables:

- `FINO_SENTRY_UPLOAD_SOURCE_MAPS=YES` (activación explícita).
- `SENTRY_AUTH_TOKEN` como secreto de EAS, con permiso de subida de mapas.
- `SENTRY_ORG` y `SENTRY_PROJECT` con los identificadores reales de Sentry.

El token no se escribe en `app.json`, Git, `sentry.properties` ni en un mensaje.
Si se activa la subida y falta cualquiera de las tres variables de Sentry, la
compilación se detiene con el nombre de la variable ausente, sin mostrar el
token. Sin la activación, el AAB conserva el comportamiento anterior.
Si `SENTRY_DISABLE_AUTO_UPLOAD=true`, la activación explícita también se
rechaza para no presentar una subida desactivada como habilitada.

El orden de plugins en `app.json` está cubierto por una prueba que ejecuta
los mods reales de Expo: su orden de ejecución es inverso al de registro.
Cambiar ese orden puede reactivar involuntariamente la subida sin credenciales.

Antes de darlo por resuelto, hacer **una** compilación de prueba con esas
variables, comprobar en Sentry que aparece el mapa de esa versión y provocar
un error de prueba controlado en el APK para ver una traza con archivos y
líneas legibles. No se ha hecho esta prueba ni se ha publicado un APK/AAB.
La prueba local cubre mapas de JavaScript; no demuestra que se estén subiendo
símbolos nativos o mapas de ProGuard.

Las actualizaciones OTA necesitan una subida de mapas por separado; activar
la compilación Android no cubre automáticamente esas actualizaciones. Seguir
la guía oficial de Expo para `sentry-expo-upload-sourcemaps` al publicar cada
actualización autorizada. La subida de mapas envía archivos a Sentry;
`eas update`, además, publica código.

Referencias: [Expo: uso de Sentry](https://docs.expo.dev/guides/using-sentry/),
[Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/).
