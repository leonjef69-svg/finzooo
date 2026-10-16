# Familia y Cajas — auditoría del 15/10/2026

## 16/10/2026 — navegación sin fundido a vacío y ocultación conservada

Marca `16oct-cambio-suave-saldo-oculto`. Navegador dentro del proveedor visual;
fondo crema/oscuro coincidente y reemplazo lateral uniforme para Personal,
Familia y Cajas, sin fade completo. Preferencia de movimiento reducido respetada.

Home perdía hideBalance y collapsedPreviousBalanceMonths al desmontarse. Se
extrae preferencia local cifrada por cuenta/sesión, memoria síncrona antes del
guardado y lectura inicial conservadora para no revelar saldo. Se conserva la
ocultación por mes; Mostrar restaura solo la presentación. Archivo/limpieza de
cuenta incluye la clave nueva; sin nube ni dinero nuevo.

Regresiones originales: remonte tras ocultar (a846c19 vuelve a mostrar tarjeta),
disco/reinicio/errores/cuentas/lectura tardía y opciones/fondos (a846c19 blanco
distinto de bg-white crema). Android comprobó ocultar → Familia → Cajas → Personal
sin reabrir tarjeta, conservando importes. Solo preferencia/navegación; grabación
y capturas fuera de Git. Primera consulta sin copia puede requerir red.
234 pruebas y 8 auditores sin tarjetas aprobados; TypeScript/ESLint completos
sin errores. Grabación de 78,3 s muestreada en 1566 instantes cada 50 ms, sin
pantalla totalmente vacía en ese muestreo. La primera pasada falló por el
adaptador que impedía importar constants/style (solo datos) desde visualTheme;
actualizado con el módulo original y repetida la batería completa aprobada.

**Sigue/falta:** segunda cuenta/Android, recuperación tras cierre abrupto,
volumen/costes, tres casos antiguos y límites de auditoría anteriores. Sin
APK/AAB/OTA/Play, Functions/reglas ni cambios monetarios.

## 16/10/2026 — lista compartida inmediata al volver

Marca `16oct-lista-cajas-completa`. El componente recordaba privadas pero
reiniciaba compartidas/saldos al desmontarse. Esa asimetría producía la lista
incompleta y el giro automático de Actualizar que muestra la captura nueva.
Se reutiliza cajasMemoria para la última lista compartida completa y sus saldos,
separados por UID/sesión, sin disco ni autoridad para operaciones financieras.

Al volver se pintan privadas y compartidas juntas; consulta automática discreta,
manual con indicador. Cerrar/salir confirma y retira la copia visual; respuestas
tardías o de otra sesión no la alteran. No se recuerda una lista parcial como
completa solo por haber abierto/unido/creado una Caja. Si aún no existe copia,
la primera consulta espera antes de mostrar una lista aparentemente completa.

Regresión con inicializadores, setters, consulta y memoria originales: volver,
red lenta/fallida, cierre/retirada, remoto vacío, manual, UID y sesión. Contra
35ca9d2 reproduce la lista vacía y carga activa de la primera imagen, no una
API ausente. Ajustado contrato estático antiguo que prohibía cualquier variable
de actualización: ahora se permite el indicador de Actualizar voluntario y se
comprueba que la consulta automática no lo active.

Android: Personal → Cajas conserva «uyyj» y «j», saldos visibles sin escalón
entre tarjetas ni giro automático. Ninguna operación de dinero, creación,
cierre o borrado en esta pasada. Capturas .tmp/lista-cajas-* fuera de Git.
Verificación final: 232 pruebas/8 auditores sin tarjetas; TypeScript y ESLint
completos sin errores. La pasada inicial detectó el contrato estático anticuado
ya descrito; corregido y repetida la batería completa con resultado aprobado.

**Sigue/falta:** primer acceso tras reinicio completo depende de la red; unión
desde segundo Android/cuenta y pendientes históricos de auditoría siguen sin
cerrarse. Los tres casos antiguos de «hj» intactos. Sin despliegue ni recopilación.

## 16/10/2026 — sustituir el formulario antiguo, no solo ocultarlo

