# Lo que hay que rellenar en Play Console

FINO-47/49 preparado (08/10/2026): al marcar la casilla se guarda cifrado solo
en el teléfono un recibo por UID, SHA-256 de los documentos, elección y fecha
del reloj local. No viaja a Firebase ni al respaldo financiero; permanece al
salir y se retira con los datos locales de la cuenta. Actualizar documentos
invalida la aceptación anterior para nuevas acciones compartidas; leer/salir/
recuperar dinero/borrar cuenta no exige aceptar. Sin permisos o servicios
nuevos. Política interna/HTML preparadas, no publicadas. No declarar esto como
consentimiento jurídico sensible ni protección remota: servidor/apps antiguas,
resto de caminos, bloqueo, SMTP y revisión de consola siguen pendientes.
Guía: docs/PRUEBAS_ACEPTACION_POR_CUENTA.md. FINO-47/48/49 no cerrados.

Preparado el **08/08/2026**, antes de que exista la cuenta, para que el día que se abra sea
copiar y pegar en vez de redactar bajo presión.

**Todo lo de aquí está sacado del código, no de la memoria.** Los permisos salen del
`AndroidManifest`, los datos que se guardan salen de `utils/storage.ts` y de
`constants/legal.ts`. Si mañana la app guarda algo nuevo, **este archivo también hay que
tocarlo**: un formulario de datos que no cuadra con lo que hace la app es motivo de suspensión,
y Google lo revisa de verdad.

---

## Datos básicos

| | |
|---|---|
| Nombre en la tienda | **Fino: Tus Gastos e Ingresos** (27 de 30) |
| Nombre bajo el icono | **Fino** |
| Identificador | **`com.finoapp.gastos`** — `com.finzo.app` ya estaba tomado en Play y ese nombre no se libera nunca. Se cambió el 13/08/2026; el porqué entero está en ESTADO.md |
| Versión | 1.0.8 (`versionCode 10`) |
| Categoría | **Finanzas** |
| Público | Mayores de 18 (no dirigida a niños) |
| País principal | Perú |
| Precio | Gratis; las compras dentro de la app todavía no están habilitadas |
| Correo de contacto | dinero123xc@gmail.com |
| Política de privacidad | https://leonjef69-svg.github.io/finzooo/privacidad.html |
| Borrado de cuenta | https://leonjef69-svg.github.io/finzooo/borrar-cuenta.html |

---

## Descripción corta (máx. 80 caracteres)

```
Controla tus gastos y los de tu negocio, en soles. Yape se registra solo.
```

**73 caracteres** de los 80 que deja Google. Contado, no estimado — pasarse hace que el
formulario lo rechace al pegarlo, y ahí se recorta a las prisas.

La descripción completa son **1.585** de los 4.000 permitidos.

**En qué países funciona el registro automático, dicho en la propia descripción**
(añadido el 11/08/2026, a petición suya). Sin esa línea, alguien de México lee "cuando
te yapeen se anota solo", instala, y esa función no le aparece — porque ahí no hay Yape.
Eso no es una decepción cualquiera: es una estrella y un comentario diciendo que la
función principal no existe, y con razón, porque el texto se lo prometió. La app misma ya
la esconde fuera de Perú y Bolivia (ver utils/dondeHayYape); esto es la otra mitad, la de
no prometerla antes de instalar.

---

## Descripción completa

