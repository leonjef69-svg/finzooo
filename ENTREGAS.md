# Entregas de Fino

## 22/10/2026 — conteo y saldo del selector mensual (desarrollo)

Personal cuenta las tarjetas visibles de cada mes, sin recibos internos de
ahorro ni movimientos ocultos, y agrupa transferencias por día como su lista.
Reportes ahora muestra el mismo conteo. El saldo de los meses resta el ahorro
reservado en metas, tal como el saldo disponible de Personal. Sin modificaciones
en movimientos o saldos guardados.

TypeScript, ESLint, 258 pruebas y 8 auditores pasan. Metro sirve el bundle nuevo
y el emulador abrió Reportes; no se pudo desplegar el selector con automatización,
por lo que su revisión visual sigue pendiente. No requiere APK/AAB.

## 22/10/2026 — límite de presupuesto en la esquina (desarrollo)

En el editor, cada fila muestra el importe del límite en la esquina derecha,
con el lápiz a su lado y «Límite mensual» debajo. Se oculta ahí el gasto para no
confundirlo con el límite; los avisos rojo/ámbar siguen cuando son necesarios.
Tocar cualquier parte de la fila permite editar. Guardar mantiene el flujo
actual y Reportes no cambia. No se tocan movimientos ni saldos.

La regresión del editor falla con la versión previa y pasa con este ajuste.
TypeScript, ESLint, 258 pruebas y 8 auditores pasan. El emulador carga el bundle
nuevo y su jerarquía muestra el título y las etiquetas actualizadas; su captura
sale negra, así que no se pudieron revisar visualmente los píxeles. No se
alteraron datos financieros. **Sigue/falta:** confirmar colores y alineación con
una captura visible. No requiere APK/AAB porque no hay cambios nativos.

## 22/10/2026 — resumen unificado de Modo Negocio (desarrollo)

Ingresos, Gastos y Resultado comparten una sola tarjeta compacta. Los dos
importes van arriba y un contorno exterior más visible rodea el conjunto. Una
línea separa el Resultado debajo, con su texto a la izquierda y el monto a la
derecha. Se calcula con los mismos registros y filtros:
ingresos menos gastos; verde cuando es positivo, rojo cuando es negativo y neutro
cuando queda en cero. No crea ni altera movimientos o saldos.

La prueba usa datos inventados y verifica la tarjeta única, el cálculo, el cambio
de color y la actualización al borrar; falla con la pantalla anterior.
TypeScript, ESLint, 258 pruebas y 8 auditores pasan. Metro sirve el bundle Android
con el marcador nuevo y la tarjeta unificada. **Sigue/falta:** confirmar la
apariencia visual en el emulador; no requiere APK/AAB porque no se modificó
código nativo.

## 22/10/2026 — editor compacto de presupuestos por categoría (desarrollo)

Lista compacta con mes, búsqueda y botón «Categoría». Muestra el gasto a la
derecha y el límite editable a la izquierda. Sin barras en esta pantalla: rojo
si se supera el límite, ámbar desde 90% y ningún aviso cuando está normal.
Reportes conserva sus barras. «Categoría» abre el mismo panel inferior y no otra
pantalla ni el selector intermedio. No se cambian movimientos ni saldos.

TypeScript, ESLint, 258 pruebas y 8 auditores pasan. Metro respondió HTTP 200 con
el marcador y los textos del nuevo diseño. La captura visual del emulador agotó
el tiempo incluso al reintentar; no se guardó ninguna categoría de prueba.

**Sigue/falta:** comprobar la apariencia directamente en el emulador. No requiere
APK/AAB porque no hay cambios nativos.

## 22/10/2026 — nueva categoría en el panel de Presupuestos (desarrollo)

Presupuestos abre el formulario de categoría dentro del panel inferior
reutilizable, sin otra pantalla ni selector intermedio. Cancelar, X o Atrás
cierran el panel; al guardar se conserva el alta actual y se vuelve a Presupuestos
con la categoría lista para asignarle un límite vacío. No se cambian movimientos,
saldos ni categorías existentes.

La regresión falla contra la versión previa y pasa con el cambio. TypeScript,
ESLint, 258 pruebas y 8 auditores pasan; la prueba dirigida se repitió tras
añadir el caso de Atrás. No se pudo revisar visualmente el emulador: la captura
de su ventana agotó el tiempo y no se reemplazó el Metro activo en 8081.

**Sigue/falta:** revisar visualmente en Android cuando la ventana del emulador
se deje capturar. Sin cambios nativos; no requiere APK/AAB.

## 22/10/2026 — presupuestos por categoría compactos (desarrollo)

El diseño nuevo quedó aplicado tanto en Reportes (la tarjeta que aparecía en la
captura) como en la pantalla que edita los límites. Gasto y límite ya no van
pegados; el límite queda a la izquierda y la barra usa el color de su categoría.
El porcentaje señala el estado con color; montos largos se conservan sin reducir
su letra. Se aumentaron un poco el título, nombres, límite e iconos, y se dio más
contraste a la línea que separa categorías. No se cambian movimientos, saldos ni
cuentas. La prueba ejecuta ambas pantallas y valida montos grandes, colores,
divisor, tamaños y edición del límite.

TypeScript, ESLint, la prueba directa de ambas pantallas y 258 pruebas/8
auditores pasan. `git diff --check` también pasa.

**Sigue/falta:** confirmar visualmente la tarjeta en el emulador. La app de
desarrollo está instalada, pero el puerto 8081 ya tiene un Metro activo y no se
confirmó que pertenezca a este proyecto, así que no se reemplazó. Sin cambios
nativos; no requiere APK/AAB.

## 22/10/2026 — retirada de la vista de prueba de Reportes (desarrollo)

Se quitó el botón «Probar 12 meses y 31 días», las cifras sintéticas que
alimentaban el calendario diario y los totales de muestra de la comparativa
mensual. Las gráficas quedan conectadas únicamente a los movimientos reales;
no se alteran movimientos, saldos, filtros ni cálculos. Se eliminaron también
los textos del modo de prueba en los tres idiomas. Una regresión comprueba que
el botón y los generadores ya no estén.

**Sigue/falta:** verificar TypeScript, ESLint y las pruebas completas. Sin
cambios nativos; no requiere APK/AAB.

## 22/10/2026 — método de desbloqueo sin activar el candado dentro de la sesión

Corregido un falso bloqueo: cambiar la preferencia huella/PIN emitía el mismo
aviso que los cambios del candado y podía mostrar el PIN de inmediato dentro
de Fino. Ahora actualiza únicamente el método que se usará la próxima vez; el
guardado/apagado del candado mantiene su ruta protegida y las respuestas viejas
no pisan una selección más reciente. No cambia el PIN ni el margen de seguridad.

La regresión reproduce el fallo con `ecae5063` y pasa con el arreglo; verifica
también el aviso que envía la preferencia guardada. TypeScript, ESLint,
`git diff --check` y 257 pruebas/8 auditores aprobados. Sin credenciales,
movimientos ni saldos reales. Sin código nativo: no requiere APK/AAB.
**Sigue/falta:** comprobar el ajuste visualmente en Android; el emulador no se
abrió porque la herramienta de pantalla no presentó su ventana nativa.

## 22/10/2026 — comparativa mensual táctil (desarrollo)

Reemplaza la gráfica mensual de gastos por doce meses del año seleccionado,
seis por página con desplazamiento táctil horizontal. Al tocar un mes aparece
su ingreso y gasto; «Comparar meses» conserva esa selección y pide tocar solo
un segundo mes. Los dos valores usan una escala común; los meses sin movimientos
siguen visibles y al elegir uno aparece un solo aviso breve bajo la división.
Se quitaron las flechas y el texto de ayuda; dos puntos discretos muestran qué
grupo está visible. Los nombres y barras de los meses se hicieron un poco más
grandes; también el título e importes. El botón de comparar es un poco mayor y
su texto/borde se ven mejor sin dejar de ser compacto. Las transferencias
internas no cuentan. Cálculo local
derivado, sin alterar datos financieros ni permisos. Marca
`22oct-comparativa-mensual-tactil`.

Verificado: TypeScript, ESLint, `git diff --check`, 257 pruebas y 8 auditores.
El servidor de desarrollo generó el paquete actual. No se modificaron
movimientos ni saldos. **Sigue/falta:** comprobar visualmente
el gesto táctil en el emulador habitual cuando Fino esté desbloqueado. Sin código
nativo, no requiere APK/AAB.

## 22/10/2026 — ajuste visual del calendario diario (desarrollo)

«Gastos» se alinea junto a la división central y el importe sigue a la derecha;
se aumenta el contraste de las líneas divisoria y superior. Sin cambios de
cálculos, datos, ni código nativo. TypeScript, ESLint y 256 pruebas con 8
auditores aprobados. **Sigue/falta:** revisión visual en el emulador habitual; no requiere
APK/AAB/OTA ni publicación.

## 22/10/2026 — calendario de Gastos diarios (desarrollo)

En Reportes, el gráfico de barras diarias se reemplaza por un calendario
compacto de lunes a domingo. Los verdes indican la intensidad del gasto y tocar
un día muestra ingresos en verde y gastos en rojo, ambos en sus lados; si falta
uno, se aclara «Sin ingresos»/«Sin gastos». Sin operaciones ese día se muestra
«Sin movimientos». El día más reciente con actividad queda seleccionado al abrir;
en meses vacíos se selecciona hoy (o el día 1 si es un mes pasado). Los importes
largos conservan su tamaño y pueden ocupar dos líneas; no se achican. Se usa el
formateador monetario existente. No hay lista extra ni fecha repetida. Las
flechas actualizan el mes común de Reportes y se conserva el selector mensual.

Se usan los movimientos ya cargados, agrupados sin transferencias internas; no
se crean, editan, borran ni persisten datos. Vista previa de desarrollo queda
sintética y separada de los datos reales. Cambios solo JS/TypeScript: no requiere
compilación nativa ni nuevos permisos/servicios; `PLAYSTORE.md` no cambia.
La comprobación de pantalla en el emulador habitual quedó pendiente: la captura
de Windows expiró, así que no se navegó ni se tocó la cuenta. Sin APK/AAB/OTA,
publicación o despliegue.

TypeScript, ESLint y `git diff --check` aprobados; lote completo: 256 pruebas y
8 auditores, todos en verde.

## 22/10/2026 — activación sin tercera petición de PIN (desarrollo)

Marca `22oct-pin-sin-tercera-vez`. Crear y confirmar PIN ya no provoca otra
autenticación inmediata: guardado confirmado se distingue de un cambio genérico,
con autorización temporal en memoria solo para esa sesión abierta. Privacidad,
lectura, reinicio, errores, cambio de configuración, salida y margen conservados.
Sin cambiar PIN/datos reales ni escribir un margen ficticio en disco.

Prueba original ampliada verde y roja contra 60f1f38a (antes reaparecía la
cubierta PIN), panel/privacidad/margen aprobados. **Sigue/falta:** activación real
personal en Android, sin automatizar ajustes de seguridad ni usar credenciales;
sensor biométrico no disponible en el emulador. Sin código nativo, APK/AAB/OTA,
publicación o despliegue. Calendario diario pendiente.
TypeScript, ESLint y lote completo aprobados: 254 pruebas y 8 auditores con
tarjetas excluidas. Servidor local de desarrollo activo.

## 22/10/2026 — configuración de bloqueo en panel inferior (desarrollo)

Marca `22oct-bloqueo-panel-compacto`. Panel compacto sobre Ajustes con entrada
desde abajo, X/fondo y ayuda inline; PIN se crea/comprueba sin otra pantalla.
Lectura pendiente, guardado y doble toque protegidos. Borradores se cancelan sin
escritura; desbloqueo global y PIN guardado intactos. Nota de huella no disponible
y ayuda corregida (dos minutos reales; no recomendar reinstalar ni garantizar
restauración completa desde nube).

Regresión original de panel/ruta/guardias verde y roja contra 5ec3de48;
TypeScript, ESLint, 254 pruebas y 8 auditores aprobados con tarjetas excluidas.
Emulador habitual: apertura, cierre/reapertura con X y Atrás y expansión de ayuda
confirmados por árbol Android, con Ajustes detrás y sin cambiar seguridad ni
dinero. Captura Windows falla y Android negra; no se desprotegen capturas ni se
acredita verificación de píxeles. Recarga final de textos mantiene cubierta PIN.

**Sigue/falta:** sensor biométrico real (no disponible en el emulador), prueba
personal de autenticación y configuración con hardware; no se usa PIN del
usuario ni se automatizan esos ajustes. Activar/desactivar solo con datos de
prueba. Sin código nativo, APK/AAB/OTA, publicación o despliegue. WhatsApp real
con archivo en chat continúa pendiente.

## 22/10/2026 — bloqueo con PIN solo alternativo (desarrollo)

Marca `22oct-bloqueo-huella-pin-alternativo`. Huella/cara al abrir cuando está
disponible y habilitada; teclado PIN solo al elegirlo, cancelar/fallar o carecer
de biometría. Sin controles duplicados ni segunda confirmación después del
acierto. Se conservan PIN existente, preferencia, espera progresiva, cubierta,
protección de pantalla y margen. Respuestas atrasadas/configuración/salida al
fondo protegidas y cifras incorrectas no reenviadas al terminar la espera.

Prueba nueva sobre guardián/JSX y solicitud Expo originales, roja en d1be8fd8;
253 pruebas y 8 auditores aprobados, tarjetas excluidas. Datos/credenciales
ficticios en pruebas; el usuario desbloqueó personalmente el emulador y se
observó Inicio sin segunda petición. Ajustes muestra el nuevo texto «Entras con
tu PIN», pero no ofrece biometría. Se revisó su árbol Android tras dos capturas
Windows fallidas; sin alterar protección, PIN, preferencias ni dinero.

**Sigue/falta:** autenticación biométrica/cancelación nativa reales en dispositivo
con huella o cara registrada; configuración/autenticación corresponde al usuario,
no se automatiza ni se usa su PIN. Sin revisión de píxeles/sensor físico ni
medición FPS. Sin cambios nativos, APK/AAB/OTA, publicación o despliegue. WhatsApp
con adjunto en chat real continúa pendiente.
TypeScript y ESLint de la versión final aprobados.

## 22/10/2026 — WhatsApp visible, botón y voz con contacto (desarrollo)

Marca `22oct-whatsapp-chat-boton-voz`. WhatsApp deja de desaparecer de Exportar
movimientos cuando no está instalado. Aviso de instalación, destinatario claro y
botón «Abrir chat en WhatsApp». Botón/voz requieren contacto único y teléfono
normalizado antes de crear el archivo; un fallo ya no abre un selector general.
Abrir la aplicación no confirma entrega. Sin cambios nativos, datos o saldos.

Regresión específica verde y roja contra aaf14ea2; flujo original y orden de
voz con datos ficticios. Árbol Android del emulador habitual confirma los nuevos
controles y aviso; botón tocado sin abrir otra app. Capturas Windows agotadas y
Android negra: sin comprobación visual de píxeles. No se enviaron archivos ni se
guardaron contactos o movimientos. **Sigue/falta:** WhatsApp no está instalado;
chat real con adjunto y reconocimiento de voz nativo no comprobados. Bloqueo
huella/PIN pendiente, sin cambios. Sin APK/AAB/OTA o publicación.
TypeScript, ESLint, 254 pruebas y 8 auditores aprobados; avisos en tres idiomas.

## 22/10/2026 — reporte alineado con Personal, sin borrar movimientos (desarrollo)

Marca `22oct-reporte-coincide-personal`. PDF/CSV/XLSX usan la misma regla de
visibilidad de Inicio para recibos antiguos de Ahorro; los datos guardados y sus
saldos no se modifican. Manual/automático conservan el espacio seleccionado y
las transferencias reales de Familia/Cajas. El disponible exportado descuenta
las reservas de metas igual que Inicio; solo lee esas metas, no las modifica.
Si falta el espacio elegido, la pantalla ya no vuelve sola a Personal ni crea
un reporte con ese otro libro. Prueba ampliada roja contra 7b8aa9ea
y verde actual; selección original, cuatro espacios, tres filtros/formatos,
pantalla y fondo con entradas/salidas adaptadas, sin datos reales alterados.

Emulador habitual: documento revisado con un ingreso S/100, presupuesto S/50,
disponible S/150 y total S/100; desaparece del reporte el antiguo total S/84.
No se enviaron archivos ni se guardaron operaciones. Se volvió a cargar la app
completa tras detectar una copia de desarrollo incompleta, sin borrar datos;
Inicio vuelve a S/150. TypeScript, ESLint, 254 pruebas y 8 auditores aprobados.
Reservas activas/cumplidas, disponible negativo, meses y espacio ausente
comprobados con datos ficticios. **Sigue/falta:** conversión nativa, entrega
programada y envío real por WhatsApp no probados.
Sin APK/AAB/OTA, publicación o cambios en Firebase.

## 22/10/2026 — PDF con base y movimientos agrupados (desarrollo)

