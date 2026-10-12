# Bitácora de continuidad de Fino

Fechas y horas en America/Lima (UTC-05:00). No inventar horas históricas.
Proyecto activo y único lugar de trabajo: `C:\finzo`.

## 12/10/2026 — 17:59 Lima — filtros recientes también en Familia y Cajas

Se extendió a los espacios el mismo comportamiento pedido para Inicio: ocultar
«Movimientos» cuando el espacio no tiene registros y enseñar la flecha verde o
roja solo si hay ingresos o gastos normales de ese tipo. Aportes y devoluciones
enlazados se dejan fuera de esos filtros; permanecen visibles en la lista normal
y en su filtro de transferencias. Si el tipo seleccionado deja de existir, se
restablece la lista general para no dejar a la persona atrapada en «sin
resultados». Pasaron la prueba nueva de Inicio/Familia/Cajas, las pruebas
existentes de Familia y Cajas, TypeScript y ESLint. Falta confirmar la apariencia
en el emulador; no se modificaron movimientos ni saldos.

## 12/10/2026 — 17:53 Lima — filtros de movimientos recientes en Inicio

Se ajustó Inicio: sin movimientos del mes, no muestra el encabezado «Movimientos
recientes» ni las flechas. Si existen gastos o ingresos personales, aparece solo
la flecha correspondiente; si existen ambos, aparecen las dos. Las transferencias
internas no habilitan filtros sin resultados. El mensaje de lista vacía se conserva.
Pasaron la prueba enfocada `verificar-movimientos-recientes`, `npx tsc --noEmit`
y ESLint. Falta revisar la apariencia en el emulador; no se modificaron datos ni
se creó un movimiento de prueba.

## 12/10/2026 — 17:34 Lima — selectores de moneda e idioma

Se corrigió el selector de moneda: antes, tras configurar la cuenta, el filtro
ocultaba las otras monedas y también quitaba la búsqueda. Ahora se puede ver y
buscar el catálogo completo, pero las alternativas siguen bloqueadas y solo se
marca la moneda actual; esto conserva la decisión de no reinterpretar montos ya
guardados. En idioma no faltaban opciones que Fino ya tradujera: el catálogo
completo de la app tiene español, inglés y portugués. Aclaré el texto para que
indique que son los idiomas disponibles actualmente; las banderas siguen siendo
decorativas. Pasaron `verificar-selectores-iniciales-real`, la prueba del
catálogo (155 monedas), `npx tsc --noEmit` y ESLint. Falta comprobarlo
visualmente en el emulador.

La captura consultada de «Cargando…» coincide con la cubierta de seguridad que
espera a que Fino lea sus datos y compruebe el bloqueo/PIN antes de mostrar
información. Debe desaparecer al terminar; si permanece, hay que revisar por
qué la carga o la comprobación no finaliza. No se tocó el emulador ni sus datos.

## 12/10/2026 — 05:46 Lima — revisión estática del guardado del formulario

El botón Guardar del alta es la marca de verificación arriba a la derecha,
no un botón inferior. Está desactivado sin monto positivo, con fecha inválida
o durante el envío; hay una barrera contra doble toque, y cerrar/guardar espera
al cierre del teclado hasta 400 ms. La persona volvió a Inicio sin guardar.
Corrijo la instrucción anterior: no hacía falta deslizar hasta un botón abajo.
Esto es revisión de código, no prueba física de teclado ni guardado Android.

## 12/10/2026 — 05:45 Lima — formulario cerrado sin guardar

La captura posterior volvió a Inicio. Se toma como formulario cerrado/cancelado;
no se creó ni editó ningún movimiento. No pedir reabrirlo por ahora: se continúa
con revisión estática del guardado y validación local del formulario.

## 12/10/2026 — 05:41 Lima — formulario manual de movimiento

La captura del formulario muestra Gasto seleccionado, monto vacío/0, categoría
Comida, fecha actual y notas opcionales; el texto de descripción es un ejemplo
de campo, no un dato guardado. El código preselecciona “Tarjeta débito” en un
movimiento nuevo (`initialPaymentMethod`); no se abrió ese selector ni se guardó
nada. Queda pendiente revisar el resto del formulario y el botón Guardar sin
confirmar la acción.