Marca `16oct-formularios-familia-cajas`. La captura nueva permitió distinguir el
error real de una recarga pendiente: tras convertir una Caja con Invitar,
SharedBoxes todavía abría su formulario inline antiguo al tocar Agregar dinero.
Se elimina ese formulario y se conecta SpaceMovementSheet, ya usado en Familia
y Cajas privadas. Se reutilizan los campos existentes de categoría/fecha/notas,
método y vínculo Personal. Se valida fecha, saldo y moneda; un fallo local tras
confirmar el movimiento remoto reintenta el mismo débito sin otro movimiento.

Crear Caja pasa inmediatamente debajo de Crear/Unirme y antes de las cajas.
Invitar responde con la hoja de código en preparación y no la reabre si se
cerró durante la espera. Familia deja de invalidar/recargar todas las consultas
financieras por una invitación. Las operaciones monetarias siguen invalidando y
confirmando como antes. Actualizar conserva el detalle conocido y no inserta
una banda de carga que mueva controles. No se promete red instantánea ni se
oculta la primera carga sin copia disponible.

Prueba Android: crear únicamente Caja temporal vacía S/0, invitar/conversión
real, abrir/cerrar código y observar el formulario moderno. Sin guardar dinero;
cerrada solo la Caja temporal, lista original conservada. Familia «ww» S/400:
generación real de código, cierre sin cambiar familia, saldo o historial;
actualización con lista en el mismo sitio. Capturas/códigos excluidos de Git.

231 pruebas/8 auditores sin tarjetas, TypeScript/ESLint completos aprobados.
Nueva regresión ejecuta guardar e invitar originales, falla contra b3676c5 por
descarte de categoría/notas/fecha; comprueba validaciones, reintento de débito
único y que Invitar no recargue Familia mientras el dinero sí se confirma.

**Sigue/falta:** unión real en segundo Android/cuenta y auditoría histórica de
diario durable/volumen/pares incompletos. Los tres casos de «hj» permanecen sin
reconstruir ni borrar. Sin despliegue, cambios de esquema o datos recolectados.

## 16/10/2026 — Invitar no reactiva Ingreso/Gasto al fallar

La rama de error restauraba automáticamente el formulario. Ahora queda plegado
y el borrador sigue guardado hasta que el usuario elija Agregar dinero. Pruebas
de error verifican que no reaparezca el formulario ni se toquen los movimientos.
Suite completa: 230 pruebas/8 auditores; TypeScript/ESLint sin errores. El emulador
sigue conectado al Metro del proyecto, pero falta observar la nueva pantalla.

## 16/10/2026 — evitar el destello de aceptación legal

La captura mostraba el aviso «Antes de crear o compartir contenido…» durante la
carga de Cajas. El componente presentaba el aviso mientras `hasAcceptedLegalDocuments`
leía el recibo cifrado local, y enseguida lo ocultaba cuando encontraba una
aceptación válida. Ahora no monta ese aviso durante el estado de comprobación;
si no hay recibo válido, se presenta tras concluir la lectura. No altera la
aceptación ni los datos financieros.

Metro 8081 sirve el bundle Android con la marca nueva y el emulador mantiene una
conexión activa a ese servidor. Sigue pendiente observar visualmente este cambio
en el emulador. Sin escritura a Firebase, edición o borrado de datos de usuario.

## Octava pasada — invitar oculta el formulario durante la espera

La invitación comparte el mismo detalle y el estado React conservaba una
operación de Ingreso/Gasto o edición de aporte que ya estaba abierta. Por eso el
el código aparecía con ese formulario y el botón lápiz de renombrar al fondo
mientras Firebase respondía. Ahora se ocultan desde el toque el formulario,
edición del nombre, Seleccionar y lápiz, antes de la petición. Al completarse,
Agregar dinero recupera el borrador; si falla, el formulario permanece plegado.
No se escribe ni se modifica movimiento alguno.

Prueba del manejador original con fixture sin dinero real y pruebas focalizadas
verifican la vista oculta antes de resolver la promesa, la recuperación del
borrador y que el fallo no reabra la vista anterior. La comprobación Android mostró el hueco
anterior durante la espera; el emulador ahora sirve el paquete actualizado con
la marca de esta versión, pero falta observar visualmente la nueva espera.
Sigue pendiente unión con otro Android/cuenta; sin cambios monetarios.

