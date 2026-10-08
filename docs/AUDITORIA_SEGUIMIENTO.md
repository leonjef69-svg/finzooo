# Seguimiento de la auditoría de Claude

Última revisión: 08/10/2026. Este archivo separa tres cosas distintas: código
corregido, pruebas locales aprobadas y acciones que realmente están publicadas.

## FINO-52 — protección parcial, no cierre (08/10/2026)

- Número coincidente con referencias inequívocamente distintas de aviso/aporte
  rechaza unión, importación y planificación de historial; no renumera datos.
  Recepción/restauración comprueban antes de cambiar perfil/presupuestos y
  Settings explica conservar copias. Atajo del disco también comprueba origen.
- Reglas v2 preparadas impiden cambiar/quitar referencias; misma edición,
  borrado y datos antiguos sin referencia/nulos siguen admitidos.
- Código original/IO adaptado y SDK/reglas reales locales aprobados;
  regresiones contra `0a6b9a9` rojas. 38 comprobaciones locales (26 + 12)
  incluyen 10.000 movimientos, dos clientes, Pro, moneda e historial.
  Guía `PRUEBAS_ORIGEN_MOVIMIENTOS.md` documenta cobertura y límites.
- TypeScript/ESLint y 162 pruebas/8 auditores aprobados, sin tarjetas; una
  prueba local ajena no versionada fuera del commit (161 previstas en Git
  limpio, no comprobado en otro checkout). Diagnóstico de FINO-52 rojo aparte.
- FINO-52 sigue abierto: generador/manuales/metas, referencias ausentes,
  lápidas por número, v1 directo/antiguo, Admin/migrador JS y restantes caminos
  de captura/creación NO quedan certificados. Diagnóstico original sigue rojo.
- **Qué sigue:** identidad estable compatible y revalidar 15/16/34/37/47/49/50.
  **Qué falta:** Android/dos teléfonos, consolas/trámites/cobros y entrega
  autorizada. Sin publicación; tarjetas/Sentry externo fuera. Auditoría abierta.

## FINO-33 pruebas / FINO-52 confirmado (08/10/2026)

- Tres lectores ignoraban el hash y leían HEAD; ahora fijan y muestran el
  commit correcto. Auxiliares de fusión también se leen de esa revisión.
  Regresión de lectores contra `d7cdbe8` roja en los tres, actual verde.
- Logout + bóveda/almacén/cifrado originales conectados con IO adaptado:
  Gratis A→B→A, cambio pendiente, Pro/sin respaldo expreso y fallos de disco/
  Auth/nube conservan datos. Logout de `276cf53` rojo por falta de manifiesto,
  no por método ausente. No se probó un APK histórico ni limpieza de servicios.
- Contratos de claves/estructuras siguen siendo estáticos; etiquetas precisas
  evitan confundir aislamiento activo con borrado definitivo de cuenta.
- FINO-52 confirmado por ejecución: azar distinto + mismo máximo cargado
  generan igual ID, fusión pierde uno de dos movimientos y una de dos metas.
  Falsa prueba de cadenas retirada; diagnóstico rojo fuera de aprobadas y
  pendiente visible en el corredor. No se instaló un prototipo inseguro.
- TypeScript/ESLint sin avisos; 161 pruebas/8 auditores verdes sin tarjetas.
  Una prueba local ajena no versionada se conserva fuera del commit; 160
  previstas en Git limpio, sin ejecutar un segundo checkout. FINO-52 rojo
  separado NO se incluye entre aprobadas.
- Guía `PRUEBAS_CALIDAD_REGRESIONES.md`. **Qué sigue:** corregir FINO-52 sin
  renumerar historiales/aportes a ciegas; revalidar 15/16/34/37/47/49/50.
  **Qué falta:** Android/dos dispositivos, consolas/trámites, cobros y entrega
  autorizada. Tarjetas/Sentry externo fuera, sin publicación; auditoría abierta.

## FINO-51 — moneda de cuenta, no etiqueta editable (08/10/2026)

- Revalidado: moneda/país podían reetiquetar importes sin convertir. Propietario
  eligió otra moneda únicamente en una cuenta nueva. Queda fija al configurar,
  sin depender de cantidad de movimientos, con guardia inmediata y explicación.
- País/idioma siguen editables; moneda local preservada también al recuperar.
  Copias de monedas distintas no se unen/suben/restauran sobre datos locales.
  Historial separado se controla antes y por fila; reglas preparadas bloquean
  cambio y reapertura del registro en documentos ya configurados.
- Prueba de manejadores/fusión/recepción/restauración/guardado originales con
  IO adaptado aprobada; SDK/reglas reales locales: seis comprobaciones verdes.
  Regresiones contra `5cd7e09` rojas, sin relajar reglas. Guía
  `PRUEBAS_MONEDA_FIJA.md` distingue contratos de UI de ejecución/Android.
- Repetición de cuatro suites SDK/Firestore: 25 comprobaciones verdes en Node
  22; TypeScript/ESLint y 160 pruebas/8 auditores (159 en Git limpio).
- **Qué sigue:** restantes IDs. **Qué falta:** Android/dos dispositivos,
  copias ya discrepantes revisadas explícitamente, reglas publicadas/consolas,
  trámites y entrega. No se modificó producción ni tarjetas; auditoría abierta.

## FINO-28/29 — manifiesto y firma regenerados (08/10/2026)

- Confirmados en fuentes/configuración: PreviewActivity/recortador públicos;
  firma solo en Android ignorado. Nuevo plugin conserva launcher/recorte y
  evita perder firma release al reconstruir desde plantilla SDK. No crea
  credenciales ni publica; ClipboardFileProvider exige público y está limitado.
- Regresión roja contra `3f41a81`, plugin/mods reales en plantilla SDK y
  manifiesto adaptado verdes; Groovy original con DSL/grafo adaptados verde.
  Prebuild sin --clean real y :app:processDebugMainManifest SDK real aprobado;
  singular nuevo sin PreviewActivity, recorte privado y receptores conservados.
- TypeScript/ESLint, 159 pruebas/8 auditores verdes (158 en Git limpio).
  Guía `PRUEBAS_ANDROID_CONFIGURACION.md` distingue cada nivel de evidencia.
- **Qué sigue:** restantes IDs. **Qué falta:** APK nuevo acumulado, recorrido
  Android, manifiesto/firma release y huella contra Play/clave custodiada,
  consolas/trámites. Tarjetas/Sentry excluidos. Auditoría no terminada.

## FINO-32 — permisos de calendario (08/10/2026)

- Confirmado: la carga automática con lista no vacía pedía permiso. Ahora
  solo Guardar/activar/Probar registra intención; la carga/moneda no pide.
  Negación no borra pago; canal previo al diálogo, canAskAgain respetado.
- Apagar/quitar limpia calendario sin pedir ni retirar exportación. Interruptor
  espera guardado inmediato para no reprogramar con valor antiguo; doble toque,
  fallos de escritura y reintento protegidos. Intención reiniciada al limpiar.
- Programador/contexto/efecto/interruptor originales con IO adaptado; roja
  contra `450f29d`, actual verde; guía `PRUEBAS_PERMISOS_CALENDARIO.md`.
- TypeScript/ESLint sin avisos; 158 pruebas/8 auditores verdes (157 en Git
  limpio, la otra es una prueba local preexistente del usuario).
- **Qué sigue:** restantes IDs. **Qué falta:** prueba Android/permiso/sonido,
  firma/consolas/trámites y entrega. Tarjetas/Sentry excluidos. No publicado.

## FINO-35 — lectura PDF acotada (07/10/2026)

- Hallazgo confirmado con archivo sintético: descompresión completa sin tope.
  Streaming por partes limita salida antes de concatenar; acumula incluso
  streams sin texto/fallidos y limita cantidad/fragmentos/cabeceras pendientes.
- No retorna texto parcial al superar límite; mensaje traducido/liberación;
  no cambia interpretación financiera ni convierte límites en stream dañado.
  Tokenizador avanza ante delimitadores y no repite búsquedas sin cierre.
- Extractor/fflate original real, compresión Node independiente y observador
  de clase real; manejador original con IO sustituido. Roja contra `595cf99`,
  verde actual. Normal 10.000 filas aprobado. Guía `PRUEBAS_LIMITES_PDF.md`.
- TypeScript/ESLint sin avisos; 157 pruebas/8 auditores aprobados (156 en Git
  limpio). Node no mide RAM/Hermes físico. ADB sin dispositivos.
- **Qué sigue:** permisos de avisos y restantes IDs. **Qué falta:** Android,
  límites sobre PDFs habituales grandes, consolas/firma/trámites y entrega.
  Tarjetas/Sentry fuera, sin APK/AAB/OTA/despliegue. Auditoría no terminada.

## FINO-30 — no confirmar un envío desconocido (07/10/2026)

- Confirmado que incluso fallback sin app marcaba exportación. Es una fecha
  interna, no un historial visible de recepciones. Se precisa el alcance.
- Externos no llaman exportacionHecha; mensaje de archivo preparado traducido
  y falta de aplicación explícita. Guardados de carpeta/nubes esperan respuesta;
  bloquea doble toque y libera reintento. Automatico sigue sin destinos externos.
- handleExport/exportacionHecha y catálogo ORIGINALES con IO adaptado verdes;
  regresión roja contra `ac8ebd7`. Contrato de MailComposer instalado contrastado:
  Android no sabe si envió/canceló, SENT no se usa como prueba. Tres formatos,
  cuatro externos/directos/fallback y cuatro guardados/error/pendiente probados.
- Guía `PRUEBAS_ENTREGA_EXPORTACION.md`. No se probó envío, servicio remoto,
  visibilidad del aviso tras volver, permisos de adjunto ni interfaz Android.
- TypeScript/ESLint sin avisos y 156 pruebas/8 auditores aprobados (155 en Git
  limpio, una prueba local del propietario no versionada).
- **Qué sigue:** restantes IDs. **Qué falta:** Android, firma/manifiesto,
  consolas/políticas/trámites y entrega autorizada. Tarjetas/Sentry fuera;
  sin APK/AAB/OTA/despliegue, no se declara terminada toda la auditoría.

## FINO-24 — pendiente cifrado y mínimo (07/10/2026)

- Revalidado: 300 eran marcas nativas con posible texto, no el log JS (40,
  ya cifrado). Buzón/lote 200 cifrados AES-GCM/clave Android Keystore, nombres
  ajenos retirados también en instalaciones anteriores; contadores conservados.