Marca `22oct-pdf-base-movimientos`. Resumen compacto compartido por Exportar
movimientos, vista previa/PDF para WhatsApp y exportación automática en pantalla
o segundo plano. Base del mes opcional (presupuesto/saldo anterior), movimientos
con ingresos/gastos presentes y un solo saldo disponible al pie; sin campos
ausentes, cifras repetidas ni abreviaturas de montos. Sin cambios en cálculos,
datos, destinos, programación, CSV ni XLSX.

Regresión específica verde y roja contra e66fede0 sin el diseño; TypeScript,
ESLint, 254 pruebas y 8 auditores aprobados. Cuatro PDF sintéticos impresos y
revisados en Chromium. Emulador habitual recargado y vista previa real revisada:
presupuesto S/50, ingreso S/100, saldo S/150; se dejó abierta sin enviar archivos
ni modificar movimientos. WhatsApp no está instalado allí: por eso no aparece
su botón, no porque se haya retirado la función.

**Sigue/falta:** conversión PDF nativa, entrega programada y envío real por
WhatsApp. Huella/PIN no se cambió. Sin APK/AAB/OTA, publicación ni despliegue de
servicios Firebase.

## 21/10/2026 — metas con S/0 y devolución al anular gasto (desarrollo)

Marca `21oct-ahorro-gasto-anulado-meta-cero`. Primer aporte opcional explicado;
meta con S/0 conservada y sin tarjeta financiera hasta aportar. El borrado de un
gasto guarda también su anulación en la misma meta, sin cambiar la reserva ni
crear filas: la tarjeta muestra lo devuelto a Personal. Copias anteriores,
reintento y gasto restaurado protegidos. Regresión original/SQLite roja contra
e2858044 y verde con el cambio, incluidos fallo y respuesta perdida.

Emulador habitual: formulario real con nombre/objetivo y aporte vacío habilita
Guardar; se canceló sin crear ni cambiar datos. El ciclo financiero se ejercita
con datos sintéticos. TypeScript, ESLint, 254 pruebas y 8 auditores aprobados.
Pendiente revisión de casos históricos borrados sin vínculo conservado; no se reconstruye dinero. Sin APK,
AAB, OTA, publicación ni despliegue de Firebase.

## 21/10/2026 — resumen de ahorro en Personal y Ahorro (desarrollo)

Cada meta tiene una tarjeta acumulada en Ahorro y una en Personal. Ahorro muestra
lo recibido desde Personal, el objetivo, las devoluciones y lo que queda en la
meta; Personal muestra lo enviado y lo que volvió. Cada cifra tiene etiqueta y
color. Aportar/devolver actualiza la misma tarjeta y no genera nuevos
movimientos. Las compras reales conservan su gasto único. El tipo de cada cambio
se guarda en el registro existente de la meta para separar devolución de gasto
y conservarlo al unir copias viejas de nube.

Regresión específica, TypeScript, ESLint y lote completo (254 pruebas y 8
auditores) aprobados. **Sigue pendiente** la revisión visual en el emulador
habitual: la herramienta de pantalla no pudo conectarse («Trusted RPC service
is not configured: sky»); no se abrió ni alteró el emulador. Sin APK/AAB/OTA ni
publicación.

## 20/10/2026 — Ahorro separado en Metas y Movimientos (desarrollo)

La pantalla ahora alterna entre «Metas» y «Movimientos» con dos botones
compactos. Metas conserva las tarjetas y acciones. Movimientos presenta un
resumen actualizado, con una fila por meta y sus montos ahorrado/objetivo; los
aportes y devoluciones no crean filas adicionales. El saldo disponible de
Personal sigue visible arriba. Los gastos reales desde una meta siguen siendo
un solo gasto. No cambia ni migra datos. Regresión roja antes del cambio, luego
TypeScript/ESLint y 254 pruebas/ocho auditores aprobados. `CODE_MARKER` actualizado.
Sin APK/AAB/OTA/publicación.

**Sigue/falta:** revisión visual en el emulador habitual; la captura expiró dos
veces y no se realizaron acciones financieras. No se genera APK por este cambio.

## 20/10/2026 — ajustes de flujo de Negocio (desarrollo)

Marca `20oct-categoria-compacta`, base `3f822e32`. Al crear un negocio
aparece una configuración inicial con el destino de Yape, el interruptor de
combinaciones y el acceso a crear categorías; ambas preferencias se pueden
ajustar después desde Opciones. El registro abre categorías desde una tarjeta
compacta en la fila de la indicación; «Nueva categoría» resalta como acción.
Cantidad permite flechas y escritura directa (1–50). Movimientos muestran hora y origen bajo el nombre,
importe verde/rojo sin tarjeta de fondo y método de pago en su propia etiqueta.

No cambia datos guardados, saldos, permisos, reglas de captura ni categorías
históricas. La regresión nueva pasó con tienda y categoría ficticias y fue roja
contra la versión anterior. Sin APK/AAB/OTA ni publicación. En el emulador
habitual se revisaron el importe sin recuadro, los movimientos y las flechas;
se canceló el formulario. No se creó una tienda real: el paso posterior se probó con estado
ficticio. La lectura financiera quedó idéntica antes/después. TypeScript,
ESLint general y pruebas/auditores sin tarjetas: resultado final anotado en
ESTADO.md.

**Sigue/falta:** probar un Yape real abierto/cerrado y en un segundo dispositivo,
y preparar la entrega instalada en teléfonos cuando se solicite. Metas continúa
en pausa; tarjetas fuera.

## 19/10/2026 — Negocio compacto integrado (desarrollo)

Marca `19oct-negocio-compacto-real`, base 77f7486f. La maqueta pasa a componentes
nativos y registros reales: solo Ingresos/Gastos, selector de negocios, registro
rápido/formularios en una hoja, categorías y modo simple, Yape identificado,
Por clasificar coloreado, selección/borrado confirmado y filtros. Hoy/Mes/Fechas,
calendario y Ver todo dentro de Fechas. Interfaces anteriores retiradas;
enlaces antiguos conservados como aliases puros al panel vigente.

Categorías nuevas se copian al ingreso; no se reescriben importes ni productos
antiguos. Captura abierta/en fondo usa una regla común y acotada. Ambigüedad
queda pendiente, no se inventa una venta. Manual/automático solo se unifican
con confirmación expresa; importe igual no significa pago duplicado.
No se cambia el libro de Personal/Familia/Cajas ni Metas, ni permisos nativos.

**Sigue/falta:** recepción Yape real abierto/cerrado, otro dispositivo y entrega
a teléfonos/Play. Es desarrollo local, no APK/AAB/OTA ni publicación Firebase.
Comprobado en Medium_Phone habitual, Metro 8081: marca nueva en Información,
Hoy/Mes y Ver todo, calendario/selección de fecha, Por clasificar activado y
desactivado, selección de una sola fila y confirmación de borrado cancelada,
Registrar/otra cantidad/métodos/Volver, filtros y Crear negocio cancelado.
No se guardaron formularios ni se modificó el destino de Yape.
Comparación local EXACTA antes/después: 51 movimientos de Personal, 260 marcas,
un negocio, un producto, una venta histórica, nueve movimientos de Negocio,
presupuestos, arrastres, Metas, Cajas y devoluciones pendientes idénticos.
Negocio conserva S/395,50 en el mes; Personal S/100. La cuenta real no recibe
datos de ejemplo. Evidencia privada en .tmp, excluida de Git.
TypeScript/ESLint completos aprobados; 252 pruebas y ocho auditores aprobados
(tarjetas excluidas). Regresiones de interfaz/encabezados repetidas tras usar
Set para selección, evitando búsquedas cuadráticas en listas grandes.

## 19/10/2026 — Regreso a Personal sin reconstruir Inicio (desarrollo)

Marca `19oct-regreso-personal-sin-remontar`, base 5b73fb28. Se conserva UN
Inicio al salir; Familia/Cajas se sustituyen entre sí. Cambio con navegador
raíz real, destino resuelto contra el árbol actual, sin duplicados por un toque
saliente. Atrás, entrada directa, doble toque y reintento conservados. Sin
congelar datos financieros, precargar tres pantallas ni añadir dependencias.

Tres puntos completados: medir desde toque, corregir la reconstrucción y
comparar. Android habitual, A/B/A/B en misma compilación, 48 cambios. Diez
regresos medidos por variante: mediana 2.287,4→1.099,5 ms (51,9 % menos).
Intervalo de cuadro de hasta 121,2 ms: cifras aproximadas, no FPS. Rangos,
pasadas completas, limitaciones y evidencia de clave conservada en ESTADO.md.
Salidas a Familia/Cajas todavía variables; no se afirma mejora universal.

Sonda y variante anterior retiradas antes de entregar. Marca nueva comprobada,
Crear/Cancelar y Atrás revisados. Datos locales/remotos idénticos (50/260 y
demás campos financieros). TypeScript/ESLint y 250 pruebas/ocho auditores
aprobados; regresión con navegador original roja en 5b73fb28 por recrear Inicio.

**Sigue/falta:** FPS sostenidos/versión final, listas pobladas y pendientes
financieros anteriores. Metas en pausa, tarjetas fuera. Sin APK/OTA/Play/Firebase.

## 19/10/2026 — Evitar guardados idénticos de Cajas (desarrollo)

Marca `19oct-cajas-sin-guardado-repetido`, base 4d169115. Solo las copias
diferidas idénticas de Cajas evitan cifrado/escritura tras comprobar bytes
actuales v2, sesión y revisión. Guardados inmediatos y lote financiero con
confirmación intactos; cambios, migración, errores y reintentos conservados.
Memoria acotada, sin claves nuevas ni cambios de fórmulas/interfaz/Metas.

Regresión original roja en la base por un cifrado innecesario; casos de fallos,
sesiones, lotes, orden y copia reemplazada. Android habitual: nueve solicitudes,
una escritura; contador retirado, no equivale a ocho cifrados evitados. Datos
financieros locales/remotos idénticos (50 movimientos/260 marcas). Solo navegación.
Medición sin contador: 48,3 antes frente a 49,6/45,2 después; NO prueba subida
estable de FPS. Método/limitaciones y demás evidencias en ESTADO.md.
TypeScript/ESLint generales y 249 pruebas/ocho auditores aprobados (sin tarjetas).

**Sigue/falta:** tirones restantes y medición representativa/final; pendientes
financieros previos abiertos. Metas en pausa, tarjetas fuera. Sin APK/OTA/Play/Firebase.

## 19/10/2026 — Paneles cerrados más ligeros (desarrollo)

Marca `19oct-navegacion-paneles-ligeros`, base 4c4564d5. Selector mensual sin
saldos/conteos/filas mientras está cerrado; avisos de borrar/campana y hojas de
Familia/Cajas sin construir contenido oculto. Abiertos usan datos actuales y
conservan controles, candado, guardado y preparación. Sin cambios financieros,
rutas, consultas, dependencias ni Metas.

Regresión con originales roja en 4c4564d5 por cálculo mensual innecesario.
Android habitual: navegación, selector y Crear/Cancelar revisados. Los 50
movimientos/260 marcas y demás campos financieros locales/remotos son idénticos
antes/después. No se guardó ni borró dinero o espacios de prueba.

FPS de desarrollo NO mejorados de forma demostrable: antes 38,1/41,1; después
12,3/37,7/30,4; alternado en misma compilación A 39,6/39,2 frente a B 40,6/33,9.
No se omiten las pasadas peores. Método/limitaciones en ESTADO.md; opción de
comparación temporal retirada. TypeScript/ESLint generales y 248 pruebas/ocho
auditores aprobados (tarjetas excluidas).

**Sigue/falta:** tirones, medición representativa/final y pendientes financieros
de la tanda anterior. Metas en pausa, tarjetas fuera. Sin APK/OTA/Play/Firebase.

## 19/10/2026 — Pruebas financieras en Android habitual y aviso de borrado (desarrollo)

Marca `19oct-pruebas-espacios-aviso-claro`, base 11efc55b. Únicamente emulador
habitual, cuenta conservada y Metro 8081. Recorridos reales de Familia, Caja
privada y compartida con dinero Personal/externo, aportes posteriores, gasto,
invitación/conversión, devolución, selección/borrado y cierre. Caja poblada
conservada tras cerrar/reabrir Fino. No se reprodujo duplicación ni formulario
antiguo en los casos ensayados. No equivale a probar todos los fallos de red.

Se corrige «Borrar todos» al eliminar un solo movimiento y su plural incorrecto
en tres idiomas. Regresión con aviso/traducciones originales roja en 11efc55b;
aviso nuevo comprobado en Android. Sin cambio de lógica financiera ni API.

Datos previos conservados: 50 movimientos idénticos en teléfono/nube y saldo
inicial restaurado. Solo se retiraron los registros nuevos `Prueba … 19oct`;
ocho marcas de recibos de prueba adicionales, sin espacios activos al terminar.
Presupuestos/arrastres/Metas intactos. TypeScript/ESLint y 247 pruebas/ocho
auditores aprobados (sin tarjetas). No se entrega APK ni publica una actualización.

**Sigue/falta:** segundo participante, fallos de red, recuperación durable y
anulación remota parcial; perfilar navegación/FPS, sin mejora nueva medida.
Metas en pausa, tarjetas fuera; ningún despliegue Firebase/Play.

## 18/10/2026 — Consultas únicas en curso y guardado identificado (desarrollo)

Marca `18oct-espacios-consultas-unicas`, base f305bf0f. Familia/Cajas comparten
lecturas todavía pendientes solo en la misma cuenta/sesión/revisión; Actualizar
inicia una nueva y ninguna respuesta antigua confirma datos en otra pantalla.
Lista Familia sin consultar miembros invisibles y saldos de otras familias en
paralelo; conciliación Personal continúa esperando confirmación completa.
Hoja de movimientos con indicador en Guardar y campos/cierre bloqueados al
confirmar. Sin cambios de cálculos, persistencia o dependencias.

246 pruebas/8 auditores sin tarjetas, TypeScript/ESLint generales; dos regresiones
originales rojas en f305bf0f por duplicación de consultas y guardado sin indicador.
Marca comprobada visualmente en el emulador. Datos financieros locales/remotos
idénticos antes/después (50 movimientos, 252 marcas), sin guardar dinero;
sesión sin espacios activos. FPS de desarrollo: dos pasadas 46,0/36,4 frente
a la anterior 42,7, con variabilidad/tirones. La segunda incluye la muestra
de cuatro cuadros; presentación no distingue pausas sin cambios de cuadros
perdidos. NO acredita mejora estable ni 60 constantes.

**Sigue/falta:** perfilar tirones y comparar de forma controlada en emulador y
versión final con datos representativos; pendientes financieros anteriores sin
cerrar. Metas en pausa, tarjetas fuera, deslizamiento no añadido. Sin entrega
APK/AAB/OTA/Play ni despliegue de Firebase.

## 18/10/2026 — Cambio de espacios con menos redibujados (desarrollo)

Marca `18oct-espacios-menos-redibujado`, base dafc53f. Cajas mantiene la
misma lista/saldos ante respuestas iguales para no reiniciar sus oyentes;
primera lista vacía confirmada conservada. Familia/Cajas reutilizan agrupados
cuando no cambian sus fuentes. Filas de Personal sin entrada escalonada al
regresar. Sin deslizamiento, nuevas dependencias, pantallas retenidas ni cambios
en saldos, guardado o confirmaciones financieras; Metas y tarjetas fuera.
Nueva regresión con originales/React/IO adaptados roja en dafc53f por trabajo
repetido. Conteos de cálculo/suscripción no equivalen a FPS de un APK final.
244 pruebas/8 auditores sin tarjetas, TypeScript y ESLint completos aprobados.
Emulador con código actual: regreso entre secciones y listas conocidas revisados;
50 movimientos/252 marcas y datos financieros locales/remotos idénticos antes
y después, Metas intactas, ningún formulario guardado. La sesión no tenía espacios
activos: detalle poblado cubierto con adaptadores, no un ciclo financiero Android.

**Sigue/falta:** medición comparativa final en Android físico con datos
representativos; pendientes financieros anteriores conservados. No se publica
APK/AAB/OTA/Play ni Firebase en esta tanda.

## 18/10/2026 — Aportes confirmados al salir y reintento único (desarrollo)

Marca `18oct-aportes-cambio-seguro`, base 655f076. Crear Familia con dinero
Personal, agregar y editar aportes confirman su contraparte aunque se haya
salido de la pantalla, sin trasladarla a otra cuenta/sesión. Agregar desde
Personal conserva la misma orden/ID al perder la respuesta; después de confirmar
el destino, un fallo local reintenta solo el débito. Rechazo definitivo libera
el formulario también durante el reintento. Metas queda pendiente por petición
expresa, sin cambios en su cálculo ni datos. No hay campos persistentes o
servidor nuevos. Una confirmación pendiente identifica su Familia y no se
ejecuta como si perteneciera a otra familia o a una creación nueva.

