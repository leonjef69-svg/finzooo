# FINO-09 — horario previsto, no puntualidad prometida

Preparado el 07/10/2026. No publicado ni instalado. Sentry/tarjetas excluidos.

## Problema y corrección

La ficha prometía guardar el archivo «a la hora elegida». El código intentaba
`setAlarmClock` sin consultar el acceso; ante SecurityException usaba una alarma
aproximada. Ese respaldo permitía seguir programando, pero no garantizaba la hora.
Un comentario y una prueba antiguos afirmaban erróneamente que setAlarmClock
no requiere acceso especial en Android 12+. Se corrigieron esas afirmaciones.

- Se conserva una sola ficha compacta: «El archivo se guarda solo; Android puede
  retrasarlo». Inglés/portugués, notas de destinos y fallback al abrir actualizados.
- La próxima fecha dice «Próximo intento previsto», no confirma un archivo futuro.
  La prueba inmediata comprueba creación/guardado, no puntualidad del horario.
- Antes de programar, Android 12+ consulta `canScheduleExactAlarms`; versiones
  anteriores conservan su recorrido permitido. No se pide ni declara permiso nuevo.
- `ExportAlarmPolicy` decide el recorrido: sin acceso usa aproximada directamente;
  con acceso intenta la exacta; una revocación entre consulta/escritura cae una
  sola vez a aproximada. Otros errores y el fallo del fallback se propagan.
- No cambia fechas elegidas, frecuencias, destinos, formatos, montos ni planes.
  No se añaden claves locales, servicios, destinatarios ni datos recogidos.

## Qué se comprobó

- `verificar-horario-exportacion.mjs` ejecuta el catálogo real con esbuild y
  comprueba tres idiomas, campos visibles y conexión del programador nativo.
  Falló antes del cambio y con `FINO_TEST_EXPORT_TIME_BASELINE=24f5757` porque
  el texto prometía puntualidad. La parte de conexión nativa es estática.
- `scripts/probar-receptores-kotlin.mjs` compila y ejecuta también la política
  Kotlin original. `AlarmPolicyTest.kt` comprueba permiso ausente/presente,
  revocación, otros errores y fallback fallido. No copia el algoritmo en Node.
  La política pura usa callbacks observables: no ejecuta AlarmManager ni sus
  permisos del sistema. Las pruebas de receptores existentes siguen pasando.
- Gradle con SDK Android real aprobó `:export-scheduler:compileDebugKotlin` y
  `:app:processDebugMainManifest` en caché offline. Hubo fallback del daemon Kotlin,
  terminó con código 0. No generó APK/AAB ni usó una compilación EAS.
- TypeScript/ESLint sin avisos, 150 pruebas locales y 8 auditores aprobados
  (149 pruebas en Git limpio: una prueba local preexistente no está versionada).
  La prueba de catálogo incluye comprobación estática nativa; la JVM y Gradle
  son comprobaciones distintas, no se cuentan como prueba física.
  No se repitió Firebase: no cambian reglas ni funciones del servidor.

## Qué sigue y qué falta

1. Nueva instalación nativa acumulada con el resto de cambios Android; no basta
   OTA para la consulta/política Kotlin. Release/firma siguen pendientes.
2. Android 12+ sin acceso exacto: programar en pantalla/cerrado, reinicio, Doze,
   batería restringida, sin red y destino desconectado. La ficha debe ser honesta,
   sin prometer entrega a minuto fijo; confirmar resultado y motivo del intento.
3. Android anterior y acceso permitido/revocado: no doble alarma/archivo ni error
   silencioso. Fecha prevista permanece, pero archivo completado usa su hora real.
4. Pro tester/prueba vencida y formatos PDF/Excel/CSV: no se presenta un ensayo
   inmediato como prueba de ejecución puntual de fondo. No se garantiza ejecución
   si Android fuerza detención/restringe batería, ni éxito de red/servicio.
5. El recorrido de servicio con alarma inexacta y restricciones modernas sigue
   por probar en Android. Esta corrección elimina promesa falsa y controla permiso;
   no migra el trabajo a WorkManager/JobScheduler ni acredita ese recorrido físico.

Sigue FINO-22 (capturas/miniatura con candado), los restantes IDs y consolas/
políticas/publicación. No se declara terminada toda la auditoría.

Fuente primaria: [alarmas, permisos y posibles retrasos de Android](https://developer.android.com/develop/background-work/services/alarms).
