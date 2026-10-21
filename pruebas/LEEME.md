# Pruebas y auditores

21/10 Ahorro: `verificar-lote-borrado-real.mjs` comprueba anulación de gastos
enlazados con guardado SQLite conjunto, tarjeta acumulada sin filas nuevas,
reintento/reinicio y copia atrasada. `FINO_SAVINGS_DELETE_BASELINE=e2858044`
sustituye solo el manejador de borrado por el anterior y produce fallo real
(devuelto 0 en vez de 10). Las pruebas de formularios/resumen verifican aporte
inicial vacío, meta en cero sin tarjeta financiera y gasto restaurado.

21/10 Ahorro: `verificar-ahorro-unificado-real.mjs` cubre una tarjeta compacta
por meta en Ahorro y Personal, los importes recibidos, devueltos, ahorrados y el
objetivo, con colores distintos. Comprueba gastos contra devoluciones, recibos
antiguos, unión de copias antiguas de nube y que aportar/devolver no cree
movimientos artificiales.

20/10 Negocio: la regresión existente `verificar-negocio-interfaz-real.mjs`
comprueba que crear un negocio abra la configuración de Yape/combinaciones y
permita seguir a las categorías; interruptores editan solo la tienda sintética.
Comprueba también que «Categoría» sea un acceso compacto en la fila superior,
tarjeta/CTA del catálogo, flechas y escritura manual con
límite 1–50, orden hora-origen, importe verde/rojo solo en el texto (sin fondo)
y etiquetas Yape/Efectivo. Falla en 4cf65643 porque la hora aparecía después
del tipo de ingreso. No hace escrituras en los datos del emulador.

19/10 Negocio compacto: verificar-negocio-maqueta-real ejecuta captura y modelo
originales (no HTML): exactos/combinaciones/ambiguos, duplicados por aviso frente
a pagos distintos de igual monto, simple, fechas/filtros, vinculación explícita,
marcas de borrado/fusión y fuentes intactas. verificar-negocio-interfaz-real
ejecuta JSX/controlador/contexto originales con hooks e IO adaptados: dos totales,
calendario/Fechas/Ver todo, selección exacta, borrado confirmado, categoría rápida,
Deshacer, volver con borradores y Pro. Ambas rojas en la base 77f7486f por el
comportamiento anterior (no solo por importar un helper nuevo). La interfaz
permite FINO_BUSINESS_UI_BASELINE=77f7486f para repetir el contraste.
Se sustituyen comprobaciones de interfaz V1 obsoletas, conservando cuentas,
sincronización, guardado local y permisos. Aliases puros de Negocio comprobados
sin exceptuar rutas vacías o con lógica; no se acepta inventar un destino.
Pruebas financieras no escriben en el emulador ni en la cuenta real. Metas sigue
en pausa. El recorrido Android y la entrega se documentan en ENTREGAS.md.

19/10 Regreso sin remontar: verificar-regreso-personal-sin-remontar-real ejecuta
selector/nav originales con StackRouter/StackActions instalados reales.
Treinta ciclos conservan Inicio; máximo un espacio delante. Etiqueta saliente,
dos órdenes pendientes, Atrás, entrada directa, raíz Expo, acceso interpuesto,
estado no inicializado, doble toque, error/reintento y otras aperturas cubiertos.
Roja en 5b73fb28 por destruir Inicio; primera solución de la tanda también roja
por apilar el segundo toque saliente, corregida antes de entregar. Suites previas
de destinos/doble toque mantienen sus aserciones con el navegador nuevo.
Android habitual A/B/A/B: 48 cambios, diez regresos por variante,
2.287,4→1.099,5 ms de mediana. No FPS; método, todas las pasadas y limitaciones
en ESTADO.md. Datos locales/remotos iguales 50/260, formularios cancelados y
Atrás revisados. TypeScript/ESLint y 250 pruebas/ocho auditores sin tarjetas.
Sigue medir FPS sostenidos/versión final y listas pobladas; Metas en pausa.

19/10 Cajas sin guardados repetidos: verificar-cajas-guardado-repetido-real
ejecuta la cola original con Android/cifrado adaptados y cuenta cifrados/IO.
Roja en 4d169115 por repetir un cifrado idéntico. Cubre copia autenticada/confirmada,
cambios/objeto mutado en cola, inmediatos y lotes no omitidos, época, migración,
fallo/respuesta perdida/reintento, bytes sustituidos, lectura opcional fallida,
bloqueo de lectura real, sesión cambiada en espera, descarte/borrado, otras claves,
orden y memoria acotada. Suite previa Personal/Cajas SQLite aprobada.
El guardado local sustituye la búsqueda literal de catch por fallo nativo real,
aviso, guardado no confirmado y reintento con cifrado/almacén originales. Android
habitual solo navegación: nueve solicitudes/una escritura, datos financieros
locales/remotos idénticos 50/260. No acredita FPS estables; resultados y pendientes
en ESTADO.md. Metas en pausa y tarjetas fuera.
TypeScript/ESLint generales y 249 pruebas/ocho auditores aprobados.

19/10 Paneles cerrados: verificar-paneles-cerrados-ligeros-real ejecuta selector,
hojas, expresiones de confirmación y fórmulas originales. React/IO adaptados;
selector cerrado sin cálculos/filas, apertura con arrastre/presupuesto, novedades,
reapertura/selección, hojas cerradas sin JSX/categorías/ordenación y preparación
de códigos conservada. Avisos abiertos mantienen IDs exactos. Roja en 4c4564d5
por dos cálculos frente a cero. Compartir/cancelar/fallos de la suite anterior
se conservan, con ausencia de controles al cerrar. Android: navegación,
selector y Crear/Cancelar; datos financieros locales/remotos idénticos 50/260.
No se guardaron formularios. FPS variables sin mejora estable demostrada;
metodología, resultados completos y pendientes en ESTADO.md. TypeScript/ESLint
generales y 248 pruebas/ocho auditores aprobados; Metas en pausa y tarjetas fuera.