Regresión original roja contra 655f076, confirmaciones tardías, doble toque,
fallos y ciclo controlado S/500→400→500, sin ingreso duplicado ni resurrección
de una devolución anulada. React/SDK/almacén adaptados: no dinero real.
243 pruebas/8 auditores sin tarjetas y TypeScript/ESLint generales aprobados.
Emulador con servidor actual, formularios Familia/Caja abiertos y cancelados.
Comparación financiera local/remota sin diferencias: 48 movimientos, 234 marcas,
metas y saldos de Familia/Cajas intactos. Sin confirmaciones monetarias reales.

**Sigue/falta:** prueba financiera real con cuenta autorizada y segundo
dispositivo, recuperación de altas inciertas tras cierre del proceso y fallo
entre anulaciones remotas. Datos iniciales antiguos no se reconstruyen.
Sin APK/AAB/OTA/Play, despliegue Firebase o tarjetas; Metas en pausa.

## 17/10/2026 — Devoluciones y anulación al cambiar de sección (desarrollo)

Marca `17oct-devolucion-cambio-seguro`; base 2d97a63. La confirmación remota
de una devolución se aplica a Personal aunque se haya abandonado su pantalla;
cuenta/sesión/moneda y marcas de borrado siguen protegidas. Se invalidan copias
financieras anteriores y se evita conciliar durante una modificación en curso.
Mismo cuidado para la contraparte de borrados confirmados. No es un lote remoto
atómico y no reconstruye movimientos antiguos.

Retirado Enviado S/0 de devoluciones solas. Avisos diferenciados entre quitar
historial de Personal y anular registros/saldos en Familia/Cajas. Selección
confirma antes de borrar y Caja compartida permite anular un grupo propio con
orden seguro. Indicadores de actualización separados del trabajo monetario.

242 pruebas/8 auditores sin tarjetas y TypeScript/ESLint generales aprobados;
dos regresiones rojas contra 2d97a63. Emulador recargado, navegación/aviso
cancelado/actualización comprobados sin mover dinero. Comparación financiera
local/remota idéntica: 48 movimientos, 234 marcas y metas intactas.

**Sigue/falta:** reserva de metas al aportar a Familia/Cajas, ciclo financiero
real con cuenta de prueba autorizada y segundo teléfono, y origen del importe
inicial antiguo. Sin APK/AAB/OTA/Play ni despliegue remoto; no auditoría global
cerrada. Evidencias privadas permanecen fuera de Git.

## 17/10/2026 — Selección individual, Editar único y borrado antiguo explícito (desarrollo)

Marca `17oct-ahorro-seleccion-individual`; base 781887d. Retirado Editar meta
duplicado, conservado Editar del menú. Una fila de ahorro/ordinaria selecciona
solo ella; los resúmenes solo incluyen su mismo espacio, tipo y fecha.

Dos devoluciones antiguas de familias cerradas tenían sus aportes ya eliminados
de Personal y no podían quitarse. Se habilita borrado real solo con cierre,
asignaciones exactas, aportes ausentes y marcas de eliminación; revalidación en
el lote y aviso de reducción del disponible. No es ocultación ni recreación.
Con autorización expresa se eliminaron únicamente S/50 de uu y S/12 de 12:
Personal S/62→S/0, otros movimientos/meta intactos. Nube confirmó el borrado;
comprobantes de las familias cerradas conservados y sin Deshacer automático.
Cerrar/reabrir conserva S/0 y las dos marcas confirmadas en nube; dos Cajas
compartidas activas revisadas solo en lectura, sin alterar sus saldos.

240 pruebas/8 auditores sin tarjetas y TypeScript/ESLint completos aprobados.
Regresiones rojas contra 781887d por selección de todo el día y bloqueo antiguo.
Pruebas con SQLite incluyen fallos/reinicio; selección y borrado real comprobados
en el emulador. FPS medidos al desplazar Ajustes: 38,1–38,3 en tres muestras,
pantalla 60 Hz, build de desarrollo; no cifra de APK final ni toda la app.

**Sigue/falta:** rendimiento de versión final en teléfono real, restauración
en segundo teléfono y antiguos de hj. Sin APK/AAB/OTA/Play, despliegues remotos
o tarjetas; no cierre de auditoría global. Evidencias privadas fuera de Git.

## 17/10/2026 — Ahorro compacto, edición conjunta y uso del ahorro (desarrollo)

Marca `17oct-metas-edicion-y-movimientos`; base 866b969. Vista única con Saldo
disponible de Personal y En metas; Nueva meta destacado, importes etiquetados
y Editar meta con objetivo/ahorrado juntos. Avisos breves y sin recorte. Una
meta completa mantiene el apartado hasta usarlo o devolverlo expresamente.

Usar ahorro crea una compra normal y baja la meta en el mismo lote, sin ingreso
ni devolución ficticia. Devolver a Personal sigue separado. Guardados cifrados
con reserva, fuentes/sesión vigentes y confirmación; errores no cierran el panel
como si se hubiera guardado. Borrador conserva categoría al abrir/cancelar.

Recibos de Ahorro y pares Familia/Caja completamente devueltos se pueden quitar
del historial visible, conservando respaldo y saldos de todos los meses. Acción
explicada antes de confirmar; no borra transferencias incompletas/consumidas ni
reconstruye registros antiguos. Filas violetas de Inicio alineadas y seleccionables;
filtro Ahorro incluye las compras pagadas con metas. Borrado ordinario sin cambiar.

238 pruebas/8 auditores sin tarjetas y TypeScript/ESLint generales aprobados.
Regresiones nuevas contra 866b969 rojas por comportamiento real. Pruebas de lote
con SQLite y originales cubren caída/confirmación perdida/restauración y varios
meses; no sustituyen la escritura financiera en Android físico. Revisión visual
del emulador sin guardar aportes, compras, retiros ni borrados; mismos registros,
dos metas, S/49 apartado y S/13 disponible.

**Sigue/falta:** ciclo financiero guardado/restaurado con cuenta desechable
autorizada y segundo teléfono; integración de transferencias con lo reservado
y casos antiguos de hj aparte. Sin APK/AAB/OTA/Play ni despliegue Firebase;
entrega de desarrollo mediante Metro, no cierre de auditoría global.

## 16/10/2026 — Nube: copia antigua comprobada y pausa inmediata (desarrollo)

Marca `16oct-nube-copia-interruptor`; base 8f0d1ec. Tres transferencias de la
copia v1 carecían de sus referencias nuevas. Se completan solo después de
comprobar el movimiento original compartido en la misma transacción del
respaldo; sin cambiar importes ni rebajar la comparación general de identidades.
No son los tres casos antiguos de hj, que permanecen documentados aparte.

Interruptor inmediato con persistencia ordenada, último toque y sesión
protegidos; pausa antes de nuevas escrituras v1/v2 y entre filas v2. Recepciones
tardías no reactivan la copia ni aplican datos. Cajas privadas respeta la pausa
automática; colaboración y acciones expresas siguen disponibles. Personal y
Negocio confirman por separado; textos sencillos y reintento de fallo real.

Comprobado en Android/Firebase: 33 movimientos respaldados, cero conflictos
en la unión, marcas de borrado conservadas y mismos saldos. Pausa recordada
tras cerrar/abrir y reactivación Guardando → Copia al día; queda activada.
236 suites y 8 auditores sin tarjetas, TypeScript/ESLint generales aprobados.
Regresiones 8f0d1ec rojas por bloqueo/falsa confirmación, no import faltante.

**Sigue/falta:** restauración completa desde otro teléfono de prueba y corte
real con historial v2; históricos de hj no reconstruidos ni borrados. Sin APK,
AAB, OTA, publicación Play o despliegue remoto; código actual en Metro.

## 16/10/2026 — Cajas: invitación sin duplicados y retirada de recorrido antiguo (desarrollo)

Marca `16oct-cajas-invitacion-sin-duplicados`; base 52a718d. Recuperación de una
conversión confirmada por servidor antes de la fusión ordinaria, comprobando
SHA/dueño/moneda/enlaces y guardando con el lote local existente. Consultas
ordinarias pausadas durante Compartir/Cancelar; actualización ajena no invalida
el origen y volver a Todas no reabre el detalle al terminar. Lista sin doble
representación de la misma conversión, sin borrar cajas por nombre o saldo.

Retirados segunda lista, formulario de unión y apertura por ruta antiguos de
SharedBoxes. El detalle solo se abre desde Cajas, con formulario actual y una
única entrada Unirme. Fila del título estable al ocultar lápiz durante código.

235 pruebas y 8 auditores sin tarjetas aprobados; TypeScript/ESLint generales
aprobados. Regresiones contra 52a718d rojas por comportamientos reales, no por
API faltante. Invitación y selector de compartir comprobados en emulador con
uyyj; sin enviar código a terceros ni hacer movimientos, devolver dinero o
cerrar cajas. No se eliminan registros antiguos ni se cambian saldos.

**Sigue/falta:** conversión nueva/corte real con datos de prueba y unión desde
otra cuenta/teléfono; primera preparación aún depende de Internet. Sin APK,
AAB, OTA, publicación Play ni despliegue remoto; no cierre de auditoría global.

## 16/10/2026 — Cambio de espacio uniforme y ocultación recordada (desarrollo)

Marca `16oct-cambio-suave-saldo-oculto`. Personal, Familia y Cajas comparten
transición lateral opaca, con pantalla anterior debajo de la entrante y sin
fade hacia el fondo. Se iguala el fondo nativo con el estilo real y se respeta
Movimiento reducido. Sin cambios de rutas, controles de acceso o dinero.

Ocultar la tarjeta anterior por mes y ocultar importes ya no se reinician al
volver a Personal: memoria inmediata más preferencia cifrada local por cuenta.
No se revela la tarjeta durante la lectura inicial; Mostrar es explícito. Clave
nueva incluida en archivo/limpieza de cuenta; no se sincroniza con Firebase.

Prueba Android: ocultar tarjeta, ir a Familia/Cajas y volver; permanece plegada
con los mismos importes. Capturas y grabación locales, sin operaciones monetarias.
Regresiones contra a846c19 rojas por tarjeta reabierta y color intermedio distinto.
Resultado final: 234 pruebas/8 auditores sin tarjetas; TypeScript/ESLint completos
sin errores. Grabación Android revisada por muestras de 50 ms sin pantalla
totalmente vacía; no sustituye pruebas en segundo teléfono ni todos los recorridos.

**Sigue/falta:** unión con segunda cuenta/teléfono y pendientes financieros
históricos ya documentados. Sin entrega APK/AAB/OTA/Play ni despliegues remotos.

## 16/10/2026 — Cajas completas al volver, sin carga automática (desarrollo)

Marca `16oct-lista-cajas-completa`. La memoria anterior solo conservaba las cajas
privadas. Compartidas y saldos se olvidaban al salir, por eso «j» aparecía después
de «uyyj». Se conserva también la lista compartida completa, aislada por cuenta
y sesión; actualizaciones automáticas comprueban novedades sin vaciar la lista
ni hacer girar la cabecera. Actualizar manualmente mantiene su indicador.

La retirada confirmada se recuerda y las respuestas tardías se descartan. Sin
copia aún no se enseña una lista privada como si fuera toda la lista. Solo
presentación en memoria: sin disco nuevo, autoridad financiera o cambios remotos.

Emulador: Personal → Cajas muestra ambas tarjetas/saldos sin espera adicional
entre ellas. Solo navegación; ningún movimiento ni dato real modificado.
Prueba nueva falla contra 35ca9d2 por lista compartida vacía en la primera imagen,
no por ausencia de una API. La primera consulta tras reiniciar sigue usando red.
232 pruebas y 8 auditores sin tarjetas aprobados; TypeScript/ESLint completos
sin errores. Evidencia y capturas locales fuera de Git.

**Sigue/falta:** unión real con otra cuenta/teléfono y casos históricos ya
documentados. Sin APK/AAB/OTA/Play, Functions/reglas o nuevos datos recolectados.

## 16/10/2026 — Formulario actual también después de invitar (desarrollo)

Marca `16oct-formularios-familia-cajas`. El detalle compartido aún conservaba un
formulario antiguo dentro del historial: plegarlo durante Invitar no corregía
Agregar dinero después de convertir la Caja. Se sustituye por la hoja actual de
Familia/Caja privada y se conservan categoría, fecha, notas, método y origen.
Crear Caja se muestra debajo de Crear/Unirme, antes de la lista.

La hoja de invitación responde al toque y prepara el código dentro de ella, sin
desplazar el detalle. Cerrar durante la espera no la reabre. Familia no vuelve a
consultar todo el historial para generar el código. Actualizaciones conservan la
copia visible y usan el lugar fijo de la cabecera; la primera consulta real sigue
necesitando conexión. Las comprobaciones financieras no se desactivan.

Emulador con código actual: Caja propia temporal en S/0 creada, convertida,
código real abierto/cerrado y formulario moderno observado; cerrada únicamente
esa Caja vacía al terminar. Ningún movimiento guardado ni saldo preexistente
modificado. Familia «ww» S/400 conserva diseño/historial al abrir/cerrar el código.
231 pruebas/8 auditores sin tarjetas y TypeScript/ESLint limpios. Regresión nueva
falla contra b3676c5 por metadatos descartados en el guardado anterior.

**Sigue/falta:** unión con otra cuenta/teléfono y pendientes históricos ya
documentados. Sin APK/AAB/OTA/Play, servidor/reglas ni cambios de datos recolectados.

## 16/10/2026 — Invitar no muestra el formulario anterior si falla

Si falla la creación del código, la Caja permanece en su vista normal y el
borrador queda guardado. Agregar dinero permite recuperarlo si se desea. El
emulador está conectado al servidor local 8081; falta observar visualmente la
última recarga. Pasaron 230 pruebas/8 auditores, TypeScript y ESLint. No modifica
saldos ni movimientos. Sin APK/AAB/OTA/Play.

## 16/10/2026 — Ocultar el aviso legal mientras comprueba la aceptación

El emulador apunta al servidor local 8081 y este sirve el marcador más reciente.
El aviso legal fugaz aparecía mientras Fino revisaba el recibo guardado en el
propio teléfono. Ahora no se dibuja durante esa comprobación; si falta la
aceptación, el aviso aparece después. Se conserva el recibo y no se tocan saldos
ni movimientos. Falta volver a mirar el cambio en la pantalla. Sin APK/AAB/OTA/Play.

## 15/10/2026 — Invitación limpia en Caja (desarrollo)

Marca `15oct-caja-invitacion-espera-limpia`. Invitar oculta el formulario y los
controles desde el toque. Conserva el borrador sin reabrirlo automáticamente si
falla la petición. No cambia dinero ni sus manejadores.

La prueba visual anterior reprodujo que el formulario seguía durante la carga y
se ocultaba después. El emulador ya sirve el paquete de desarrollo con la marca
actualizada; falta observar visualmente el ocultamiento inmediato de esta versión.
Sigue pendiente la unión desde otra cuenta. No toca los tres pares antiguos de
«hj». Sin APK/OTA/Play ni Firebase desplegado.

## 15/10/2026 — Código sobre el mismo diseño de Caja (desarrollo)

Marca `15oct-caja-mismo-diseno`: corrige la presentación antigua que conservaba
el detalle compartido tras la unificación de listas. Devolución debajo del
saldo, Agregar dinero/Cerrar arriba y movimientos con Seleccionar; Ingreso/Gasto
quedan dentro del formulario, no cambian el fondo al invitar. Acciones y permisos
financieros conservados; no se añade borrado masivo.

Emulador actualizado por el servidor de desarrollo: código real abierto/cerrado
en «ww», S/100, misma caja/historial/diseño antes, detrás de la hoja y después.
Sin operaciones de dinero, conversiones, cierres ni borrados para probar.
230 pruebas/8 auditores sin tarjetas, TypeScript/ESLint sin errores; regresión
9a29f31 falla por la ausencia de Agregar dinero en el diseño anterior.
Evidencia .tmp/caja-mismo-diseno-app-15oct.log y registros asociados, no publicados.

**Sigue/falta:** unión desde otro Android/cuenta y pendientes previos de auditoría.
Sin APK/AAB/OTA/Play, servidor/reglas ni nuevos datos recolectados. No se repararon
automáticamente transferencias antiguas ni se movió Personal.

## 15/10/2026 — Lista única de Cajas e invitación estable (desarrollo)

Marca `15oct-cajas-lista-unica`: sin tarjeta Cajas compartidas ni una segunda
lista/ruta al invitar, unirse o regresar. Cajas existentes permanecen accesibles,
con saldo real y su moneda; Miembros/Invitar arriba como Familia, detalle de
integrantes en la hoja compartida. Cerrar código conserva caja/movimientos.
No se muestra un fallo pendiente durante el intento activo; un resultado
verdaderamente incierto mantiene recuperación y datos protegidos. Indicador en
la cabecera sin desplazar botones, sin texto No repitas la acción.

Invitar no invalida ni reinicia movimientos. La confirmación financiera que
llega durante la creación del código sigue siendo válida; una operación de
dinero conserva sus bloqueos/recarga. Cerrar no aparece durante carga/error.
Selección exacta, consultas tardías/cuenta, miembros, cierre/salida sin tarjeta
reaparecida y regresiones originales verificadas contra 4bc800e.