## 12/10/2026 — 05:40 Lima — menú de alta de movimiento

La captura confirma que el botón central `+` abre el menú con Registrar
movimiento, Dictar por voz y Escanear boleta. No se inició micrófono/cámara ni
se guardó información. Siguiente paso seguro: abrir solo el formulario manual,
sin escribir ni guardar.

## 12/10/2026 — 05:39 Lima — vista de prueba de gráficos

La captura muestra “Volver a mis datos” y cifras de ejemplo en las gráficas,
señal de que se activó la vista de demostración de Reportes. La lógica usa
valores visuales separados; no crea movimientos ni cambia saldos. El usuario
puede abrir el formulario con el botón `+` inferior central; no guardar nada.

## 12/10/2026 — 05:37 Lima — reporte de ingresos

La captura posterior muestra activa la vista “Ingresos por categoría”: octubre
no tiene ingresos y el gráfico de gastos sigue mostrando S/300 en septiembre.
Esto es navegación de solo lectura; no hay movimiento nuevo ni cambio de saldo.
La siguiente instrucción visual se aclarará indicando el botón central `+` de
la barra inferior (no los filtros de gráficas).

## 12/10/2026 — 05:36 Lima — identificación de la app de desarrollo

En la captura de Reportes aparece “Probar 12 meses y 31 días”. El botón está
dentro de una condición `__DEV__` y usa datos de vista solo para los gráficos;
no añade movimientos ni modifica saldos. Su presencia confirma que el emulador
está mostrando la app en modo de desarrollo, no la experiencia exacta de la
versión instalada desde Play. Esto explica la marca `03oct` frente a la marca
de la última entrega de Play y limita la validez de estas capturas para evaluar
la publicación. No se pulsó el botón.

## 12/10/2026 — 05:34 Lima — captura de Reportes en el emulador

La pantalla Reportes cargó. Para octubre muestra “Sin datos este mes” en gastos
por categoría y gasto diario, y ningún límite por categoría; el gráfico mensual
sí muestra S/300 para septiembre. Esto confirma que hay al menos un dato
histórico visible, no que todo el historial esté completo ni que cada cálculo
sea correcto. No se cambió ningún filtro/dato ni se tocó otra función.

## 12/10/2026 — 05:26 Lima — versión y marca de Información

La captura de Información muestra Fino 1.0.8 y `03oct-calendario-local-pro`.
La carpeta activa declara 1.0.8/versionCode 10 y esa misma marca de código;
coinciden con el código local. No prueba por sí sola que el resto de cambios
locales esté en el emulador ni que esté publicado en Play: la última entrega
anotada en Play era 1.0.8 con marca `14sep-yape-transferencias-seguras`.
La línea pequeña que distingue el código instalado del recibido por internet
no se alcanza a leer en la imagen. No se pulsó Buscar actualización ni se
actualizó/reinició la app.

## 12/10/2026 — 05:32 Lima — aclaración del propietario sobre esa línea

El propietario indica que debajo del marcador solo ve una línea sin texto
legible y luego la lista de partes nativas. El origen del código (instalado,
actualización o sesión de desarrollo) queda sin confirmar; no pedirle que pulse
Buscar actualización.

## 12/10/2026 — 05:24 Lima — captura de Ajustes en el emulador

La captura muestra Ajustes cargado, con idioma y moneda como filas separadas,
tema/estilo, opciones Pro, Eliminar cuenta, Cerrar sesión e Información de la
app. No se ve un error evidente en esta pantalla. No se tocó ningún botón ni
dato. Siguiente comprobación visual segura: abrir Información de la app.

## 12/10/2026 — 05:20 Lima — captura actual de Inicio del emulador

La captura enviada por el propietario confirma que la app abrió Inicio y muestra
las pestañas Inicio, Historial, Reportes y Ajustes. En Octubre de 2026 aparecen
presupuesto S/1.000.333.333, saldo anterior S/210 y saldo disponible
S/1.000.333.543; la suma coincide. No hay movimientos recientes este mes.
El propietario confirmó que el monto es de prueba. La lógica local admite montos
hasta S/9.000.000.000.000 y la captura muestra el valor con separadores correctos;
el saldo coincide con la suma. No se editó, borró ni cambió ningún dato. Esta
imagen comprueba que Inicio cargó, pero no los demás recorridos de Android.