```
Fino es una app de presupuesto pensada para Perú: lleva tus gastos de casa y los de tu negocio por separado, en soles.

LO QUE HACE SOLO
Enciende el registro automático y cuando te yapeen, el movimiento se anota sin que toques nada. Funciona incluso con la app cerrada.

Esta parte necesita Yape, así que está disponible en Perú y Bolivia. En los demás países Fino funciona igual de bien: anotas tus movimientos en dos toques, los dictas o los importas del estado de cuenta de tu banco.

TU DINERO ORDENADO
• Ingresos y gastos con categorías
• Presupuesto del mes y por categoría
• Metas de ahorro
• Reportes en PDF, Excel y CSV
• Copia de seguridad en la nube

MODO NEGOCIO
Si tienes un negocio, su plata va aparte de la de tu casa. Nunca se mezclan, ni en los totales.
• Los yapeos que recibes entran directo a la caja del negocio
• Anota tus gastos: insumos, gas, alquiler
• Mira cuánto hiciste hoy, este mes o desde el primer día
• Compara un mes con el anterior
• Registra ventas por producto, si quieres llevar esa cuenta

HABLA EN VEZ DE ESCRIBIR
Anota un gasto, pregunta cuánto llevas o pide un reporte, dictando.

TUS REPORTES DONDE QUIERAS
Guárdalos en tu celular, en Google Drive o en Dropbox. También puedes programarlos para que salgan solos cada día, semana o mes.

TUS DATOS SON TUYOS
Se guardan cifrados en tu celular. No vendemos tu información. Puedes borrar tu cuenta entera cuando quieras, desde la app o desde nuestra web.

Fino no es un banco, no mueve dinero y no se conecta a tus cuentas bancarias. Es tu cuaderno de gastos, pero que hace las cuentas por ti.
```

---

## Las imágenes de la ficha — ✅ TODAS SUBIDAS (13/08/2026)

**Se descubrieron el 09/08/2026, mirando la ficha de Netflix**: *"¿eso ya está listo? ¿está
dentro de mi plan de fases?"*. No estaba. Es un hueco de esta lista, no suyo.

Google **no deja publicar sin esto**, y no es un adorno: es lo único que ve alguien antes de
decidir si instala.

| Qué | Medida | Quién |
|---|---|---|
| **Icono** | 512 × 512 px, PNG | ✅ **HECHO: `tienda/icono-512.png`** |
| **Gráfico destacado** | 1024 × 500 px | ✅ **HECHO: `tienda/destacado-1024x500.png`** (10/08/2026) |
| **Capturas de teléfono** | mínimo **2**, hasta 8 | ✅ **HECHO: 5 capturas suyas** (13/08/2026) |

**Y en la consola está marcado que el icono y el gráfico destacado se hicieron con IA**,
porque se hicieron con IA. Lo que sigue de esta sección se conserva como referencia por si
hay que rehacer alguna imagen.

### Qué capturas, y en qué orden

El orden importa: en la ficha solo se ven las dos o tres primeras sin deslizar. Van las que
explican de qué va la app, no las más bonitas.

1. **Inicio** con movimientos de verdad y el presupuesto del mes — de un vistazo se entiende
   qué es.
2. **El registro automático**, con la pantalla de Yape. Es lo que Fino tiene y las demás no.
3. **El Modo Negocio**, con el panel y su saldo.
4. **Reportes** con las gráficas.
5. **Exportar** a PDF/Excel.

> **NO USAR DATOS INVENTADOS FEOS.** Las capturas se hacen con la app llena
> de movimientos creíbles. Una pantalla vacía en la tienda dice "esto no lo usa nadie".
>
> **Y NI UN DATO REAL SUYO**: en esas capturas no puede salir su nombre, su correo, su foto de
> perfil ni el nombre de quien le yapea. Van a estar públicas para siempre. La forma limpia es
> usar una cuenta nueva y meterle movimientos de ejemplo.

**Las capturas se toman del celular tal cual** (botón de encender + bajar volumen). Google las
acepta así, sin marcos ni texto encima. Ponerles texto encima —como Netflix— convierte mejor,
pero es diseño y se puede dejar para después: primero publicar.

## Formulario de seguridad de los datos

### FINO-47 — aceptación previa de altas preparada (08/10/2026)

Registro por correo y ambos botones Google muestran una elección explícita
sin marcar y los documentos internos/fecha antes de enviar credenciales. No
añade nuevos campos transmitidos ni un recibo de consentimiento: falta
evidencia por cuenta/versionado, sesiones existentes, servidor y revisión
jurídica de datos sensibles. No declarar cumplimiento completo ni términos
aceptados por todos los miembros existentes. Android/publicación pendientes;
guía `docs/PRUEBAS_ACEPTACION_PREVIA_AUTH.md`.

### FINO-49 — denuncias preparadas, aún no activadas (08/10/2026)