Android: lista única con las cajas reales; prueba en S/88 ya compartida, dueño1,
historial externo88/aporte100/devuelto100 conservado; código real, Compartir,
cancelación sin destinatario, cierre de hoja sin cambio de caja y regreso a
lista única; Miembros abre su detalle. No se hicieron operaciones monetarias,
cierres/borrados ni conversiones de otras cajas del dueño. Sin APK/AAB/OTA/Play,
servidor/reglas, campos/colecciones nuevos ni tarjetas. Sigue/falta segundo
Android/cuenta real y los pendientes históricos de la auditoría.

Verificación final estable: 229 pruebas y 8 auditores aprobados sin tarjetas,
TypeScript/ESLint completos sin errores/avisos. Registros locales
.tmp/cajas-lista-unica-final-15oct.log y tsc/eslint asociados. Las pasadas
intermedias detectaron contratos antiguos de rutas y un inventario que aún
enumeraba el archivo retirado antes de prepararlo en Git; no fueron finales.

## 15/10/2026 — Cajas utilizables conservando borrados antiguos (desarrollo)

Marca `15oct-caja-historial-conservado`: agrega movimientos, permite devolución
nueva y borrado elegido sin reconstruir las contrapartes Personal antiguas ya
borradas. Cierra solo con saldo cero y aportes liquidados; conserva las marcas
ausentes y liquida lo existente sin otra devolución. No se archiva ni repara
dinero automáticamente. Retirada la oferta Archivar caja y los avisos técnicos
automáticos; revisión solo voluntaria. Invitar «hj» sigue protegido, no se
presenta como resuelto ni se altera la conversión para sortearlo.

Android muestra los botones activos. El propietario confirmó su devolución
manual S/10 durante la comprobación; se dejaron de hacer toques para no cruzarse
con su uso. No se hicieron movimientos/cierres/borrados de prueba en su cuenta.
228 pruebas/8 auditores sin tarjetas y TypeScript/ESLint sin errores/avisos.
Acciones originales/contexto/SQLite: aportes, gasto, devolución única, rollback,
borrado elegido y cierre en cero; regresión 361466b reproduce bloqueo anterior.
Sigue/falta compartir «hj», resolver intención de sus tres casos antiguos y
pendientes de dos Android/diario durable/volumen. Sin APK/AAB/OTA/Play ni servidor.

## 15/10/2026 — Código de invitación y Compartir (desarrollo)

Marca `15oct-codigo-compartir`: la hoja compartida de Familia/Caja ofrece el
código seleccionable, Compartir por el selector del teléfono y Copiar. El mensaje
explica dónde entrar; cancelar no se anuncia como envío ni consume la invitación.
Invitar ya no deriva a detalles financieros cuando la caja privada tiene pares
dudosos; aviso breve, sin quitar la protección. «hj» NO está reparada/habilitada:
sus tres mitades borradas siguen conservadas, no se alteró ningún saldo.

Acceso Cajas compartidas añadido a la lista principal: la Caja convertida no
queda escondida y el invitado no necesita Pro para abrir sus espacios.
15/15 pruebas Firebase locales de invitación: generación/unión originales con
otra cuenta sin Pro, mismo espacio/historial y dinero intacto, consumo único,
permisos/caducidad/cierres. Nueva prueba de hoja original falla en 99d0be2 por
ausencia de Compartir. TypeScript/ESLint completos sin errores/avisos y última
pasada estable 227 pruebas/8 auditores aprobados sin tarjetas. No presentar la
primera pasada con contrato estático de JSX desactualizado como aprobada.
El dueño autorizó usar la Caja S/88 para la prueba real. Verificada compartida:
mismo saldo/historial (externo88, aporte100/devuelto100), dueño, código auténtico,
selector Compartir y cancelación sin envío. Personal antes/después idéntico,
«hj» sigue S/20 privada. No se recrean/deshacen conversiones para simular prueba.
Metro estaba apagado: recuperado oculto Node22/8081 y adb reverse, bundle real
3958 módulos; sin limpiar almacenamiento ni cerrar sesión. La lectura Windows
falló dos capturas; la comprobación se hizo mediante conexión Android.
Sin entrega APK/AAB/OTA/Play ni cambios de servidor/reglas. Sigue/falta «hj»,
prueba Android con dos cuentas y pendientes financieros de la auditoría.

## 15/10/2026 — Respuesta inmediata y revisión de copia (desarrollo)

Marca `15oct-respuesta-inmediata`. Tras confirmar borrar/cerrar, Familia y Cajas
privadas/compartidas retiran la tarjeta visualmente sin esperar servidor/disco.
No cambian libros ni saldos antes del ACK; si falla, la tarjeta vuelve y se
conservan las protecciones y el aviso. Es una presentación temporal por sesión,
no una garantía nueva de recuperación tras cerrar el proceso.

Se añadió consulta solo lectura de la copia de los casos antiguos. Android
con sesión real confirmó marcas de borrado en los TRES casos «hj»; el dueño no
recuerda su intención. No se restauran, eliminan ni archivan; S/20 conservado.
La otra Caja mantiene S/88. El resultado queda abierto para consultarlo.
TypeScript/ESLint sin errores/avisos; 226 pruebas y 8 auditores (sin tarjetas).
Regresión original contra 44859f6 roja porque la tarjeta no se ocultaba antes
de la respuesta. Pruebas de rechazo/false conservan libros/saldos originales.

No APK/AAB/OTA/Play ni cambios remotos/nativos. Falta evidencia para resolver
los tres registros con consentimiento, diario durable y recorrido con dos
cuentas/Android. El aviso de System UI del emulador se cerró con Wait: no
reinstalar ni limpiar datos como solución. No cerrar auditoría global.

## 15/10/2026 — Familias sin mezclas y revisión localizada de Cajas (desarrollo)

Marca `15oct-familias-sin-mezclas`: carga prioritaria de la familia elegida,
sin datos temporales de la anterior ni pantalla vacía al crear. Confirmaciones
de borrado retiran la fila/caché sin esperar todas las demás familias; indicador
de proceso y errores sin saldo cero ficticio. La conciliación conserva la
exigencia de todas las lecturas confirmadas y la sesión vigente.

Compartir Caja solo se bloquea por su propia revisión o un problema global;
se conservan fuentes antiguas protegidas al unir nube. Los tres casos «hj» del
02/10 no se borran, restauran ni archivan automáticamente. Aviso corregido en
tres idiomas. Sin datos, permisos o cambios nativos nuevos; sin APK/AAB/OTA/Play
ni despliegue servidor/reglas. Detalle y límites en ESTADO.md y auditoría del día.

Android de lectura: dotero123xc S/100 e ingreso inicial existente, cajas S/88 y
«hj» S/20. Falta recorrido de dos familias/cuentas y altas/borrados Android sin
comprometer datos reales, además de aclarar si los borrados antiguos fueron
intencionales. No declarar la auditoría global terminada por esta entrega.

TypeScript/ESLint sin errores ni avisos; 225 pruebas y 8 auditores aprobados
con tarjetas excluidas. Regresión contra 66e4504 roja por movimientos de A
al elegir B. Los tres casos antiguos se reproducen sin restaurar ni eliminar.

## 15/10/2026 — Activación Firebase real de Familia/Cajas

Código f2573a5, Node22, southamerica-east1: 16 servicios de cuenta/Familia/Cajas
publicados en grupos explícitos, sin Telegram ni SMTP/cron. Reglas activadas
2026-10-15T08:00:28.446830Z, hash local/remoto 360bcda5d08c453db266f5f962f60b4d36ed3737645f72ce253e4153ad342b41.
Blaze activo, campos nuevos de sincronización permitidos y llamada sin sesión
rechazada HTTP401. No se hicieron escrituras financieras de prueba ni borrados
de cuentas del propietario. Las lecturas/guardados auténticos y 2 cuentas no
se deducen de esa prueba sin sesión.

Preparar SOLO con `node scripts/preparar-servidor-cuentas.mjs`: genera config
aislada bajo .tmp conservando funciones originales y sin declaraciones de
secretos Telegram. Desplegar los nombres aprobados en grupos de hasta 8 usando
esa config y proyecto explícito dotero-2d430. Nunca publicar toda la entrada
general de Functions por acompañamiento. El primer intento se detuvo ante
Secret Manager; no se habilitó Telegram como solución. El aviso de artefactos
del primer grupo no significó fallo de creación: los ocho ya estaban activos.

Retención de imágenes técnicas de compilación: 7 días, autorizada por dueño y
aplicada en gcf-artifacts. El dueño aprobó expresamente el hook de limpieza
posterior a eliminar Auth y sus reintentos, tras bloquearlo la revisión inicial;
publicado sin eliminar ninguna cuenta ahora. No es «cerrar sesión».

224 pruebas/8 auditores de app sin tarjetas, 97 unitarias y 245 Firebase locales,
TypeScript/ESLint verdes. La prueba adicional de empaquetado demuestra igualdad
literal de los 16 handlers. Android vuelve a cargar (3957 módulos); Inicio,
Familia y Cajas existentes visibles, «hj» S/20 conservada y Cajas abierta.
Sin registros ficticios ni APK/AAB/OTA/Play. Qué sigue/falta: dinero Android/dos
cuentas, cortes/reinicio entre mitades de aportes, «hj», volumen/coste, tres
decimales legacy, moderación/políticas/alertas y distribución.

## 15/10/2026 — Auditoría Familia/Cajas; preparación verificada

Marca `15oct-auditoria-familia-cajas`. Saldo compartido transaccional, borrado
de ingreso usado protegido, reintentos de sesión sin duplicar y confirmación
de guardado Personal. Fallo de red no oculta espacios; nombres/errores revisados.
TypeScript/ESLint completos, 223 pruebas/8 auditores sin tarjetas, 97 unitarias
Functions y 245 Firebase SDK/reglas/Auth/HTTP estables aprobados. Regresiones
originales ab441d3 rojas por el fallo real. Sin modificar datos del propietario.
Blaze confirmado activo en dotero-2d430; el dueño confirma solo uso en emulador.
Activación de servicios/reglas se comprobará por separado; todavía no es entrega
APK/AAB/OTA/Play ni cierre global. Faltan reinicio entre aportes, dos cuentas,
historiales grandes, fuentes antiguas «hj», tres decimales legacy y moderación.
Detalle: docs/AUDITORIA_FAMILIA_CAJAS_15OCT.md.

## 15/10/2026 — Bloques y conectores corregidos; visible en emulador

Marca `15oct-bloques-conectados`. Todas las categorías del reporte conservan
su bloque, icono y línea. Tamaño mínimo visual explicado; monto/% reales.
Conectores por fuera del anillo sin cruzarse y monto completo debajo con
fmtExact, ancho disponible y alto libre. Gastos/ingresos comparten diseño.
TypeScript, ESLint, 222 pruebas y 8 auditores verdes, sin tarjetas. Regresión
e4e10fd detectada por falta de conectores. Android confirma nueve categorías,
Hogar S/ 1,099 <1% y regreso a S/ 1,383,957; Reportes queda abierto.
Sin movimientos ficticios ni APK/AAB/OTA/Play. Qué sigue/falta: distribución,
físico/letra grande/TalkBack y nativo con ingresos/importes extremos; las cifras
S/ 445,443,876,578 se comprobaron en la suite original, no en una cuenta real.

## 15/10/2026 — Rueda de categorías interactiva; emulador actualizado

Marca `15oct-rueda-categorias`. Reportes muestra iconos grandes y parejos,
sin conectores, total central y selección de categoría con monto/% reales.
Gastos/ingresos comparten rueda; ninguna categoría se agrupa y el anillo deja
de ampliar artificialmente valores pequeños. Capturas reales de Android
confirman gastos, selección de S/ 11 <1% y retorno al total; ingresos vacío
se conserva. Se deja el emulador en Reportes/Gastos con total al centro.
TypeScript/ESLint, 222 pruebas y 8 auditores aprobados; tarjetas excluidas.
No APK/AAB/OTA/Play. Qué sigue/falta: entrega de distribución y revisión física,
letra grande/anchos mínimos y una rueda con ingresos reales por separado.

## 15/10/2026 — Coronas en Ajustes; desarrollo verificado en emulador

Marca `15oct-coronas-ajustes`. Sustituye los textos visibles «De pago» por
coronas en Ajustes, incluida la copia automática de nube. Retira la coronita
superpuesta al beneficio de nube en Premium. No cambia acceso ni respaldo.
TypeScript, ESLint, 222 pruebas y 8 auditores aprobados, sin tarjetas.
Capturas reales de emulator-5554 confirman ambas pantallas actualizadas;
Ajustes queda abierto mostrando las coronas y la nube pausada, sin activarla.
No se generó APK/AAB ni se publicó OTA/Play. Qué sigue/falta: distribución y
compras reales por separado; este ajuste visual ya se ve en desarrollo.

## 14/10/2026 — Rosquilla de Reportes equilibrada; solo código

Se reparte por igual la posición de etiquetas para gráficos de gastos e
ingresos, conservando su orden y los montos/porcentajes reales. Las líneas
tocan el borde del segmento y mantienen su color. TypeScript, ESLint, 222
pruebas y 8 auditores verdes (tarjetas excluidas por decisión vigente).
No se generó APK/AAB ni se publicó OTA/Play. Falta confirmar el dibujo en el
emulador: el servidor local responde, pero la captura de pantalla está bloqueada.

## 14/10/2026 — Planes compactos Plus/Pro; solo código local

Se llevó a la pantalla Premium la maqueta aprobada, sin alterar las funciones
ni los beneficios acordados. Plus S/ 3.60/mes; Pro S/ 9.99/mes o S/ 84/año,
con ahorro calculado de S/ 35.88. Se especifica que son precios propuestos y
que todavía no se puede pagar. Prueba de 24 horas conservada; no se concede
Premium con la selección del plan. TypeScript, ESLint y 222 pruebas/8 auditores
verdes (tarjetas excluidas por decisión vigente).

No se generó APK/AAB ni se publicó en OTA/Play. La captura del emulador se
quedó negra y la ventana no respondió; hace falta verificarla en una sesión
de desarrollo conectada y estable. Compras reales, identificadores de Play y
precios localizados siguen pendientes.

## 14/10/2026 — Tarjetas y cifras completas; desarrollo local

Marca 14oct-pdf-montos-completos. Ajuste solicitado: tarjetas únicas de color,
saldo y presupuesto juntos en UNA tarjeta, también en todos los filtros;
presupuesto solo positivo. Únicamente totales del tipo
elegido. Sin montos abreviados en PDF; moneda y decimales del espacio.
Manual/automática conectadas a las cuentas originales de mes/espacio;
prueba amplía arrastre, transferencias, seis monedas y tres idiomas.
Regresión acf28d9f roja por conducta. PDF sintético revisado visualmente,
no datos de la cuenta del usuario. Guía EXPORTACION_RESUMEN_LIMPIO.
TypeScript/ESLint y 219 pruebas/8 auditores verdes sin tarjetas, también con
Saldo/presupuesto juntos (una suite local ajena; 218 previstas Git limpio).
Qué sigue/falta: exportar/abrir y comprobar convertidor/entrega programada
en Android; redondeo preexistente de acumulados extremos separado en la guía.
Sin APK/AAB/OTA/Play, nativo o servicios remotos publicados.

## 14/10/2026 — Exportación limpia y coherente; desarrollo local

Marca 14oct-exportacion-limpia. Sin tarjetas repetidas en el resumen; presupuesto
solo positivo y totales acordes al filtro, tanto manual como automático.
Método de pago en tres idiomas y puntos de categoría azules, sin alterar
montos, moneda o transferencias. Guía EXPORTACION_RESUMEN_LIMPIO.
Armadores/manejadores originales con IO ficticio aprobados; regresión
20b8877 roja por conducta anterior. PDFs sintéticos A4 revisados visualmente,
incluidas cabeceras repetidas en tres páginas. TypeScript/ESLint y 219 pruebas/
8 auditores verdes sin tarjetas (una suite local ajena; 218 previstas Git limpio).
Qué sigue/falta: exportar/abrir
y comprobar programación/entrega reales en Android. Sin datos reales,
APK/AAB/OTA/Play ni servicios remotos modificados/publicados.

## 14/10/2026 — Privacidad del registro; preparación local

Marca 14oct-privacidad-registro. Aviso/aceptación previa al permiso y al
interruptor, servicio cerrado sin aceptación, códigos descartados antes de
persistir/anunciar y limpieza selectiva de cola/marcas sin perder pagos.
Ayuda aclara respaldo Pro en Firebase, también en inglés/portugués. Guía
docs/REGISTRO_AUTOMATICO_PRIVACIDAD.md. TypeScript/ESLint y Kotlin/JCE original
aprobados; regresiones d156abe rojas por acceso sin aviso/captura heredada.
Debug x86_64 compilado e instalado sin desinstalar/borrar datos en emulator-5554.
218 pruebas/8 auditores verdes sin tarjetas (una suite local ajena; 217
previstas Git limpio). Captura visual agotó espera dos veces; no se aceptó
ningún permiso. Sin APK de distribución/AAB/OTA/Play, HTML legal o servicios publicados.
Qué sigue/falta: aviso visible/permiso/avisos reales/físico,
alinear textos públicos y confirmar uso de marca. No es autorización de Yape.