- Lectura falla cerrada, migración sin cambiar montos, no crear llave al leer ni
  al añadir si hay otro lote cifrado. Commit falso no confirma ni deja una
  caché distinta: restaura campos afectados para un reintento real.
- Regresiones estática/política y Kotlin original rojas contra `257813c` y
  verdes actuales. JSON/JCE reales, Context/Preferences/proveedor adaptados.
  Guía `PRUEBAS_BUZON_YAPE_CIFRADO.md`. No se ejecutó Keystore/servicio físico.
- TypeScript/ESLint sin avisos, 155 pruebas/8 auditores (154 en Git limpio)
  aprobados; Gradle debug inicial aprobó módulo/app/manifiesto.
- **Qué sigue:** FINO-30 y restantes IDs. **Qué falta:** recorrido Android,
  release/firma, nueva instalación, política/Play y servidor publicados,
  consolas y trámites. Sin APK/AAB/EAS/OTA/despliegue. Tarjetas/Sentry fuera.

## FINO-25/26 — declaraciones y movimiento (07/10/2026)

- FINO-25 confirmado en PLAYSTORE: afirmación de procesamiento local sin exigir
  motor offline. Se corrige política/HTML/ayuda y declaración borrador de audio,
  sin asegurar proveedor/retención/cifrado de terceros ni cambiar el motor.
  La escucha no exige mantener pulsado; también se corrige esa explicación.
- FINO-26: avisos históricos/contador insuficiente confirmados por ejecución del
  efecto anterior; nueva referencia por IDs, espera de hidratación, preferencia
  dinámica/cancelación y traducciones preparadas. Reanimated instalado sí usa
  sistema por defecto: se documenta ese límite del hallazgo original.
- Pruebas originales de efecto/hook/catálogo/política ejecutadas con adaptadores,
  rojas contra `cb7f1e2` y verdes actuales. Guía `PRUEBAS_VOZ_CAMPANA.md`.
  No son pruebas de tráfico/proveedor, interfaz Android ni cumplimiento legal.
- TypeScript/ESLint sin avisos; 154 pruebas/8 auditores (153 en Git limpio)
  aprobados. Una prueba histórica exigía literal español: se actualizó su
  conexión traducible conservando las comprobaciones, y volvió a aprobar.
- **Qué sigue:** FINO-24 y restantes IDs. **Qué falta:** Android, voz/retención
  real, consolas/declaraciones/trámites, política pública y entrega autorizada.
  FINO-50 no se declara cerrado; tarjetas/Sentry siguen fuera.

## FINO-22/23 y refuerzo FINO-41 (07/10/2026)

- Protege ventana nativa desde onCreate, confirma FLAG_SECURE antes de quitar
  cubierta y solo permite capturas tras confirmar candado apagado. Ausencia del
  módulo en APK anterior se identifica como sin soporte, no protección cumplida.
- Gate unifica comprobaciones cancelables, falla cerrado ante error y recrea
  su diálogo tras confirmación. PrivateModal suspende paneles hasta desbloqueo.
  Tarjetas propias excluidas, sin modificar sus dos ventanas.
- Inicio comparte formato oculto con todos sus importes/filas/avisos/aportes,
  oculta progreso y anuncia acción/estado del ojo en tres idiomas. Datos intactos.
- Pruebas de puente/efectos/formato/fila/componentes ORIGINALES con adaptadores
  y regresiones rojas/verdes; Kotlin original JVM pasa. Gradle debug/SDK real
  compiló módulo y app, fusionó manifiesto y registró Package/Module. Receptores
  y alarmas JVM anteriores también se reejecutaron, sin romperse.
- Sin APK/AAB/OTA/EAS/despliegue. Release/firma no se comprobaron en este punto.
  Guía: `PRUEBAS_PRIVACIDAD_CANDADO_INICIO.md`.
- TypeScript/ESLint sin avisos; 152 pruebas/8 auditores (151 en Git limpio)
  aprobados. ADB sin dispositivos; los artefactos ajenos se conservan sin subir.
- **Qué sigue:** FINO-24/restantes IDs. **Qué falta:** Android real, TalkBack/OEM,
  release, instalación acumulada, consolas/trámites/publicación. Sentry fuera.

## FINO-09 — puntualidad y acceso exacto (07/10/2026)

- Confirmada promesa falsa en ficha/notas y comentario/test de setAlarmClock.
  Catálogo real de tres idiomas ahora advierte retrasos y distingue intento
  previsto de archivo completado. No se agrega otra tarjeta ni un permiso.
- Guard de SDK/acceso conectado a `ExportAlarmPolicy`; callback exacto/fallback
  y revocación ejecutados con Kotlin original en JVM. No es AlarmManager real.
  Regresión del catálogo contra `24f5757` roja y actual verde.
- Gradle debug/SDK real aprobó Kotlin/manifiesto; sin APK/AAB/EAS ni despliegue.
- TypeScript/ESLint sin avisos y 150 pruebas locales/8 auditores aprobados
  (149 en Git limpio). La JVM/Kotlin y Gradle no acreditan el recorrido físico.
- **Qué sigue:** FINO-22. **Qué falta:** restantes IDs, recorrido físico de
  alarmas/servicio/red, nueva instalación nativa acumulada, firma release y
  publicación autorizada. Sentry/tarjetas excluidos. Guía:
  `PRUEBAS_HORARIO_EXPORTACION.md`.

## FINO-21 — barrera Android y dos entradas separadas (07/10/2026)

- Se conserva la identidad del PendingIntent, pero su receptor ahora es privado.
  Un nuevo receptor solo repone al arranque protegido. El servicio sigue privado;
  no se agregan permisos, datos, destinos ni cambios financieros.
- Prueba estática roja/verde y receptores originales compilados/ejecutados en
  JVM con adaptadores de Android. La JVM también falla contra `de49c06` por
  el receptor anterior atendiendo arranque; no se confunde con permisos físicos.
- Gradle debug/SDK real aprobó compilación Kotlin y fusión de manifiesto. Se
  leyó el resultado singular `merged_manifest`, no el plural antiguo. Release
  rechazó la comprobación por variables de firma ausentes; protección intacta.
- TypeScript/ESLint, 149 pruebas locales/8 auditores (148 en Git limpio) aprobados.
  Sin APK/AAB/OTA/despliegue ni compilación EAS. ADB vacío, falta prueba física.
- **Qué sigue:** FINO-09 (hora exacta prometida/fallback inexacto). **Qué falta:**
  restantes IDs, Android, firma/manifiesto release y entrega nativa acumulada.
  Guía: `PRUEBAS_RECEPTOR_EXPORTACION.md`. Sentry/tarjetas excluidos.

## FINO-20 — entrada y consumo inseparables; FINO-06/31 revalidados (07/10/2026)

- Regresión real de Firestore falló contra las reglas anteriores por aceptar
  una membresía sin consumir su código. Ahora se exige el consumo en el mismo
  guardado y se limita al código de esa membresía nueva, o revocación del creador.
  Marcadores de eliminación bloquean nuevas membresías por peticiones atrasadas.
- Clientes originales Familia/Caja ejecutados con SDK real: índices/membresía/
  consumo juntos, concurrencia, rechazo completo y permisos. No cambia dinero
  ni añade metadata/retención/permisos/servicios. La suite de reglas usa tokens
  simulados, no es prueba del login ni de Android.
- FINO-06/31: ya corregidos, métodos originales y pruebas existentes reejecutados;
  se documenta la diferencia entre pruebas con adaptador y emulador real.
- TypeScript/ESLint sin avisos, 148 pruebas locales/8 auditores (147 en Git
  limpio), 82 unitarias y 142 reglas/SDK/HTTP/eventos Firebase local bajo Node 22
  aprobadas. Regresión `d9c3d01` falló por consumo omitido, revocación ajena y
  cuenta en eliminación; suite actual verde. ADB sin dispositivos conectados.
- Queda contrastar Auth/SDK después de terminar el borrado: las marcas nuevas
  protegen mientras están presentes, no invalidan por sí mismas un token viejo
  una vez retiradas. Se anotó sin inferir retención ni darlo por corregido.
- **Qué sigue:** FINO-21 confirmado abierto (receptor público acepta exportar
  con acción conocida). **Qué falta:** corrección nativa, Android, consolas,
  restantes IDs y despliegue/entrega autorizados. Sentry y tarjetas excluidos.
  Evidencia y pasos: `PRUEBAS_INVITACIONES_UNICAS.md`.

## FINO-43 — versiones y borrados del Negocio (07/10/2026)

- Las cuatro listas incluyen versiones y borrados; guardado conjunto cifrado
  incorpora captura de fondo sin resucitar filas. Copia por cuenta v3, lectura
  compatible v1/v2. Nube transaccional retorna la copia conciliada y reglas
  impiden que un cliente atrasado quite marcas o baje formato.
- La regresión de nube original falló antes y pasa después. Acciones originales,
  almacenamiento sobre SQLite, cambio de cuenta y reglas de Firestore local
  comprobados. 148 pruebas locales/8 auditores (147 en Git limpio), 129 pruebas
  del servidor local con Node 22 aprobadas. No se tocó producción.
- Privacidad/ficha actualizadas por IDs y fechas técnicos; no nuevos servicios
  ni permisos. Límites/migración/pruebas físicas en `PRUEBAS_NEGOCIO_BORRADOS.md`.
- **Qué sigue:** contrastar restantes IDs del índice. **Qué falta:** Android,
  dos dispositivos, consolas/políticas, coordinación de reglas/versión y entrega.
  Sentry y tarjetas excluidos. No se declara terminada toda la auditoría.

## FINO-55 — rutas y ediciones con origen ausente (07/10/2026)

- Se reemplazaron las pantallas vacías y la navegación durante el dibujo por
  `MissingItem`. Se incluyeron las rutas equivalentes de productos/venta/gasto
  de Negocio y edición de metas, además de las del informe.
- El guardado de una edición exige un origen vigente; no basta haberlo visto
  al abrir el formulario. Movimiento y meta rechazados no se presentan como
  éxito. Las protecciones existentes de movimientos enlazados se conservan.
- Prueba del código original roja antes/verde después. TypeScript, ESLint sin
  avisos y batería de 146 pruebas locales/8 auditores aprobados en el cierre
  del punto (145 en Git limpio). No se monta Android en esa prueba.