Alcance: Cajas privadas y compartidas, Familia, aportes/ediciones/borrados,
devoluciones, cierre/salida, invitaciones, lectura y conservación de originales.
Tarjetas, Telegram, cobros, cambios de facturación y publicación fuera del cambio.
No se crean, corrigen ni borran movimientos de la cuenta del propietario.
Excepción autorizada posterior: comprobar la conversión/invitación de su Caja
S/88 conservando importes, historial y Personal; no tocar «hj» ni devolver dinero.

## Séptima pasada — mismo diseño antes y después del código

Marca 15oct-caja-mismo-diseno. La sexta pasada quitó la segunda ruta/lista, pero
el detalle de SharedBoxes mantenía su presentación antigua. Se alinean tarjeta,
devolución, Agregar dinero/Cerrar, totales e historial con el detalle privado.
No se cambian protocolos de dinero ni invitaciones; el formulario aún permite
Ingreso/Gasto. Seleccionar despliega las acciones originales de edición/borrado
y denuncia, sin elevar permisos ni añadir borrado masivo.

Prueba nueva renderiza el JSX original, usa linkedTransfers real para la muestra
aislada y comprueba orden, controles, permisos, gasto rojo, selección y abrir/
cerrar código sin acciones monetarias. Contra 9a29f31 falla por los botones viejos.
Suite final estable: 230 pruebas y 8 auditores sin tarjetas, TypeScript/ESLint
completos sin errores. Registros .tmp/caja-mismo-diseno-app-15oct.log y asociados.

Comprobación Android autorizada sin uso simultáneo: «ww» compartida con S/100 e
historial real, abrir código y cerrar con Atrás conserva el mismo fondo moderno.
No se convirtió otra privada, no se hizo ningún movimiento/devolución/cierre/
borrado. La preparación del código puede requerir red y conserva su indicador.
Capturas/códigos excluidos de Git; sin APK/OTA, servidor, reglas ni nuevos campos.

**Sigue/falta:** unión desde segundo Android/cuenta real y pendientes históricos
de diario durable/volumen/pares dudosos. No se reconstruyen ni borran mitades
antiguas y no se presenta esta corrección visual como auditoría financiera completa.

## Sexta pasada — una lista y código sin recarga financiera

Marca 15oct-cajas-lista-unica. El usuario señaló falsa advertencia de conversión
pendiente durante el intento, código en otra pantalla, cambio al salir y una
segunda lista con otro Unirme. Se elimina el acceso extra y la ruta interna
huérfana /shared-boxes; las cajas compartidas se muestran JUNTO a privadas en
la lista de Cajas. No se fusionan libros ni se convierten al listarlas. Lecturas
por sesión y cancelables; sus saldos/monedas vienen del historial, nunca ceros
supuestos mientras carga. La selección existente mantiene el orden; una salida/
cierre confirmado retira la tarjeta antes de refrescar, sin reaparecerla.

Detalle compartido incrustado en /boxes, con caja/código originales. Atrás/Ver
todas regresan a la lista única; cerrar código no limpia selección ni sus datos.
Miembros e Invitar en la fila superior, igual que Familia. Hoja reutilizada para
miembros, denuncia de espacio/persona y retirar acceso con roles intactos. La
privada muestra al único dueño; la compartida solo sus integrantes reales.

La señal persistida sharingPending se conserva para recuperación, pero no se
presenta como fallo mientras compartiendo es verdadero. Se conserva el aviso
solo si el resultado es realmente incierto, sin desactivar comprobaciones del
servidor. Indicador en el botón de actualizar, sin mover controles ni texto
No repitas la acción. Carga/error no muestra noResults ni cierre engañosos.