## 12/10/2026 — 05:02 Lima — revisión de disponibilidad Firebase y catálogos

La configuración local fija Cloud Functions en Node.js 22 y apunta a
`firestore.rules`; no existe `.firebaserc`. Hay Firebase CLI en caché, pero su
sesión no es consultable desde este entorno: abrir el archivo local de sesión
devuelve `EPERM`. No se cambiaron permisos, no se inició sesión y no se ejecutó
ningún despliegue. Por tanto sigue sin comprobarse qué reglas/funciones están
publicadas ahora. La última consulta histórica anotada (09/10) informó cero
funciones; no sustituye una comprobación actual.

En el código local, varias funciones limitan `maxInstances` (por ejemplo,
2–10 instancias) y las denuncias tienen cupo por usuario; no encontré la opción
`enforceAppCheck` en sus llamadas. Eso reduce algunos abusos, pero no es un
techo global de gasto ni demuestra App Check activo en Firebase. La cola de
denuncias sí se escribe, pero no hay consumidor SMTP/Trigger Email en el
proyecto; por eso todavía no llega un aviso real a la persona responsable.

También se verificó el comportamiento de los selectores que el propietario
mostró: con una cuenta ya configurada, Moneda filtra la lista y presenta solo
PEN para proteger los importes existentes; Idioma es independiente y ofrece
los tres idiomas traducidos por Fino (español, inglés y portugués), no todos
los idiomas del mundo. No se alteraron estos selectores ni los datos.

La ficha de Play Store sigue siendo un borrador local, no una declaración
confirmada: documenta que el dictado puede enviar audio al servicio de Android,
que Billing/anuncios aún no existen y que Sentry está desactivado. La política
local avisa que el correo de denuncias no está configurado. Intenté abrir las
páginas públicas de Privacidad, Términos y Borrado en modo lectura; la herramienta
web no pudo acceder a ellas, así que no concluyo que estén caídas ni que su
contenido publicado coincida con estos archivos.

El punto 2 sigue pendiente de recorridos completos en Android; la captura de
pantalla falló dos veces en esta sesión. El punto 3 sigue pendiente de revisar
Firebase/Play con sesión accesible, App Check y límites, SMTP/moderación,
políticas y publicación coordinada. Tarjetas fuera, Telegram en pausa, Sentry
externo excluido. Sin cambio de código, pruebas, APK/OTA ni publicación.

## 11/10/2026 — 18:38 Lima — primera apertura normal después del vínculo

El emulador abrió Inicio, Cajas y Ajustes sin aviso de «otra cuenta». Se vio
una caja previa y un aviso de 3 transferencias pendientes; no se modificaron.
Detalles y límites en `PRUEBAS_ACCESO_INICIAL_VIDEO.md`. Falta confirmar
reingreso persistido, historial completo y resto de Android; punto 3 externo
sigue pendiente. El commit de recuperación `a38b33a` ya está subido. Sin
entrega APK/OTA ni publicación de Play/Firebase.

## 11/10/2026 — 18:24 Lima — recuperación del propietario en el emulador

Dos capturas del propietario muestran la secuencia: perfil antiguo configurado
sin identificador/correo; después de elegir su misma Google y autorizar el
vínculo, `ownerPresent=true`, `ownerMatches=true`, `owner-same-active`. En la
pantalla aparece «Datos vinculados». Los detalles, pruebas y límites están en
`PRUEBAS_ACCESO_INICIAL_VIDEO.md`; no repetirlos aquí. Acceso normal aún
pendiente; no publicar ni considerar terminada la auditoría. Tarjetas fuera,
Telegram en pausa, Sentry externo excluido y UI diferida.

## Documentación existente: leer sin volver a copiarla

1. `AGENTS.md`, `ESTADO.md`, `ENTREGAS.md` y `PLAYSTORE.md`.
2. `docs/AUDITORIA_CIERRE_61.md`: seguimiento de los hallazgos originales y FINO-62.
3. `docs/PRUEBAS_CICLO_BORRADO_RESTAURACION.md`: evidencia del punto 1 y límites.