## 14/10/2026 — Selector sin Personalizar; desarrollo local

Marca 14oct-selector-simple: se retira el acceso Personalizar del selector
de movimiento; Nueva categoría crece a todo el ancho. Categorías, iconos,
creación/cierre y datos conservados. Guía SELECTOR_CATEGORIA_SIMPLE.
TypeScript/ESLint y 217 pruebas/8 auditores verdes sin tarjetas (una suite
local ajena; 216 previstas Git limpio). Regresión a6fa7a6 roja por botón
antiguo visible; original actual verde sin crear categorías reales.
Android confirma selector y Nueva sin guardar. Qué sigue/falta:
físico/letra grande/TalkBack. Sin
APK/AAB/OTA/Play, nativo ni servicios remotos; Telegram permanece en pausa.

## 14/10/2026 — Movimientos por día y hora real; desarrollo local

Marca 14oct-movimientos-por-dia: fecha encima de cada día, sin repetirla en
tarjetas de Personal/Historial/Familia/Cajas/Negocio. Resúmenes no mezclan
días; selección diaria conserva enlaces y saldos. Hora manual al Guardar,
edición conserva ausencia/original y nube sin sello no usa hora de lectura.
TypeScript/ESLint y 216 pruebas/8 auditores verdes sin tarjetas (una suite
local ajena; 215 previstas Git limpio). Regresiones f7f8800 por comportamiento.
Guía docs/MOVIMIENTOS_POR_DIA.md; Android confirma encabezados y filtros
con datos existentes, sin registrar/borrar movimientos reales.
Qué sigue/falta: físico/letra grande/TalkBack y cotejar reloj al registrar;
respaldo remoto separado. Sin APK/AAB/OTA/Play ni servicios publicados.

## 14/10/2026 — Ajustes agrupados; desarrollo local

Marca 14oct-ajustes-ordenados. Pro visible y legible arriba; seis secciones
con destinos directos, iconos mayores adaptados a claro/oscuro/estilo y sin
perfil grande/editor/etiqueta Gratis. Datos conservados, correo en Cuenta;
las condiciones Pro y el aviso verdadero de respaldo permanecen.
TypeScript/ESLint, 214 pruebas y 8 auditores verdes sin tarjetas (una suite
local ajena; 213 previstas Git limpio). Regresión 7276cdd roja por conducta
anterior. Guía docs/AJUSTES_AGRUPADOS.md. Android confirma entradas a Pro,
idioma/moneda y apariencias sin cambiar cuenta, dinero ni permisos.
Qué sigue/falta: físico, pantalla pequeña/letra grande/TalkBack y respaldo
remoto separado. No APK/AAB/OTA/Play, nativo ni servicios remotos publicados.

## 14/10/2026 — Ingreso real recuperado; desarrollo local

Marca 14oct-ingreso-cuentas. Corrige el archivo faltante al cambiar desde
una cuenta vacía cuya configuración quedó sin terminar. Conserva las
comprobaciones de dueño, datos sin perfil, archivos y sesión; sin borrado
forzado ni mezcla. Correo y Google reales confirmados por el propietario
y UI Android; Google persistió tras reabrir el mismo proceso/reconectar
Metro 8081 sin elegir cuenta ni contraseña. Logger SDK sin petición privada.
TypeScript/ESLint, 213 pruebas y 8 auditores verdes sin tarjetas (una suite local ajena).
Guía/regresiones: docs/PRUEBAS_INGRESO_CUENTAS.md.
Qué sigue/falta: más cuentas/físico y respaldo remoto rechazado por permisos;
no cierre global. No APK/AAB/OTA/Play, reglas publicadas ni cambios nativos.


## 13/10/2026 — Acceso único, desarrollo local; NO entrega de Play

Marca 13oct-acceso-unificado: crear/entrar en un formulario, campos animados,
correo conservado, Google único y reintentos protegidos. Registro viejo solo
conserva un alias de compatibilidad; no una pantalla adicional.
TypeScript/ESLint, 212 pruebas y 8 auditores sin tarjetas aprobados; regresión
cafc2ec roja por navegación anterior y verde actual. Guía ACCESO_UNIFICADO.
Emulador actualizado: ambos modos completos, sin formularios reales enviados.
Qué sigue/falta: Google/correo personales, copia protegida, físico y publicación.
Sin datos borrados ni APK/AAB/OTA/Play/nativo/Firebase/Telegram modificados.

## 13/10/2026 — Posiciones de Bienvenida según referencia; desarrollo local

Marca 13oct-bienvenida-posiciones: Bus/Comida bajan hacia los costados de la
cabeza; Presupuesto/Ahorro se acercan sin tapar pies. Círculo hasta 350, desde
cabeza a zapatos, centrado y adaptable; tamaños aprobados conservados.
Referencia lateral jhhh.GIF: las cuatro más hacia fuera, sin cambiar alturas
ni círculo y con margen prudente incluso al crecer/inclinarse el texto.
Vista completa en emulador normal con los tres accesos. Guía ENTRADA_UI_CALIDA.
TypeScript/ESLint, 211 pruebas y 8 auditores sin tarjetas aprobados; regresión
roja edee109 por colocación anterior y verde actual.
Qué sigue/falta: físico, pequeño/letra grande y acceso/copia protegida pendiente.
Sin datos, navegación, APK/AAB/OTA/Play, cambios nativos ni servicios modificados.

## 13/10/2026 — Bienvenida flotante recuperada; desarrollo local

Marca 13oct-bienvenida-flotante: ajuste visual posterior a sin-choques, cuyas
filas separadas no fueron aprobadas. Tarjetas cercanas sin tocar cabeza/zapatos,
tamaños aprobados conservados y círculo mayor centrado. Visto completo en el
emulador; TypeScript/ESLint, 211 pruebas/8 auditores sin tarjetas aprobados.
Regresión roja e607245 por comportamiento y verde actual; ENTRADA_UI_CALIDA.
Qué sigue/falta: físico, pequeño/letra grande y acceso/copia local protegida.
Sin datos, APK/AAB/OTA/Play, navegación ni servicios remotos modificados.

## 13/10/2026 — Tarjetas centradas y separadas; desarrollo local

Marca 13oct-bienvenida-sin-choques: iconos/textos mayores con espacio interior
equilibrado y tarjetas fuera de cabeza/piernas/zapatos, conservando el tamaño
visible aprobado. Vista normal completa; regresión original roja 03324f0 y
verde actual. Guía ENTRADA_UI_CALIDA.
Qué sigue/falta: comprobación física/pequeños/letra grande y acceso/copia local
pendiente. Sin APK/AAB/OTA/Play, cambios nativos/remotos ni datos modificados.

## 13/10/2026 — Proporciones de Bienvenida; desarrollo local

Marca 13oct-bienvenida-equilibrada: persona/tarjetas/subtítulo mayores, menor
hueco bajo Fino y margen lateral más amplio. Sin cambiar acceso ni datos.
Regresión original/JSX roja 3f5d5b4 y verde actual; guía ENTRADA_UI_CALIDA.
Qué sigue/falta: comprobación en teléfono físico y acceso/copia protegida
pendiente. Sin APK/AAB/OTA/Play ni Firebase/Telegram/nativo.

## 13/10/2026 — Entrada cálida, revisión local; NO entrega de Play

Marca 13oct-entrada-calida: diseño aprobado en las rutas reales, presupuesto
opcional y paneles compactos. TypeScript/ESLint, 210 pruebas y 8 auditores
sin tarjetas aprobados. Bienvenida vista completa en dos tamaños Android;
Registro/Login visibles. Servidor único 8081 y recarga limpia recuperaron la
pantalla roja. No se borraron datos ni se publicó APK/AAB/OTA.
Qué sigue/falta: recorrido físico restante y Google personal; diagnosticar la
copia protegida, letra grande/teclado y medir suavidad real. No declarar cerrado
el acceso completo. Guía: docs/ENTRADA_UI_CALIDA.md.

## 13/10/2026 — Moneda, corrección confirmada en emulador; NO entrega de Play

El propietario confirmó que el primer cambio no resolvió el fallo. Nueva versión
de desarrollo con marcador `13oct-moneda-window`: recorte nativo desactivado y
ventana de dibujo ampliada a 21. Conserva las 155 monedas, búsqueda y bloqueo.
Prueba JSX, TypeScript/ESLint y batería actual (211 pruebas, 8 auditores)
aprobados. El propietario recargó el emulador e informó que las
filas ya no desaparecen al deslizar rápido. Detalles en
`docs/PRUEBAS_MONEDA_DESLIZAMIENTO.md`. Sin APK/AAB/OTA, despliegue ni saldos
modificados. Qué sigue/falta: revisar memoria, letras grandes y búsqueda;
continuar la auditoría del recorrido desde apertura hasta Inicio.

## 13/10/2026 — revisión local Familia/Cajas, NO entrega de Play

Preparado el marcador `13oct-espacios-botones`: regresos rápidos entre espacios
sin ignorar toques válidos, exclusión de artefactos que cerraban Metro y archivo
local reversible/confirmado de Cajas antiguas. El emulador abrió Inicio,
Familia y Cajas; no se creó, borró, archivó ni devolvió dinero durante la prueba.
El archivo no es cierre financiero ni borrado y su recorrido Android completo
sigue pendiente. Sin APK/AAB/OTA/Play ni reglas/servicios nuevos publicados.
**Qué sigue/falta:** archivo/latencia Android, concurrencia compartida, guardado
Personal/Familia y activación/entrega remota coordinada con autorización.

## 11/10/2026 — 18:38 Lima — acceso normal visto, todavía NO entrega

La app normal abrió Inicio, Cajas y Ajustes en el emulador tras la vinculación;
desapareció el aviso de «otra cuenta». Cajas conserva una caja visible y muestra
3 transferencias por revisar. No se conciliaron ni tocaron sus importes.
`docs/PRUEBAS_ACCESO_INICIAL_VIDEO.md` registra alcance y límites.
No APK/AAB/OTA/Play/Firebase nuevos ni validación de sesión persistida tras
reiniciar. El commit `a38b33a` está en `origin/master`, pero Git no distribuye
un APK. **Qué sigue/falta:** Android restante del punto 2 y punto 3 externo,
incluida entrega coordinada cuando corresponda.

## 11/10/2026 — 18:24 Lima — recuperación local confirmada, NO entrega de Play

El propietario vinculó el perfil antiguo sin dueño/correo a su misma cuenta
Google en el emulador. La pantalla «recuperación11oct1» y `owner-same-active`
confirman el vínculo local; requieren desarrollo Android y banderas efímeras de
Metro, y no estarán en la versión de Play. Resultado de pruebas y límites en
`docs/PRUEBAS_ACCESO_INICIAL_VIDEO.md`. Aún falta abrir Fino normalmente.
No APK/AAB/OTA, instalación nueva, despliegue ni publicación por este paso;
el marcador normal no cambió. Git tampoco actualiza la app instalada.
**Qué sigue/falta:** acceso y demás Android (2), servicios/consolas/publicación
(3), incluida entrega coordinada cuando corresponda.

## 11/10/2026 — 12:24:29 Lima — diagnóstico local solicitado, NO entrega funcional

Sesión/bóveda/Google y FINO-63 preparados, app final 201/8 sin tarjetas y TS/lint
exit0. Detalle único en PRUEBAS_ACCESO_INICIAL_VIDEO, apartado 12:24:29.
Metro local solo diagnóstico «diagnóstico11oct1», sin restaurar/adjudicar datos;
compilación local HTTP200 no acredita ejecución Android. Captura Reloading,
resultado aún pendiente. No APK/AAB/OTA/instalación ni despliegue/publicación;
CODE_MARKER normal intacto: no se entregó ni cargó la app funcional normal.
**Qué sigue/falta:** diagnóstico y acceso humano (2), servicios/consolas/
publicación (3) después. Git no actualiza teléfonos; exclusiones intactas.

## 11/10/2026 — 10:26:12 Lima — motivo del aviso preparado, NO entregado

Guía PRUEBAS_ACCESO_INICIAL_VIDEO, apartado 10:24:27: dueño sin identificar,
sesión interrumpida y correo distinto ya no comparten aviso engañoso.
Protección/datos conservados; TypeScript/ESLint y app 196/8 aprobados, sin tarjetas.
No APK/AAB/OTA/instalación/despliegue ni cambio de marcador: JS real desconocido.
**Qué sigue/falta:** captura humana/diagnóstico y Android (2); servicios/consolas/
publicación (3). No se acreditó acceso de la misma cuenta; exclusiones intactas.

## 11/10/2026 — 06:18:56 Lima — acceso inicial preparado, SIN nueva entrega

Bloque del punto 2 y evidencia en `docs/PRUEBAS_ACCESO_INICIAL_VIDEO.md`
(sección 11/10); continuidad en ESTADO/bitácora. No nuevo APK/AAB/OTA,
instalación ni despliegue. Git no actualiza el teléfono; CODE_MARKER intacto.
**Qué sigue/falta:** diagnosticar rechazo de la MISMA cuenta Google sin borrar
datos, recorridos Android (2), servicios/consolas/publicación (3) después.
Tarjetas fuera, Telegram en pausa, Sentry externo excluido, diseño diferido.

## 10/10/2026 — 23:47:02 Lima — continuidad documental, SIN nueva entrega

Información faltante y horas en `docs/BITACORA_AVANCE.md`, sin duplicar informes.
El propietario no quiere otra copia del proyecto; el respaldo iniciado se canceló.
**Qué sigue/falta:** punto 2 Android y punto 3 servicios/publicación. No nueva
compilación, instalación, despliegue ni publicación por este registro documental.

## 10/10/2026 — borrado/recuperación y metas, NO entregado a teléfonos

Punto 1 de preparación/código/pruebas locales TERMINADO. No significa cierre
global de FINO-52/62 ni de toda la auditoría, ni publicación/instalación.
Contrato de origen y cadena de recuperación, lote local de movimiento/marcas/
metadatos y copia Admin con relectura transaccional preparados. FINO-62 añadido:
aportes independientes a la misma meta y reintentos se reconocen; cantidades
antiguas contradictorias no se suman ni reemplazan sin prueba.
Regresiones c6959c6 rojas por los fallos: aporte 10+20 perdido, memoria cambiada
con disco lleno y carrera Admin que pisaba la edición de 30 con 10.
Detalle/meta y cierre Familia/Caja esperan ACK local; fallo conserva ficha,
confirmación genuina permite reintento sin repetir RPC y error remoto anterior
no deja la lectura bloqueada. verificar-espera-borrados-cierres-real actual
verde/baseline c6959c6 rojo por comportamiento; no navegación Android real.
TypeScript/ESLint generales finales aprobados. App final3: 194 pruebas y 8
auditores sin tarjetas (una prueba del usuario no versionada, 193 previstas
en Git limpio; no otro checkout ejecutado). Node 22 final: 64/64 seleccionadas
fuera de Telegram/tarjetas. SDK/HTTP/reglas final: 229/229, exit0 sin omisiones,
cancelaciones ni fallos. Log .tmp/auditoria-punto1-sdk-final.log. Candidato
anterior 226/227 falló por exceso de expresiones en conversión válida; corrección
enfocada 7/7 y repetición completa aprobadas, SHA/recibo/tuplas/escape conservados.
Guía PRUEBAS_CICLO_BORRADO_RESTAURACION separa evidencia y límites. ADB sin
dispositivo/emulador conectado; no se ejecutó Android ni integración Telegram.
Telegram en pausa desde esta petición del 10/10; tarjetas/Sentry externo fuera,
diseño diferido. No APK/AAB/OTA/EAS/Firebase/Play ni edición HTML publicados
por este bloque; los textos web antiguos sí existen, según revisión previa.
Nueva orden: terminar SOLO el punto 1 y parar, sin comenzar los puntos 2/3.
**Qué sigue:** detenido tras el cierre local del 1, esperando nueva orden.
**Qué falta:** Android (2) y acciones externas (3), que quedan pendientes por
esa decisión; antiguos ambiguos, dos dispositivos/cuentas reales,
App Check/costos, SMTP/moderación, consolas/Billing/privacidad/trámites y
activación coordinada autorizada. Un commit/push no actualiza la app instalada.

## 09/10/2026 — formatos/borrados dudosos, NO entregado a teléfonos

Propietario aceptó exigir actualización antes de sincronizar con un contrato
nuevo; datos locales conservados. Se preparan controles de formato futuro/
inválido en nube/transacciones/recepción, Telegram y migrador Admin; importación/
staging/Admin detienen contradicciones identificadas sin retirar fuentes.
PRUEBAS_FORMATO_COPIA conserva evidencias y límites. No hay mínimo global
activado, cambio de formato, migración real ni APK/AAB/OTA/despliegue.
FINO-52 sigue abierto: cuatro casos protegidos, tres diagnósticos rojos.
**Qué sigue/falta:** contrato común, revisión humana de antiguos ambiguos,
Android/dos dispositivos, trámites/consolas/SMTP/cobros y entrega coordinada.
Tarjetas/Sentry externo excluidos. Un push no actualiza la app instalada.