19/10 Aviso de selección: verificar-aviso-borrado-seleccion-real ejecuta el
aviso y traducciones originales en tres idiomas. Selección de uno/dos movimientos
sin anunciar borrado total ni «1 movimientos»; cantidad y advertencia monetaria
intactas. Roja en 11efc55b por el título que anunciaba borrar todo. Android
habitual: aviso nuevo visto durante el borrado de un gasto de prueba.
Recorridos de Familia/Cajas documentados en ESTADO.md; 50 movimientos anteriores
idénticos local/remoto y ocho marcas nuevas solo de recibos de prueba retirados.
TypeScript/ESLint y 247 pruebas/ocho auditores aprobados (sin tarjetas). Metas en pausa y
tarjetas fuera. Pendientes red incierta, otro participante y rendimiento.

18/10 Consultas en vuelo: verificar-recargas-espacios-compartidas-real ejecuta
recargar Familia y foco Cajas originales, espera de cuenta y coordinador reales;
solo IO/React adaptados. Reentrada antes de completar (una consulta), manual
que sustituye la anterior, rechazo, ocho segundos de antigüedad, cuentas/sesiones/
revisiones, lista sin miembros, saldos en paralelo y conciliación no parcial.
Roja en f305bf0f por dos consultas frente a una. verificar-guardado-localizado-
espacios-real ejecuta la hoja/campos JSX originales: indicador y bloqueo de
Guardar/cierre/categoría/fecha/notas, conexión a los tres formularios y distinción
del Actualizar general. Roja en f305bf0f por indicador ausente, no API nueva.
Adaptadores anteriores ampliados con dependencias originales, sin retirar
aserciones. 246 pruebas/8 auditores sin tarjetas, TypeScript/ESLint completos.
Android: navegación y marca nueva comprobadas, 50 movimientos/252 marcas y
datos financieros locales/remotos idénticos. Sin guardar movimientos y sin
espacios activos: no prueba confirmaciones financieras Android. Dos pasadas
de navegación en desarrollo: 46,0/36,4 FPS frente a 42,7 anterior, variables;
se incluye la muestra de cuatro cuadros. Presentación no distingue pausas sin
cambios de cuadros perdidos: NO mejora estable demostrada.
Sigue perfilar tirones y comparar controladamente en el emulador/versión final.
Pendientes financieros previos intactos; Metas en pausa y tarjetas fuera.

18/10 Fluidez: verificar-cambio-espacios-ligero-real ejecuta agrupadores,
setters/suscripción y fila JSX originales. React y plataforma adaptados;
no representa una medición Android ni del React Compiler. Diez mil movimientos,
21 renders con fuentes iguales (un agrupado, dos en Cajas por archivo), filtros,
ocultación y llegadas reales; veinte respuestas iguales sin reiniciar oyentes;
cero/ausente, primera lista vacía confirmada y cuenta/sesión. Personal sin ocho
entradas de fila al volver. Roja en dafc53f por 21 agrupados frente a uno;
no API ausente. No escribe dinero real. Pendiente comparar FPS/latencia de
versión final en teléfono físico con datos representativos. Metas en pausa y
tarjetas fuera de auditoría activa.

Corrida final de esta tanda: 244 pruebas/8 auditores sin tarjetas, TypeScript
y ESLint generales aprobados. No se retiran pruebas anteriores. Emulador con
servidor actual y listas conocidas sin vaciado al regresar; comparación financiera
local/remota idéntica (50 movimientos, 252 marcas y Metas intactas), sin guardar
formularios. Sin espacios activos en esa sesión: no acredita detalle financiero
poblado Android ni FPS de una versión final.

18/10 Personal/Familia/Cajas: verificar-aportes-cambio-pantalla-real ejecuta
crear/guardar/editar originales con espera de cuenta real, envío compartido,
registro de devolución, planes de anulación y cálculos originales. React,
almacén y SDK adaptados; no prueba Android ni Firebase publicado. Comprueba
salir al confirmar, doble toque, cuenta A→B/sesión nueva, error remoto/local,
reintento de débito sin repetir envío y respuesta perdida sin dos IDs Personal.
Un rechazo definitivo libera el formulario también al reintentar. Ciclo
S/500→400→500, devolución repetida sin ingreso ordinario extra, anulación del
par sin perder dinero y confirmación antigua sin resucitar la devolución.
Falla contra 655f076 por actualización omitida al salir; la ampliación de red
falló antes del arreglo por dos órdenes remotas. Adaptadores anteriores reciben
captureAccountTask original, no se retiran sus aserciones. Metas en pausa;
faltan ciclo financiero Android/segundo dispositivo y recuperación durable de
altas inciertas tras cerrar el proceso. Tarjetas fuera de auditoría activa.
Corrida final: 243 pruebas/8 auditores sin tarjetas y TypeScript/ESLint generales
aprobados. Revisión visual Android de navegación/formularios cancelados sin
dinero real: 48 movimientos, 234 marcas y fuentes financieras locales/remotas
idénticos. No equivale a probar confirmaciones monetarias en Android físico.