Punto 1 local terminado y subido en `7c6c324`. Resultados y decisiones están
en esos archivos; no se repiten aquí. No está acreditado como instalado/publicado.

## 10/10/2026 — 23:01:18 — cierre parcial del punto 2 (información nueva)

El propietario autorizó punto 2 hasta las 23:00 y revisar el vídeo
`C:\Users\User\Videos\2026-10-10 01-18-59.mkv`. La última lectura fue 23:01:18;
se comunicó el resultado y se detuvo, sin terminar el punto 2.

- Revisado completo: 63,654 segundos, 1909 fotogramas, 1656 imágenes RGB distintas
  y 253 duplicados exactos. Las 104 hojas se revisaron en tres tramos solapados.
- Negro breve al abrir Crear cuenta: 22,654–22,788 s.
- Destellos blancos de «Comprobando el bloqueo de Fino…»; entre otros, a
  54,554–54,821; 58,988–59,254 y 61,488–61,754 s.
- Intentos de Google/correo vuelven con aviso de datos de otra cuenta. Puede ser
  protección correcta: no se demostró rechazo indebido ni acceso exitoso. No
  quitar la protección ni borrar datos para forzar la entrada.
- La hoja del gestor de contraseñas observada no es el selector de acceso Google.
  El vídeo está estirado horizontalmente; no atribuir esa distorsión a la app.
- Emulador abierto por el usuario y detectado; no se completó acceso real ni se
  operó la elección de cuenta. Ningún cambio nuevo de código por esta revisión.
- Evidencia ya existente: `.tmp/auditoria-video-20261010/` (manifiestos, hojas,
  PNG y `revision-primera-mitad.md`). No generar otra copia ni renumerar hallazgos.

## 10/10/2026 — 23:20:12 y 23:47:02 — conservación y aclaración

El propietario pidió guardar los avances y después aclaró: NO quiere otra
carpeta/copia del proyecto, solo información faltante dentro de C:\finzo.
Se detuvo el script de respaldo y su Robocopy, identificados por comando exacto.
Se solicitó enviar a la papelera únicamente la copia parcial creada por el
agente; no borrar fuentes externas, archivos originales ni C:\finzo.
La bitácora queda como referencia breve, sin duplicar la auditoría ya escrita.

## 11/10/2026 — 06:16:51 — punto 2 retomado, antes del apagado solicitado

- El propietario confirma que Google rechaza exactamente la misma cuenta
  que usaba antes. No atribuirlo a una cuenta equivocada: causa aún pendiente.
  No se borraron datos ni se retiró la protección de propietario.
- Preparados: botones de Bienvenida se liberan si el viaje rápido es descartado;
  respuestas tardías de acceso/registro no continúan ni navegan por una ruta
  abandonada. Hook y callbacks originales conservan identidad/enfoque y reintento.
  No cancela la llamada Auth ya enviada ni todos sus eventos globales.
- Cubierta de datos sigue opaca, sin fundido; distingue cargar datos de comprobar
  candado. No acredita desaparición del negro/destellos en Android instalado.
- Pruebas nuevas originales: viaje descartado y acceso abandonado verdes;
  ambas contra ed0cb18 rojas por los fallos reales, no por API ausente.
  Privacidad ampliada verde y baseline ed0cb18 rojo por fundido.
- Verificación final registrada 06:18:56: TypeScript/ESLint exit0, app final
  196 pruebas/8 auditores sin tarjetas (una ajena no versionada: 195 previstas
  Git limpio; no otro checkout). Primera batería falló el adaptador nuevo;
  corregido y repetido sin retirar aserciones. Auth SDK aislado Node 22: 5/5,
  sin fallos/omisiones; primer CLI bloqueado por config externa, repetición
  sin sesión/configuración real aprobada. No servidor integral repetido.
  Detalle nuevo en PRUEBAS_ACCESO_INICIAL_VIDEO, sección 11/10.