Crear invitación usa la exclusión original de doble toque pero NO reinicia
la comprobación financiera. Un bloqueo monetario separado evita descartar una confirmación
que llega mientras se genera un código; dinero real mantiene épocas, bloqueo,
comprobación de espacio abierto y recarga. No se cambia protocolo de dinero.
Regresión 4bc800e: aviso pendiente durante proceso; segunda regresión original:
confirmación descartada por lock de Invitar. Ambas rojas por comportamiento,
no por exportaciones inexistentes. Suites anteriores conservadas; contratos
de rutas/entrada adaptados a la lista única. Última pasada estable:
229 pruebas y 8 auditores sin tarjetas; TypeScript/ESLint sin errores/avisos.
Registro .tmp/cajas-lista-unica-final-15oct.log; no confundir con pasadas
intermedias. Esperar código después de retirar privada muestra carga, no otra lista.

Android del emulador: lista única, S/88 ya compartida conserva externo88 y
aporte100/devuelto100, propietario1; Miembros abre detalle real; Invitar genera
código, Compartir abre selector con el mismo código/instrucción y se cancela
sin destinatario. Cerrar hoja conserva caja, historial y saldo; Atrás regresa
a lista única, sin otra pantalla compartida. No se probó moviendo dinero,
cerrando/borrando datos del dueño ni convirtiendo nuevas privadas.

**Sigue/falta:** prueba con dos Android/cuentas reales y los pendientes previos
de diario durable/volumen/pares antiguos. Esto no resuelve la intención de «hj»
ni autoriza reconstruir mitades borradas. Sin campos/colecciones/retención nuevos,
servidor/reglas, APK/AAB/OTA/Play ni tarjetas.

## Quinta pasada — operaciones explícitas sin resucitar los tres borrados

Marca 15oct-caja-historial-conservado. El dueño pidió quitar Archivar caja y
avisos técnicos, después denunció que no podía agregar, devolver, borrar ni
cerrar. No se deduce que autorizara restaurar las tres mitades de Personal.

La excepción opera solo con contraparte AUSENTE + marca de borrado + identidad
exacta y sin otros conflictos de la caja: permite ingreso externo/Personal,
gasto nuevo, devolución NUEVA calculada del libro actual, borrado explícito y
cierre con saldo cero/aportes liquidados. No repara libros al abrir, no retira
registros antiguos sin elección y no restaura ni borra saldos de Personal de
oficio. Cerrar conserva las marcas ausentes; liquida solo contrapartes existentes.
Las ausencias sin marca se comprueban todas, aunque el plan las omita al hallar
otro conflicto; contraparte reaparecida, duplicados, formatos/valores inválidos,
conversión incierta y revisiones monetarias mantienen sus protecciones.

Sin oferta Archivar al cerrar/borrar; compatibilidad de lectura/restauración
conservada. Sin diálogo/toast técnico automático en acciones de «hj». Revisar
transferencias queda como entrada voluntaria de la caja actual. Invitar queda
desactivado en ella: no se usa la excepción para una conversión que podría
reconstruir los pares. Familia y cajas sanas siguen separadas de esos conflictos.

Validación final: 228 pruebas + 8 auditores sin tarjetas, TypeScript/ESLint
sin errores/avisos. Acciones originales, contexto original y SQLite real:
aportes externos/Personal conservan cuatro filas antiguas; devolución nueva
S/10 una sola vez; gasto sin mover Personal; cierre en cero con tres marcas
antiguas intactas; borrado elegido sin abono inventado; rollback deja ambos
libros originales. Regresión de acciones contra 361466b falla por bloqueo real
en la misma caja, no por función ausente. Nueva prueba de avisos reproduce
diálogo automático anterior y confirma revisión voluntaria/Familia aislada.

Android mostró «hj» S/20 con botones activos. Durante la captura siguiente
pasó a S/10 y el dueño confirmó que él pulsó Devolver S/10. Se detuvieron los
toques para no interferir; no se prueba cerrando/borrando/creando datos suyos.
No afirmar que el agente restauró dinero ni que permaneció S/20 después de su
acción. Primer Fast Refresh de exportación nueva falló transitoriamente; la
reentrada posterior mostró la pantalla nueva. No limpiar datos ni reinstalar.

