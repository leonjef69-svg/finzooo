# Seguimiento de la auditoría de Claude

Última revisión: 06/10/2026. Este archivo separa tres cosas distintas: código
corregido, pruebas locales aprobadas y acciones que realmente están publicadas.

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