- Emulador detectado: com.finoapp.gastos 1.0.8/code10, último APK 02/10;
  eso no identifica el JS cargado. Autorización Computer Use caducó sin obtener
  captura/operar acceso; usuario elige Google. No prueba Android completada.
- Solicitado apagado único 11/10 a las 07:05 Lima. Tarjeta sugerida con fecha
  exacta, todavía sin confirmación observada. Guardar antes; sin cierre forzado.
  Tres minutos solo tras pregunta imprescindible pendiente, no silencio normal.
- Bloque guardado en commit `860530ed` (06:20:53 Lima) y push a origin/master
  confirmado. No incluye pendientes preexistentes de Telegram ni prueba ajena;
  esos archivos permanecen conservados en C:\finzo. No despliegue/entrega.
- **Qué sigue/falta:** diagnóstico legítimo de propietario y pruebas Android (2); servicios,
  consolas/publicación (3) después. Tarjetas fuera, Telegram en pausa,
  Sentry externo excluido, rediseño diferido. Sin APK/AAB/OTA/despliegue nuevos.

## 11/10/2026 — 10:24:27 — aviso de dueño y limitación visual

Distinción de aviso preparada sin aflojar protección ni leer/borrar historiales
reales. Bóveda/rutas originales verdes; a982dc3 rojo por aviso que afirmaba otra
cuenta sin demostrarlo. Detalle único en PRUEBAS_ACCESO_INICIAL_VIDEO, sección
10:24:27. Final 10:26:12: TypeScript/ESLint exit0, app 196/8 sin tarjetas
(una ajena no versionada: 195 previstas Git limpio, no otro checkout).
Emulador original reabierto, datos conservados; dos capturas Computer Use fallaron.
Se pidió captura humana del aviso actual. APK sigue 1.0.8/code10 del 02/10;
JS cargado desconocido. No entrega/instalación/despliegue ni acceso real resuelto.
**Qué sigue/falta:** captura/diagnóstico legítimo y resto Android (2), servicios/
consolas/publicación (3). Exclusiones anteriores intactas. El apagado sugerido
07:05 ya está en el pasado; no se observó confirmación ni se ejecuta ahora por esa
hora antigua. El guardado permanece en C:\finzo, sin otra copia del proyecto.

## 11/10/2026 — 12:24:29 — sesión y diagnóstico del rechazo Google

Información nueva únicamente: PRUEBAS_ACCESO_INICIAL_VIDEO, apartado 12:24:29,
conserva las correcciones, FINO-63 nuevo, regresiones, APK/Metro y límites.
Misma Google aún sin acceso real demostrado; imagen actual blanca Reloading.
TypeScript/ESLint y app final 201/8 sin tarjetas aprobados, una prueba ajena
sin versionar (200 previstas Git limpio). Solo modo diagnóstico local solicitado;
no se abrió el libro ni se adjudicó a otra cuenta. No instalación/despliegue.
**Qué sigue/falta:** resultado de diagnóstico humano y restante Android (2),
servicios/consolas/publicación (3). Tarjetas fuera, Telegram/Sentry externos
en pausa/excluidos, diseño diferido. Sin segunda copia de la app.

### Instrucciones vigentes para continuar (actualización)

- Completar punto 2: comprobar versión instalada y acceso con propietario
  legítimo/cuenta de prueba; la selección de Google la hace el usuario. Después
  corregir lo confirmado y repetir pruebas Android sin tocar datos reales.
- Punto 3 sigue pendiente: servicios/consolas, App Check/costos, SMTP/moderación,
  Play/Billing, web/legal/trámites y activación coordinada autorizada.
- Tarjetas excluidas; Telegram en pausa; Sentry externo fuera; rediseño diferido.
- Dos archivos de Telegram modificados y la prueba local
  `pruebas/verificar-resumen-gasto-ingreso-ui.mjs` son pendientes preexistentes:
  conservarlos, no adjudicarse su autoría ni declararlos publicados/verificados.
- No APK/AAB/OTA/EAS/Firebase/Play ni migración por este registro documental.
- Esta bitácora registra lo nuevo; no afirma una exportación literal del chat.
- **Qué sigue/falta:** terminar punto 2 y luego punto 3; no cerrar toda la auditoría.