Responsable y destinatario confirmados por el propietario: dinero123xc@gmail.com.
La función prepara en Firebase `contentReports`, `moderationMail` y un contador
privado `reportRateLimits`; solo el servidor puede acceder. Incluye UID del
denunciante/autor, IDs del espacio/elemento, texto señalado (120 caracteres),
motivo, aclaración voluntaria (500), fecha, huella/ID de reintento y autorización
de procesamiento/versionado de política. No adjunta automáticamente montos,
notas, fotos ni todo el historial, aunque el texto voluntario podría contener
datos personales o financieros: no afirmar que la denuncia nunca los contiene.
Revisar «Otro contenido generado por usuarios», IDs, finalidad de seguridad/
prevención de abuso y las categorías realmente transmitidas antes de activar.

Limpieza programada desde 30 días, acotada y reintentable (no garantía de fecha
exacta); borrado Auth limpia avisos enviados por/sobre esa cuenta. Queda una
barrera de UID/fecha hasta 30 días contra solicitudes atrasadas; el contador
normal conserva solo día/cupo vigente hasta el borrado de cuenta. El borrado
de Firestore no retira correos ya recibidos ni copias del proveedor.

Sin configuración privada comprobada, la función rechaza la denuncia y explica
que soporte aún no está disponible. No se instaló extensión ni proveedor SMTP,
no se enviaron correos y no se conectó una cuenta real. Antes de activarla,
definir proveedor, conservación, accesos y procedimiento manual de atención;
actualizar políticas publicadas y consola. Un acuse de guardado NO confirma
correo entregado ni denuncia resuelta. Guía: `docs/PRUEBAS_DENUNCIAS_CONTENIDO.md`.
La aceptación de Términos/bloqueo y moderación efectiva siguen pendientes.

En los espacios compartidos de Familia y Cajas, el nombre de miembro y los
movimientos ingresados en ese espacio se muestran a los participantes autorizados.
Los datos personales fuera del espacio no se muestran a los invitados. La política
pública ya describe este funcionamiento y debe coincidir con la declaración de la tienda.

La integración opcional con Telegram está incluida en el código de la próxima
versión, aunque todavía no se ha desplegado su servidor. Antes de subir ese AAB hay
que actualizar el formulario: el texto enviado al bot y el identificador del chat
se procesan para registrar movimientos. Las políticas pública e interna ya lo explican.

> **Lo que decide la mayoría de respuestas:** los datos **se recogen** (viajan a Firebase si la
> persona inicia sesión) y **no se comparten** con terceros. Todo va **cifrado en tránsito** y
> **se puede pedir el borrado**. Nada de esto es opcional en el formulario y equivocarse aquí
> es lo que más rechazos causa.

### ¿Recoge o comparte datos? → **Sí, recoge. No comparte.**

| Categoría | ¿Se recoge? | ¿Obligatorio? | Para qué |
|---|---|---|---|
| **Nombre** | Sí | No (solo con cuenta) | Funciones de la app |
| **Correo electrónico** | Sí | No | Funciones de la app · Gestión de la cuenta |
| **Fotos** | Sí | No | Funciones de la app (foto de perfil, dibujos de categorías, boletas) |
| **Información financiera del usuario** *(otra)* | Sí | No | Funciones de la app |
| **Mensajes en la app** *(otros: contenido de notificaciones)* | Sí | No | Funciones de la app |
| **IDs de usuario** *(identificador de chat de Telegram, si se conecta)* | Sí | No | Funciones de la app · Gestión de la cuenta |
| **Grabaciones de voz** | **Por verificar en la APK final** | Opcional | Android puede enviar audio al servicio de reconocimiento; Fino no guarda grabaciones. No marcar «No se recoge» basándose solo en que no se guarda en Firebase. |
| **Diagnóstico de fallos y rendimiento** | No en la versión preparada | — | Sentry desactivado por decisión del propietario; comprobar y actualizar la declaración al publicar |

**Para las cinco que sí:** marcar **cifrado en tránsito** y **se puede solicitar el borrado**.

