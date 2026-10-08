# Entregas de Fino

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