## 12/10/2026 — 05:51 — revisión de dictado y escáner de boletas

Revisión estática de `screens/VoiceEntry.tsx`, `screens/ScanReceipt.tsx`,
`utils/receiptPreprocess.ts`, el módulo Android `TextRecognizer` y permisos de
`app.json`/Manifest. No se abrió el micrófono ni la cámara, no se eligió una
foto y no se guardaron movimientos.

- Dictado: pide el permiso al entrar desde el botón de voz, muestra una pantalla
  si se deniega, acumula los segmentos reconocidos, intenta variantes de idioma
  y exige confirmar los movimientos antes de guardarlos. Protege el guardado
  repetido. La identificación de voz depende del servicio Android/dispositivo;
  no se pudo confirmar desde el código qué proveedor procesa el audio ni su
  comportamiento real sin conexión.
- Boletas: pide permiso al elegir cámara/galería, recorta y prepara la imagen,
  y la lectura usa ML Kit nativo en el teléfono; el módulo OCR no hace llamadas
  de red. Presenta el resultado para corregirlo y no guarda hasta confirmar un
  importe positivo y fecha válida. El permiso denegado simplemente vuelve sin
  mensaje propio visible en esta pantalla; queda pendiente comprobar cómo lo
  comunica el selector/permisos de Android en dispositivo.
- No se encontró una ruta de carga de la foto a Firebase en estos recorridos.
  Esto no sustituye revisar privacidad del proveedor de dictado ni las
  declaraciones de permisos reales de Play Console.

**Qué sigue/falta:** en punto 2 siguen pendientes pruebas físicas del dictado,
permiso denegado, cámara/galería, lectura de una boleta real y guardado/revisión
del movimiento; no ejecutar sobre datos reales sin autorización. En punto 3
siguen consolas/servicios, proveedor de correo para denuncias, declaraciones de
Play y legales. Tarjetas fuera de alcance; Telegram en pausa; Sentry externo
dejado de lado. No se modificó código ni se ejecutaron pruebas.

## 12/10/2026 — 05:53 — el propietario deja el escáner pendiente

El propietario indica posponer las pruebas del escáner de boletas. No insistir
ni pedir que abra cámara/galería ahora. Se puede continuar con el dictado y las
demás revisiones de Android que no requieran esa función. El escáner queda
pendiente para una sesión posterior, junto con la lectura de una boleta de
prueba.

## 12/10/2026 — 05:58 — verificación del emulador y revisión Play/Firebase

Comprobación solo de lectura por ADB: el emulador está conectado y tiene Fino
1.0.8, versionCode 10, instalado por última vez el 02/10/2026, Android target
36. Está en la pantalla principal de Fino. Cámara y micrófono aparecen como
permisos denegados actualmente; no los solicité ni abrí el escáner/dictado. Para
comprobar dictado real, el propietario debe iniciar esa función y aceptar el
permiso en la pantalla de Android. La configuración fuente declara los permisos
para esas funciones; la prueba del dictado queda esperando esa acción.

Firebase CLI no está disponible en esta sesión y no se obtuvo acceso a Firebase
ni Play Console. El estado local confirma Node 22 en la configuración, reglas
locales con bloqueo por aceptación vigente, y que el correo de denuncias está
desactivado hasta configurar un proveedor. No se afirma que el servidor, reglas,
App Check o formularios de Play coincidan con ese código. La comprobación de
ventanas abiertas tampoco encontró Chrome/Edge ni otra consola web abierta.

Lectura de la política oficial vigente de Google Play (página efectiva desde
30/09/2026): en grupos cerrados con personas identificadas se exige poder
denunciar contenido y usuarios; también exige términos antes de crear contenido,
reglas contra contenido prohibido y moderación efectiva. El código tiene
aceptación y botones de denuncia para elementos/usuarios/espacios de Familia y
Cajas, pero el servicio aún responde como no disponible sin configuración de
correo; no hay atención real demostrada. No se ve mensajería directa 1 a 1, así
que no se afirma que el requisito de bloqueo específico para chats aplique; la
moderación efectiva y canal funcional sí siguen como riesgo de publicación.
Fuente: https://support.google.com/googleplay/android-developer/answer/18258653?hl=en