17/10 Confirmación al cambiar de pantalla: 242 pruebas y 8 auditores sin
tarjetas; TypeScript/ESLint generales. verificar-devolucion-cambio-pantalla-real
ejecuta los manejadores originales de Familia/Caja y recordPersonalReturn:
salida durante RPC, duplicado, red, moneda, cuenta A→B→A/sesión, marcas de
borrado y copia familiar. Coordinación original aislada por cuenta/sesión/tipo.
verificar-transferencias-anulacion-real dibuja el componente original sin
Enviado S/0, ejecuta avisos ES/EN/PT, confirmación previa, grupo compartido
ordenado/permisos y borrado confirmado al salir sin escribir en otra sesión.
Ambas fallan contra 2d97a63 por los comportamientos reales anteriores, no por
una API ausente. React/IO/RPC adaptados: no acreditan ciclo financiero Android.
Pruebas de consultas/selección/formulario/lista/invitación/filas diarias
adaptadas a dependencias originales nuevas sin relajar sus aserciones.
Emulador recargado y avisos cancelados sin operar dinero; 48 movimientos,
234 marcas, metas y datos financieros locales/remotos idénticos antes/después.
Faltan reserva de metas para transferir, cuenta de prueba con ciclo completo
y restauración en segundo dispositivo; tarjetas excluidas.

17/10 Selección/devoluciones antiguas: 240 pruebas y 8 auditores sin tarjetas;
TypeScript/ESLint completos. verificar-seleccion-ahorro-real ejecuta selector
original y JSX del menú: una fila individual, resumen por espacio/tipo/día,
grupos bloqueados intactos y un solo Editar funcional. Base 781887d roja por
seleccionar ocho filas al tocar una. verificar-devoluciones-antiguas-real falla
en esa base por bloqueo real; exige espacio cerrado, aportes ya eliminados y
asignaciones exactas, verifica borrado real 62→0 y rechazo de copia atrasada.
verificar-lote-borrado-real añade dos devoluciones juntas y rollback/ACK perdido/
reinicio con SQLite original. Fallos iniciales de dos suites de reparación se
corrigieron aislando la validación nueva de las reparaciones sin borrado antiguo;
corrida completa final verde, sin quitar pruebas. Emulador comprobó una fila
marcada sin marcar la otra y borrado de las dos devoluciones autorizadas;
38 filas y 229 marcas confirmadas en nube. FPS de Ajustes medidos aparte,
no prueban rendimiento de APK final ni cierre de auditoría global.

17/10 Ahorro: 238 pruebas y 8 auditores aprobados con --sin-tarjetas;
TypeScript/ESLint completos. verificar-ahorro-unificado-real y
verificar-metas-edicion-historial-real fallan contra 866b969 por liberar una
meta completada automáticamente y avisar de apartado inexistente, no por API
faltante. Ejecutan cálculos, planificadores y formularios originales: reserva
única, edición 20→10 con objetivo intacto, formulario atrasado rechazado,
compra con una fila y sin ingreso/devolución ficticia, cancelación/borrador y
categoría conservada en montaje repetido. Filtro Ahorro, orden/selección,
parejas completamente devueltas por enlaces, meses distintos y 10.000 filas.
verificar-lote-borrado-real amplía los callbacks/almacén originales con SQLite:
metas/recibos juntos, fallo de disco, confirmación perdida, reinicio, fuentes
vigentes y fila oculta no resucitada por reparación. React/puente Android
adaptados, no escritura física financiera. Revisión visual de lista, formularios
y previsualización cancelada en emulador sin modificar dinero real. Falta ciclo
guardado/restaurado con cuenta de prueba autorizada y segundo teléfono; no
cierra auditoría global ni casos antiguos de hj. Tarjetas fuera de alcance.

16/10 Nube: 236 pruebas y 8 auditores aprobados con --sin-tarjetas;
TypeScript/ESLint completos. verificar-nube-transferencias-antiguas-real usa
guardado/merger originales y comprueba tres transferencias v1 anteriores a las
referencias nuevas: prueba compartida en la misma transacción, conservación de
importes/listas/borrados, 17 rechazos seguros y pausa v1/v2 antes de escribir y
entre filas. IO de Firebase adaptado; no es la prueba de todas las reglas.
verificar-interruptor-nube-real amplía último toque inmediato, disco fallido,
sesión, timers/respuestas anteriores y confirmación Personal/Negocio separada.
Ambas rojas contra 8f0d1ec por comportamiento anterior, no API ausente.
Consultas estables añade pausa/revisión antes de recibir o mostrar errores;
Cajas sincronización comprueba que pausar no programa lecturas/subidas privadas.
En emulador/Firebase se comprobó copia 33/33 sin conflicto, pausa persistente y
reactivación confirmada sin movimientos ni cambio de saldos. Restauración en
otro dispositivo y corte físico en v2 siguen pendientes; históricos hj aparte.

16/10 Cajas/invitación: 235 pruebas y 8 auditores aprobados con --sin-tarjetas.
verificar-recuperacion-invitacion-caja-real ejecuta helper SHA/validadores,
lectura de pantalla y colección/JSX originales con IO adaptado: recibo exacto
tras reinicio, identidad/dueño/moneda, fuente cambiada, cambio ajeno conservado,
lecturas sin cruzarse y lista heredada retirada. Base 52a718d roja por conflicto
de recuperación y segunda lista antigua, no import faltante. Continuidad visual
ampliada reproduce 24 vs36 dp al ocultar lápiz en esa base; actual verde.
verificar-conversion-caja añade salida a Todas durante la espera sin reapertura.
TypeScript/ESLint generales verdes. Sin caída física/reinicio durante conversión
nueva ni unión desde dos cuentas; no declarar toda la auditoría terminada.