## Preparado, no entregado — consultas/borrados/controles/ficha — 09/10/2026

Bucle de recepción eliminado, consultas rechazadas antes del libro y permiso
Pro transaccional acotado; marcas completas sin recortes 5000/1000, Telegram
sin reutilizar ID eliminado. Rótulos/roles del catálogo y controles sin rediseño;
seis huérfanos recuperables retirados. Ficha local corregida; HTML intactos.
187 pruebas/8 auditores sin tarjetas, 88 unitarias Node 22 y 202 SDK/reglas/HTTP
locales aprobadas. Una prueba ajena no versionada, 186 previstas en Git limpio
(sin otro checkout). Cinco contratos mixtos de tarjetas también excluidos.
Siete diagnósticos de FINO-52 siguen ROJOS y no se ocultan en esos números.
**Qué sigue:** compatibilidad mínima y contrato de identidades/borrados.
**Qué falta:** esa decisión, pruebas Android/cuentas reales, App Check/SMTP/
moderación, consolas/trámites/Billing y activación/entrega autorizadas.
No APK/AAB/OTA/EAS ni Firebase/Play. La web ya servía contenidos anteriores,
contradictorios; no se editaron HTML. Git no actualiza la app instalada.
Tarjetas/Sentry fuera; no distribuir como auditoría totalmente terminada.

## Preparado, no entregado — configuración/Idioma — 09/10/2026

Idioma sustituye País sin cambiar moneda; banderas únicamente decorativas.
Compatibilidad de enlaces antiguos, guardado inicial confirmado y adopción
de historial antiguo con correo verificado; salida sin abrir conserva archivos.
Guía PRUEBAS_CONFIGURACION_INICIAL.md, 180 pruebas/8 auditores aprobados sin
tarjetas. **Qué sigue:** restantes IDs/consultas/compatibilidad. **Qué falta:**
Android/Google/correo reales, consolas/trámites/SMTP/cobros y entrega autorizada.
Sin APK/AAB/OTA/EAS/despliegue. Git no actualiza producción; tarjetas/Sentry fuera.

## Preparado, no entregado — acceso inicial funcional (08/10/2026)

Registro parcial, Google de Bienvenida, carga de cuenta distinguida del
acceso, verificación/reset y teclado/fondo; rediseño retirado y diferido por
el propietario. Guía PRUEBAS_ACCESO_INICIAL_VIDEO.md conserva evidencia del
video, pruebas/regresiones y límite de la primera integral SDK/HTTP. Integral
final 189/189 aprobada; repetición aislada 14/14, sin relajar la aserción que
falló primero. Acceso usa el SDK de la app y sus manejadores originales.
Firma instalada sí registrada según consulta Firebase solo lectura; no se
modificó nube/configuración. **Qué sigue:** recorrido inicial y continuidad entre cuentas.
**Qué falta:** cuenta/Google/correo reales en Android, resto de auditoría,
consolas/trámites/migración/cobros y entrega autorizada. No APK/AAB/OTA/EAS
ni despliegue; Git no actualiza una instalación de producción. Tarjetas/Sentry fuera.

## Preparado, no entregado — aceptación servidor parcial (08/10/2026)

Callable/recibo privado versionado y reglas, cliente con elección local y
confirmación propia acotada; dinero/salidas no dependen de nueva aceptación.
Borrado Auth limpia el recibo y la barrera existente rechaza solicitudes tardías.
Guía PRUEBAS_ACEPTACION_SERVIDOR.md. Requiere activación autorizada y coordinada
de servidor/reglas/huellas/documentos/app; ninguna parte se publicó ahora.
**Qué sigue:** bloqueo/restantes IDs. **Qué falta:** Android, SMTP/atención,
consolas/políticas/revisión jurídica/trámites/cobros y entrega. Sin APK/AAB/OTA;
tarjetas/Sentry excluidos, FINO-47/49 y auditoría todavía no cerrados.

## Preparado, no entregado — aceptación por cuenta parcial (08/10/2026)

Recibo cifrado/versionado local tras elección explícita, conservación logout y
borrado por cuenta; aceptación existente sin Pro. Diez acciones compartidas y
conversión nueva protegidas en cliente, recuperación/salidas conservadas.
Originales/IO adaptado y regresiones `1292a78` comprobados; guía
PRUEBAS_ACEPTACION_POR_CUENTA.md. **Qué sigue:** servidor/bloqueo/restantes IDs.
**Qué falta:** Android, SMTP, consolas/revisión jurídica/trámites/cobros y
publicación autorizada. No acredita consentimiento sensible. Políticas solo en
archivos; sin APK/AAB/OTA/EAS/despliegue. Tarjetas/Sentry fuera; auditoría abierta.

## Preparado, no entregado — FINO-50 parcial (08/10/2026)

Interruptores, PIN/biometría, mes/categoría y barras con nombres/roles/estado;
sin cambio de dinero/permisos/Firebase. JSX original con adaptadores/regresiones
rojas/verde; guía PRUEBAS_ACCESIBILIDAD_CONTROLES.md. No prueba TalkBack ni
accesibilidad total. **Qué sigue:** controles restantes/aceptación/bloqueo.
**Qué falta:** Android, SMTP, consolas/trámites/cobros y publicación autorizada.
Sin APK/AAB/OTA/EAS/despliegue; tarjetas/Sentry fuera; auditoría no terminada.

## Preparado, no entregado — FINO-47 parcial (08/10/2026)

Casilla explícita/enlace/fecha antes del registro por correo y ambos botones
Google, sin premarcar ni aceptación automática. Manejadores/JSX originales
con IO adaptado y regresión roja/verde; guía PRUEBAS_ACEPTACION_PREVIA_AUTH.md.
No prueba jurídica ni recibo por cuenta; sesiones existentes y CGU pendientes.
**Qué sigue:** completar aceptación/bloqueo/restantes IDs. **Qué falta:**
Android, SMTP, consolas/trámites/cobros y publicación autorizada. Sin APK/AAB/
OTA/EAS/despliegue. Tarjetas/Sentry fuera; auditoría no terminada.

## Preparado, no entregado — FINO-49 parcial (08/10/2026)

Denuncias de contenido en Familia/Cajas: cuenta/miembro/texto/autor verificados,
sin cambiar saldos. Cola privada, cupo/reintento y limpieza con barrera al borrar
cuenta. Sin proveedor SMTP/configuración no se guardan ni anuncian envíos.
11 comprobaciones SDK/reglas locales aprobadas; guía
`docs/PRUEBAS_DENUNCIAS_CONTENIDO.md`. Políticas/Play son borradores actualizados.
No se instaló proveedor/extensión ni envió correo. **Qué sigue:** aceptación
de términos/bloqueo y resto de auditoría. **Qué falta:** configurar/probar correo,
Android, consolas/trámites/cobros y publicación coordinada autorizada.
No APK/AAB/OTA/EAS/despliegue; Git no actualiza la app. Tarjetas/Sentry fuera.


## Preparado, no entregado — identidades de altas nuevas (08/10/2026)

Generador con entropía aun sobre máximo común; UUID por alta nueva Personal/
Yape/meta, fusión rechaza otra identidad. No se renumeran antiguos/enlaces.
Reglas admiten/conservan `recordIdentityFormat: 1` y UUID v2; publicar reglas
compatibles antes de distribuir la app. Avisar que versiones antiguas que
retiren el marcador no podrán guardar esa copia. Migrador Admin reforzado.
Guía `docs/PRUEBAS_IDENTIDAD_CREACION.md`, regresiones rojas/verdes.
**Qué sigue:** antiguos/lápidas/otras entradas y restantes IDs de auditoría.
**Qué falta:** Android/dos teléfonos, migración real revisada, consolas/cobros/
trámites y publicación autorizada. Sin APK/AAB/OTA/EAS/despliegue. FINO-52
y auditoría abiertos; tarjetas y Sentry externo fuera.

## Preparado, no entregado — FINO-52 parcial (08/10/2026)

Se detienen uniones de avisos/aportes con orígenes conocidos distintos y mismo
número, antes de reemplazar movimientos/metadatos; reglas v2 preparadas.
Pruebas originales y SDK/reglas locales actuales, regresiones rojas contra
`0a6b9a9`; guía `docs/PRUEBAS_ORIGEN_MOVIMIENTOS.md`. FINO-52 NO cerrado:
generador/manuales/metas, lápidas, referencias ausentes, cliente v1 antiguo
y migrador administrativo pendientes. No se renumeraron datos ni tocaron
tarjetas. **Qué sigue:** protección completa compatible y restantes IDs.
**Qué falta:** Android/dos teléfonos, consolas/trámites/cobros y entrega
autorizada. No APK/AAB/OTA/EAS/despliegue; Git no actualiza los teléfonos.
Sentry externo fuera.

## Comprobado, no entregado — FINO-33 / FINO-52 abierto (08/10/2026)

Correcciones de las pruebas, no una nueva versión de la app: lectores de
regresión respetan hash, cierre Gratis/Pro conectado a copia/cifrado reales
con IO adaptado y regresiones rojas/verdes. Guía
`docs/PRUEBAS_CALIDAD_REGRESIONES.md`. Diagnóstico de IDs pierde movimientos/
metas y sale con error: FINO-52 sigue abierto. No cambió el generador ni se
tocaron tarjetas. **Qué sigue:** corregir IDs y restantes 15/16/34/37/47/49/50.
**Qué falta:** Android, consolas/trámites, cobros y entrega autorizada. Sin
APK/AAB/OTA/despliegue; Git no actualiza los teléfonos, Sentry externo fuera.

## Preparado, no entregado — FINO-51 (08/10/2026)

Moneda fija al terminar configuración inicial por decisión del propietario.
País/idioma pueden cambiar sin convertir ni reetiquetar importes. Copias
discrepantes conservadas sin unión/subida; protección de reglas preparada.
Regresiones roja/verde de manejadores y reglas reales locales, guía
`docs/PRUEBAS_MONEDA_FIJA.md`. Sin APK/AAB/OTA ni Firebase real. **Qué sigue:**
restantes IDs. **Qué falta:** Android/dos dispositivos y publicación coordinada,
consolas/trámites y entrega acumulada. Tarjetas/Sentry externo fuera.

## Preparado, no entregado — FINO-28/29 (08/10/2026)

Plugin nativo reconstruye firma release sin secretos y limita componentes
expuestos sin quitar recorte/arranque. Plantilla SDK/mods y Groovy originales
comprobados, prebuild local sin --clean y merger debug real aprobados;
guía `docs/PRUEBAS_ANDROID_CONFIGURACION.md`. Requiere APK nuevo acumulado,
no genera otro APK/AAB ni OTA/EAS/despliegue en este paso. **Qué sigue:**
restantes IDs. **Qué falta:** Android/fotos/enlaces/avisos, release final,
credenciales/huella/consolas/trámites y entrega. Tarjetas/Sentry externo fuera.

## Preparado, no entregado — FINO-32 (08/10/2026)

Permiso del calendario solo tras acción explícita, no al recuperar pagos.
Canal antes del diálogo Android 13; interruptor espera escritura y conserva
avisos ajenos. Pruebas originales con IO adaptado, regresión contra `450f29d`;
guía `docs/PRUEBAS_PERMISOS_CALENDARIO.md`. Sin cambio nativo/permisos nuevos,
APK/AAB/OTA/despliegue. **Qué sigue:** restantes IDs. **Qué falta:** Android,
firma/consolas/trámites y entrega acumulada. Tarjetas/Sentry fuera.

## Preparado, no entregado — FINO-35 (07/10/2026)

Lector PDF limita descompresión y no importa datos parciales al superar tope.
Extractor/fflate reales, manejador adaptado y regresión roja-verde aprobados;
guía `docs/PRUEBAS_LIMITES_PDF.md`. No añade datos/servicios/permisos ni cambio
nativo. **Qué sigue:** permisos/restantes IDs. **Qué falta:** Android/memoria,
firma/consolas/trámites externos y entrega acumulada. Tarjetas/Sentry fuera.
Sin APK/AAB/OTA/EAS/despliegue, no se modifica la versión instalada.

## Preparado, no entregado — FINO-30 (07/10/2026)

Exportación manual distingue archivo preparado de guardado comprobado. Abrir
WhatsApp/Gmail/correo/selector no confirma envío ni recepción. Regresión roja
contra `ac8ebd7`, manejadores originales/IO adaptado verdes; guía
`docs/PRUEBAS_ENTREGA_EXPORTACION.md`. No añade cambio nativo ni datos/servicios.
**Qué sigue:** restantes IDs. **Qué falta:** Android y entrega coordinada con
lo nativo acumulado, consolas/trámites; tarjetas/Sentry fuera. No publicado.

## Preparado, no entregado — FINO-24 (07/10/2026)

Buzón Yape/duplicados cifrados con Keystore; conserva y convierte avisos antiguos,
comprueba guardados y deja de conservar nombres de otras apps. Kotlin/JCE local
aprobado con adaptadores y regresiones rojas-verdes; módulo/app debug compilados.
Guía `docs/PRUEBAS_BUZON_YAPE_CIFRADO.md`. No hay APK/AAB/OTA ni despliegue nuevo.
Necesita nueva instalación Android, acumulada con otros cambios nativos.
**Qué sigue:** exportación manual/restantes IDs. **Qué falta:** pruebas Android,
release/firma, consolas/trámites y entrega autorizada. Tarjetas/Sentry fuera.

Resumen público. No guarda enlaces privados, credenciales ni datos de firma.

## Versión disponible en Google Play

| Fecha | Versión | Estado |
|---|---|---|
| 19/09/2026 | 1.0.8 | Disponible en la prueba cerrada (`versionCode 10`) |

## Próxima versión

FINO-25/26 preparados: explicación honesta de reconocimiento de voz y campana
solo por llegadas nuevas, con reducir movimiento y etiquetas traducidas.
Política/ayuda/HTML/Play son borradores coherentes con el código; no se publicaron.
Faltan Android/TalkBack, proveedor real de voz y declaración final de Play.

FINO-22/23 y refuerzo FINO-41 preparados: ventana protegida con candado,
paneles suspendidos hasta desbloqueo y ojo que oculta todos los importes de
Inicio. Kotlin JVM y Gradle debug/SDK real aprobados; no son pruebas físicas.
Módulo ScreenPrivacy necesita nueva instalación nativa acumulada, no OTA.
Faltan Android/TalkBack/OEM, firma/release y entrega autorizada. No se generó
APK/AAB ni se usó EAS; no es una versión ya disponible.

FINO-09 preparado: horario previsto, textos compactos de retrasos y consulta
de acceso exacto antes de programar en Android 12+. Política Kotlin JVM y
Gradle debug/SDK real aprobados. No agrega permiso/retención ni cambia planes.
Kotlin requiere nueva instalación acumulada, no solo OTA. Falta servicio/alarmas
físicos, firma release y publicación; sin APK/AAB/EAS. Guía:
`docs/PRUEBAS_HORARIO_EXPORTACION.md`. Sigue FINO-22.
TypeScript/ESLint sin avisos y 150 pruebas locales/8 auditores aprobados
(149 en Git limpio). No se revisó una configuración publicada ni se entregó app.

FINO-21 preparado, requiere nueva instalación: exportación privada y receptor
aparte para arranque protegido. Kotlin JVM original y Gradle debug/SDK real
aprobados; manifiesto recién generado verificado. Release pendiente por firma;
no se debilitó la protección ni se generó APK/AAB. TypeScript/ESLint, 149 pruebas
locales/8 auditores aprobados (148 en Git limpio). ADB vacío. Juntar cambios
nativos antes de una sola entrega; no publicar por OTA como si protegiera al
APK anterior. Guía: `docs/PRUEBAS_RECEPTOR_EXPORTACION.md`. Sigue FINO-09.

FINO-20 preparado: consumir invitación al entrar es obligatorio también en
reglas; los invitados no revocan otros códigos y una cuenta en eliminación
no entra por petición atrasada. Regresión Firestore local y clientes originales
comprobados; FINO-06/31 revalidados. Sin despliegue/APK/AAB/OTA. Falta Android,
dos cuentas y entrega coordinada. Guía: `docs/PRUEBAS_INVITACIONES_UNICAS.md`.
Actualización: FINO-21 preparado en la sección superior, todavía no instalado.
TypeScript/ESLint, 148 pruebas locales/8 auditores (147 en Git limpio), 82
unitarias de servidor y 142 pruebas Firebase local/Node 22 aprobadas. ADB sin
dispositivos. Falta comprobar también petición de una sesión antigua después
de terminar el borrado Auth; no se presenta ese caso como resuelto.

FINO-43 preparado: borrados y ediciones de Negocio no retroceden por copias
antiguas; lote local cifrado y archivo por cuenta v3 (v1/v2 siguen legibles).
Reglas de formato/marcas probadas en Firestore local. 148 pruebas locales/8
auditores (147 en Git limpio) y 129 pruebas de servidor local Node 22 aprobadas.
Falta Android, dos dispositivos y coordinar app/reglas antes de distribuir.
Política y ficha ajustadas a las marcas técnicas. Sin APK/AAB/OTA ni despliegue.
Guía: `docs/PRUEBAS_NEGOCIO_BORRADOS.md`. Restantes IDs aún pendientes.