Las páginas públicas de privacidad, términos y borrado no pudieron abrirse en
esta comprobación; la herramienta devolvió error interno. No concluir que están
caídas; sigue pendiente verificar su contenido por otro canal y contrastarlo
con el formulario real de Play.

**Qué sigue/falta:** revisar el resto del código/recorridos Android que no
requieren permiso y conservar el escáner pospuesto; para dictado hace falta que
el propietario use el micrófono en el emulador. Punto 3 requiere que el
propietario abra Firebase y Play Console para revisar configuración publicada,
reglas, App Check, costos y declaraciones, y después autorizar/configurar
correo antes de habilitar denuncias. No hubo cambios de código, pruebas, acceso
a cuentas, despliegues ni publicación.

## 12/10/2026 — 17:14 — calendario de pagos, revisión estática

Se revisaron el programador de avisos, el toque de una notificación, la apertura
de la ficha en Inicio, el botón «Ya pagué» y las pruebas ya escritas. El código
solo retira/reprograma avisos del calendario, no los de exportación; serializa
los cambios y programa hasta tres meses. Un toque válido abre el pago y mes
correctos incluso desde app cerrada; pagos borrados o avisos mal formados no
abren otro pago. Confirmar un pago crea o reutiliza un movimiento, con la fecha
y hora reales de confirmación; un recordatorio no crea movimiento. Las pruebas
de código cubren estos casos, pero no se ejecutaron en esta pasada ni acreditan
que Android entregue/sonorice avisos.

El propietario pidió dejar el micrófono pendiente y ya había dejado pendiente
el escáner; no se abrió ni pidió permiso para ninguno. La captura del emulador
falló dos veces, así que no se interactuó ni se tocaron datos. **Qué sigue/falta:**
continuar revisando otros recorridos locales que no requieran esos permisos;
queda pendiente comprobar en Android el sonido, la entrega y el toque de avisos,
además del dictado y escáner cuando el propietario quiera retomarlos. Punto 3
sigue necesitando revisión de Firebase/Play con sesión del propietario y el
correo de denuncias. No hubo cambios de código, ejecución de pruebas ni
despliegues.

## 12/10/2026 — 17:17 — repaso de denuncias y política de Play

Contrasté de nuevo el código y `docs/PRUEBAS_DENUNCIAS_CONTENIDO.md` con la
política oficial de Play vigente desde el 30/09/2026. Para espacios cerrados de
Familia/Cajas, Play requiere aceptación de reglas antes de publicar y opciones
para denunciar contenido y usuarios; además pide moderación continua y medidas
cuando corresponde. Fino prepara esos controles y la cola protegida, pero no
hay proveedor/lector de correo activo: una denuncia real no está demostrada y
no se debe activar manualmente el indicador que la habilitaría antes de probar
el servicio. Las pruebas locales documentadas usan emulador Firestore, no
producción ni correo real.

El código de las funciones tampoco declara `enforceAppCheck`; la documentación
oficial permite aplicarlo al desplegar cada función, pero no se puede deducir
desde aquí si está forzado en la consola. No se abrió sesión de Firebase/Play,
no se cambió su configuración y no se envió una denuncia. Fuente Play:
https://support.google.com/googleplay/android-developer/answer/18258653?hl=es-419
; fuente App Check:
https://firebase.google.com/docs/app-check/cloud-functions.
**Qué sigue/falta:** probar el servicio de moderación requiere habilitar/configurar
un proveedor y que el propietario participe en Firebase; App Check, reglas,
límites de gasto y declaraciones requieren la consola del propietario. El punto
2 todavía requiere recorridos físicos restantes; micrófono y escáner quedan
pospuestos. No hubo cambios de app ni pruebas/despliegues.

## 12/10/2026 — 17:21 — pruebas locales enfocadas del calendario

