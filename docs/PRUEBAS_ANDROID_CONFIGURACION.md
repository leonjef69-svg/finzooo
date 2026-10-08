# FINO-28/29 — componentes y firma reproducibles

Revisión: 08/10/2026. Preparado, no instalado ni publicado.

## Componentes (FINO-28)

El manifiesto release antiguo conservaba PreviewActivity (herramienta de Compose)
y CropImageActivity públicos. El nuevo plugin registrado en app.json marca la
primera con tools:node=remove y conserva la segunda con exported=false. No
elimina el recortador ni su wrapper privado de Expo. Arranque/enlaces de Fino,
proveedores de compartir/importar y receptores del calendario/exportación no
se cambian por este plugin.

ClipboardFileProvider NO debe cambiarse a false: su attachInfo original exige
exported=true y lanzaría AssertionError al iniciar. El código instalado limita
las rutas a cache/.clipboard/ y comprueba la ruta canónica; Fino no llama a
setImageAsync. Esto no demuestra que cualquier proveedor público sea seguro ni
que una versión futura tenga el mismo límite. Mantenerlo requiere revisar su
configuración/dependencia final; no guarda el historial/boletas de Fino ahí.

`expo prebuild --platform android --no-install --template
./node_modules/expo/template.tgz --skip-dependency-update react,react-native`
se ejecutó sin --clean, sin instalar ni descargar. Conservó /android y aplicó
el plugin. Expo cambió los comandos android/ios de package.json; se restituyeron
solo esas dos líneas con apply_patch, sin alterar las dependencias del usuario.

Gradle local/SDK Android real aprobó :app:processDebugMainManifest offline.
El archivo singular recién generado (08/10 00:21) en
android/app/build/intermediates/merged_manifest/debug/processDebugMainManifest/
AndroidManifest.xml no contiene PreviewActivity; ambos recortadores están
privados; exportador privado/boot público protegido y proveedor se conservan.
No se usaron artefactos release/plurales viejos como evidencia del cambio.
Hubo avisos existentes de Gradle/merger. No es un AAB ni prueba de fotos reales.

## Firma (FINO-29)

La configuración privada existía solo en android/app/build.gradle ignorado.
El plugin ahora la reconstruye también sobre la plantilla limpia original
del SDK 54 empaquetada en Expo. No borra el resto del Gradle; reaplicarlo no
duplica su bloque. Release usa su signingConfigs.release después de cualquier
referencia previa a debug. Debug conserva su recorrido.

FINZO_STORE_FILE y FINZO_KEY_ALIAS pueden venir de entorno/propiedades;
FINZO_STORE_PASSWORD y FINZO_KEY_PASSWORD únicamente del entorno. El plugin
NO guarda valores secretos, crea claves ni lee archivos de claves. Bloquea
tareas release sin las cuatro variables y protege también tareas agregadas
(build) cuando el grafo termina en empaquetar/firmar release. Configuración
incompleta/duplicada o lenguaje distinto de Groovy falla para revisión, no
se sustituye silenciosamente.

`verificar-configuracion-release.mjs` ejecuta plugin/mods reales de Expo sobre
plantilla SDK real y manifiesto adaptado: firma idempotente, error cerrado,
preservación de arranque/recorte/proveedor y aplicación registrada en app.json.
La regresión FINO_TEST_RELEASE_POLICY_BASELINE=3f41a81 falla por faltar el
plugin de reconstrucción; actual verde. No depende del Android generado para
correr en otro clon. Algunas aserciones son de contrato de fuente, no de firma.

`node scripts/probar-politica-firma.mjs` ejecuta el bloque Groovy ORIGINAL con
Groovy 3.0.24/Gradle 8.14.3/Java reales, sustituyendo solo DSL Android/proyecto/
grafo: sin variables rechaza release/agregadas, permite debug; con valores
ficticios comprueba configuración release, nunca genera/firma archivos. Los
FINZO_* del usuario se quitan solo del entorno de ese proceso de prueba; no
se leen sus valores al informe ni se cambian sus credenciales reales.

TypeScript/ESLint sin avisos; 159 pruebas/8 auditores aprobados (158 en Git
limpio, más una prueba local preexistente del usuario). JVM y merger se informan
aparte, no se cuentan como teléfono ni certificado/firma válidos.

## Pendientes que NO se acreditan desde aquí

- Sobre APK/AAB final autorizado: manifiesto release sin depuración, componente
  privado del recorte y contratos anteriores; recortar con cámara/galería,
  compartir/importar, avisos tras reinicio y portapapeles textual en Android.
- Firma final y huella de la clave de subida contra Play Console, caducidad y
  copia de seguridad privada de esa clave. No se pide enviar contraseñas por chat.
  FINZO_STORE_FILE conviene que sea una ruta absoluta fuera de android/ generado;
  no ejecutar --clean sin asegurar primero copia privada de la clave existente.
- No se ejecutó prebuild --clean en el repositorio ni compilación release:
  faltan credenciales privadas autorizadas. No se sustituye la clave por una
  nueva ni por debug. Para EAS futuro debe configurarse explícitamente esta
  política de firma; no se presume compatibilidad con credenciales automáticas.
- No se consumió compilación Expo/EAS, ni hubo APK/AAB/OTA, despliegue o instalación.
  Estos cambios nativos se agrupan con los otros y requieren nuevo APK posterior.

Referencias revisadas antes de cambiar código:
[Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/),
[config plugins](https://docs.expo.dev/config-plugins/plugins/),
[merger de Android](https://developer.android.com/build/manage-manifests),
[firma y variantes](https://developer.android.com/build/build-variants).

**Qué sigue:** restantes IDs (costos/políticas/pruebas/documentación/accesibilidad,
moneda/identificadores). **Qué falta:** Android/release/clave/consolas/trámites y
entrega. Tarjetas y Sentry externo excluidos; auditoría integral no terminada.