**Sigue/falta:** invitación/conversión de «hj», intención histórica de sus tres
casos, diario durable/dos Android/volumen y los pendientes anteriores. Sin
nuevas colecciones/campos/retención, Functions/reglas ni APK/AAB/OTA/Play.

## Cuarta pasada — código, compartir y acceso a las cajas compartidas

Marca 15oct-codigo-compartir. Invitar no abre la revisión financiera ante pares
privados dudosos: aviso breve sin código supuesto; protección conservada.
La hoja real incorpora Compartir nativo, Copiar y texto según Familia/Caja.
Cajas incorpora entrada visible a compartidas (antes no existía): no bloqueada
por Pro del invitado ni por pares de otra privada. No modifica libros/saldos.

15/15 Firebase SDK/reglas aisladas: generar con el cliente original y unirse
desde otro UID sin Pro, misma raíz e historial intactos, dueño conservado,
consumo de código atómico, caducidad/roles/carreras protegidos. Prueba UI original
ejecuta los botones reales; 99d0be2 falla por ausencia de Compartir. Otra
regresión demuestra que antes Invitar abría el aviso técnico. TypeScript/ESLint
completos y 227 pruebas/8 auditores finales verdes sin tarjetas.

Android autorizado: Caja S/88 verificada compartida, externo88 y aporte100/
devuelto100 conservados; código real, selector nativo con texto coincidente y
cancelación sin destinatario/envío. Personal antes/después idéntico. «hj» privada
S/20 intacta. No borrar cuentas ni crear dinero ficticio. Conexión de desarrollo
recuperada al detectar Metro apagado; sin limpiar datos. Dos capturas Windows
agotadas; comprobación mediante conexión Android. No acredita ingreso de otro
teléfono real ni cambia servidor/reglas. Código de acceso no se guarda en Git.

**Sigue/falta:** los tres pares de «hj» siguen sin intención demostrada; no
inferir devolución de una marca de borrado. Diario durable, dos cuentas/Android,
volumen y demás límites anteriores continúan. Al cargar una compartida se vio
texto vacío y Cerrar bajo el indicador; no se ejecutó cierre y queda revisión
visual pendiente. Sin publicar APK/AAB/OTA/Play ni retomar tarjetas.

## Tercera pasada — acción inmediata y evidencia remota de «hj»

Solicitud adicional: la respuesta visual debe ser inmediata, no tras ACK. Se
añade withImmediateRemoval para ocultar IDs solo en presentación antes de enviar
la operación ya autorizada. No escribe libros/disco/nube ni quita marcas de
borrado; los cálculos y barreras financieras siguen usando registros confirmados.
Se ocultan filas/fichas en Familia y Cajas privadas/compartidas. Error/false
retira la máscara y muestra la fuente intacta. No se anuncia éxito anticipado
ni se publica tras abandonar la sesión. Un proceso interrumpido sigue necesitando
el diario durable pendiente: no atribuirle esa garantía a una máscara React.

El dueño respondió «No lo recuerdo» sobre la intención de los tres borrados.
Se incorporó «Comprobar copia · sin cambiar datos» a la revisión: lecturas del
servidor mediante la sesión del dueño, con el acceso Pro existente, solo de IDs
afectados. No se usa acceso administrativo ni se guarda una copia nueva. El
resultado temporal queda invalidado al cambiar las fuentes. La ausencia no
demuestra borrado, presencia por ID no prueba identidad; red/permisos fallidos
no se convierten en ausencia ni autorizan reparación.

Android REAL: Caso 1, Caso 2 y Caso 3 muestran la marca de eliminado también en
la nube; la jerarquía y la captura confirman los tres resultados. Conservados
«hj» S/20 y otra Caja S/88, sin restaurar/eliminar/archivar datos. No hay evidencia
del motivo ni una contraparte activa obtenida de esta consulta. Reparación de
significado financiero sigue pendiente: se necesita una fuente anterior fiable
y confirmación informada sobre la operación concreta. Archivar solo conserva
y oculta, no equivale a reparar; no se ejecuta sin autorización.