- **Actualización:** FINO-43 preparado en el apartado superior, no publicado.
  **Qué sigue y falta:** Android y resto de IDs, consolas y entrega.
  Sentry y tarjetas excluidos según decisión del propietario.

## FINO-44/54 y decisión sobre Sentry (07/10/2026)

- Importación: `commitImport` ejecuta el preparador real sobre los movimientos
  actuales, conserva la barrera monetaria, marca edición, deduplica IDs y
  rechaza todo el lote si una fusión perdió su origen o cambió de versión.
  `scoreMatch` no trata aportes enlazados como gastos duplicados.
- Cuatro pantallas bloquean guardados repetidos inmediatamente y permiten
  reintento tras error. Se ejecutan sus manejadores originales extraídos con
  TypeScript, sin copiar su lógica. No se monta React ni se prueba Android;
  ese límite queda explícito. Pruebas rojas contra la versión anterior.
- Sentry: el propietario eligió dejarlo fuera. El auxiliar compatible ya no
  carga/inicia el SDK ni envía errores; la raíz se conserva y las tareas de
  fondo no dependen de ese servicio. Prueba con observador de SDK roja antes y
  verde después. Privacidad/PLAYSTORE actualizados para la versión preparada;
  la web y las apps instaladas necesitan entrega coordinada.
- TypeScript, ESLint, 145 pruebas locales y 8 auditores aprobaron (144 en Git
  limpio). Empaquetado Android/Hermes con mapas aprobado; el SDK de diagnósticos
  ya no forma parte de los imports de la app. No es un APK/AAB instalado.
  **Qué sigue:** FINO-43/55 y revalidación de los IDs restantes.
  **Qué falta:** Android, dos clientes reales, consolas/entrega; Sentry y tarjetas
  excluidos por decisión del propietario.

## FINO-45 — exportación por espacio (07/10/2026)

- Confirmado en la revisión cruzada: Familia usaba la moneda personal y todos
  los espacios descartaban categorías/notas. Se corrigió el cargador real sin
  alterar montos ni transferencias.
- La regresión roja antes/verde después cubre Familia USD frente a Personal PEN,
  Caja compartida EUR, Caja privada, datos antiguos y fallo remoto sin sustituir
  Familia por otro espacio. TypeScript, ESLint, 142 pruebas locales y 8 auditores
  aprobaron (141 pruebas en Git limpio).
- **Qué sigue:** FINO-44/54. **Qué falta:** archivos reales en Android y resto
  del índice `AUDITORIA_CIERRE_61.md`. Se comprobó solo presencia de variables
  Sentry: no hay token, organización ni proyecto configurados; no se consultó
  su API ni se conoce el motivo de pérdida de acceso del propietario.
  Tarjetas excluidas.

## FINO-19 — Firebase explícito al preparar Android (07/10/2026)

- Retirada la selección del JSON más reciente de Descargas. El generador usa
  `android.googleServicesFile` y valida proyecto/remitente contra
  `utils/firebase.ts` y paquete contra `app.json`, antes de prebuild y de copiar.
- Prueba nueva roja antes y verde después: configuraciones de otro proyecto,
  remitente y paquete, duplicados, lectura sin cambios y rechazo sin sobrescribir
  destino. La prueba Google anterior exigía elegir Descargas; se actualizó ese
  requisito conservando las comprobaciones de firma de Google Play.
- La configuración real pasó la lectura local. No se ejecutó prebuild/AAB.
  Prueba específica y acceso Google aprobados; batería anterior del mismo turno
  140 pruebas/8 auditores. Inventario actual: 141 locales, 140 en Git limpio.
- **Qué sigue:** revisión cruzada del resto de hallazgos. **Qué falta:**
  compilación y firma en entorno limpio (FINO-29 separado), Android y entrega.
  Si se descarga otro JSON, debe actualizarse deliberadamente la ruta de
  `app.json` o su archivo; no se tomará de Descargas por fecha. Tarjetas excluidas.

## FINO-60 — sustitución compatible de crypto-js (07/10/2026)

- Se retiró crypto-js de dependencias y del cifrado real. Noble Ciphers/Hashes
  y Scure Base 2.4.0 mantienen el formato v2, AES-CBC/PKCS7, HMAC y la llave
  existente. Expo Crypto 15 aporta el azar; SDK 54 no ofrece AES nativo como
  sustitución directa. No se cambió el formato ni se migraron datos reales.
- Prueba nueva falló antes por aceptar campos sobrantes. Ahora comprueba
  claves dañadas/ausentes sin reemplazo, alteración de IV/cifrado/HMAC, lectura
  v1/v2, tamaños de bloque, Unicode/BOM y 10.000 movimientos. El resultado se
  contrasta con AES/HMAC de Node, y con el decodificador de Expo, sin copiar
  el algoritmo de la app.
- TypeScript, ESLint, 140 pruebas locales y 8 auditores aprobaron (139 en Git
  limpio); exportación Android/Hermes aprobada. No se compiló APK ni se publicó.
- **Qué sigue:** selección de Firebase del generador (FINO-19).
  **Qué falta:** prueba Android al actualizar una instalación con datos v1/v2,
  cierre/reinicio y publicación. Tarjetas fuera del alcance.