**FINO-25 — dictado:** el código no exige reconocimiento exclusivamente local.
La dependencia instalada elige el servicio normal de Android si no se exige
`requiresOnDeviceRecognition`. La política/ayuda preparadas ahora avisan que el
proveedor puede usar internet y procesar audio fuera del teléfono. No se cambia
el motor ni se bloquean teléfonos sin modelos offline. Antes de publicar hay que
comprobar proveedor, transferencia, retención y declaraciones de recogida/
compartición/cifrado para la APK final. No afirmar procesamiento temporal sin
evidencia de retención del proveedor. La transcripción confirmada como movimiento
sigue el tratamiento de la información financiera, no es una grabación de audio.
Fuentes oficiales revisadas el 07/10/2026:
[Android SpeechRecognizer](https://developer.android.com/reference/android/speech/SpeechRecognizer)
y [definiciones de Seguridad de los datos](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es).
Esto es un borrador: no confirma que la consola ni la web pública estén actualizadas.

El estado de avisos ya revisados (`finzo:homeNotificationSeen`) se guarda cifrado
solo en el teléfono, para controlar el contador de la campana. No se sube a Firebase,
por lo que no añade una categoría de datos recogidos en Play Console. Desde el
05/10/2026, cerrar sesión conserva una copia local cifrada y separada por cuenta,
incluidos los avisos leídos; solo se recupera con esa misma cuenta en el teléfono.
Eliminar la cuenta retira también sus copias locales. La política publicada debe
actualizarse con `docs/privacidad.html` en la próxima entrega.

La próxima versión aplica Pro también en el servidor para Personal, historial,
Negocio y Cajas privadas. Gratis consulta únicamente permisos, no sus movimientos
ni fotos. Se guarda además un registro privado por UID de la fecha de prueba,
sin información financiera, hasta completar el borrado de la cuenta. El evento
de eliminación de Firebase Auth retira ese registro y las copias cubiertas.
No añade una categoría de datos distinta a los IDs y gestión de cuenta ya
declarados. La política debe describirlo al publicar; no se publicó aún.

El cierre de Familia/Cajas conserva en el historial Personal un marcador de
cierre y el importe del aporte consumido. No es un cobro ni una transferencia
bancaria nueva: registra el destino de dinero ya anotado. Forma parte de la
información financiera ya declarada y de su copia Pro; no añade permisos ni
una nueva categoría. El saldo disponible sigue protegido; las devoluciones
tras vencer Pro se prepararon posteriormente en `docs/PRUEBAS_DEVOLUCION_SIN_PRO.md`;
el recorrido físico completo aún está pendiente.

La devolución a Personal guarda en servidor una confirmación financiera privada
por operación: UID, espacio, importe, moneda, fecha, descripción e IDs de aportes.
Se usa para deduplicación y recuperación incluso sin Pro, sin descargar ni
respaldar todo Personal. Solo Functions puede entregarla al dueño autenticado
que conoce el ID; se conserva hasta completar el borrado de Auth y se limpia por
lotes. El movimiento del espacio sigue siendo visible para sus miembros. La
orden pendiente local se cifra, se separa por cuenta y se conserva al cerrar
sesión; se retira tras confirmar el ingreso en disco o un rechazo definitivo.
Esto pertenece a información financiera y gestión de cuenta ya declaradas;
revisar retención/finalidad en el formulario antes de publicar. No añade permiso
Android ni SDK de anuncios. Política interna/web actualizadas solo en archivos;
el texto publicado y las declaraciones reales de Play siguen sin comprobarse.

El 05/10/2026 se comprobó el borrado de la nube con SDK/HTTP y eventos reales de
Auth/Firestore emulados bajo Node 22. Se corrigió la limpieza de índices privados
de miembros desde una función administrativa limitada al espacio en borrado.
No añade datos recogidos, permisos Android ni acceso de un miembro al historial
Personal de otro. No acredita borrado físico en Android ni reglas/configuración
publicadas. La nueva función debe desplegarse antes de distribuir la app;
el formulario y las políticas de producción continúan por verificar.

Las copias de Cajas privadas conservan
la fecha de última edición de cada Caja/movimiento y un marcador técnico de
formato, para no reemplazar una edición reciente con una copia antigua. Siguen
siendo los datos financieros de la propia cuenta, sin nuevas categorías de
datos, servicios o destinatarios; la nube de Cajas sigue limitada a Pro.

Negocio añade versiones de edición y marcas técnicas de borrado para las cuatro
listas. La nueva clave `finzo:businessDeleted` contiene únicamente IDs, cifrados
en el teléfono y separados por cuenta; esos mismos IDs se incluyen en la copia
Pro de `negocios/{uid}`. No añade servicios, destinatarios ni permisos Android.
Se conservan hasta eliminar los datos de la cuenta para impedir que un cliente
antiguo recupere filas borradas. Política interna/web preparadas, no publicadas.
Coordinar reglas y actualización; guía: `docs/PRUEBAS_NEGOCIO_BORRADOS.md`.

La revisión explícita de dos nombres distintos de Caja conserva ambas versiones,
elección, UID/IDs, fecha y confirmación pendiente en `revisionesNombre`, solo
en el contenedor local cifrado `cajasDinero`, incluido en la copia por cuenta.
No se sube ese registro a Firebase; solo se cambia el nombre elegido con Pro.
Hasta 50 revisiones, sin borrar anteriores al alcanzar el límite; misma limpieza
de la cuenta local. No añade clave/permiso/servicio/destinatario externo.
Las políticas interna/web están preparadas con fecha 06/10; no publicadas.
Revisar consistencia de la declaración real de Play antes de entregar.
Guía y límites: `docs/PRUEBAS_NOMBRES_CAJA_NUBE.md`.

Se prepara además `resolvePrivateBoxMoney`, limitado a la cuenta verificada
con Pro, para corregir monto/fecha de un aporte Personal/Caja privada en una
sola transacción remota. Comprueba fuentes, enlaces, moneda y saldo; no añade
colección/recibo ni retención distinta: modifica registros financieros existentes.
La petición incluye originales y elección financiera, dentro de la finalidad
de consistencia del respaldo ya declarado. Ya conectado en el código de la
próxima versión, no publicado. Guía inicial:
`docs/PRUEBAS_DIFERENCIAS_DINERO_SERVIDOR.md`; integración vigente:
`docs/PRUEBAS_FLUJO_IMPORTE_CAJA.md`.

El archivo local para esa integración queda preparado en `revisionesImporte`
dentro de `cajasDinero`: cuatro registros originales completos (Personal/Caja,
celular/nube), elección, UID/IDs, moneda, fechas y estado pendiente/confirmado.
Se cifra con el mismo almacén, se conserva en la copia local por cuenta al salir
y sigue su eliminación local. Hasta 50 revisiones/400.000 bytes UTF-8 entre
todas, sin retirar una anterior al alcanzar el límite; cada una hasta 150.000
bytes. La subida ordinaria excluye esas copias y se detiene si están pendientes.
La pantalla conserva esos originales antes de enviar y confirma Personal/Caja
juntos tras respuesta genuina; una revisión pendiente pausa ambos respaldos.
Políticas interna/web preparadas en archivos, no publicadas. La petición
transmite originales financieros ya contemplados para consistencia, pero se
deben revisar finalidad, retención y metadatos/imágenes reales con la declaración
de Play antes de distribuir, no asumir aprobación ni completar la consola ahora.

La recuperación prepara `recoverPrivateBoxMoney`: una cuenta real verificada
puede comprobar, incluso sin Pro, si su elección pendiente ya está aplicada
exactamente en Personal/Caja. El servicio solo devuelve la confirmación del
resultado que el usuario suministró; no devuelve el historial ni otros datos,
no escribe, no inicia una corrección y no crea colección/recibo/retención nuevos.
La petición vuelve a enviar los mismos originales/elección para comprobar la
consistencia financiera; se guardan con el mismo cifrado/archivo por cuenta.
Nueva corrección y descarga del respaldo siguen exigiendo Pro. Guía:
`docs/PRUEBAS_RECUPERACION_IMPORTE_SIN_PRO.md`. Desplegar función junto con el
servidor/reglas/app preparados antes de distribuir; políticas y consola reales
siguen pendientes. Esto no autoriza ni realiza publicación.

La sustitución de una elección pendiente conserva la elección anterior con
estado `sustituido` y los enlaces técnicos locales `reemplaza`/`reemplazadaPor`
entre ambas revisiones. Mantiene cuatro originales por revisión, los mismos
límites/cifrado/archivo por UID y eliminación local, sin borrar anteriores para
hacer espacio. Los enlaces no viajan en la petición financiera ni en el respaldo,
no añaden clave/colección/destinatario externo. Elegir otra vez requiere Pro y
confirmación explícita de las fuentes frescas; solo se retira el intento antiguo
en el mismo lote que conserva el nuevo pendiente. Políticas interna/web preparadas
en archivos, no publicadas. Guía: `docs/PRUEBAS_SUSTITUCION_IMPORTE_CAJA.md`.
No volver a un cliente que descarte o desconozca esta cadena sin revisar antes
compatibilidad/migración. Consolas y publicación autorizada siguen pendientes.

El cierre sin Pro de una elección monetaria pendiente solo se ofrece cuando
Personal y Caja locales y remotos ya coinciden. Mantiene los cuatro originales
en el diario local cifrado, con estado `retirado`, sin alterar los importes.
`moneyReviewRetirements/{uid}/operations/{id}` guarda únicamente UID/ID en la
ruta, huella SHA-256 de la solicitud y fecha de cierre; bloquea una petición
vieja posterior y se limpia al completar el borrado de la cuenta. No guarda
otra copia del movimiento. Las reglas de cliente no conceden acceso a esa
colección; el servidor la administra. Si la corrección se aplicó primero, la
app recupera su resultado en vez de fingir un retiro. Política interna/web
actualizada solo en archivos, no publicada; verificar Play Console y desplegar
servidor antes de distribuir la app. Guía:
`docs/PRUEBAS_RETIRO_IMPORTE_CAJA.md`.

Al convertir una Caja privada a compartida, `privateBoxMigrations` y la copia
privada conservan una confirmación del servidor: UID, IDs de origen/destino,
nombre/moneda, fechas, SHA-256 de la copia e IDs de enlaces a Personal, sin
una segunda copia de los montos. Evita repetir la operación; solo recupera
la confirmación propia mediante función autenticada, incluso sin Pro, sin
abrir el historial privado a Gratis. Se elimina al terminar el evento de
borrado Auth. Misma finalidad de consistencia de datos financieros, sin nuevos
servicios ni permisos Android; política interna/web preparadas para ese flujo.

La confirmación financiera conserva también la marca y fecha de anulación
cuando el usuario deshace una devolución; así no se recupera como vigente al
reintentar. Es la misma finalidad de consistencia y prevención de duplicados,
con la misma retención hasta borrar Auth, sin nueva categoría de datos ni
permiso Android. Política interna/web preparadas; publicación por comprobar.

El guardado conjunto Personal/Cajas privadas en Android no añade datos, claves
locales, retención, servicios ni permisos: usa el mismo cifrado y los mismos
movimientos/marcas en una transacción local comprobada. No genera un envío
adicional a Firebase ni cambia la copia por cuenta. Las operaciones enlazadas
en iOS/web se bloquean con aviso hasta implementar su garantía equivalente;
no se presenta esa parte como comprobada ni entregada.
La recuperación heredada también usa ese guardado conjunto. Una elección
explícita de monto/fecha modifica los mismos registros; no crea nuevas claves
ni una categoría de datos distinta. Pro verifica únicamente los IDs afectados
en el servidor antes de recuperar; Gratis no consulta nube. Los casos sin
prueba se conservan para revisión, no se borran ni se reembolsan por inferencia.
Guía y limitaciones: `docs/PRUEBAS_REPARACION_PARES_CAJAS.md`; no publicado.
La identificación manual de una pareja heredada modifica los IDs de enlace
ya previstos en esos mismos registros financieros. Exige elección y confirmación,
sin nuevos datos recogidos, claves, servicios, destinatarios o retención. No
recupera por aproximación una copia remota diferente ni una mitad desaparecida.
Ver `docs/PRUEBAS_ENLACE_HEREDADO.md`; preparación, no publicación.
La Caja conserva además una señal local cifrada de conversión pendiente para
no usar su copia privada mientras el resultado remoto es incierto. No se sube
a Firebase, no añade una clave ni categoría de datos y sigue el mismo archivo
por cuenta. Su ID de intento UUID también se guarda ahí cifrado y solo se
transmite como metadata de la operación, separado de la copia financiera.
La cancelación prepara `privateBoxMigrations/{uid}/attempts`: ID, huella,
origen/moneda, fechas y cancelación; el documento padre conserva un contador
diario antiabuso. `boxSpaces` mantiene la barrera de cancelación que impide
una publicación atrasada; sus clones incompletos/índice visible se limpian.
Intentos y barreras se conservan hasta terminar el borrado Auth, incluida su
limpieza de miembros/clones residuales. No exige Pro para cancelar/recuperar,
ni permite descargar el historial privado Gratis. Misma finalidad de
consistencia/protección financiera, sin servicios o permisos Android nuevos.
Antes de publicar, contrastar identificadores, datos financieros y si el contador
diario requiere actualizar Interacciones con la app en Seguridad de los datos;
no dar por suficiente la declaración anterior. Política interna/web preparadas;
formulario y publicación de producción pendientes. No declarar el flujo como entregado.

El borrado prepara `prepareIncompleteBoxDeletion`, sin Pro pero con correo
verificado e identidad reciente. Verifica primero sin escribir y limpia solo
clones propios demostrados; el origen privado se conserva hasta el paso normal
de borrar Cajas de la cuenta. `migrationDeletionPending` en el destino cerrado
mantiene la barrera hasta terminar Auth; entonces desaparecen raíz, miembros,
clones/índices y las confirmaciones. Se revisan estas últimas antes de retirarlas
para no confundir una publicación real con una copia incompleta. Sin permisos,
servicios o categorías financieras nuevos; misma finalidad/retención del borrado.
La descripción publicada y Seguridad de los datos siguen por contrastar con
la próxima versión; esta preparación no modifica las consolas ni la web publicada.

> **LOS CONTACTOS DE ENVÍO NO SE DECLARAN, Y AQUÍ DECÍA LO CONTRARIO (corregido el
> 18/08/2026).** Este archivo afirmaba que "se guardan y se suben a su copia en la nube" y
> mandaba declararlos bajo "Correo electrónico" y "Números de teléfono". **Es falso:**
> `utils/sendContacts.ts` los guarda solo en el aparato y esa clave no está en `cloudSync`,
> así que **no salen del celular** y por definición no se "recogen".
>
> La frase venía de un comentario del propio `sendContacts.ts` que decía eso mismo y que
> nunca fue verdad; se copió aquí sin comprobarla contra el código. Los dos están corregidos.
>
> **La consola está bien: ahí ya se declararon como NO recogidos.** Si alguien "arregla" este
> archivo al revés y los declara, estaría prometiéndole a Google que la app sube datos de
> terceros que en realidad nunca envía — y la declaración tiene que describir la app, no al
> revés.
>
> **Comprobarlo antes de tocar esta línea:** que `sendContacts` no aparezca en
> `utils/cloudSync.ts` ni en `datosParaLaNube`.

---

## Permiso delicado: lector de notificaciones

FINO-52 preparado (08/10/2026): movimientos personales/metas nuevos conservan
un UUID de creación, además del número, y el respaldo un marcador técnico de
compatibilidad. No identifica otro teléfono/persona ni añade un servicio o
permiso: viaja en los mismos datos financieros locales y copia Pro. Se conserva
con esos registros, siguiendo su borrado/archivo por cuenta. No se etiqueta
automáticamente historial antiguo. Revisar identificadores y finalidad en la
declaración real de Play al entregar, sin afirmar aprobación ni publicar ahora.
Guía `docs/PRUEBAS_IDENTIDAD_CREACION.md`; tarjetas/Sentry externo fuera.

FINO-24 preparado (07/10/2026): buzón temporal y marcas de duplicados cifrados
con clave local de Android Keystore. Hasta 200 pendientes, un lote reclamado
hasta 200 y 300 marcas; diagnóstico JS ya cifrado hasta 40 avisos. Buzón/log no
se envían a Firebase; los movimientos resultantes siguen el respaldo Pro ya
declarado. Se retiran nombres de otras apps, se conservan contadores/horas.
Sin permisos, destinatarios, categorías de datos ni retención remota nuevos.
Requiere instalar nueva versión Android; comprobar migración/Keystore físico y
manifiesto final antes de publicar una afirmación de cifrado para esa versión.
Política interna/HTML son borradores, no web publicada. Guía:
`docs/PRUEBAS_BUZON_YAPE_CIFRADO.md`. Seguridad de los datos real aún por contrastar.

Es la declaración más importante del formulario y **la que puede tumbar la publicación**.
Google exige justificar `BIND_NOTIFICATION_LISTENER_SERVICE` con la función principal de la app.

**Texto para el formulario:**

```
Fino es una app de control de gastos. El acceso a las notificaciones se usa
para una única función: leer los avisos de pago de Yape y registrar
automáticamente el movimiento (monto, fecha y contraparte) en el presupuesto
del usuario, sin que tenga que escribirlo a mano.

Es una función opcional que viene desactivada. Solo funciona si el usuario la
enciende expresamente dentro de la app y concede el permiso.

Fino filtra por paquete de origen ANTES de procesar nada: solo se leen los
avisos de Yape. Los avisos de cualquier otra aplicación se descartan sin
guardarse. Los avisos de códigos de verificación y claves se detectan y su
texto NO se guarda.

Los datos se quedan en el dispositivo del usuario y en la copia de seguridad
de su propia cuenta. No se envían a terceros, no se usan para publicidad y no
se venden. El usuario puede desactivar la función y borrar el registro en
cualquier momento desde Ajustes.
```

**Vídeo de demostración:** Google suele pedirlo. Grabar la pantalla mostrando:
Ajustes → Registro automático → encender el interruptor → conceder el permiso → llega un yapeo
→ aparece el movimiento solo.

---

## Otros permisos que preguntarán

| Permiso | Para qué, en una línea |
|---|---|
| `CAMERA` | Escanear boletas para leer el monto |
| `RECORD_AUDIO` | Dictar movimientos por voz |
| `POST_NOTIFICATIONS` | Avisar de la exportación programada |
| `USE_BIOMETRIC` / `USE_FINGERPRINT` | Bloquear la app con huella |

`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` y `SYSTEM_ALERT_WINDOW` están
bloqueados expresamente. Los reportes usan el selector moderno de Android y el
acceso rápido de voz es un widget; ninguno necesita esos permisos amplios.

FINO-21 preparado (07/10/2026): el receptor de trabajo de exportación será privado
y el de arranque del sistema estará separado. No añade permisos ni datos recogidos,
servicios o destinatarios. Mantiene RECEIVE_BOOT_COMPLETED y servicio privado.
Kotlin/manifest debug comprobados, no una versión instalada; verificar manifiesto
release/firma y recorrido físico al entregar. Guía: `docs/PRUEBAS_RECEPTOR_EXPORTACION.md`.

FINO-09 preparado (07/10/2026): exportación automática usa hora prevista, no
garantiza entrega puntual. Android 12+ consulta acceso exacto existente y, sin
él, usa alarma aproximada. No se agregan SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM ni
datos/permisos/destinatarios. Textos compactos/ficha interna ajustados; comprobar
servicio/alarmas físicos y versión final antes de entregar. No publicar una
promesa de guardado al minuto. Guía: `docs/PRUEBAS_HORARIO_EXPORTACION.md`.

---

## Clasificación de contenido

No marcar todo «No» automáticamente: Familia/Cajas permiten nombres y textos
compartidos entre miembros, que son contenido generado por usuarios aunque
solo se vean por invitación. Responder según las preguntas reales y las
funciones de la versión a publicar; no inferir una clasificación «apto para
todos» desde el código. Las compras tampoco existen aún en la versión preparada.
Antes de declarar que hay compras, verificar integración y producto reales.

La política requiere términos previos, reglas de contenido y moderación efectiva;
tener un botón de denuncia por sí solo no acredita cumplimiento. Revisar bloqueo
según interacción/visibilidad y respetar registros y saldos financieros.
[Política oficial de contenido generado por usuarios](https://support.google.com/googleplay/android-developer/answer/9876937?hl=es-419).

---

## Lo que NO se puede prometer

- **No decir "sin publicidad"** mientras no haya publicidad. Se quitó el 08/08/2026 por eso
  mismo: es lo que Google llama afirmación engañosa. Ver `constants/anuncios.ts`.
- **No decir "conecta con tu banco"**: no se conecta con ningún banco. Se leen avisos de Yape,
  que es otra cosa, y la diferencia importa.
- **No usar logos de bancos ni de Yape** en el icono, las capturas ni el gráfico. Es marca
  registrada y en una app de dinero es lo que hace pensar que es oficial de esa marca. Ya se
  decidió el 03/08/2026 y por eso no hay ni un logo financiero en la app.