Corrí solo `verificar-calendario-pagos` y `verificar-permiso-calendario-real`,
excluyendo tarjetas. Ambas suites pasaron. Revisan cuentas/fechas y los
manejadores del permiso/reprogramación con Android y almacenamiento reemplazados
por adaptadores; no abrieron Fino, no cambiaron avisos reales ni movimientos y
no prueban sonido/toque de notificaciones en el dispositivo. El ejecutor borró
su carpeta temporal. No hubo cambio de código ni despliegue.
**Qué sigue/falta:** continuar la revisión local de recorridos restantes y
después comprobar avisos en Android cuando sea posible. Dictado/escáner siguen
pospuestos; Firebase/Play y el correo de denuncias aún requieren intervención
del propietario.

## 12/10/2026 — 17:24 — reportes y exportación, pruebas locales

Pasaron, por separado y con tarjetas excluidas, los cálculos `verificar-gasto-
diario-real`, `verificar-comparar-meses-real` y `verificar-resumen-dia-real`;
también `verificar-horario-exportacion` y `verificar-entrega-exportacion-real`.
La primera llamada a la prueba Kotlin no encontró Java en PATH; encontré el JDK
incluido con Android Studio y repetí sin cambiar configuración permanente.
Pasó la JVM Kotlin original: receptores de arranque/exportación y política de
alarma, usando adaptadores. Ninguna prueba abrió Fino ni demostró notificaciones,
AlarmManager o entrega de archivos reales en Android. Se usó solo el JDK local;
no hubo APK/AAB, despliegue ni cambio de código.
**Qué sigue/falta:** continuar revisión estática y pruebas aisladas seguras de
otros recorridos. La verificación real de Android exige interacción/emulador;
Firebase/Play, denuncias por correo, micrófono y escáner permanecen pendientes.

## 12/10/2026 — 17:25 — montos y categorías, pruebas locales

Pasaron `verificar-montos-seguros`, `verificar-categorias` y
`verificar-categorias-propias`, siempre excluyendo las pruebas de tarjetas.
Confirman los límites/formato de montos largos, el recorte matemático de fotos
de categorías y las categorías propias con datos de prueba. No se abrió cámara
ni galería, no se modificaron categorías del propietario ni se guardaron
movimientos. Son pruebas locales, no verificación visual Android.
**Qué sigue/falta:** quedan comprobaciones físicas de Android (entre ellas
notificaciones, orientación/accesibilidad y sesión persistida) que requieren
ver e interactuar con el emulador. Firebase/Play requieren la sesión del
propietario; micrófono y escáner permanecen pospuestos.

## 12/10/2026 — 17:29 — formulario manual y regreso del teclado

El lector de código del formulario confirma monto positivo y fecha válida,
desactiva Guardar si son inválidos y bloquea doble toque. Espera a que Android
oculte el teclado (máximo 400 ms) antes de cerrar; la categoría recién creada
queda elegida. Pasaron `verificar-boton-sobre-teclado`,
`verificar-elegir-categoria` y el auditor `auditar-pantallas-externas`.
No abrí ni guardé el formulario; las pruebas no demuestran el teclado físico,
el guardado en un teléfono ni la persistencia tras cierre forzado.
**Qué sigue/falta:** las pruebas físicas del formulario/teclado y reinicio
necesitan interacción Android; no hay captura/control de pantalla disponible en
esta pasada. Dictado y escáner siguen pospuestos; las consolas y correo siguen
requiriendo al propietario.

## 12/10/2026 — 17:30 — privacidad del buzón de notificaciones Yape

Pasó `verificar-privacidad-buzon-yape` y también la suite Kotlin/JCE original
`probar-receptores-kotlin.mjs --notification-privacy`. Con adaptadores de
Android se comprobaron cifrado, migración del formato anterior, duplicados,
reinicio, cambios/daños de datos y claves, fallos de guardado, y apagado del
lector. No accedí a notificaciones reales ni al micrófono y no se usó el buzón
del emulador. **Límite:** esto prueba la lógica Kotlin y cifrado JCE, no el
Android Keystore/SharedPreferences físico ni la actualización de una instalación.
**Qué sigue/falta:** mantener pendiente el recorrido de notificaciones reales
hasta una prueba segura en Android y confirmar que la nueva versión nativa se
instala; continuar revisión local de otros puntos. Micrófono y escáner siguen
pospuestos; consolas externas siguen pendientes.