Punto 1 de preparación/código/pruebas locales TERMINADO el 10/10; guía
PRUEBAS_CICLO_BORRADO_RESTAURACION.md. App final3: 194 pruebas y 8 auditores
sin tarjetas (una ajena no seguida; 193 previstas Git limpio, no otro checkout
ejecutado). Node 22 final: 64/64 seleccionadas fuera de Telegram/tarjetas.
SDK/HTTP/reglas final: 229/229, exit0 sin fallos/omisiones/cancelaciones;
TypeScript/ESLint generales finales aprobados. No cierre de FINO-52/62 globales
ni de toda la auditoría; no acredita Android ni integración Telegram.
Antecedente SDK 226/227 falló por exceso de expresiones en conversión válida;
app final2 falló historial-separado. Correcciones y repetición completa final
aprobadas; antecedentes conservados en la guía, sin retirar esos casos.
FINO-52 conserva sus siete diagnósticos, que ahora se bloquean sin reemplazar
fuentes; FINO-62 reproduce aportes10+20 y verifica30. Regresiones c6959c6 por
comportamiento, no API faltante. Telegram en pausa; Android/activación pendientes.
Los conteos y fallos de las pasadas del 09/10 siguientes son antecedentes.
Actualización del punto 1: siete diagnósticos FINO-52 conservan fuentes al
detener conflictos, y FINO-62 suma30 en ambos órdenes. La corrección enfocada
del límite de reglas conserva SHA/recibo/tuplas/escape y sello fresco obligatorio
para escritores 2 también sobre raíz antigua. verificar-espera-borrados-cierres-real
ejecuta los callbacks/listeners originales de movimiento/meta/Familia/Caja:
espera ACK, fallos conservan ficha, reintento no repite RPC confirmado y rechazo
remoto previo no bloquea lecturas. Verde actual/roja c6959c6 por comportamiento.
La comprobación enfocada también aprobó 7/7; no sustituye la integral final.
Nueva orden cumplida: terminar SOLO el punto 1 y parar, esperando nueva orden.
Android (2) y servicios/consolas/
activación (3) se mantienen pendientes; no se ejecuta Telegram ni tarjetas para
rellenar esos pendientes ni se declara cerrada toda la auditoría.

Ampliación posterior 09/10: 188 pruebas/8 auditores sin tarjetas, 92 unitarias
Node 22 y 208 SDK/reglas/HTTP locales aprobadas; seis casos SDK de formato
recomprobados al final. TypeScript/ESLint aprobados. Una prueba ajena no
versionada está en 188: 187 previstas Git limpio, no otro checkout ejecutado.
verificar-formatos-copia-real y consultas-estables ejecutan los originales
con IO adaptado; SDK de formatos usa Firestore real local. Regresión 07dfaf0:
rechazos/avisos ausentes y escrituras indebidas, no API faltante. Admin/Telegram
también tienen regresiones rojas/verde. Guía PRUEBAS_FORMATO_COPIA.
El diagnóstico conserva siete casos: cuatro ya se bloquean preservando fuentes,
TRES siguen rojos. No cerrar FINO-52 ni toda la auditoría por estas cifras.
El propietario aceptó exigir actualización; mínimo global/contrato/activación
siguen pendientes. Las notas de siete fallos/cifras siguientes son históricas.

Cierre de esta tanda, 09/10: 187 pruebas y 8 auditores aprobados con
--sin-tarjetas (una prueba local ajena no versionada, 186 previstas Git limpio;
no se ejecutó otro checkout). 88 unitarias Node 22 y 202 SDK/reglas/HTTP locales
aprobadas sin omisiones. Son comprobaciones de código/SDK/adaptadores, no
pruebas de todo Android ni cierre de FINO-52 o de la auditoría.

Refuerzo 09/10: consultas estables y autorizadas, inventario/acciones accesibles,
catálogo y ficha, y resolver/imports de huérfanos. Nuevas suites de originales:
verificar-consultas-estables-real, verificar-consultas-autorizadas-real,
verificar-accesibilidad-pantallas-real, verificar-codigo-huerfano-real y
verificar-ficha-planes-real. Regresiones b6cccc0 rojas/actual verdes; guías
PRUEBAS_CONSULTAS_ESTABLES, PRUEBAS_ACCESIBILIDAD_PANTALLAS,
PRUEBAS_CODIGO_RETIRADO y REVISION_PRIVACIDAD_FICHA.
Servidor Node 22: query-authorization comprueba 13 casos con Firestore real
local; telegram-personal-history rechaza un ID reservado en v1. No producción.
FINO-52: diagnosticos/reproducir-borrados-identidad.mjs tiene SIETE CASOS ROJOS
confirmados y permanece fuera del conteo aprobado, no eliminado ni convertido
en éxito. Guía PRUEBAS_COMPATIBILIDAD_PENDIENTE. No cerrar toda la auditoría
por la batería verde. Usar --sin-tarjetas por decisión del propietario.

Ampliación: verificar-conservacion-borrados-real ejecuta normalizadores con
5001/1001/100000 marcas; Telegram conserva la primera tras 5000 borrados.
verificar-exclusion-tarjetas-real ejecuta el auditor mixto impidiendo leer
las fuentes excluidas y comprueba cinco contratos no ejecutados; el corredor
propaga la decisión, sin cambiar módulos de tarjetas. Ambos baseline b6cccc0
rojos por defecto anterior, no ausencia de un API. El contrato viejo que
llamaba «seguro» al recorte se sustituyó por normalizadores originales.