- Referencias: [CryptoJS](https://github.com/brix/crypto-js),
  [Expo Crypto SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/crypto/),
  [Noble Ciphers](https://github.com/paulmillr/noble-ciphers),
  [Noble Hashes](https://github.com/paulmillr/noble-hashes).

## FINO-59 — mapas de Sentry (07/10/2026)

- El script Gradle de Sentry ya no se retira cuando se solicita expresamente
  subir mapas y existen `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` y `SENTRY_PROJECT`.
  Sin esa activación, el AAB mantiene la compilación anterior. La activación
  incompleta falla con un mensaje claro, sin imprimir credenciales.
- Prueba nueva roja antes y verde después. No se generó AAB ni se tocó Sentry.
  La guía operativa está en `docs/SENTRY_MAPAS.md`.
- Se integraron el plugin oficial y Metro conservando NativeWind.
- TypeScript, ESLint, 139 pruebas locales y 8 auditores aprobaron (138 pruebas
  en Git limpio). La cadena real de mods de Expo se probó con subida activada
  y desactivada, sin red ni credenciales reales.
- `expo export --platform android --source-maps` terminó correctamente;
  paquete Hermes y mapa comparten identificador y el mapa contiene 4.172
  fuentes. No se subieron archivos ni se compiló un APK/AAB.
- **Qué sigue:** configurar credenciales en EAS y verificar una compilación
  autorizada. **Qué falta:** comprobar la traza real y cubrir por separado los
  mapas de actualizaciones OTA; tarjetas excluidas.

## FINO-61 — cobertura engañosa en pruebas (07/10/2026)

- Se confirmó que cinco pruebas ejecutaban gráficas retiradas y otra ejecutaba
  JavaScript compilado y congelado de un exportador viejo. Se retiraron esos
  seis archivos; Git conserva su historial. El exportador actual sigue
  cubierto por `verificar-exportar.ts`, que lo importa y ejecuta.
- La batería restante pasó: 143 pruebas y 8 auditores sin tarjetas. El número
  baja porque estas seis nunca podían detectar un fallo nuevo de la app.
- Después, la cuenta de gasto diario salió de Reportes a una función pura
  que Reportes usa de verdad. La nueva prueba la ejecuta junto a las medidas
  reales del gráfico; falló antes de la extracción. Se retiraron dos copias
  más, incluida la que aún esperaba 31 barras. Ahora pasan 142 pruebas
  locales y 8 auditores sin tarjetas. Una prueba preexistente no está
  versionada (`verificar-resumen-gasto-ingreso-ui.mjs`), por lo que en un
  checkout limpio son 141. Los archivos retirados siguen recuperables en Git.
- La comparación mensual y ranking de Voz también comparten función con su
  prueba real. La prueba nueva falló antes de la extracción y comprueba que
  una transferencia no se sume como gasto; la antigua copia sí la sumaba.
  El resumen por día/mes de Voz ahora comparte también función con su prueba
  real y la copia antigua se retiró.
- Las cuatro simulaciones históricas de navegación/candado no ejecutan la app:
  se conservan como escenarios, pero el corredor no las incluye en el conteo
  normal. Pasan 138 pruebas locales y 8 auditores sin tarjetas; en Git limpio
  son 137 porque una prueba local preexistente no está versionada.
- **Qué sigue:** realizar el recorrido de
  `docs/PRUEBAS_NAVEGACION_CANDADO.md` en Android y convertirlo en pruebas
  automatizadas donde sea viable. **Qué falta:** comprobación física y
  publicación; tarjetas excluidas.

## FINO-58/59 — candado y herramientas de desarrollo (07/10/2026)

- FINO-58 ya se había corregido en `276cf53`. La prueba ejecuta la lectura
  real del estado con SecureStore simulado fallando: responde `unavailable`,
  `isLockEnabled()` sigue bloqueando y la puerta muestra un modal desde el
  arranque. Revalidado localmente; falta Android real.
- FINO-59: el bot local ahora exige `FINO_LOCAL_FIREBASE_PROJECT_ID`,
  `FINO_LOCAL_ALLOW_WEBHOOK_DELETE=YES` y, si se eligió producción,
  `FINO_LOCAL_ALLOW_PRODUCTION=YES`. Se comprueba que sin esas autorizaciones
  termina antes de cargar Firebase o llamar a Telegram. No se ejecutó contra
  servicios reales. Se retiró el script de plantilla que movía/borraba el
  proyecto, se corrigió README y se fijó `sharp-cli`.
- La prueba de herramientas falló contra la versión anterior y pasó ahora;
  TypeScript, ESLint, 149 pruebas y 8 auditores sin tarjetas aprobaron.
  **Qué sigue:** resolver el tratamiento de mapas de código de Sentry sin
  introducir credenciales en el repositorio. **Qué falta:** esa parte,
  prueba física del candado y publicación; tarjetas excluidas.

## FINO-57 — precisión de moneda y fórmulas en CSV (07/10/2026)

- Confirmado: la salida CSV fijaba dos decimales para todas las monedas y no
  protegía tabulador/retorno inicial. Ahora recibe la moneda del espacio tanto
  en exportación manual como automática y usa sus decimales reales.
- El escapado protege también controles iniciales, espacios previos a signos
  de fórmula y variantes de ancho completo. Conserva comillas y separadores
  correctos. La prueba añadió CLP/BHD y entradas problemáticas; falló antes
  del arreglo y pasa ahora. TypeScript, ESLint, 148 pruebas y 8 auditores sin
  tarjetas aprobaron.
- **Qué sigue:** abrir el CSV generado en Excel/LibreOffice y revisar que el
  texto peligroso permanezca inerte, también tras guardar y reabrir. El
  apóstrofo no es una garantía universal entre hojas de cálculo.
  **Qué falta:** prueba Android y publicación; tarjetas excluidas.

## FINO-10 — tocar aviso del celular abre la ficha (07/10/2026)

- El toque de un aviso propio del calendario ahora lleva a Inicio y abre la
  ficha inferior del pago y mes correctos. Se atiende tanto con la app abierta
  como al arrancarla desde el aviso, y espera a que se quite el candado.
- Si el pago fue borrado o el mes ya no aplica, se explica que el aviso quedó
  antiguo sin abrir otra ficha. Si ya se marcó, se muestra como registrado y
  no se ofrece registrarlo de nuevo. Se limpia la respuesta atendida para no
  reabrirla en siguientes arranques.
- La prueba específica cubre la selección, datos ajenos/incorrectos y la
  conexión de ambas rutas de llegada; no sustituye un toque real en Android.
  TypeScript, ESLint, 148 pruebas locales y 8 auditores sin tarjetas aprobaron.
- **Qué sigue:** prueba en Android con
  app abierta, cerrada, candado y pago borrado; publicación. Tarjetas excluidas.

## FINO-53 — fecha visible en el aviso del celular (07/10/2026)

- El aviso del teléfono mostraba monto, pero no día ni mes del vencimiento.
  Ahora añade la fecha completa en formato día/mes/año, también para ingresos
  y recordatorios. En un día 31 que cae en febrero muestra el último día real
  de febrero, igual que el calendario.
- La prueba del aviso sin fecha falló antes del cambio; ahora pasa, junto con
  las comprobaciones de traducción en español, inglés y portugués.
  TypeScript, ESLint, 148 pruebas locales y 8 auditores sin tarjetas aprobaron.
- **Qué sigue:** verlo en Android. **Qué falta:**
  comprobar también allí la apertura de la ficha al tocarlo (FINO-10) y
  publicar; tarjetas excluidas.

## FINO-38 — aportes según el saldo del mes de su fecha (07/10/2026)

- Confirmado: Familia y Caja comparaban los aportes con el disponible del mes
  que la persona dejó abierto en Inicio, no con el mes del movimiento.
- Ahora las dos usan la misma cuenta financiera de Inicio aplicada al mes de
  la fecha del aporte. Crear usa el día actual; aportar otro día usa la fecha
  elegida; ampliar un aporte usa el mes original, también en Caja compartida. La cifra
  explicativa del formulario sigue la misma fecha.
- La prueba falló en ambas pantallas antes del cambio y pasa ahora. También
  comprueba cortes de saldo y transferencias previas. La prueba de guardado
  real de Caja también comprueba qué fecha se usa. TypeScript, ESLint,
  148 pruebas locales y 8 auditores sin tarjetas aprobaron.
- **Qué sigue:** probarlo en Android.
  **Qué falta:** prueba visual con Inicio en otro mes y entrega; tarjetas
  excluidas.

## FINO-11 — fecha real al marcar un pago (07/10/2026)

- Decisión del propietario: «Ya lo pagué» registra en Inicio e Historial la
  fecha y hora locales del toque, aunque el recibo venciera otro día o mes.
  El calendario conserva su fecha de vencimiento sin cambiarla.
- La prueba del pago anticipado y la del pago tardío fallaron con el código
  anterior y pasan con el nuevo. Un movimiento ya enlazado no se vuelve a
  crear ni se refecha al desmarcar y marcar otra vez; los antiguos no se
  reescriben automáticamente. TypeScript, ESLint, 148 pruebas locales y 8
  auditores sin tarjetas aprobaron.
- **Qué sigue:** tocar el flujo en Android.
  **Qué falta:** confirmar visualmente Inicio, Historial y calendario en el
  teléfono/emulador, y publicar la versión. Tarjetas excluidas.

## FINO-08 — exportación de tester no se apaga sola (07/10/2026)

- Confirmado: si el trabajo sin pantalla no encontraba Premium comprado ni
  una prueba de 24 horas vigente, apagaba la programación y cancelaba la
  alarma. El permiso de tester solo estaba en la sesión abierta, por lo que
  una persona tester podía perder su programación definitivamente.
- Ahora, si no puede comprobar Pro, omite ese archivo, registra el motivo y
  conserva la programación/alarma para la siguiente oportunidad. El texto
  mostrado ya no afirma falsamente que se apagó. Regresión roja antes del
  cambio y prueba programada específica aprobada.
- **No equivale a exportación de tester garantizada con la app cerrada:** el
  trabajo aún no verifica su permiso vigente en el servidor. Evité guardar
  un permiso indefinido o ejecutar el reporte sin comprobarlo. Un intento
  posterior podría volver a omitirse; esto exige un diseño de verificación
  breve y revocable y una prueba real en Android.
- Verificación local completa: TypeScript y ESLint sin errores; 148 pruebas
  locales y 8 auditores aprobados, sin ejecutar las suites de tarjetas.
- **Qué sigue:** diseñar esa verificación. **Qué
  falta:** ejecución real de tester con app cerrada, fallo de red, reapertura,
  control de avisos repetidos y entrega; tarjetas excluidas.

## FINO-17 — destino de Yapes al vencer Pro (07/10/2026)

- Confirmado: el destino Negocio seguía activo tras vencer Pro. La captura con
  la app abierta y el trabajo de fondo ahora consultan si sigue vigente antes
  de enviar ingresos nuevos al negocio; sin Pro van a Personal. No se mueve
  ni reinterpreta ningún ingreso ya anotado en la caja. Si un aviso antiguo
  llega de nuevo tras vencer, su marca impide duplicarlo en Personal.
- Quien tenga negocios previos puede abrir la lista y sus paneles en consulta
  aunque Pro haya vencido; crear, editar y borrar siguen restringidos. Puede
  apagar la preferencia antigua de recibir Yapes, pero no encenderla sin Pro.
  Ajustes, diagnóstico y panel explican que la preferencia queda pausada y
  que se reanudaría al recuperar Pro si no se apaga.
- La prueba de 24 horas ahora actualiza el candado en su instante exacto y al
  volver del segundo plano; antes podía tardar hasta un minuto. Sin sesión
  visible, un permiso de tester no se presume vigente: ante esa incertidumbre,
  el ingreso va a Personal y no se pierde. Prueba del caso nuevo roja antes
  del arreglo; TypeScript, ESLint, 148 pruebas locales sin tarjetas y 8
  auditores aprobados. Una de las 148 es un archivo ajeno sin registrar que
  no se incluye en este cambio.
- **Qué sigue:** revisar otros hallazgos.
  **Qué falta:** simular expiración y Yapes con la app abierta/cerrada en
  Android (ADB no mostró dispositivos ni AVD disponibles en esta sesión),
  verificar compras/permiso de tester y publicación. Los productos
  previos aún tienen una ruta Pro separada que conviene revisar como parte
  del acceso a datos propios. Tarjetas de crédito fuera del ámbito.

## FINO-14 — lector de avisos sin descifrar historiales en cada pulso (07/10/2026)

- Confirmado: con captura activada, la app volvía a leer y descifrar la lista
  completa de movimientos, el registro de avisos y la caja del negocio cada
  ocho segundos aunque no hubiera novedades. Ahora consulta el buzón y el
  registro breve; las listas completas se reconcilian al llegar un aviso,
  cambiar el registro que escribe Android en segundo plano, volver al frente
  o cumplir un minuto de repaso. Un cambio de fondo se detecta en el siguiente
  pulso, sin esperar al minuto.
- Las tres lecturas de la conciliación se completan antes de modificar los
  datos visibles. Si alguna falla, un aviso pendiente no se confirma ni se
  registra sobre una copia incompleta. La prueba de regresión falló antes del
  cambio; se conservó la protección del negocio contra duplicados.
- TypeScript, ESLint, 148 pruebas locales sin tarjetas y 8 auditores aprobados
  (una prueba ajena sin registrar no se incluye en el cambio). La
  prueba del registro falló antes del cambio; la del negocio se actualizó
  para comprobar el nombre nuevo sin quitar su protección. No se tocó el
  código nativo ni se publicó.
- **Qué sigue:** revisar el siguiente hallazgo de riesgo. **Qué falta:** medir
  en un Android con historial grande, probar
  avisos con la app abierta/cerrada, consolas y entrega; tarjetas excluidas.

## FINO-39/56 — fecha y finalización de metas (07/10/2026)

- Confirmado: `toISOString()` ponía la fecha UTC y `GoalFormSheet` conservaba
  `completed` al editar el objetivo. Ahora fecha local y estado derivado de
  `saved >= target`, tanto al entregar el formulario como al guardar en el
  contexto. Prueba con 23:30 en Lima demuestra el salto UTC; subir/bajar el
  objetivo comprueba ambos sentidos.
- Regresión roja antes del cambio; TypeScript/ESLint y 148 pruebas sin tarjetas/
  8 auditores aprobados. No se cambian fechas de metas antiguas sin saber qué
  día quiso la persona; código no publicado ni probado tocando Android.
- **Qué sigue:** FINO-14 y demás riesgos de datos/rendimiento.
  **Qué falta:** prueba física, consolas y entrega autorizada; tarjetas fuera.

## FINO-46 — abono positivo en columna Monto única (07/10/2026)

- Confirmado: con `Monto=-80` y `Monto=+1500`, el lector original devolvía
  dos gastos. Ahora decide la convención por el archivo: con un cargo negativo
  real, el positivo es ingreso; sin negativos, no cambia compras positivas.
  No infiere desde una fila TOTAL inválida, respeta Tipo escrito y conserva
  el tipo en filas que esperan fecha.
- Prueba del lector real roja antes del cambio, verde después; TypeScript,
  ESLint, 148 pruebas sin tarjetas y 8 auditores aprobados. No se modificaron
  datos existentes ni se publicó el código. La vista previa muestra el signo,
  pero no permite corregir el tipo fila por fila: esa mejora y los extractos
  reales/Android siguen pendientes antes de cerrar el hallazgo completo.
- **Qué sigue:** continuar riesgos de pérdida/corrupción e importación.
  **Qué falta:** revisión manual de tipo, pruebas Android/consolas/entrega;
  tarjetas fuera del ámbito.

## FINO-12 — monto de pagos del calendario (07/10/2026)

- Confirmado en `NuevoPagoProgramado`: `Number(monto.replace(",", "."))`
  convertía `1,500` en 1,5. El formulario ahora usa la conversión compartida
  con validación de grupos, moneda y límite; mantiene el texto original hasta
  guardar. No altera montos de pagos ya guardados: esos requieren revisión
  humana, no una corrección automática que podría inventar otro valor.
- La prueba nueva falló con el código previo; tras el arreglo pasaron
  TypeScript/ESLint, 147 pruebas sin tarjetas y 8 auditores. No se ejecutó el
  toque del campo en Android ni se entregó una nueva versión.
- **Qué sigue:** revisar los demás errores de importes y datos. **Qué falta:**
  prueba Android y consola/entrega del conjunto; FINO-12 no está cerrado en
  usuarios publicados. Tarjetas de crédito excluidas.

## Continuación punto 1 — nueva elección conserva la revisión anterior (06/10/2026)

- Regresión 1084e38 reproduce `money-pending` al comparar una revisión antigua.
  Pro ahora revisa fuentes actuales y confirma explícitamente otra elección.
- Anterior sustituida/nueva pendiente y Personal/borrados/Caja guardados juntos;
  anteriores originales/elección conservados. Nueva versión supera la anterior;
  ambas subidas permanecen pausadas hasta confirmar. No copia ningún enlace
  local al servidor ni vuelve a enviar desde UI el intento sustituido.
- Cadena mutua/identidad/moneda/versiones, límites, fusión atrasada, fallos por
  fase/reinicio, respuesta vieja y componente original comprobables. Guía:
  `docs/PRUEBAS_SUSTITUCION_IMPORTE_CAJA.md`. Políticas solo en archivos.
- Verificación: TypeScript/ESLint completos; 146 pruebas locales/8 auditores,
  77 unitarias de servidor y 126 SDK/reglas/HTTP/eventos Node 22 real aprobados.
  Ningún fallo/omisión/cancelación en servidor. Una prueba local ajena sin
  registrar se cuenta pero no se incorpora al commit; checkout limpio no
  probado. Dos suites específicas de tarjetas excluidas, no verificadas.
- **Qué sigue:** retirar sin sucesora/Pro o revisar fuentes iguales/incompletas/
  incompatibles, sin adivinar. **Qué falta:** Android/disco/tamaño/dos dispositivos
  (ADB vacío), demás hallazgos, consolas y entrega conjunta autorizada. Revisar
  compatibilidad antes de rollback. Tarjetas intactas; sin nativos/marca/
  APK/AAB/OTA/despliegue. Punto 1 y auditoría abiertos.

## Continuación punto 1 — recuperar resultado vigente sin Pro (06/10/2026)

- Regresión 48e9f95: flujo real rechazaba recuperar por Pro antes de consultar
  una corrección ya terminada. No se afirma afectación de entrega publicada.
- Función solo lectura con Auth/cuenta real y transacción exige resultado
  exacto vigente. Respuesta mínima propia, sin historial ni nueva colección/
  recibo. Endpoint de escritura y descarga Firestore mantienen Pro.
- Cliente/flujo/botón originales permiten recuperación Gratis; solo rechazo
  definitivo «no aplicada» permite escritura con Pro. No vía alternativa tras
  red/cambio/acuse falso. Comprobante genuino y lote local, originales/versiones
  conservados. Políticas preparadas en archivos, no publicadas. Guía:
  `docs/PRUEBAS_RECUPERACION_IMPORTE_SIN_PRO.md`.
- TypeScript/ESLint y 145 locales/8 auditores aprobados (prueba local ajena no
  registrada conservada fuera del commit; tarjetas específicas excluidas).
  77 unitarias y 124 SDK/reglas/HTTP/eventos Node 22 real aprobados, sin fallos,
  omisiones ni cancelaciones. Incluye resultados/permisos/barreras de borrado.
- **Qué sigue:** sustituir o retirar revisión obsoleta/no aplicada con elección
  explícita y sin perder originales. **Qué falta:** Android/espacio/tamaño/dos
  dispositivos (ADB vacío), demás hallazgos, consolas/políticas reales y entrega
  coordinada autorizada de funciones/reglas/app. Sin tarjetas/nativos/marca/
  APK/AAB/OTA/despliegue. Punto 1 y auditoría siguen abiertos.

## Continuación punto 1 — comparación/elección/reintento conectados (06/10/2026)

- Cajas muestra cuatro fuentes (monto/moneda/fecha), exige confirmación humana
  y reconsulta antes de conservar elección/originales y fuentes locales juntas.
  Respuesta genuina y lote financiero en la misma cola. Pendientes visibles
  aun con descarga pausada; historial de originales confirmados disponible.
- Fallos/red/respuesta perdida/reinicio conservan elección; no se fabrica otra
  versión ni se duplica. Pro antes de HTTP/copia obsoleta detienen la corrección
  preservando originales; Pro después de respuesta genuina no impide lote local.
- Modal/dos toques, aviso de caché a pantalla nueva y lectura/render antiguos
  protegidos. Guía: `docs/PRUEBAS_FLUJO_IMPORTE_CAJA.md`. Pruebas de código original
  y SQLite/demo Firebase no equivalen a Android visual ni consola de producción.
- Verificación: TypeScript/ESLint completos, 144 locales/8 auditores, 73
  unitarias y 121 SDK/reglas/HTTP/eventos bajo Node 22 real aprobados. Ningún
  fallo/omisión/cancelación de servidor. La prueba local ajena sin registrar se
  conserva fuera del commit; tarjetas: dos suites específicas excluidas, no
  verificadas. Regresión cbe2b08 falla por nuevo contrato ausente.
- **Qué sigue:** recuperación/desbloqueo de elección obsoleta o Pro vencido antes
  de respuesta, sin borrar originales. **Qué falta:** Android/cierres/espacio/
  tamaño/dos dispositivos, restantes hallazgos, consolas/políticas reales y
  publicación coordinada autorizada. Tarjetas intactas; sin nativos/marca/
  APK/AAB/OTA/despliegue. Punto 1 y auditoría permanecen abiertos.

## Continuación punto 1 — lote monetario local preparado (06/10/2026)

- Contexto exige comprobante HTTP genuino/cuenta/generación/cola y relee
  originales cifrados dentro de la cola de escritura. Personal/borrados/Caja
  juntos, versión exacta de servidor, originales conservados y otras filas.
- Reserva corta durante SQLite/lectura, mutaciones rechazadas antes de memoria,
  captura en cola espera; durante cifrado se reprepara con los datos nuevos.
  Fallo mantiene originales; lectura incierta congela escrituras sin borrar.
  Pantalla cerrada tras iniciar lote no recibe éxito, pero cuenta vigente sí
  refleja lo verificado. Reserva liberada incluso ante error.
- Guía: `docs/PRUEBAS_LOTE_IMPORTE_CAJA.md`. Código original y SQLite real con
  sustitutos de React/nativos; no Android. Regresión ddde38d por API nueva
  ausente, no fallo de usuarios publicados. Datos/claves/retención sin cambios.
- 120 pruebas SDK/reglas/HTTP/eventos bajo Node 22 real aprobadas, sin fallos,
  omisiones ni cancelaciones; 73 unitarias del servidor aprobadas. ADB vacío.
- Auditor que expiró recorría artefactos/cachés. Excluidos esos directorios,
  recorrido original probado (regresión ddde38d), sin omitir código propio ni
  ampliar el timeout. No se cuenta la pasada interrumpida como aprobada.
- TypeScript/ESLint y repetición final: 143 locales/8 auditores aprobados; una
  prueba ajena sin registrar conservada pero no incluida en commit. Tarjetas:
  dos suites específicas excluidas, no consideradas verificadas.
- **Qué sigue:** selección/petición/lote/recuperación visible, controles y
  lecturas visuales concurrentes, decisiones obsoletas/Pro vencido. **Qué falta:**
  Android/espacio/tamaño/dos dispositivos/otros conflictos y 61 hallazgos,
  consolas/políticas publicadas/publicación autorizada. Sin tarjeta/nativos/
  marca/instalable/OTA/despliegue. No botón ni petición monetarios en pantalla;
  contexto preparado no equivale a punto 1 ni auditoría terminados.

## Continuación punto 1 — cliente monetario preparado (06/10/2026)

- Fuentes frescas en cola auténtica, consulta exacta/limitada de historial v2;
  archivo pendiente con originales comprobados antes/después de HTTP, pareja
  actual válida, cuenta/generación/moneda. Respuesta genuina ligada a la misma
  cola; calcular/copiar campos de un ack no equivale a recibirlo.
- Cliente original y SDK/HTTP demo comprueban recuperación vigente sin otra
  escritura, Pro revocado, pantalla cerrada y cambios posteriores. No modifica
  dinero local ni confirma su guardado por recibir HTTP. Guía:
  `docs/PRUEBAS_CLIENTE_IMPORTE_CAJA.md`. Regresión aee6653 del contrato nuevo
  falla por cliente/verificador ausente, no por bug de la app publicada.
- TypeScript/ESLint, 141 locales/8 auditores (una prueba ajena sin registrar), 73
  unitarias y 117 SDK/reglas/HTTP/eventos Node 22 reales aprobados; prueba
  directa final del cliente repetida. Sin omisiones/cancelaciones en servidor;
  tarjetas específicas excluidas del ámbito. ADB no encontró dispositivos.
- **Qué sigue:** lote financiero/mutaciones protegidas, selección humana y
  caminos para decisión obsoleta/Pro vencido. **Qué falta:** Android/tamaño/
  dos dispositivos/consolas/otros hallazgos/publicación coordinada autorizada.
  Ningún import del contexto/pantalla ni nuevo botón o envío habilitados.
  Mismo esquema documentado; no claves/retención/nativos/tarjetas/marca/entrega.
  No cerrar punto 1/auditoría ni prometer atomicidad servidor/teléfono.

## Continuación punto 1 — barrera del respaldo Personal/Caja (06/10/2026)

- Pendencia local pausa ambos respaldos/lecturas ordinarios, incluso tras reinicio;
  misma cola por UID y autorización anidada genuina para historial v2. Identidad,
  generación, archivo legible y verificación antes de escribir/tras esperas.
- Recepción/hidratación/contexto descartan sellos viejos. No rejuvenece otra
  respuesta/autorización. Espera el desenlace de escrituras en vuelo, no las deshace.
  Ajustes explica la pausa sin anunciar una confirmación vieja como respaldo actual.
- Regresión c24eff0 reproduce Personal S/80 contra Caja S/100 pese a pendencia.
  Pruebas nuevas aíslan red/almacén, ejecutan módulos/contexto originales; SDK
  real añade casos sin escrituras y respuesta vieja/otro dispositivo. Guía:
  `docs/PRUEBAS_BARRERA_PERSONAL_CAJA.md`. TypeScript/ESLint, 140 pruebas del
  ámbito/8 auditores (una ajena sin registrar), 73 unitarias y 112 SDK/reglas/
  HTTP/eventos bajo Node 22 real aprobados. Regresión anterior falla; adaptadores
  y contrato de sesión corregidos sin quitar aserciones, suite completa repetida.
- **Qué sigue:** pantalla, fuentes frescas dentro de cola, originales, mutaciones
  protegidas, petición, lote financiero y recuperación. **Qué falta:** resto de
  conflictos/hallazgos, Android/tamaño/consolas/publicación autorizada. Sin cierre
  de punto 1/auditoría ni atomicidad global. No nativos/tarjetas/marca/entrega.
  Dos suites específicas de tarjetas excluidas expresamente por el propietario.

## Continuación punto 1 — originales de importe locales (06/10/2026)

- Cuatro fuentes/elección/versiones conservadas en Cajas cifrado y archivo por
  cuenta. Normalizar no descarta, confirmada no vuelve a pendiente ni cambia
  originales. Hasta 50 revisiones/400.000 bytes totales, sin borrar anteriores.
- Validación común del servidor, propuesta local de dos mitades, respuesta exacta,
  fuentes/moneda/borrados/saldo y metadata conservados. Fusión/recuperación/subida
  Caja ordinarias no resuelven una pendiente; copias no viajan como respaldo.
- Regresión sintética contra b48e703 pierde las revisiones al normalizar. Archivo
  y cifrado originales comprobados con sustitutos Android, no teléfono real.
  Guía: `docs/PRUEBAS_ORIGINALES_IMPORTE_CAJA.md`. TypeScript/ESLint,
  141 locales/8 auditores (una prueba ajena sin registrar), 73 unitarias
  Functions y 110 SDK/reglas/HTTP/eventos Node 22 reales aprobados. Sin pruebas
  omitidas/canceladas; lectores adaptados a módulos originales sin quitar aserciones.
- **Qué sigue:** botón/fuentes frescas, barrera Personal/subidas en vuelo,
  petición, lote financiero confirmado y recuperación. **Qué falta:** otras
  discrepancias, Android/tamaño/consolas/políticas publicadas y entrega autorizada.
  No conectado a pantalla, no publicado, no atomicidad servidor/celular ni auditoría
  cerrada. Tarjetas/nativos/marca sin cambios. Políticas local/web/Play preparadas.

## Continuación punto 1 — base de corrección monetaria en servidor (06/10/2026)

- Servicio limitado a aporte propio exacto Personal/Caja privada; cuatro
  originales/elección de monto-fecha, Pro/cuenta/moneda/fuentes y saldo comprobados.
  Una transacción remota guarda ambos registros, no otros; replay vigente no escribe.
- Historial antiguo/separado, duplicados, borrados, cierre, conversión, devolución,
  edición concurrente y datos no finitos protegidos. Sin colección/recibo nuevo ni
  nueva retención de servidor. Una decisión obsoleta no fuerza datos actuales.
- Regresión contra e10b2b6 usa SDK original: interrupción tras subir Caja deja
  S/100 en Caja y S/80 en Personal. Guía y límites:
  `docs/PRUEBAS_DIFERENCIAS_DINERO_SERVIDOR.md`. Regresión falla como se esperaba;
  TypeScript/ESLint, 140 locales/8 auditores (una prueba ajena sin registrar),
  73 unitarias de Functions y 110 SDK/reglas/HTTP/eventos aprobados bajo Node 22
  real, sin pruebas omitidas ni canceladas. ADB sin dispositivos; no prueba Android.
- **Qué sigue:** integrar pantalla/confirmación, originales y decisión cifrados,
  guardado conjunto local, bloqueos y recuperación. **Qué falta:** otras discrepancias,
  Android, índices/consolas, políticas de la integración y publicación autorizada.
  No conectado a la app, no publicado ni desplegado, tarjetas/nativos sin cambios.
  No declara punto 1, auditoría o atomicidad servidor/celular resueltos.

## Continuación punto 1 — reconstrucción incompleta protegida (06/10/2026)

- Tres regresiones contra 37ff973 comprueban Caja cerrada reconstruida como
  abierta, fecha imposible propagada y reparto no iterable que rompía Cajas.
  Se conserva y señala, sin escribir dinero ni confirmar un plan viejo inseguro.
- Devolución sin ID/mitad requiere revisión. Recuperaciones positivas siguen;
  conserva identidad privada y no valida/repara movimientos compartidos ajenos.
  Explicaciones específicas, sin prometer dos copias cuando falta una mitad.
- Contexto/almacén originales con SQLite y SDK/Auth/Firestore locales reales;
  10.001 filas/1.001 Cajas sin ajuste. No Android físico ni medición de su rapidez.
- TypeScript/ESLint, 140 locales/8 auditores (una prueba ajena sin registrar),
  63 unitarias y 99 SDK/reglas/HTTP/eventos bajo Node 22 aprobados. La primera
  pasada detectó ámbito/identidad: se corrigió código, sin quitar aserciones.
  Guía: `docs/PRUEBAS_RECUPERACION_INCOMPLETA_CAJAS.md`.
- **Qué sigue:** resolver desacuerdos monetarios locales/remotos, mitad/reparto
  sin prueba y elecciones obsoletas. **Qué falta:** Android, consolas, publicación
  coordinada/autorizada y comprobación posterior. ADB sin dispositivos; sin
  datos/retención/claves/reglas/servicios nuevos, nativos, tarjetas o publicación.
  Punto 1 y auditoría no cerrados; no es atomicidad global servidor/celular.

## Continuación punto 1 — nombres distintos de Caja (06/10/2026)

- Elección explícita solo ante empate de versión/nombre, no decide dinero.
  Guarda ambas versiones locales cifradas antes de red; transacción exige
  la fuente remota exacta y cambia solo nombre/versión, preservando demás datos.
- Reintento vigente idempotente; fallos/cambios de cuenta/fuente/Pro/respuesta
  no confirman éxito. Hasta 50 revisiones locales conservadas por cuenta,
  no subidas a Firebase. Políticas y compatibilidad preparadas, no publicadas.
- TypeScript/ESLint, 139 locales/8 auditores (una prueba ajena sin registrar),
  63 unitarias y 97 SDK/reglas/HTTP/eventos aprobados con Node 22 real.
  Regresión contra 482f2fd falla como se espera. Guía:
  `docs/PRUEBAS_NOMBRES_CAJA_NUBE.md`.
- **Qué sigue:** punto 1 no cerrado: diferencias de dinero/mitad ausente/
  reparto no demostrable y elecciones obsoletas conservadas para revisar.
  **Qué falta:** puntos 2/3, Android visual/cierre/espacio/tamaño/dos dispositivos,
  consolas y publicación autorizada. ADB sin dispositivos; no se publicó nada,
  no se tocaron tarjetas ni código nativo. No es atomicidad global con Firebase.

## Continuación punto 1 — selección de enlace heredado (06/10/2026)

- Elección y confirmación unen una pareja existente con igual importe/fecha,
  sin cambiar dinero o campos. No se decide por coincidencia ni se fuerza una
  edición/borrado remoto no recibido; aviso específico conserva la revisión.
- Elegibilidad se vuelve a comprobar dentro del guardado conjunto original:
  IDs únicos, no borrados/cierre/otro enlace/espacio/devoluciones posteriores.
- TypeScript/ESLint, 138 locales/8 auditores (una prueba ajena sin registrar),
  63 unitarias y 92 SDK/reglas/HTTP/eventos aprobados. Regresión contra 410bbb3
  falla como se espera. Guía: `docs/PRUEBAS_ENLACE_HEREDADO.md`.
- **Punto 1 no cerrado:** siguen diferencias concurrentes, mitad ausente y
  reparto antiguo no demostrable. **Qué falta:** puntos 2/3, Android visual/
  cierre/espacio/tamaño/dos dispositivos y publicación autorizada. ADB sin
  dispositivo conectado; no se publicó nada ni se tocaron tarjetas.

## Continuación FINO-02 — copias incompletas al borrar cuenta (05/10/2026)

- S/100 copiados podían bloquear como deuda ficticia el borrado de cuenta.
  El índice sin destino también fallaba por las reglas SDK. Regresión cliente
  anterior reproduce el bloqueo; el servidor verifica primero sin escribir.
- Nueva limpieza limitada sin Pro, identidad reciente y UID autenticado:
  congela/limpia clones demostrados, conserva origen durante esa fase y barrera
  hasta Auth. Publicación real, invitados, diferencias o legado no demostrable
  no se descartan a ciegas. Recibos se comprueban antes de retirarlos.
- Reglas protegen la barrera e impiden índices arbitrarios/atrasados o nuevas
  copias legacy sin protocolo. Se mantienen creación/unión atómicas normales.
- Guía/evidencia: `docs/PRUEBAS_BORRADO_CAJAS_INCOMPLETAS.md`. Preparado en código,
  no publicado ni probado físicamente; no declara FINO-02 totalmente resuelto.
- TypeScript/ESLint, 136 locales/8 auditores (una prueba ajena sin registrar),
  63 unitarias y 89 SDK/reglas/HTTP/eventos aprobados con Node 22 real. Regresiones
  local/SDK contra 51a57d0 detectan la deuda ficticia; JWT atrasado no recrea índice.
- **Qué sigue:** pares heredados y conflictos. **Qué falta:** legado no
  demostrable, Android/cierres/dos dispositivos, tamaño/espacio lleno, consolas/
  índices y publicación coordinada. No se tocaron tarjetas ni código nativo.

## Continuación FINO-02 — no revivir una devolución anulada (05/10/2026)

- Falla confirmada: borrar el retorno no invalidaba su confirmación privada.
  Un reintento la recuperaba como vigente. Además, la recepción en el contexto
  no comprobaba si su ID ya se había borrado.
- Anulación y comprobante se actualizan conjuntamente; repetir la anulación
  no escribe ni exige Pro otra vez. El replay del retorno anulado se rechaza.
- Orden pendiente: retiro verificado, sin convertir errores de red en anulación.
  Borrado inmediato en referencia y guardia también al procesar la recepción.
- Pruebas y alcance: `docs/PRUEBAS_DEVOLUCION_ANULADA.md`. No abre Gratis para
  nuevas ediciones/borrados Pro ni declara corregidas todas las consultas de UI.
  TypeScript/ESLint, 130 pruebas locales y 8 auditores, 54 unitarias de Functions
  y 50 de SDK/reglas/HTTP/eventos aprobados; una prueba local es ajena no registrada.
- **Qué sigue:** conciliación/consultas atrasadas entre dispositivos.
  **Qué falta:** Android/dos teléfonos, producción y entrega coordinada.
  No se publicaron cambios ni se tocaron tarjetas.

## FINO-05 y continuación FINO-02 — Node 22 y borrado probado (05/10/2026)

- Node 22.23.3 real, portátil y SHA-256 oficial verificado. Se cargaron las
  Functions originales, con llamadas HTTP de SDK y eventos Auth/Firestore
  auténticos de sus emuladores, no envolturas de Auth sustituidas.
- Hallazgo adicional confirmado: el borrado de Familia intentaba consultar
  índices privados de otro miembro y fallaba por las reglas correctas de
  privacidad. La regresión reproduce el rechazo usando el cliente anterior.
- `finalizeLinkedSpaceDeletion`: identidad reciente, dueño, borrado preparado,
  movimientos ya retirados y ninguna exigencia Pro. Limpia solo índices del
  espacio; conserva los del propietario para reintentar y retira raíz/índice/
  membresía propios conjuntamente al final. Sin ampliar reglas privadas.
- Devolución con prueba vencida, historial de 405 documentos, espacios propios,
  limpieza Auth de permisos/comprobantes y limpieza de Telegram comprobados;
  otra cuenta se conserva. Pruebas y límites en
  `docs/PRUEBAS_NODE22_BORRADO_CUENTA.md`.
  TypeScript/ESLint, 129 pruebas locales y 8 auditores, 53 de Functions y 48
  de reglas/SDK/HTTP/eventos aprobados. Una prueba local es ajena no registrada.
- **Qué sigue:** recorrido Android y demás riesgos de datos. **Qué falta:**
  teléfono/dos dispositivos, Google real, configuración de producción y
  publicación coordinada. No se declara auditoría completa ni FINO-05 resuelto
  en producción; tarjetas siguen excluidas.

## FINO-02 — recuperación del saldo sin renovar Pro (05/10/2026)

- Nuevo servicio estrecho: S/100 aportados, S/60 gastados y S/40 recuperables
  permiten devolver S/40 a Personal sin Pro y cerrar el espacio sin deuda ficticia.
  No permite otras operaciones Pro ni tocar el aporte de otra cuenta.
- Transacción financiera con identificador persistente, orden local cifrada y
  confirmación privada. Reintentos no generan otro ingreso; se recupera aun
  después de borrar el grupo o salir de él, sin conceder acceso al grupo.
- Nuevas devoluciones SDK bloqueadas, también Pro. La copia histórica de una
  Caja privada solo admite su origen exacto y una fase de migración irreversible.
  El evento Auth limpia confirmaciones por UID; bloqueo de cuenta en eliminación.
- Pruebas y límites: `docs/PRUEBAS_DEVOLUCION_SIN_PRO.md`. La decisión de lo
  consumido y conservación del historial continúan vigentes.
  TypeScript/ESLint aprobados; 129 pruebas locales y 8 auditores, 49 de Functions
  y 40 del emulador Firestore. Una prueba local preexistente ajena sigue sin
  registrar en Git. La regresión nueva falla contra el manejador anterior.
- **Qué sigue:** FINO-05 (Node 22) y comprobar eliminación de cuenta de punta
  a punta. **Qué falta:** Android/dos cuentas/dispositivos, Functions/Auth reales,
  consolas, transición de versiones y publicación autorizada. FINO-02 preparado
  en estas rutas, no declarado resuelto en producción. Tarjetas excluidas.

## FINO-02 — consumido sin deuda ficticia, avance parcial (05/10/2026)

- El propietario autorizó considerar consumido el aporte gastado. Saldo cero
  permite cerrar/preparar borrado sin exigir devolución de dinero inexistente.
  El miembro con dinero ya consumido también puede salir. Devoluciones inválidas,
  saldos disponibles y borrado de aportes gastados siguen bloqueados.
- Se conserva Personal al cerrar: marcador e importe consumido, sin alterar
  saldo ni generar ingresos. Las ausencias de espacios cerrados no se purgan
  como huérfanos, también si la copia de destino llega antes que la Personal.
- Borrado de Caja privada corregido: no llama a Functions compartidas; prueba
  real del método, aporte intacto/gastado y par devuelto. Familia conserva los
  vínculos de cierre para limpieza posterior. Guía de pruebas y límites:
  `docs/PRUEBAS_APORTES_CONSUMIDOS.md`.
- Verificado: TypeScript, ESLint, 128 pruebas locales y 8 auditores; 42 de
  Functions y 31 del emulador. Una prueba local es preexistente ajena no registrada.
- **Qué sigue:** devolución del saldo aún disponible tras vencer Pro y Node 22.
  La excepción de devolución está preparada en la sección superior.
  **Qué falta:** completar esa excepción segura, teléfono/dos dispositivos,
  Functions reales/consolas y publicación coordinada. No se considera FINO-02
  completamente resuelto ni se migraron cuentas; tarjetas siguen excluidas.

## FINO-04 — protección Pro preparada, no publicada (05/10/2026)

- Personal/historial, Negocio y Cajas privadas requieren Pro también en reglas.
  Gratis mantiene su uso local; se conservan copias antiguas al bajar de plan.
  Consulta de permisos separada y limitada a metadatos, sin descargar fotos,
  movimientos ni perfil de la persona Gratis.
- Borrado Personal administrativo sin Pro, con identidad reciente, bloqueo y
  limpieza por lotes. Registro privado de prueba por UID y limpieza de Auth
  reintentable. La prueba no se reinicia borrando solo la copia financiera.
- Cajas distingue copia vacía de consulta fallida y no repara eliminando datos
  por un fallo de permisos/red. No se revisó toda su fusión en esta tanda.
- TypeScript, ESLint, 127 pruebas locales, 8 auditores, 41 de Functions y 26
  comprobaciones reales del emulador Firestore en verde.
  Una prueba local es preexistente ajena y continúa sin registrar en Git.
  Regresión contra reglas anteriores confirma acceso Gratis no autorizado.
- **Qué sigue:** decisión sobre aportes gastados (FINO-02), Node 22 y entrega
  coordinada de Functions/reglas/app/política. **Qué falta:** teléfono, llamadas
  reales de Functions/evento Auth y consolas. No se desplegó ni publicó nada;
  el cobro real no existe y tarjetas de crédito siguen excluidas. Este cambio
  no soluciona el bloqueo de devolución/cierre por aportes al vencer Pro.
  Detalle y límites: `docs/PRUEBAS_NUBE_PRO.md`.

## Auditoría FINO — avance de pérdida de datos (05/10/2026)

- FINO-01: cierre de sesión con copia local cifrada por UID, ya preparado y
  probado localmente; pendiente el recorrido Android con dos cuentas.
- FINO-03: unión por elemento/campo de la copia Personal, también al recibir
  y restaurar. Presupuestos, límites, categorías y calendario se conservan;
  borrados explícitos no reaparecen. Ver `docs/PRUEBAS_FUSION_PRO.md`.
- Validación actual: TypeScript, ESLint, 126 pruebas locales, 8 auditores,
  39 pruebas de Functions y 15 comprobaciones en el emulador Firestore.
  Las nuevas pruebas de fusión y reglas fallan contra la versión anterior.
  Una de las 126 pruebas es preexistente, ajena y no registrada en Git.
- No se publicó la app, las reglas ni Functions; no se usaron cuentas reales.
  Las reglas nuevas deben admitir `syncFormat: 2` antes de distribuir la app.
  El requisito Pro aún no está aplicado a todas las rutas del servidor.
- **Qué sigue:** FINO-04 (Pro en servidor), FINO-02 (decisión sobre aportes),
  comprobar Functions en Node 22 y preparar una entrega coordinada.
  **Qué falta:** dispositivo, consolas/producción y revisión independiente de
  Negocio/Cajas y del pago simultáneo del mismo mes desde dos teléfonos.

## Corregido y probado localmente

- CRI-01 a CRI-04: acceso a Familia/Caja, separación entre cuentas, borrado de
  cajas y protección de cuentas sin verificar/cierre de sesión.
- ALT-02 a ALT-05, ALT-07, ALT-09 a ALT-11 y ALT-13: montos, sincronización,
  errores de nube, importación, Cajas, Negocio y Telegram.
- ALT-08: historial Personal separado, compatible con el formato anterior,
  probado con dos clientes y 10.000 movimientos. Aún no está activado fuera
  del emulador.
- MED-01 a MED-17 y MED-21/MED-22: correcciones preparadas en código. La prueba
  Premium ahora se concede una sola vez desde una función del servidor.
- BAJ-01 a BAJ-11 y BAJ-13: corregidos en código. Un auditor automático revisa
  texto JSX, placeholders, etiquetas accesibles, alertas y mensajes breves en
  Inicio, bienvenida, Familia, Cajas, Caja compartida, calendario, Telegram,
  navegación y pantallas secundarias. Falta la comprobación física con TalkBack.

## Pendiente por decisión o trabajo externo

- ALT-01 y BAJ-12, tarjetas de crédito: excluidos por indicación del usuario.
- ALT-06: publicar de forma coordinada reglas y Cloud Functions.
- ALT-08: crear la nueva versión, probarla físicamente y migrar cuentas reales
  solo después de confirmar que ya no escriben versiones antiguas.
- ALT-12: rotar la clave de firma desde Google Play Console. Las contraseñas ya
  fueron retiradas del proyecto, pero la rotación no puede hacerse solo en código.
- MED-19, App Check: Firebase JS en React Native exige un proveedor de
  atestación nativo personalizado. Requiere código nativo, consola Firebase y
  un AAB nuevo; no se debe activar la exigencia antes de que la app entregue
  tokens válidos porque bloquearía a todos los usuarios.
- MED-18: el límite de 15 MB ya existe; falta medir en un teléfono de gama baja
  que el procesamiento de PDF no bloquee la interfaz.
- MED-20: la limpieza y menor captura del lector nativo están en código, pero
  requieren un AAB y prueba física para considerarlas terminadas.
- MED-23: ya existen pruebas reales del emulador de reglas y dos clientes. La
  prueba de la campana ya valida comportamiento y la del flujo inicial ejecuta
  las traducciones reales. Las pruebas de importación rápida y presupuesto
  exacto también ejecutan ya la lógica real; todavía quedan otras pruebas
  antiguas por reemplazar gradualmente.
- VER-01 y VER-04 a VER-06: verificar consola/producción, correo fuera de la
  app, avisos tras reiniciar y requisitos fiscales de Google Play.
- Pruebas físicas: dos teléfonos/dos cuentas, red intermitente, Drive/Dropbox,
  TalkBack, reinicio de Android e iPhone. Las pruebas automáticas no sustituyen
  estas comprobaciones.

## Siguiente orden

1. Sustituir más pruebas antiguas de texto por pruebas de comportamiento.
2. Revisar los pendientes de rendimiento y pruebas reales que aún puedan
   simularse localmente, sin tocar tarjetas de crédito.
3. Preparar una sola versión de prueba con los cambios nativos acumulados.
4. Con autorización previa: publicar servidor/reglas, instalar la versión en
   prueba cerrada y ejecutar la lista manual en dispositivos.
5. Migrar primero una cuenta de prueba y después decidir el despliegue general.

### Familia/Caja: invitaciones, disponibilidad y presentación (02/10/2026)

- El selector muestra tarjetas de Familia y Caja más compactas, con altura y
  espaciado consistentes; Inicio ya no muestra el estado “En control”.
- La barra inferior anima cada toque, resalta el botón + y muestra una sola vez
  la indicación para registrar el primer movimiento.
- El código de invitación se presenta en una hoja inferior compartida. La
  lectura nativa del portapapeles se retrasa hasta tocar “Copiar”, para que una
  versión instalada sin `ExpoClipboard` no falle al abrir Familia.
- “Unirme” en Cajas ahora introduce el código en la misma pantalla y abre la
  caja después de aceptar la invitación. Los errores de permisos ya no se
  confunden con una desconexión.
- Simulación de saldo ejecutada: S/ 500 − S/ 120 (Familia) − S/ 80 (Caja) +
  S/ 50 (devolución) = S/ 350. Seleccionar el origen no modifica el saldo.
- TypeScript, ESLint, 118 pruebas y 8 auditores aprobados. El emulador y las
  escrituras de Firebase aún deben verificarse; no se han publicado reglas,
  Functions ni app. Las reglas desplegadas podrían rechazar los campos nuevos
  `category` y `notes` hasta publicar `firestore.rules` con autorización.

### Auditoría externa — pruebas reales de importación y presupuesto (28/09/2026)

- La prueba de importación dejó de buscar una frase en el archivo fuente: ahora
  ejecuta el detector y comprueba el límite de 14 días, la exclusión desde el
  día 15 y que una coincidencia no pueda reutilizarse.
- La prueba del presupuesto también ejecuta la función usada por Inicio:
  confirma que 1.359 llega completo al formateador y que un monto oculto no se
  procesa ni se muestra.
- Los métodos de pago ahora se filtran mediante una función probada: Yape solo
  aparece en Perú/Bolivia, Plin solo en Perú, los métodos universales siguen en
  todos los países y una edición conserva métodos antiguos.
- La importación ya no recorre todo el historial por cada fila. Construye una
  sola vez un índice por fecha y consulta únicamente la ventana de 14 días; una
  prueba local indexa y busca entre 10.001 movimientos, incluido un cambio de
  mes.
- El catálogo mundial dejó de comprobarse leyendo su código como texto. La
  prueba carga los 250 países y 155 monedas reales, valida símbolos, decimales,
  asignaciones, orden y búsquedas por nombre, código, moneda y símbolo. Cambiar
  moneda conserva el país local y el país continúa fuera del respaldo en nube.
- La categoría de cada fila importada se decide ahora en una función probada:
  lo escrito en el archivo tiene prioridad, los sinónimos reales se reconocen,
  lo aprendido por la persona se conserva y una categoría de ingreso no puede
  entrar en un gasto. La confirmación de borrado mensual permanece vigilada en
  una prueba independiente.
- Una prueba sintética procesa 10.000 filas CSV, comprueba que ninguna se pierda
  ni cambie de tipo y limita el tiempo local a 3 segundos; en esta revisión
  terminó en menos de 100 ms. Esto no reemplaza la medición física de PDF.
- La carga de archivos usa ahora un límite de 15 MB con fronteras probadas. Un
  XLSX real de 10.000 filas se abre, convierte y analiza sin pérdidas; preparar
  el HTML de un PDF con 10.000 movimientos conserva la primera y última fila,
  escapa el texto y queda bajo el límite temporal local. La impresión nativa
  del PDF todavía necesita medirse en un teléfono de gama baja.
- Los avisos del calendario dejaron de comprobarse leyendo el efecto como
  texto. La prueba programa tres meses reales, cambia de PEN a USD, confirma
  que no se dupliquen, omite el mes pagado y cancela únicamente avisos del
  calendario sin retirar el aviso independiente de exportación.
- La misma prueba cubre permiso denegado, error nativo al programar y dos
  reprogramaciones simultáneas. Los fallos conservan su etapa y motivo, y la
  última moneda queda activa con tres avisos, no seis.
- El botón de prueba del calendario también se ejecuta: programa un aviso a
  tres segundos con título, texto, sonido y marca correctos; distingue permiso
  denegado de un error del servicio.
- La recuperación de exportaciones al abrir la app ya conserva el destino real
  (Drive, Dropbox, OneDrive o carpeta), el espacio Personal/Familia/Caja y la
  opción de gráficos. Solo confirma la ejecución después de guardar bien; si
  falla la red, permite reintentar en el próximo arranque sin entrar en bucle
  durante la misma sesión. Un mes sin movimientos termina limpiamente y no
  deja una pantalla invisible abierta.
- Se retiraron cálculos de gráficos y comparaciones mensuales que ya no usaba
  ninguna pantalla. El total mensual que antes estaba huérfano ahora alimenta
  realmente a Inicio y separa gastos, ingresos, envíos y devoluciones; así una
  transferencia interna no puede volver a entrar en los totales normales.
- TypeScript, ESLint, 117 pruebas y 8 auditores están aprobados para esta
  tanda. No se modificaron tarjetas de crédito ni se publicó ningún cambio.

### Cierre de validación local Android (28/09/2026)

- Se comprobó que el proyecto usa `package-lock.json`; las dependencias se
  reinstalaron con `npm ci` para respetar exactamente las versiones aprobadas y
  evitar las rutas profundas que producía una instalación local con pnpm.
- Gradle completó `:app:assembleDebug`: 755 tareas y `BUILD SUCCESSFUL`. El APK
  de comprobación quedó en `android/app/build/outputs/apk/debug/app-debug.apk`
  con SHA-256
  `18C5B16E7A7EB7046DCEB06BCF94A63E09912390F05A9EBC29A42CA8BC90058E`.
- Con esa instalación exacta volvieron a pasar TypeScript, ESLint, las 117
  pruebas, los 8 auditores y las 38 pruebas de Cloud Functions.
- Se retiraron las cachés y copias temporales creadas durante la compilación.
  `output/` se preservó sin cambios. No se modificaron tarjetas de crédito y no
  se publicó, instaló ni desplegó nada.
- No quedan hallazgos locales de código de la auditoría original fuera del
  módulo de tarjetas de crédito excluido por decisión del usuario. `npm audit`
  pasó de 90 avisos a 22 (20 moderados y 2 altos) al actualizar sin rupturas
  `fast-uri`, `undici` y React Navigation. Los restantes son transitivos de
  Expo Router, Metro, PostCSS y `xcode`; corregirlos automáticamente exige
  bajar Expo Router o saltar de Expo 54 a 57, por lo que se documentan para una
  migración controlada y no se aplicó `--force`.
- Siguen pendientes las comprobaciones físicas y acciones externas enumeradas:
  reglas/Functions, AAB de prueba, dos dispositivos y dos cuentas, red
  intermitente, Drive/Dropbox, TalkBack, reinicio, iPhone, App Check, rotación
  de firma, requisitos de Play y la migración posterior del historial.

## Continuación FINO-02 — pares heredados protegidos (06/10/2026)

- Falla comprobada en el efecto anterior: monto de Caja imponía otra cifra
  sobre Personal. Recuperación por IDs y guardado conjunto sustituyen la
  coincidencia débil y las escrituras separadas, conservando campos y borrados.
- Elección de monto/fecha únicamente con pareja inequívoca; sin saldo negativo
  ni ajustes parciales de devoluciones. Ausencia/consumo/duplicados/marca antigua
  conservan registros y piden revisión; no fabrican devolución.
- Pro comprueba en servidor los IDs afectados; copia remota no recibida bloquea
  la reconstrucción. No se otorga nube a Gratis ni se cambia el contrato nativo.
- Guía: `docs/PRUEBAS_REPARACION_PARES_CAJAS.md`. No afirma FINO-02 corregido
  globalmente ni en producción. **Qué sigue:** legado/diferencias local-nube.
  **Qué falta:** Android/cierres/espacio/tamaño/dos dispositivos, revisión del
  aviso, consolas y publicación coordinada. Tarjetas excluidas.
- TypeScript/ESLint, 137 locales/8 auditores (una prueba ajena sin registrar),
  63 unitarias Functions y 91 SDK/reglas/HTTP/eventos aprobados. Regresión
  contra 0f0588f confirma la sobrescritura antigua; ninguna cuenta real tocada.