Verificación estable: TypeScript/ESLint completos sin errores/avisos y 226
pruebas/8 auditores, excluidas tarjetas. Prueba nueva corre manejadores reales
con respuestas retenidas, rechazo y false, conserva libros y restituye UI.
44859f6 falla en la comparación de ocultación inmediata, no por API faltante.
La fixture antigua de archivo se adaptó a la máscara vacía y se repitió toda
la suite; no se cuenta su ejecución fallida ni otra interrumpida como verde.
No cambios de servidor/reglas/nativo ni publicación. Pendientes: diario durable,
dos cuentas Android, coste/volumen, tolerancias y externos ya documentados.

El emulador mostró ANR de com.android.systemui/edge-swipe; se eligió Wait y
se pudo leer la revisión. No se detuvo Fino ni se borró almacenamiento. No
afirmar estabilidad definitiva del emulador a partir de ese resultado.

## Segunda pasada — selección, espera y tres casos antiguos

Síntomas enviados por el dueño después de activar servicios: al elegir una
Familia se veía momentáneamente otra, cerrar/borrar tardaba en reflejarse,
crear mostraba unos segundos la pantalla sin familias y compartir otra Caja
abría tres incidencias de «hj» del 02/10, S/10 cada una.

Causas confirmadas y correcciones de cliente:

- El botón cambiaba la ficha sin cambiar sus movimientos/miembros. Ahora cambia
  el conjunto visual, limpia controles del espacio anterior y usa carga cuando
  la elegida no tiene copia conocida. No se muestran ceros supuestos al fallar.
- recargar esperaba listas, todos los historiales y miembros en serie. Ahora
  prioriza la elegida y publica sus movimientos/miembros juntos; el resto va
  detrás. No se da permiso de conciliar Personal hasta confirmar el conjunto
  completo y vigente. Se elimina la consulta legacy duplicada.
- Cierres y borrados confirmados se retiraban solo después de recargar el
  conjunto. Se retiran de la vista/caché de sesión después de ambos ACK; nunca
  antes del guardado ni al fallar. Se conserva reintento de cierre local.
- Compartir comprobaba conflictos.length global. Ahora conserva la barrera
  global, la de la Caja elegida y enlaces cruzados, y mantiene intactas las
  fuentes de las otras cajas protegidas al subir la copia privada.
- Cajas compartidas limpian selección vieja y muestran carga/progreso; una
  respuesta en caché no repinta el movimiento cuyo borrado ya fue confirmado.
  Se evita reiniciar la apertura por ruta al cambiar la lista, por ejemplo
  después de renombrar.

Las capturas describen tres marcas de borrado con la contraparte Personal no
encontrada, NO tres duplicados demostrados ni tres operaciones nuevas. La
reproducción equivalente del plan original devuelve tres conflictos deleted,
sin altas; se rechaza imponer Personal/Caja cuando falta la contraparte. Se
conservan movimientos, lápidas e importes. No se recuperan los originales
privados mediante acceso administrativo ni se elige qué historial prevalece.
Para cerrar esos casos falta evidencia del dueño sobre la intención del borrado.

La regresión nueva ejecuta el botón ORIGINAL de ambas revisiones: 66e4504
muestra mov-a al abrir B y falla esa comparación real. Comprueba también
respuesta tardía, historial ajeno retenido, carga al crear, borrado antes de
recarga, cierre tardío y aislamiento de los casos antiguos. Son sustitutos de
red/SDK para ordenar respuestas, no prueba de dinero real.

Android observado sin escrituras financieras de prueba: una sola Familia en
la lista, dotero123xc S/100 y su ingreso externo inicial del 15/10 8:22; Cajas
mantiene la caja S/88 y «hj» S/20. No se crea otra Familia ni se borra un
movimiento real para justificar cobertura. El cambio A/B, altas y borrados
Android sigue pendiente. No se cambian servicios/reglas nativos ni se publica.

Verificación final de esta pasada: TypeScript y ESLint completos sin errores
ni avisos, 225 pruebas y 8 auditores aprobados (tarjetas excluidas). El servidor
y las reglas no cambian; las 245 pruebas Firebase de la activación anterior
son evidencia histórica de aquella entrega, no se afirman ejecutadas de nuevo.

## Orden y hallazgos