Configuración/Idioma (09/10): ocho suites nuevas de originales y adaptadores,
enumeradas en docs/PRUEBAS_CONFIGURACION_INICIAL.md. Legacy, rutas, guardado,
avisos, selección, banderas, idioma independiente y aliases; regresiones
19e5dde rojas/actual verde. Guardado usa AES/HMAC y SQLite reales locales;
React/Android/IO adaptados, Settings/alias son contratos estáticos. Batería
180 pruebas/8 auditores sin tarjetas (una ajena no versionada). No acredita
Google/correo reales, UI/TalkBack ni ausencia total de fallos.

Acceso inicial: `verificar-bienvenida-acceso-real.mjs`,
`verificar-registro-reintento-real.mjs` y
`verificar-acceso-inicial-operativo.mjs` ejecutan originales con IO/JSX
adaptado. Regresiones `a1000a5` rojas/actual verde; guía
PRUEBAS_ACCESO_INICIAL_VIDEO.md. Auth SDK real local se comprueba aparte en
`functions/integration-tests/initial-auth.test.js`: no Google nativo,
Microsoft OAuth, envío real de correo ni prueba de todas las pantallas.

FINO-50 parcial: `verificar-accesibilidad-controles-real.mjs` ejecuta JSX/
acciones originales de Toggle, PIN y barras con adaptadores; mes/categorías
son contratos estáticos. Regresiones `FINO_ACCESSIBILITY_BASELINE=53fbf38`
rojas por caso (FINO_ACCESSIBILITY_CASE); actual verde. Guía
`docs/PRUEBAS_ACCESIBILIDAD_CONTROLES.md` separa esto de TalkBack y del
resto de pantallas. No declarar accesibilidad completa.

FINO-47 parcial: `verificar-aceptacion-antes-auth.mjs` ejecuta los tres
manejadores de alta y JSX original con IO/árbol adaptados. Sin aceptación no
inicia Auth; doble toque/cancelación y validación conservados. Regresión
`FINO_LEGAL_AUTH_BASELINE=a80a09b` roja/actual verde. Guía
`docs/PRUEBAS_ACEPTACION_PREVIA_AUTH.md`: no recibo por cuenta, sesiones
existentes, servidor, validez jurídica ni Android. No declarar cierre total.

FINO-49: `verificar-denuncia-contenido-real.mjs` ejecuta cliente/tarea por sesión
y manejador originales con IO adaptado; ACK, doble toque, reintento y desmontaje.
UI estática, no SMTP ni Android. `functions/emulator-tests/content-reports.test.js`
se ejecuta aparte con SDK/Admin/reglas locales, Node 22; 11 comprobaciones.
Captura local anterior a barrera de cuenta roja/actual verde, no APK histórico;
guía `docs/PRUEBAS_DENUNCIAS_CONTENIDO.md`. Términos/bloqueo/envío real pendientes.
Extractor `.ts` corregido: `verificar-extractor-ts-original.mjs`, regresión
`FINO_TEST_HANDLER_PARSER_BASELINE=d965d47` roja; compila genéricos TS reales.


FINO-52 altas nuevas: `verificar-identidad-creacion-real.mjs` ejecuta generador,
fusión y manejadores originales con IO adaptado: máximo común, 100.000 altas,
colisión numérica forzada con UUID distinto, edición, entropía/espacio agotado.
Regresión `FINO_TEST_CREATION_ID_BASELINE=72e816b` roja. Diagnóstico histórico
del máximo común ahora verde, no acreditación total. Migrador Admin con
regresión `FINO_TEST_HISTORY_ADMIN_ORIGIN_BASELINE=72e816b` roja. SDK/reglas
locales prueban manuales/metas/marcador raíz. Guía
`docs/PRUEBAS_IDENTIDAD_CREACION.md`: antiguos, lápidas, otros escritores/
entradas, migración real y Android siguen pendientes. No declarar cierre.

FINO-52 parcial: `verificar-origen-movimientos-conflicto.mjs` ejecuta módulos,
recepción/restauración/setter/recogida del disco originales con IO adaptado:
orígenes distintos de avisos/aportes detienen la unión antes de reemplazar
datos, ediciones/reintentos del mismo origen siguen válidos. Regresión
`FINO_TEST_MOVEMENT_ORIGIN_BASELINE=0a6b9a9` roja. SDK/reglas reales locales en
`functions/emulator-tests/personal-history-client.test.js`, caso «orígenes
distintos»; reglas históricas con
`FINO_TEST_MOVEMENT_ORIGIN_RULES_BASELINE=0a6b9a9` rojas. Guía
`docs/PRUEBAS_ORIGEN_MOVIMIENTOS.md`. Manuales/metas/generador/lápidas,
referencias ausentes, clientes v1 antiguos, migrador Admin y Android pendientes;
diagnóstico global de IDs sigue rojo. No se cuenta FINO-52 como corregido.

FINO-33: lectores de seguridad-continuacion/fusion-pro/nube-pro-servidor
respetan el hash concreto de `FINO_TEST_BASELINE` y distinguen contratos
estáticos de ejecución con IO adaptado. `1` es HEAD, no una versión anterior
permanente. `verificar-fuentes-regresion.mjs` ejecuta los tres lectores
originales; roja con `FINO_TEST_SOURCE_READER_BASELINE=d7cdbe8`, actual verde.
`verificar-cierre-sesion-conserva-real.mjs` conecta logout + bóveda/cifrado/
almacén originales con IO adaptado, verifica Gratis A→B→A, último cambio,
Pro y fallos. Solo logout histórico con `FINO_TEST_LOGOUT_FLOW_BASELINE=276cf53`
es rojo; no es un APK histórico. Guía `docs/PRUEBAS_CALIDAD_REGRESIONES.md`.

