# FINO-21 — entrada privada de exportación

Preparado el 07/10/2026. No instalado ni publicado. Tarjetas y Sentry excluidos.

## Qué se corrigió

Un componente público atendía tanto el arranque del teléfono como la acción
`com.finzo.exportscheduler.EXPORTAR`. Una acción conocida no autentica al
remitente: otra app podía enviar un mensaje explícito al componente.

- `FinzoExportReceiver` es privado (`exported=false`), sin filtro público. Mantiene
  el nombre, acción, solicitud 0 y flags del PendingIntent anterior: no se cambia
  el destino de alarmas existentes. Solo esa acción inicia el servicio.
- `FinzoBootReceiver` es una entrada distinta, pública, que acepta únicamente
  `BOOT_COMPLETED`, un broadcast protegido del sistema. Solo repone la alarma;
  ni adquiere el wake lock ni inicia el servicio/exportación directamente.
- El servicio sigue privado y el trabajo legítimo conserva el orden wake lock →
  inicio de servicio. No cambia el destino, configuración, frecuencia ni formato.
- Se retiraron comentarios y una prueba antigua que confundían filtrar el nombre
  de acción con autenticar al remitente. No se agregan permisos ni datos recogidos.

## Comprobaciones distintas, sin confundirlas

1. `pruebas/verificar-receptor-exportacion.mjs` comprueba el contrato de fuentes/
   manifiesto. Falló antes y contra `FINO_TEST_RECEIVER_BASELINE=de49c06` porque
   el trabajo era público. Esta comprobación es estática, no un Android simulado.
2. `scripts/probar-receptores-kotlin.mjs` compila los dos receptores originales
   con Kotlin 2.1.20 y ejecuta sus métodos en JVM. Sustituye Context/Intent,
   BroadcastReceiver, React y el programador por adaptadores observables; no
   traduce Kotlin a JavaScript ni duplica las decisiones de los receptores.
   Nulos/desconocidos no actúan; trabajo no atiende arranque; arranque no acepta
   exportar; boot repone una vez y exportar pide wake lock antes del servicio.
   `FINO_TEST_RECEIVER_KOTLIN_BASELINE=de49c06` falló por aceptar el arranque en
   el receptor privado anterior. No ejecuta permisos del sistema, ni verifica
   la implementación de AlarmManager, React o el servicio real.
3. Gradle local aprobó `:export-scheduler:compileDebugKotlin` y
   `:app:processDebugMainManifest` con el SDK Android real y caché offline.
   Se comprobaron ambas clases y el manifiesto recién generado en
   `android/app/build/intermediates/merged_manifest/debug/processDebugMainManifest/AndroidManifest.xml`.
   El directorio plural `merged_manifests/.../processDebugManifest` tenía un
   archivo antiguo: no se usó como evidencia de este arreglo. Falta procesar
   y revisar el manifiesto final de release firmado.
4. La comprobación release se detuvo antes de compilar por faltar las variables
   privadas FINZO_* de firma. No se cambiaron ni inventaron credenciales, no
   se desactivó su protección y no se generó APK/AAB. Debug aprobó usando su
   recorrido existente; no se gastó una compilación de Expo/EAS.
5. TypeScript y ESLint sin avisos aprobados. 149 pruebas locales/8 auditores
   aprobados (148 en Git limpio por una prueba preexistente ajena sin seguimiento).
   La prueba Kotlin JVM es una comprobación adicional, no se cuenta como Android.
   La ejecución Gradle tuvo avisos existentes y fallback del daemon Kotlin,
   pero terminó con código 0. ADB sin dispositivos conectados.

## Ejecutar la prueba JVM

Desde la raíz, configurar JAVA_HOME y opcionalmente GRADLE_USER_HOME. Ejecutar
`node scripts/probar-receptores-kotlin.mjs`. Usa los JAR locales 2.1.20 en el
caché Gradle (por defecto `.gradle-cache`); si falta uno, falla con explicación,
no descarga ni presenta una omisión como éxito. Los artefactos quedan en `.tmp`.
La variable de regresión solo se configura en el proceso que comprueba el
código anterior; no modifica el código actual ni la configuración instalada.

## Qué sigue y qué falta

- Unir este cambio a los otros nativos pendientes y generar una sola versión
  cuando esté autorizado. Un cambio Kotlin/manifiesto no llega por OTA.
- En Android con esa nueva versión: confirmar el manifiesto del paquete final;
  una app de prueba ajena intenta enviar EXPORTAR al receptor privado (rechazo)
  y al de arranque (sin efectos). Intentar simular BOOT desde otra app debe
  ser rechazado por Android, no por una decisión copiada en una prueba Node.
- Reiniciar realmente con programación activa/inactiva, teléfono bloqueado,
  cambios de plan y sin red; la alarma debe reponerse sin generar un archivo
  por reiniciar, y la cancelada no reactivarse. Probar también actualización
  sobre una instalación anterior con una alarma pendiente.
- FINO-09 preparado posteriormente: ficha advierte retrasos, consulta acceso
  exacto y conserva fallback aproximado; ver `PRUEBAS_HORARIO_EXPORTACION.md`.
  No garantiza hora ni éxito del servicio en todos los fabricantes. Sigue
  por probar Android 12+ y restricciones de batería antes de entregar.
- Restantes IDs, consola/políticas, firma release y publicación siguen pendientes.
  No se declara terminada la auditoría ni corregida la app ya instalada.

Referencias primarias: [receptores y exposición externa](https://developer.android.com/guide/topics/manifest/receiver-element),
[riesgo de receptores inseguros](https://developer.android.com/privacy-and-security/risks/insecure-broadcast-receiver).