1. **Saldo compartido (alto, reproducido):** el teléfono validaba un saldo viejo
   y escribía cada gasto sin comprobar el libro en servidor. Dos gastos de 80
   sobre 100 podían aceptarse. Nuevo callable `mutateSharedMovement` suma el
   historial en unidades enteras de la moneda dentro de una transacción y
   escribe una versión de la raíz. Todos los nuevos gastos/ingresos de espacios
   existentes pasan por él. Cambios/borrados de aportes también escriben la
   raíz; devoluciones ya lo hacían. Cierre/salida leen la misma raíz.
2. **Borrar ingresos usados (alto):** el borrado directo podía retirar dinero
   ya gastado. Se comprueba disponibilidad actual en servidor. Solo el creador
   o dueño puede borrar un movimiento externo; los enlaces con Personal siguen
   en su flujo especializado. Retirar dinero disponible no exige renovar Pro
   ni aceptar documentos nuevos. Crear movimientos sí exige aceptación y Pro
   del propietario; los miembros invitados no necesitan Pro individual.
3. **Confirmación Personal/Familia (medio):** alta/aporte inicial y ediciones
   usaban un actualizador sin confirmación de disco. Ahora esperan el guardado
   conjunto de los movimientos locales antes de anunciar éxito. Si el servidor
   respondió pero falla el disco, se conserva en la pantalla la misma pareja
   para confirmar de nuevo sin otro aporte remoto. Edición compartida de Cajas
   usa la misma confirmación de disco.
4. **Reintentos (medio):** IDs estables ante respuesta perdida en esta sesión;
   recibo servidor transaccional con huella de orden y fecha, sin textos ni
   importes. Repetir no duplica y una orden anulada no revive ni confirma un
   débito nuevo. Se rechaza reutilizar la referencia Personal de otro aporte.
5. **Listas incompletas por red (medio):** listarFamilias/listarCajasCompartidas
   atrapaban cualquier fallo de lectura como si el espacio faltara. Un fallo
   de red ahora llega al manejador de error; no se publica una lista parcial.
   Un vínculo sin permiso continúa sin ocultar los otros espacios válidos.
6. **Validación y textos (bajo):** nombre familiar vacío se rechaza antes de
   enviar. Fechas reales, importes compatibles con decimales de la moneda,
   límites y enlaces se validan también en servidor. Los errores distinguen
   saldo insuficiente, Pro del propietario, datos inválidos y cierre; no llaman
   «Familia» a una Caja ni presentan datos inválidos como caída de red.

## Protección de datos y activación

No se migra automáticamente «hj», no se renumeran IDs ni se elige una fuente
por fecha. Archivar sigue siendo reversible y distinto de borrar. Se mantienen
las protecciones de sincronización, originales y marcas de borrado.

La primera consulta remota del 15/10 encontró facturación desactivada. Tras
vincularla el propietario, una segunda consulta confirmó `billingEnabled=true`
en dotero-2d430: Blaze ACTIVO. En ese momento aún había cero Functions y reglas
del 02/10 sin los tres campos nuevos. Después se activaron los servicios y
reglas probados, descritos al final. Activar Blaze por sí solo no los desplegó.

**No publicar reglas solas:** las versiones antiguas escriben dinero directo.
Primero preparar servicios compatibles, después entregar la app y coordinar el
cambio de reglas, que rechaza altas normales SDK y borrar ingresos sin servidor.
Se conserva únicamente la creación atómica del primer ingreso de una Familia
nueva y la copia exacta de Cajas privadas aún en conversión. No activar Telegram.

`moneyOperations` se guarda debajo del espacio compartido, no lo lee el cliente
ni contiene UID en claro, descripción o importe; conserva una huella derivada
de la orden y fecha para impedir duplicados/resurrección. Se retira al borrar
explícitamente el espacio preparado, no al cerrarlo. La versión de raíz es
metadato financiero. Revisión de conservación/política final aún obligatoria.
Cada operación añade lecturas del libro y escrituras de movimiento/recibo/raíz;
los reintentos pueden repetir lecturas. maxInstances=3 NO es un límite de gasto.

## Qué falta y límites de esta entrega