FINO-52 NO corregido: se retira la falsa comprobación de cadenas del conteo.
`node pruebas/diagnosticos/reproducir-colision-identificadores.mjs` ejecuta
generador y fusión originales en dos instancias; devuelve error por perder
uno de dos movimientos y una de dos metas. El corredor avisa del pendiente,
no lo cuenta como aprobado. Faltan protección/migración y dos dispositivos.

FINO-51: `verificar-moneda-cuenta-real.mjs` ejecuta manejadores, setter,
unión/recepción/restauración y guardados originales con IO adaptado: cuenta
nueva, moneda fija, país independiente y conflicto sin escrituras v1/v2/por
fila. Regresión `FINO_TEST_CURRENCY_BASELINE=5cd7e09` roja. Contratos de UI
estáticos, no pruebas visuales. Seis comprobaciones aparte con SDK/reglas
Firestore local en `functions/emulator-tests/account-currency.test.js`,
regresión `FINO_TEST_CURRENCY_RULES_BASELINE=5cd7e09` roja. Guía
`docs/PRUEBAS_MONEDA_FIJA.md`; Android/dos dispositivos/publicación pendientes.

FINO-28/29: `verificar-configuracion-release.mjs` ejecuta plugin/mods Expo
originales sobre plantilla SDK real y manifiesto adaptado. Contratos de firma,
idempotencia/preservación/error cerrado; regresión
`FINO_TEST_RELEASE_POLICY_BASELINE=3f41a81` roja. JVM aparte:
`node scripts/probar-politica-firma.mjs` ejecuta Groovy original con DSL/grafo
adaptados y valores ficticios; no firma. Guía
`docs/PRUEBAS_ANDROID_CONFIGURACION.md` incluye merger debug real y pendientes
release/Android/clave. No requiere carpeta Android generada para la prueba Node.

FINO-32: `verificar-permiso-calendario-real.mjs` ejecuta programador, contexto,
efecto e interruptor originales con IO sustituido: carga sin petición, intención
explícita consumida una vez, concesión/negación/canal, retiro propio, guardado
confirmado/doble toque/fallo. Regresión
`FINO_TEST_PAYMENT_PERMISSION_BASELINE=450f29d` roja. Guía:
`docs/PRUEBAS_PERMISOS_CALENDARIO.md`. No monta React ni prueba Android.

FINO-35: `verificar-pdf-limites-real.mjs` ejecuta extractor/fflate reales con
compresión Node independiente y observador de clase real; pantalla con IO
adaptado. Bomba sintética, límites/acumulado, sin parcial, formatos y 10.000
filas. Regresión `FINO_TEST_PDF_LIMITS_BASELINE=595cf99` roja. Guía:
`docs/PRUEBAS_LIMITES_PDF.md`. No mide memoria/UI/Hermes Android.

FINO-30: `verificar-entrega-exportacion-real.mjs` ejecuta manejadores originales
y catálogo con IO sustituido: preparar no confirma envío; subir/guardar espera
respuesta, fallos/doble toque/reintento. Regresión contra
`FINO_TEST_EXPORT_DELIVERY_BASELINE=ac8ebd7` roja. Guía:
`docs/PRUEBAS_ENTREGA_EXPORTACION.md`. No es Android ni recibo de terceros.

FINO-24: `verificar-privacidad-buzon-yape.mjs` comprueba contratos estáticos y
ejecuta política original. `node scripts/probar-receptores-kotlin.mjs --notification-privacy`
compila/ejecuta Kotlin ORIGINAL con JSON/JCE reales y adaptadores Android/Keystore,
sin descargar dependencias ni declarar prueba física. Regresiones contra
`FINO_TEST_NOTIFICATION_PRIVACY_BASELINE=257813c` rojas. Guía:
`docs/PRUEBAS_BUZON_YAPE_CIFRADO.md`. Nuevo APK acumulado/Android pendientes.

Privacidad del candado/Inicio: `verificar-privacidad-candado.mjs` ejecuta puente,
efectos y PrivateModal originales con adaptadores; `verificar-privacidad-inicio.mjs`
extrae formato/fila reales y ejecuta el componente de aportes original. Kotlin:
`node scripts/probar-receptores-kotlin.mjs --screen-privacy`. Guía y limitaciones:
`docs/PRUEBAS_PRIVACIDAD_CANDADO_INICIO.md`. Regresiones `6672b08` rojas.

Voz y campana: `verificar-voz-privacidad.mjs` ejecuta la política exportada y
contrasta textos/configuración, NO audio/tráfico. `verificar-campana-movimiento-real.mjs`
extrae efecto/ref originales y ejecuta el hook y catálogo con IO adaptado,
NO una animación renderizada. Regresiones con `FINO_TEST_VOICE_PRIVACY_BASELINE`
y `FINO_TEST_BELL_MOTION_BASELINE` contra `cb7f1e2`. Guía:
`docs/PRUEBAS_VOZ_CAMPANA.md`. Android/TalkBack/proveedor siguen pendientes.

`verificar-horario-exportacion.mjs` ejecuta el catálogo real de tres idiomas:
aviso de retrasos, intento previsto y prueba no promete puntualidad; comprueba
también la conexión nativa. `scripts/probar-receptores-kotlin.mjs` ejecuta la
política Kotlin original con callbacks, no AlarmManager/Android físico. Regresión
del catálogo: `FINO_TEST_EXPORT_TIME_BASELINE=24f5757`. Guía y límites:
`docs/PRUEBAS_HORARIO_EXPORTACION.md`.