FINO-55 preparado: elementos ausentes tienen mensaje/Volver; editar un movimiento
o meta ausente no crea uno nuevo. Prueba con componentes originales aprobada,
TypeScript/ESLint y 146 pruebas locales/8 auditores aprobados al cierre de este
punto (145 en Git limpio). Falta Android físico. FINO-43 se preparó después,
como indica el apartado superior. Sin APK/AAB/OTA.

FINO-44/54 preparados: importación conserva ediciones al sincronizar, bloquea
conflictos, IDs repetidos y fusiones con aportes enlazados; cuatro manejadores
de guardado protegidos contra doble toque y comprobados con código original.
Sentry queda apagado por decisión del propietario, con privacidad y declaración
preparadas para esta versión. TypeScript, ESLint, 145 pruebas locales y 8
auditores aprobados (144 en Git limpio). Falta Android físico y entrega.
Empaquetado local Android/Hermes aprobado con Sentry apagado.
No se ha enviado este cambio a las versiones instaladas.

FINO-45 preparado: moneda propia de Familia y categorías/notas reales de Familia
y Cajas en los reportes. Prueba del cargador real, TypeScript, ESLint, 142 pruebas
locales y 8 auditores aprobados (141 en Git limpio). Falta abrir PDF/Excel/CSV
en Android. Sin APK/AAB/OTA nuevo.

FINO-19 preparado: generar AAB usa el archivo Firebase explícito de `app.json`,
validado contra proyecto, remitente y paquete. La comprobación local real y
las pruebas de rechazo/copia y acceso Google aprobaron. Falta compilar y
comprobar la firma en entorno limpio; no se generó ni publicó AAB.

FINO-60 preparado: librería de cifrado sustituida conservando formato, llave y
datos antiguos. Comparación independiente con 10.000 movimientos, TypeScript,
ESLint, 140 pruebas locales y 8 auditores aprobados (139 pruebas en Git limpio).
Empaquetado Android/Hermes aprobado; falta actualización real sobre datos
antiguos en Android. Sin APK/AAB/OTA ni cambios de datos reales.

FINO-59 (mapas de Sentry) parcial, no publicado: conservar la subida durante
Android ahora requiere activación expresa y credenciales privadas. Sin activar,
la compilación mantiene su comportamiento anterior. Se integraron el plugin
oficial y Metro conservando NativeWind. Falta verificar una
compilación autorizada y una traza legible en Sentry; las actualizaciones OTA
requieren su propia subida de mapas. Ver `docs/SENTRY_MAPAS.md`.
Sin APK/AAB/OTA nuevo. Tarjetas de crédito excluidas.
TypeScript, ESLint, 139 pruebas locales y 8 auditores aprobados; 138 pruebas
en Git limpio, por el archivo local no versionado señalado abajo.
Exportación local Android con mapas aprobada; el identificador coincide entre
mapa y paquete Hermes. No sustituye la compilación nativa ni la prueba en Sentry.

FINO-61 atendido en el conteo: se retiraron diez pruebas que no comprobaban
el código actual (gráficas inexistentes y copias de algoritmos). El gráfico
diario vigente ahora comparte la misma cuenta entre Reportes y una prueba
real, que falló antes de la extracción. Voz también comparte las cuentas de
comparación mensual y resumen por día con pruebas reales. Cuatro simulaciones
de navegación/candado se guardan, pero no cuentan hasta probar Android.
Pasaron 138 pruebas locales y 8
auditores sin tarjetas; una prueba local no está versionada, por lo que Git
limpio tiene 137. Falta el recorrido físico de
`docs/PRUEBAS_NAVEGACION_CANDADO.md`. No constituye una entrega instalada.
Sin APK/AAB/OTA.

FINO-58 revalidado: el candado falla cerrado si SecureStore no responde.
FINO-59 parcialmente mitigado: el bot local exige autorizaciones explícitas,
la plantilla ya no ofrece `reset-project` y la herramienta gráfica tiene
versión fija. No se ejecutó ningún bot ni se cambió producción. La prueba
nueva falló antes y pasa ahora; 149 pruebas y 8 auditores sin tarjetas
aprobaron. Falta revisar los símbolos de Sentry y probar el candado en
Android. Sin APK/AAB/OTA.

FINO-57 preparado, no publicado: CSV manual y automático respetan los decimales
de la moneda del espacio; el texto de descripciones con controles iniciales o
signos que podrían leerse como fórmula se protege. Regresión roja antes y verde
después, TypeScript, ESLint, 148 pruebas y 8 auditores sin tarjetas aprobaron.
Falta abrir archivos reales en Excel/LibreOffice y probar en Android. Sin
APK/AAB/OTA.

FINO-10 preparado, no publicado: tocar un aviso de pago del teléfono abre
Inicio con su ficha inferior, incluso tras arranque en frío y después del
candado. Un pago borrado muestra un aviso; uno ya registrado no se duplica.
La prueba específica pasa; falta el toque real en Android con la app
abierta/cerrada antes de entregar. TypeScript, ESLint, 148 pruebas y 8
auditores sin tarjetas aprobaron. Sin APK/AAB/OTA.

FINO-53 preparado, no publicado: el aviso del calendario en el teléfono
muestra el monto y la fecha completa del vencimiento (día/mes/año). Incluye
ingresos, recordatorios y ajuste al último día de febrero. La regresión falló
antes y pasa ahora; TypeScript, ESLint, 148 pruebas locales y 8 auditores sin
tarjetas aprobaron. Falta comprobar en Android que tocar el aviso abra la
ficha correcta (FINO-10). Sin APK/AAB/OTA.

FINO-38 preparado, no publicado: Familia y Caja validan aportes contra el
saldo del mes de la fecha del aporte, no el mes abierto en Inicio. Incluye
creación y ampliación en Familia y Cajas, incluso aportes antiguos de Cajas
compartidas, y el texto del saldo en el formulario. Regresión roja
antes del cambio y verde ahora; TypeScript, ESLint, 148 pruebas locales y 8
auditores sin tarjetas aprobaron. Faltan Android y entrega. Sin APK/AAB/OTA.

FINO-11 corregido en código, no publicado: al tocar «Ya lo pagué», el
movimiento usa la fecha y hora reales del toque, incluso si el vencimiento
fue en otro mes. El calendario conserva el vencimiento y los movimientos
anteriores no se reescriben. La regresión falló antes y pasa ahora; faltan
prueba visual en Android y entrega. TypeScript, ESLint, 148 pruebas locales y
8 auditores sin tarjetas aprobaron. Sin APK/AAB/OTA.

FINO-08 mitigado en código, no publicado: si el trabajo de exportación no
puede verificar Pro con la app cerrada, deja intacta la programación y omite
ese archivo. TypeScript, ESLint, 148 pruebas locales y 8 auditores sin
tarjetas aprobaron; esto todavía no garantiza que un tester reciba el
archivo sin abrir la app. Faltan verificación de permiso en
segundo plano y prueba Android. Sin APK/AAB/OTA.

FINO-17 preparado, no publicado: al vencer Pro, los Yapes nuevos vuelven a
Personal, sin mover lo ya anotado en Negocio ni duplicar avisos antiguos.
Los negocios existentes se consultan sin Pro; se puede apagar, pero no
encender, el destino de nuevos Yapes. La prueba Pro caduca en el instante
exacto. TypeScript, ESLint, 148 pruebas locales y 8 auditores sin tarjetas
aprobados (una prueba ajena sin registrar no se incluye);
falta comprobarlo en Android abierta/cerrada y publicarlo. Sin APK/AAB/OTA.

FINO-14 preparado, no publicado: la captura deja de descifrar el historial
entero cada ocho segundos sin avisos; detecta cambios del trabajo de fondo
mediante el registro breve y conserva el repaso de seguridad. Una lectura
incompleta no confirma movimientos. TypeScript, ESLint, 148 pruebas locales y
8 auditores sin tarjetas aprobados (una prueba ajena sin registrar no se
incluye); falta medirlo en Android y verificar avisos
con la app abierta/cerrada. Sin APK/AAB/OTA ni entrega a usuarios.

FINO-39/56 corregidos en código, no publicados: metas nuevas guardan la fecha
local y una edición del objetivo recalcula si la meta está cumplida. No se
reescriben fechas antiguas sin confirmación. Regresión previa, TypeScript,
ESLint y 148 pruebas/8 auditores sin tarjetas aprobados; falta tocar el flujo
en Android. Sin APK/AAB/OTA ni entrega a usuarios.

FINO-46 corregido en el lector de archivos, no publicado: en una columna
única Monto, si hay cargos negativos reales, los positivos se presentan como
ingresos; con solo positivos se conserva la lectura anterior como gastos.
La columna Tipo explícita prevalece y un pie TOTAL no cambia la convención.
Regresión roja antes del arreglo; TypeScript/ESLint y 148 pruebas/8 auditores
sin tarjetas aprobados. Faltan revisión manual de tipos y pruebas con archivos
reales/Android; sin APK/AAB/OTA ni entrega a usuarios.

FINO-12 corregido en el código, no publicado: el monto de un pago/ingreso del
calendario conserva la coma o el punto escrito y distingue `1,500` (mil
quinientos en PEN) de `1,50` (uno con cincuenta). Un formato ambiguo o cifra
excesiva no se guarda como otro valor. TypeScript/ESLint y 147 pruebas/8
auditores sin tarjetas aprobados; falta probarlo tocando el campo en Android.
Sin APK/AAB/OTA ni entrega a usuarios en esta tanda.

Cierre de elección monetaria pendiente **preparado, no publicado**: Gratis
puede cerrarla solo si las dos copias de Personal/Caja ya coinciden aquí y en
Firebase. El servidor guarda una huella técnica que invalida una petición
antigua; la app conserva originales y montos, con guardado local indivisible.
Si la corrección se aplicó primero, recupera su confirmación; si hay diferencias
o fallos, mantiene el pendiente. `docs/PRUEBAS_RETIRO_IMPORTE_CAJA.md` reúne
pruebas y pasos restantes. Servidor actualizado debe desplegarse antes que el
cliente, en entrega coordinada autorizada. La política se modificó solo en
archivos. Esta tanda no entrega APK/AAB/OTA ni toca tarjetas de crédito.
TypeScript/ESLint, 147 pruebas locales y 8 auditores sin tarjetas, 82
unitarias del servidor y 128 SDK/HTTP/reglas en Firebase local/Node 22
aprobados. Un APK de desarrollo se abrió solo en emulador hasta bienvenida;
no se probó el recorrido financiero en Android con cuenta. La prueba local
ajena sin registrar se mantuvo fuera del commit.

Antecedente de sustitución Pro:

Nueva revisión Pro de elección monetaria pendiente: fuentes actuales,
confirmación/reconsulta, anteriores originales/elección conservados con estado
local `sustituido` y enlaces mutuos; nueva pendiente en el mismo lote local.
Límite no borra historial; versiones/cola/acuse genuino y fallos protegidos.
Guía vigente: `docs/PRUEBAS_SUSTITUCION_IMPORTE_CAJA.md`. No entregar cliente que
descarte/desconozca esa cadena ni retroceder sin revisar migración. Políticas
preparadas en archivos, no publicadas; sin tarjetas/nativos/marca/APK/AAB/OTA/
despliegue. Siguen retiro sin sucesora/Pro, otros casos incompatibles, Android,
consolas y publicación conjunta autorizada.

Verificación de esta tanda: TypeScript/ESLint completos, 146 pruebas locales/
8 auditores, 77 unitarias de servidor y 126 SDK/reglas/HTTP/eventos Node 22
real aprobados. Servidor sin fallos/omisiones/cancelaciones. Regresión 1084e38
falla antes y pasa ahora. El total local incluye una prueba ajena sin registrar
que queda fuera del commit; no se probó un checkout limpio. Dos suites
específicas de tarjetas excluidas, no verificadas.

Antecedente de recuperación sin Pro:

Recuperación sin Pro de corrección monetaria **ya completada y vigente**:
`recoverPrivateBoxMoney`, solo lectura; respuesta mínima propia, no historial
ni corrección nueva. Botón Gratis comprueba resultado pendiente; SDK/contexto
exigen originales cifrados, recibo genuino y guardado local verificado con
misma versión. Escritura nueva y descargar respaldo siguen requiriendo Pro.
Guía vigente: `docs/PRUEBAS_RECUPERACION_IMPORTE_SIN_PRO.md`. Función nueva y
políticas están preparadas, no desplegadas/publicadas. Publicarlas conjuntamente
con servidor/reglas/app antes de entregar, solo con autorización. Siguen revisión
obsoleta/no aplicada con Pro vencido, Android y restantes hallazgos. Tarjetas
fuera; ningún cambio nativo/marca/APK/AAB/OTA ni entrega en esta tanda.
TypeScript/ESLint, 145 locales/8 auditores, 77 unitarias servidor y 124 SDK/
reglas/HTTP/eventos Node 22 real aprobados. Una prueba local ajena no registrada
no se incorpora al commit; dos suites específicas de tarjetas excluidas.

Antecedente del flujo conectado:

Flujo de comparación de importes conectado en Cajas, aún **sin publicar**:
cuatro fuentes con monto/moneda/fecha y confirmación, reconsulta, conservación
previa de originales con Personal/borrados/Caja juntos, HTTP genuino y lote
financiero con versión exacta. Pendientes/reintento/reinicio e historial
visibles; modal/dos toques/caché y lecturas atrasadas protegidos. Guía vigente:
`docs/PRUEBAS_FLUJO_IMPORTE_CAJA.md`. No desplegar esta pantalla sin preparar
conjuntamente servidor/reglas. Siguen recuperación de decisión obsoleta o Pro
vencido antes de recuperar respuesta, Android y autorización de publicación.
Tarjetas fuera; ningún APK/AAB/OTA, marca ni cambio nativo en esta tanda.
TypeScript/ESLint completos, 144 locales/8 auditores, 73 unitarias servidor y
121 SDK/reglas/HTTP/eventos Node 22 real aprobados. Sin omisiones/cancelaciones/
fallos de servidor. Una prueba local ajena sin registrar queda fuera del commit;
dos suites específicas de tarjetas excluidas, no verificadas.

Antecedentes de la preparación del lote (ahora conectado):

Lote monetario local preparado en el contexto: respuesta genuina, originales
releídos, tres claves juntas y versión exacta del servidor. Reserva corta evita
mutaciones durante SQLite; no publica éxito antes de verificar el archivo ni
deja memoria vieja si se cierra solo la pantalla. Guía:
`docs/PRUEBAS_LOTE_IMPORTE_CAJA.md`. **Pantalla/petición aún sin habilitar**.
Siguen selección/recuperación/decisión obsoleta/Pro vencido y controles
concurrentes; después Android/consolas/otros hallazgos/publicación coordinada
autorizada. Sin nueva retención/claves/nativos/tarjetas/marca/entrega.

Las secciones siguientes registran el avance histórico de cada tanda; sus
pendientes anteriores no sustituyen los de esta última continuación.

Cliente monetario preparado para fuentes de servidor y solicitud con originales
pendientes confirmados en disco. Respuesta genuina ligada a cuenta/sesión/cola,
sin aceptar un comprobante calculado/copiado ni anunciar guardado local por HTTP.
Reintento vigente sin nueva escritura; Pro real aplicado por reglas/servicio.
Guía: `docs/PRUEBAS_CLIENTE_IMPORTE_CAJA.md`. **No se importa desde pantalla o
contexto ni se habilita:** sigue lote conjunto, selección y recuperación
explícita; después Android/consolas/publicación coordinada autorizada. Mismo
esquema ya documentado, sin nueva retención/claves/nativos/tarjetas/marca/entrega.

Coordinación Personal/Caja preparada: una revisión monetaria pendiente pausa
ambos respaldos ordinarios; cola por cuenta y sello en memoria impiden aplicar
respuestas viejas. Historial v2 anidado, identidad, archivo dañado y guardia antes
de escribir comprobables. Guía: `docs/PRUEBAS_BARRERA_PERSONAL_CAJA.md`.
**No botón monetario ni petición conectados.** Faltan elección/fuentes frescas
dentro de la cola, guardado conjunto y recuperación; después Android/consolas y
entrega coordinada autorizada. No nueva retención/servicio, nativos, tarjeta,
CODE_MARKER, APK/OTA o despliegue. No garantiza atomicidad servidor/teléfono.

Preparación local monetaria conserva los cuatro originales y elección en Cajas
cifrado/bóveda por cuenta, sin nueva clave ni respaldo remoto de esas copias.
Hasta 50 revisiones/400.000 bytes; mantiene anteriores al llegar al límite.
Guía: `docs/PRUEBAS_ORIGINALES_IMPORTE_CAJA.md`. **No hay botón ni envío/guardado
monetario conectados.** Antes de habilitarlo faltan protección del respaldo
Personal/subidas en vuelo, selección, lote conjunto y recuperación. Políticas
preparadas en archivos; no publicadas. Después siguen Android/tamaño/consolas y
publicación coordinada autorizada. No nativos/marca/APK/OTA/despliegue.