- Comprobar uso financiero autenticado y alertas de consumo. Blaze, servicios
  y reglas ya están activos; no está pendiente volver a activarlos.
- Dos cuentas/dispositivos Android y red intermitente en producción controlada.
  Firebase Emulator Suite no equivale a dos teléfonos ni a la APK distribuida.
- **Personal y Firebase no son una sola transacción:** el cierre del proceso
  entre ambos guardados depende de la conciliación existente. Falta un diario
  durable de aportes, incluido crear Familia con respuesta perdida, y probar
  reinicio/cambio de cuenta antes de afirmar garantía integral sin duplicados.
  El reintento estable nuevo dura la sesión, no sobrevive por sí solo al cierre.
- Revisar los tres casos originales de «hj» con evidencia del propietario;
  conservarlos no significa haber reparado su significado financiero.
- Historiales grandes: las sumas financieras siguen leyendo todo el libro.
  Falta medir/cotar coste y paginar presentación sin calcular saldo con una
  página incompleta. Cajas privadas mantienen el límite documental de Firebase.
- Moderación/SMTP/bloqueo efectivo antes de publicar espacios compartidos.
- Revisar cierre/retirada con monedas de tres decimales: ayudantes antiguos
  conservan tolerancia 0.005, no una escala monetaria universal. Las nuevas
  altas/borrados del callable sí usan unidades enteras; no declarar cerrado
  este punto para todas las monedas.

## Pruebas

Se ejecutan fuentes originales de pantalla, transacciones/rules SDK y HTTP
locales, sin credenciales o datos financieros reales. La prueba nueva de
pantalla falla contra ab441d3 porque anunciaba guardado sin confirmación; la
prueba concurrente contra los escritores originales anteriores debe detectar
dos gastos aceptados sobre un mismo saldo. Registrar resultados finales en
ESTADO/ENTREGAS, sin presentar una ejecución roja como aprobada.

Se actualiza además una integración de acceso obsoleta: buscaba Register.tsx,
que ya no existe. Usa registerSubmit del formulario Login vigente con SDK Auth
real exclusivamente local; no se cambia el acceso de producción por ello.

Resultado final estable: TypeScript/ESLint completos, 223 pruebas y 8 auditores
de app (tarjetas excluidas), 97 unitarias Functions y 245 Firebase emulado
aprobados. Las regresiones contra ab441d3 fallan por guardar sin confirmar disco
y por aceptar ambos gastos de 80 con saldo 100. Un helper faltante detectado
en una ejecución intermedia se corrigió; el servidor completo se repitió y
aprobó 245/245. Sin prueba física ni escrituras financieras de la cuenta real.
El dueño confirmó que solo prueba en el emulador; no hay otros clientes activos
que obliguen a mantener el escritor SDK antiguo durante la activación.

## Activación remota completada

Ya no está pendiente activar Blaze, los 16 servicios aprobados o estas reglas.
Publicación real de reglas 15/10 08:00:28 UTC, hash local/remoto idéntico
360bcda5d08c453db266f5f962f60b4d36ed3737645f72ce253e4153ad342b41.
Paquete aislado generado por scripts/preparar-servidor-cuentas.mjs, sin secretos
Telegram, cron ni copias de .env; los 16 handlers son literalmente los probados.
App: 224 pruebas y 8 auditores tras añadir la comprobación de empaquetado.
Autorización explícita para limpiar imágenes técnicas después de 7 días, aplicada.
El hook de Auth fue bloqueado hasta la explicación y aprobación «ok hazlo» del
dueño; creado después, sin ejecutar eliminación de cuenta alguna. La consulta
sin sesión a mutateSharedMovement devuelve 401; no prueba un movimiento real.
Todo el apartado de límites financieros/Android, datos legacy, volumen/coste,
moderación y política final sigue vigente. No hay APK/AAB/OTA/Play entregados.
Verificación visual posterior: Inicio, Familia y Cajas existentes abiertos en
Android; «hj» mantiene S/20 y la otra Caja S/88. No se crearon movimientos.
Esto acredita carga/lectura/navegación, no las operaciones con dinero ni 2 cuentas.