`verificar-receptor-exportacion.mjs` comprueba estáticamente el contrato de
receptores: trabajo privado y arranque separado. `node scripts/probar-receptores-kotlin.mjs`
compila/ejecuta Kotlin original en JVM con adaptadores de Android; exige JAR
locales/Java y no se cuenta como prueba física ni se omite silenciosamente.
Gradle debug comprueba por separado SDK/manifiesto; guía y regresiones:
`docs/PRUEBAS_RECEPTOR_EXPORTACION.md`.

`verificar-lote-importe-caja.mjs` ejecuta contexto/setters/cliente/colas/almacén
originales y SQLite real: comprobante genuino, tres claves, reserva corta,
repreparación, fallos, versiones, otros movimientos y 10.001 filas/1.001 Cajas.
También proporciona el mismo arnés a pruebas SDK/HTTP locales. Guía:
`docs/PRUEBAS_LOTE_IMPORTE_CAJA.md`. Regresión
`FINO_TEST_MONEY_BATCH_BASELINE=ddde38d` falla por API nueva ausente; no afirma
un bug publicado. Pantalla/petición/Android siguen pendientes.

`verificar-auditoria-sin-artefactos.mjs` comprueba el recorrido original del
auditor de código: conserva las carpetas de fuentes y excluye cachés/resultados
que podían agotar el tiempo o aparentar usos. Regresión:
`FINO_TEST_AUDIT_WALK_BASELINE=ddde38d`.

```bash
node pruebas/correr.mjs
```

Desde la raíz del proyecto. Descubre las pruebas nuevas y muestra el número
actual de pruebas y auditores. Si algo falla, dice cuál y en qué.

Antes de publicar cualquier cosa, además:

```bash
npx tsc --noEmit
npx eslint app screens components utils constants contexts modules
```

Las funciones del servidor tienen pruebas separadas. Desde `functions`,
`npm test` ejecuta sus pruebas unitarias. `npm run test:server` exige Node 22
real y ejecuta reglas, SDK, HTTP y eventos de Auth/Firestore en emuladores
locales con cuentas ficticias. No despliega ni necesita datos de producción.
Requisitos, regresión y límites: `docs/PRUEBAS_NODE22_BORRADO_CUENTA.md`.

La base de corrección remota Personal/Caja tiene diez pruebas unitarias y una
suite SDK/HTTP separada. No está habilitada en la app; falta integrar selección,
conservación y guardado local. Alcance, comandos y regresión:
`docs/PRUEBAS_DIFERENCIAS_DINERO_SERVIDOR.md`.

---

## Qué comprueba cada cosa

`verificar-cliente-importe-caja.mjs` ejecuta cliente/coordinador/validadores
originales: fuentes frescas dentro de revisión, originales pendientes en disco,
confirmación genuina ligada a cuenta/sesión/cola, respuesta perdida/copiada,
fallos y cambios sin confirmar dinero local. La suite SDK/HTTP del cliente está
en `functions/integration-tests/private-box-money.test.js`. El contexto dispone
del lote comprobable, pero pantalla/petición siguen sin activar; guía y límites:
`docs/PRUEBAS_CLIENTE_IMPORTE_CAJA.md`.

`verificar-recuperacion-incompleta-cajas.mjs` ejecuta el plan, aviso, manejador
de entrada y guardado originales con SQLite real: Caja cerrada/convertida,
fechas/montos/repartos dañados, filas ilegibles, identidad disponible y no
mezclar datos compartidos. No reconstruye ni escribe un plan antiguo inseguro;
las recuperaciones positivas se mantienen. SDK emulado lee también fuentes
dañadas/cerradas sin modificarlas. Regresión y límites:
`docs/PRUEBAS_RECUPERACION_INCOMPLETA_CAJAS.md`.

`verificar-nombres-caja-nube.mjs` ejecuta auxiliares, transacción, elección,
reintento y guardados originales; confirma ambos nombres antes de la red,
rechaza fuentes/sesiones/planes obsoletos y no toca dinero. Incluye rollback
y respuesta perdida con el contexto/almacén originales sobre SQLite real,
no Android. La prueba de copia por cuenta cubre conservar revisiones A→B→A.
`private-boxes.test.js` prueba también dos SDK concurrentes y reglas reales
emuladas. Regresión contra 482f2fd y límites:
`docs/PRUEBAS_NOMBRES_CAJA_NUBE.md`.

`verificar-enlace-heredado-explicito.mjs` ejecuta la elección/confirmación
originales y sus condiciones: iguales importes/fechas, IDs únicos, no borrados,
cancelación, cambios de fuente/cuenta/plan. La matriz SQLite original también
comprueba el guardado de ese enlace. Guía, regresión y límites:
`docs/PRUEBAS_ENLACE_HEREDADO.md`.

`verificar-reparacion-pares-cajas.mjs` comprueba recuperaciones con IDs,
conservación ante diferencias/borrados/consumo, elección explícita y el guardado
original sobre SQLite real (no Android físico). Incluye pantalla/contexto
originales, rollback, respuesta perdida y fuente/sesión remota. Regresión contra
0f0588f y límites: `docs/PRUEBAS_REPARACION_PARES_CAJAS.md`.

`verificar-cajas-sincronizacion.mjs` cubre versiones, conflictos, datos inválidos,
cache/sesión, respuesta encolada, conversión con vista vieja y marcas de consumo
con los auxiliares/manejadores propios reales. La prueba SDK está en
`functions/integration-tests/private-boxes.test.js`. Guía y límites:
`docs/PRUEBAS_CAJAS_PRIVADAS.md`.