Corrección financiera prepara **solo el servidor**: elección de monto/fecha
de un aporte con enlaces exactos y actualización conjunta de Personal/Caja
remotos. Pro/cuenta/fuentes/moneda/saldo, reintentos y concurrencia protegidos.
Guía: `docs/PRUEBAS_DIFERENCIAS_DINERO_SERVIDOR.md`. No hay nueva colección ni
recibo. **No habilitar ni desplegar todavía:** faltan pantalla, originales/
decisión cifrados, guardado conjunto local, recuperación y bloqueo de subidas
incompatibles. Sin código nativo/marca/APK/OTA/despliegue. Después faltan Android,
índices/consolas y publicación coordinada autorizada; punto 1 sigue abierto.

Recuperación incompleta prepara guardias que impiden reconstruir una Caja
cerrada/convertida o propagar montos/fechas/repartos inválidos a Personal.
Conserva los datos sin devolver dinero ficticio ni modificar compartidas
ajenas; el guardado real rechaza un plan antiguo inseguro. Explica por qué.
Guía: `docs/PRUEBAS_RECUPERACION_INCOMPLETA_CAJAS.md`. Sin claves/datos nuevos,
reglas/Functions de producción, nativos, marca ni entrega. No publica ni repara
datos reales. Punto 1 abierto para discrepancias financieras más complejas;
faltan Android y publicación autorizada coordinada de todo el conjunto.

Nombres de Caja prepara elección explícita entre celular/nube ante igual
versión; guarda ambos originales cifrados antes de enviar y comprueba otra vez
la Caja en servidor sin tocar dinero, movimientos ni otra Caja. Reintento
vigente sin nueva escritura. Revisiones solo locales, hasta 50 conservadas,
incluidas en copia por cuenta; políticas interna/web/PLAYSTORE preparadas.
Guía: `docs/PRUEBAS_NOMBRES_CAJA_NUBE.md`. Sin claves/nativos/marca ni entrega.
No volver a una app que normaliza eliminando revisiones sin comprobar
compatibilidad. Punto 1 sigue abierto para dinero/legado/elecciones obsoletas;
faltan Android y publicación coordinada/autorizada de todo lo preparado.

Enlace heredado prepara identificación y confirmación explícitas de una pareja
existente; solo une IDs con guardado conjunto, sin cambiar montos ni duplicar
movimientos. Pro conserva su comprobación remota y Gratis trabaja localmente.
Guía: `docs/PRUEBAS_ENLACE_HEREDADO.md`. Sin claves/nativos/marca ni entrega.
Punto 1 sigue abierto para diferencias más complejas; faltan Android y publicación.

Recuperación Personal/Caja prepara un guardado conjunto con IDs comprobados,
sin sobrescribir un monto distinto ni devolver dinero por una marca heredada.
Una pareja inequívoca permite elegir monto/fecha; otras discrepancias se
conservan bloqueadas para revisar. Pro verifica IDs afectados en servidor antes
de recuperar; Gratis no consulta nube. Guía:
`docs/PRUEBAS_REPARACION_PARES_CAJAS.md`. Sin nuevos datos/retención/claves,
APK/OTA/despliegue o marca. Faltan legado no demostrable, diferencias entre
dispositivos, Android y entrega coordinada de todo el conjunto preparado.

Borrado de cuenta prepara `prepareIncompleteBoxDeletion`: comprobación previa
sin escribir, limpieza de clones propios sin devolución ficticia y retirada de
índices huérfanos. Legado solo si coincide con su origen; dinero publicado sigue
su validación normal. Barrera/membresía hasta Auth y purga antes de quitar recibos.
Reglas impiden borrar/recrear esa barrera desde SDK y nuevo legado sin protocolo.
Guía: `docs/PRUEBAS_BORRADO_CAJAS_INCOMPLETAS.md`. Desplegar función + evento Auth
y reglas antes de la app; no publicarlas de forma aislada ni volver a cliente
que pueda crear copias sin protocolo. Sin APK/OTA/despliegue, marca sin cambios.
Faltan pares/conflictos heredados, Android, rendimiento/tamaño y casos no demostrables.

Caja pendiente prepara Reintentar / Cancelar compartir. Cancelación propia sin
Pro: barrera remota persistente, intentos UUID y guardado local confirmado antes
de desbloquear; una conversión terminada recupera su recibo y no devuelve dinero.
Limpia clones cancelados/índice y borra metadata/barreras al eliminar Auth.
Guía: `docs/PRUEBAS_CANCELACION_CAJA.md`. Requiere funciones + reglas + app juntas.
**No publicar todavía:** la limpieza de conversiones activas/incompletas se prepara
en la sección anterior; siguen pendientes
conflictos/pares heredados, pruebas físicas y revisión de tamaño/rendimiento.
No se compiló APK ni publicó OTA/Firebase; CODE_MARKER no cambia.

Personal/Cajas privadas prepara guardado conjunto en el SQLite Android existente:
no muestra éxito hasta confirmar ambas mitades y sus marcas; escrituras antiguas
no deshacen un lote nuevo. Incluye aportes, edición, devolución, borrado, cierre
y remapeo al compartir. Las operaciones enlazadas iOS/web quedan bloqueadas con
aviso hasta tener un equivalente comprobado; sus operaciones de una clave siguen.
Guía: `docs/PRUEBAS_GUARDADO_PERSONAL_CAJAS.md`. Sin claves nuevas ni cambio de
archivo por cuenta. Falta Android físico, pares heredados, rendimiento/tamaño y
limpieza de copias incompletas; no es atomicidad conjunta con Firebase.
Sin APK/OTA/despliegue ni cambios nativos; CODE_MARKER permanece igual.

El bloqueo local de conversión pendiente sobrevive reinicios y no viaja a
Firebase. La cancelación comprobada se prepara en la sección anterior, sin renovar
Pro ni desbloquear a ciegas. Quedan pruebas físicas y limpieza de huérfanos activos.

Conversión privada/compartida prepara `privateBoxMigration` y formato privado 3:
comprobación y retirada indivisibles en Firebase, confirmación recuperable,
clones nuevos incompletos aislados y ediciones atrasadas conservadas. Invitación
fallida no deshace el cambio. Guía/límites: `docs/PRUEBAS_CONVERSION_CAJA.md`.
Requiere funciones + reglas + app coordinadas; no entregar la app antes del
servidor ni volver a un cliente que quite formato 3. Quedan transferencias
entre archivos, conflictos heredados y limpieza de copias incompletas por revisar.
Sin APK/OTA/despliegue ni cambios nativos; CODE_MARKER permanece igual.

Cajas privadas prepara `syncFormat: 2`/fecha de edición: no impone una copia vieja
sobre una edición nueva, conserva eliminaciones y rechaza conflictos ambiguos.
La carga confirma servidor/cuenta y la pantalla recibe el resultado del guardado.
Exige entrega coordinada de reglas y app; tras escribir formato 2 no revertir a
un cliente que lo quite. La conversión entre dispositivos todavía requiere
otra revisión antes de entregar. Ver `docs/PRUEBAS_CAJAS_PRIVADAS.md`.
Sin APK/OTA/despliegue ni cambios nativos; no cambió CODE_MARKER.

Familia y Cajas compartidas descartan consultas/operaciones de una sesión
anterior y fuentes sin confirmar antes de corregir Personal. Cajas concilia
contrapartes borradas remotamente solo del espacio activo abierto, conservando
aportes consumidos y otros espacios. Guía: `docs/PRUEBAS_CONSULTAS_ESPACIOS.md`.
Preparado localmente; no hay APK/OTA/deploy ni cambios nativos en esta tanda.

La devolución deshecha ahora invalida su confirmación privada y una respuesta
atrasada no reinserta el ingreso borrado. Requiere actualizar juntas
`changePersonalContribution`, `returnPersonalContribution` y la app; no cambian
las reglas ni el formato del archivo local. La anulación inicial conserva sus
permisos Pro; recuperar el resultado ya confirmado no crea una operación nueva.
Ver `docs/PRUEBAS_DEVOLUCION_ANULADA.md`. No se publicó ninguna entrega.

Node 22 quedó probado localmente con las funciones cargadas en su emulador,
llamadas HTTP y eventos reales de Auth/Firestore emulados. El borrado de Familia
fallaba al intentar leer índices privados ajenos; se corrigió mediante
`finalizeLinkedSpaceDeletion`, sin ampliar reglas ni exigir Pro. Esta función
tiene que estar desplegada antes de entregar el nuevo cliente de borrado.
Ver `docs/PRUEBAS_NODE22_BORRADO_CUENTA.md`. No se compiló/publicó app ni servidor.
La versión realmente desplegada en Firebase todavía no se comprobó.

La devolución a Personal sin Pro también quedó preparada el 05/10/2026.
Requiere `returnPersonalContribution` y la limpieza Auth actualizada antes de
activar las reglas/app que la utilizan. Las reglas nuevas rechazan devoluciones
SDK directas de las versiones antiguas, incluso Pro; no publicarlas aisladas.
La conversión de Cajas privadas también requiere el nuevo cliente para copiar
sus retornos históricos. Los archivos cifrados nuevos usan formato 2; la app
nueva lee formato 1, pero no se debe revertir a una app antigua sin comprobar
su compatibilidad. Guía y pruebas: `docs/PRUEBAS_DEVOLUCION_SIN_PRO.md`.
No se generó entrega, no se cambió CODE_MARKER ni se desplegó Firebase.

La tanda de aportes del 05/10/2026 permite cerrar un espacio sin saldo con
aportaciones consumidas, conserva las salidas de Personal y corrige el borrado
local de Cajas. La decisión del propietario quedó registrada en ESTADO.md.
Requiere publicar las Functions actualizadas junto con la app; versiones
antiguas mantienen su comprobación anterior. Las devoluciones tras vencer Pro
se prepararon posteriormente; las pruebas físicas siguen pendientes. Ver
`docs/PRUEBAS_APORTES_CONSUMIDOS.md`. No se generó ni publicó una entrega.

El 05/10/2026 quedó preparada y comprobada la conservación local al cerrar
sesión y la unión Personal por elemento al volver a Pro (`syncFormat: 2`).
No se generó ni publicó un APK/AAB u OTA. Las reglas deben admitir el marcador
antes de distribuir esta app; después de su primera escritura, una versión
antigua no podrá reemplazar la copia de esa cuenta. También quedó preparado el
bloqueo Pro en servidor para Personal/historial, Negocio y Cajas privadas, con
consulta de permisos separada y borrado administrativo sin exigir Pro.
Las funciones nuevas deben estar disponibles antes de distribuir la app;
las reglas no se publican de forma aislada. Las pruebas físicas, Node 22 y
la publicación coordinada siguen pendientes; tarjetas de crédito siguen fuera.
Ver `docs/PRUEBAS_FUSION_PRO.md` y `docs/PRUEBAS_NUBE_PRO.md` antes de entregar
o revertir versiones. No se publicó ningún cambio de esta tanda.

La separación del historial Personal está preparada y probada localmente,
pero todavía **no está disponible en Google Play**. No se ha publicado ni
migrado ninguna cuenta real. Requiere una entrega coordinada de reglas,
Functions, app y migración; no se debe activar solo una de esas partes.

| Fecha preparada | Versión | Marca visible | Estado |
|---|---|---|---|
| 23/08/2026 | 1.0.5 | `23ago-09` | Inicio exacto de tres pantallas aprobado |
| 08/09/2026 | 1.0.6 | `08sep-auditoria-pre-play` | Auditoría integral previa a Play Store |
| 09/09/2026 | 1.0.6 | `09sep-telegram-seguro` | Integración segura de Telegram preparada para prueba local |
| 10/09/2026 | 1.0.6 | `10sep-responsive-android-ios` | Correcciones responsive para Android y iPhone listas en código |
| 10/09/2026 | 1.0.6 | `10sep-exportes-por-espacio` | PDF profesional y exportación separada para Personal, Familia y Cajas |
| 19/09/2026 | 1.0.8 | `14sep-yape-transferencias-seguras` | Versión disponible para testers en Google Play |
| 22/09/2026 | 1.0.8 | Sin nuevo AAB | Auditoría integral y protección de aportes corregidas en código |

La versión 1.0.3 contiene el acceso Google con diagnóstico, copia de seguridad,
Modo Negocio, registro automático, voz, rendimiento, calendario, exportación,
modo oscuro carbón y compatibilidad con pantallas modernas.

La versión 1.0.4 añade:

- Bienvenida con identidad de Fino.
- País y moneda detectados, editables y conservados durante el registro.
- Búsqueda entre 250 países o territorios y 154 monedas.
- Perfiles antiguos y copias de Firestore compatibles con la ampliación.
- Permiso de avisos antes del registro.
- Verificación de correo sin carga infinita y aviso de Spam.
- Inicio, reportes y gráficos adaptados para monedas grandes.
- Saludo sin mostrar el correo completo.
- Dictado más natural, preguntas cuando falta el monto y correcciones por voz.
- Métodos de pago reconocidos y guardados desde el dictado.
- La voz del Yape dice «un pago de un sol» sin tocar el registro automático.

La versión 1.0.5 añade:

- Exactamente tres pantallas iniciales, creadas a partir de los tres paneles
  del diseño aprobado, sin aproximaciones visuales.
- Eliminación del recorrido anterior de cinco pantallas.
- Botones reales sobre el diseño para país, moneda, avisos, Google, crear
  cuenta e iniciar sesión.
- País y moneda siguen siendo editables y los avisos solicitan el permiso real
  de Android sin bloquear el acceso si el usuario lo rechaza.

La firma real de Google Play ya está registrada en Firebase y el acceso con
Google fue comprobado en un teléfono.

La versión 1.0.6 añade la auditoría previa a Play Store: operaciones atómicas
en espacios compartidos, borrado completo de cuentas y espacios propios,
reautenticación de Google, reglas estrictas, permisos mínimos y dependencias
compatibles con Expo SDK 54.

También deja preparada la primera integración de Telegram: vínculo Premium por
código temporal, confirmación obligatoria, desconexión desde Fino, intérprete
determinista y ejecución local o mediante una función protegida por secretos.
El bot local añade un menú compacto de Personal, Familia y Cajas, lee los totales
reales de Fino y permite registrar desde una sola línea. Recuerda el último
espacio y método, ofrece corrección y deshacer, y transfiere de Personal a
Familia o Cajas mediante una operación enlazada y confirmada. Los totales se
muestran separados y el texto rápido acepta sus datos en cualquier orden.
El formulario breve y la confirmación de Telegram muestran monto, descripción y
método de pago verticalmente, evitando que textos o cifras largas queden apretados.
Las transferencias de Personal hacia Familia o Cajas se confirman con monto,
origen, saldo posterior y destino en líneas independientes.
El presupuesto no puede borrarse ni reducirse por debajo del dinero que conserva
transferido en Familia o Cajas; Fino pide devolverlo primero para mantener los
saldos coherentes. Inicio descuenta esas transferencias de Personal y las vuelve
a sumar cuando se devuelven. Los miembros invitados no pueden enlazar su saldo
Personal ni borrar movimientos ajenos; el propietario administra los movimientos
comunes y Telegram respeta las mismas restricciones.

La auditoría responsive corrige áreas seguras, scroll, teclado, textos y montos
largos, modales, listas extensas, barra inferior, recorte de imágenes y pantallas
de primera apertura. También deja configurado el identificador de iOS, limita
la primera entrega de Apple a iPhone y evita cargar funciones nativas de Android
en plataformas o entornos que no las incluyen. La revisión automática pasó; la
validación física de cámara, permisos y teclado de iPhone queda pendiente hasta
contar con un iPhone o una compilación generada desde macOS.

Calidad comprobada:

- TypeScript aprobado.
- ESLint sin errores.
- Más de 100 pruebas aprobadas.
- 7 auditores aprobados.

## Cómo reconocer la entrega

En **Ajustes → Acerca de**, la versión 1.0.8 publicada muestra `14sep-yape-transferencias-seguras`.

## Publicación

- Cada AAB aumenta su número interno.
- El AAB firmado se genera únicamente en el equipo autorizado.
- Los testers actualizan desde Google Play sin desinstalar.
- No se comparten dos instalables diferentes al mismo tiempo.

## Próximo paso

Probar Familia/Cajas con dos cuentas, generar la siguiente actualización Android
y, cuando haya acceso a macOS/Apple Developer, crear y probar la compilación iOS.

## 2026-09-22 · Transferencias como tercer tipo

Personal, Familia, Caja e Historial distinguen las transferencias internas con
color azul, dirección y estado. Las devoluciones se enlazan con los aportes
originales sin convertirse en ingresos o gastos; totales, gráficas, exportación
y Telegram respetan la separación. Se conservó compatibilidad con movimientos
anteriores y con la conversión de cajas privadas a compartidas.

Validación: TypeScript, ESLint, 109 pruebas, 7 auditores y 29 pruebas de funciones
aprobados. No se generó AAB en esta entrega.