`verificar-consultas-espacios.mjs` ejecuta manejadores originales de Familia y
Cajas con respuestas diferidas: cuenta/sesión, consulta superada, borrado,
caché, miembros y cierres. La prueba de fuentes reales está en
`functions/integration-tests/shared-sources.test.js` (SDK/Auth/Firestore local).
Regresión, comandos y límites: `docs/PRUEBAS_CONSULTAS_ESPACIOS.md`.

### Pruebas (`verificar-*`)

| | |
|---|---|
| `voz-exportar` | Que "exportar julio pdf whatsapp a mamá" se entienda entera: mes, formato, destino, tipo, gráficos y a quién |
| `orden-voz` | Que **el orden no importe**: las 720 formas de decir la misma orden, más las 120 sin nombre |
| `contactos` | Los números de teléfono como los quiere WhatsApp, y a quién va el archivo en el momento de mandarlo |
| `categorias` | Las categorías personalizadas y el recorte de la imagen |
| `pdf` / `pdf-mixto` | El documento: rosquilla, gráficos, escapado, la lista completa, y si se aprieta para caber en una hoja |
| `excel` / `excel-export` | Leer y escribir .xlsx, con las fechas sin correrse un día |
| `exportar` / `programado` | Cuándo toca la exportación automática y qué mes lleva |
| `panorama` | Las cuentas de Reportes: que el disponible sea el mismo que en Inicio |
| `paises-monedas` | Catálogo mundial completo, sin monedas ausentes ni cambios peligrosos en Firestore |
| `bloqueo` | El PIN, la huella y el bloqueo progresivo |
| `archivo-entrante` | Compartir un estado de cuenta a Fino |
| El resto | Gráficos, etiquetas que no se pisan, resúmenes por día |

### Auditores (`auditar-*`)

| | |
|---|---|
| `textos` | Que las 718 claves estén en los tres idiomas y ninguna falte |
| `redaccion` | Cómo están escritos esos textos |
| `codigo` | Lo que quedó sin usar |
| `pantallas-externas` | Que salir a otra app y volver no rompa nada |
| `fondo` | Claves repetidas, erratas de puntuación, ceros escritos como O, `console.log` olvidados, funciones con el mismo nombre en dos sitios |

---

## Cómo escribir una prueba nueva

**Tiene que fallar contra la versión anterior.** Una prueba que pasa siempre
no está probando nada: da tranquilidad sin dar información. La forma de
comprobarlo es escribirla ANTES del arreglo y ver que falla.

Y que el mensaje diga qué se rompería si fallara, no cómo funciona por dentro:

```
ok(normalizePhone("999888777") === "51999888777",
   "un numero peruano suelto recibe su codigo de pais");
```

Si es un `.mjs` suelto, con dejarlo en esta carpeta ya entra: el lanzador los
busca solos. Si es un `.ts` que carga código de la app, hay que apuntarlo en
`correr.mjs` con los sustitutos que necesite.

## Los sustitutos (`stubs/`)

Estos archivos cargan código de la app, y la app habla con Android. Aquí no
hay Android: se cambia `react-native` y algún módulo de Expo por versiones que
no hacen nada. Lo que se comprueba son las **cuentas** y el **texto** que sale,
no el dibujado.

Había dos sustitutos de react-native, cada uno con piezas distintas, y cada
prueba usaba el suyo. Así es como dos pruebas se quedaron paradas meses sin
que nadie se enterara. Ahora es **uno solo**: si a alguna le falta algo, se
añade ahí y lo tienen todas.

## Preparación del archivo de originales monetarios

`verificar-originales-importe-caja.mjs` ejecuta Cajas y plan monetario puros,
cuatro fuentes, validación/metadata/versiones, límites y cifrado/bóveda reales
con sustitutos de Android. La regresión b48e703 pierde el campo al normalizar.
No es pantalla/envío/guardado monetario conectados ni Android físico. Ver
`docs/PRUEBAS_ORIGINALES_IMPORTE_CAJA.md` para alcance y siguientes pasos.

## Coordinación de respaldo y alcance sin tarjetas

`verificar-barrera-personal-caja.mjs` ejecuta la cola/nube/historial/contexto
originales con red y almacenamiento aislados. La regresión c24eff0 reproduce
un respaldo de Personal pese a la revisión Caja pendiente. No es Android ni
la corrección monetaria de pantalla, que todavía falta conectar. Guía:
`docs/PRUEBAS_BARRERA_PERSONAL_CAJA.md`.

Por la exclusión del propietario, ejecutar `node pruebas/correr.mjs --sin-tarjetas`
omite sus dos suites específicas y no las cuenta como aprobadas. Sin esa opción
se conserva la ejecución completa; con un filtro el total muestra solo lo que
se ejecutó. La compilación/lint generales no equivalen a auditar ese módulo.

Cuatro archivos históricos (`verificar-archivo-entrante.mjs`,
`verificar-bloqueo-importar.mjs`, `verificar-carrera-inicio.mjs` y
`verificar-bloqueo.mjs`) simulan pasos de navegación/candado, pero no ejecutan
el componente ni Android. El corredor los conserva para consulta y permite
ejecutarlos con un filtro explícito, pero no los cuenta en la batería normal.
Sus casos deben comprobarse en un teléfono según
[`docs/PRUEBAS_NAVEGACION_CANDADO.md`](../docs/PRUEBAS_NAVEGACION_CANDADO.md).
