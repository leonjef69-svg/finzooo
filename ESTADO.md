# Dónde nos quedamos

Actualizado: **7 de agosto de 2026** · Código publicado: **7ago-16**

> **PENDIENTE: "Elegir categoría" sigue lenta.** Se arreglaron **seis** causas reales
> (ver la sección) y el usuario dice *"mejoró un poco pero sigue lento"*. Lo dejó en
> pausa él. **Lo que queda por probar está escrito al final de esa sección** — no
> volver a empezar por arriba.
· APK instalado y al día: **finzo-6ago-10** (no hace falta uno nuevo: desde
entonces no ha cambiado nada de Android)

> **Lo último y lo más serio:** al añadir los favoritos a la copia de la cuenta
> salieron tres fallos que ya estaban ahí — las categorías propias se subían y no
> se bajaban, cerrar sesión habría borrado datos de la nube, y la cuenta siguiente
> en un mismo celular heredaba las categorías y **fotos** de la anterior. Ver
> "Los favoritos van a la nube".

Este archivo existe para que una sesión nueva —de Claude o de quien sea— no
empiece de cero. No cuenta lo que ya se ve en el código ni en el historial de
git: cuenta el **estado** y las **decisiones**, que es lo que no se deduce
mirando archivos.

Al terminar algo relevante, actualízalo. Si queda desfasado deja de servir y
se vuelve peor que no tenerlo, porque se cree.

---

## Qué es esto

**Finzo**, una app de presupuesto personal para Android, en soles peruanos
(S/). React Native + Expo SDK 54, Expo Router, NativeWind, TypeScript.

El usuario **no es programador** y escribe en español. Las explicaciones van
en español llano, sin jerga: nada de "efecto", "estado", "props", "race
condition". Se dice qué se veía mal, por qué pasaba y qué se hizo.

---

## Cómo se entrega

Dos caminos, y confundirlos cuesta horas:

| | Qué lleva | Cómo llega |
|---|---|---|
| **Actualización (OTA)** | Solo JavaScript | `eas update`, y el usuario toca Ajustes → Buscar actualización |
| **APK** | Todo, incluido el código nativo | Se compila con `eas build` y hay que instalarlo a mano |

**El código nativo NO viaja por actualización.** Todo lo que toque
`modules/*/android/` necesita APK nuevo. Esto se olvidó varias veces y se
arregló dos veces lo mismo.

### AHORA SE COMPILA EN LA PC DEL USUARIO (03/08/2026)

Se agotaron las compilaciones de Expo del mes y no se podía esperar al día 1,
así que se montó la compilación local. **Funciona y ya no hay límite.** Expo
sigue disponible cuando vuelva su cupo; los dos caminos conviven.

```
C:\finzo\android\compilar.bat
```

Ese `.bat` pone `ANDROID_HOME` y `JAVA_HOME` (el Java que trae Android
Studio) y lanza `gradlew assembleRelease --max-workers=3`. El APK sale en
`android/app/build/outputs/apk/release/`.

**Cuatro cosas costaron esta primera vez, y ninguna es obvia:**

1. **El proyecto tuvo que MOVERSE a `C:\finzo`.** Estaba en
   `Videos\Fino control de gastos diarios\PresupuestoApp` y las rutas del
   código C++ de `react-native-safe-area-context` pasaban de los 260
   caracteres que admite Windows. Un atajo corto (junction) **no basta**:
   Gradle resuelve la ruta real por su cuenta. Hubo que mover de verdad.
2. **Memoria.** `MaxMetaspaceSize=512m` no llega: muere en
   `compileReleaseKotlin` con "Metaspace" tras 1.276 de 1.308 tareas. Está
   subido a `-Xmx4096m -XX:MaxMetaspaceSize=2048m` en
   `android/gradle.properties` — ojo, ese archivo lo regenera `prebuild`.
3. **El canal de actualizaciones.** EAS lo inyecta desde `eas.json`; gradle
   no. Sin él la app compila bien pero **no puede buscar actualizaciones**
   ("checkForUpdateAsync has been rejected"). Resuelto pasándolo a
   `app.json` → `updates.requestHeaders`, que sí lo lee el prebuild.
4. **`git add -A` falla** tras compilar: las carpetas de Gradle dentro de
   `modules/*/android/build` traen rutas larguísimas y Windows revienta con
   "Filename too long". Ya están en `.gitignore`.

**La llave de firma** está en `C:\Users\User\finzo-llave\` (bajada de Expo) y
la referencian `FINZO_*` en `android/gradle.properties`. El APK sale firmado
igual que los de Expo — comprobado: SHA-1 `3D:F8:...:8B:3D` — así que se
instala encima sin desinstalar. **Esa carpeta necesita copia de seguridad.**

**El APK local pesa 163 MB** contra los ~70 MB de Expo, porque lleva las
cuatro arquitecturas. Se puede reducir; no se ha hecho.

### LAS COMPILACIONES SE ACABAN. JUNTAR LO NATIVO.

El **02/08/2026 se agotaron las compilaciones de Android del mes** (plan
gratuito de Expo; se reponen el 1 de cada mes). Se gastaron todas en una sola
tarde, compilando un APK por cada arreglo nativo — y varios porque el arreglo
anterior no había salido bien.

Consecuencia: **quedó un arreglo hecho y sin poder entregar** (la voz por su
propio hilo, commit `db03dc7`), y hasta el 01/09/2026 no se puede tocar nada
de `modules/*/android/`.

La regla:

> **No compilar un APK por cada arreglo nativo.** Se juntan y se compila una
> vez. Antes de lanzar una compilación, comprobar si hay otro cambio nativo
> pendiente o previsible que pueda ir en el mismo.

Y antes de proponer algo nativo, decir en voz alta lo que cuesta: cada intento
gasta una compilación, y equivocarse gasta dos.

Lo que **no** se ve afectado: todo lo que sea JavaScript sigue llegando por
`eas update` sin límite. Es la mayor parte del trabajo.

### Reglas que costó aprender

- **UN SOLO enlace de APK por mensaje, y UNO SOLO VIVO EN TODA LA
  CONVERSACIÓN.** Nunca uno "de respaldo": el 30/07/2026 se dieron dos, el
  usuario instaló el viejo, y dos funciones que estaban bien parecieron rotas.
  Se perdió medio día.

  Volvió a pasar el 02/08/2026, y de otra forma: los dos enlaces iban en
  mensajes distintos —uno al diagnosticar, otro al terminar el arreglo— y aun
  así el usuario acabó con dos enlaces delante sin saber cuál instalar. La
  regla no es "uno por mensaje": es que en la conversación **solo puede haber
  un APK vigente**.

  De ahí sale la práctica: **no dar el enlace de un APK hasta tener el arreglo
  hecho**. Si hay que enseñar el diagnóstico antes, se cuenta el problema sin
  enlace. Y al dar el nuevo, se dice explícitamente que el anterior queda
  anulado.

  **Y una tercera vez, el mismo 02/08/2026.** Esta vez ni siquiera eran dos
  APK distintos: era el MISMO enlace pegado en dos mensajes seguidos —al
  entregarlo y al resumir—. Da igual: en la pantalla del usuario se ven dos
  enlaces, y eso es lo único que cuenta.

  La regla, ya sin margen para cumplirla a medias:

  > **El enlace de un APK se escribe UNA sola vez en toda la conversación.**
  > Para volver a referirse a él se dice "el APK que te pasé" o se nombra por
  > sus últimas letras. Nunca se vuelve a pegar la dirección.

  Las dos versiones anteriores de esta regla se cumplieron al pie de la letra
  y el usuario acabó igual las tres veces. Una regla que se puede cumplir sin
  resolver el problema está mal escrita: por eso ahora se cuenta algo que se
  puede contar —cuántas veces aparece la dirección— y no una intención.
- **Subir `CODE_MARKER`** en `screens/AppInfo.tsx` en cada entrega. Es la única
  forma de saber por chat qué código está corriendo el celular. Sin eso, cada
  arreglo es a ciegas y puede estar ya hecho.
- **Commit y push automáticos** tras cada cambio, sin preguntar. Lo pidió el
  usuario expresamente. Solo `commit` y `push` — nada destructivo.

---

## Antes de publicar nada

```
npx tsc --noEmit
npx eslint app screens components utils constants contexts modules
```

Y las pruebas, con un solo comando:

```
node pruebas/correr.mjs
```

Son 40 pruebas y 7 auditores. Cada prueba nueva tiene que **fallar contra la
versión anterior**: una que pasa siempre no está probando nada. Y si la prueba
imita código de otro lenguaje, tiene que imitar también sus reglas — ver el
espacio duro, más abajo.

---

## Lo que funciona hoy

- Movimientos, presupuesto mensual y por categoría, metas de ahorro
- **Micrófono**: anotar, preguntar, comparar meses y exportar. El orden de las
  palabras no importa (probado con las 720 combinaciones de una frase)
- **Exportar** a PDF, Excel y CSV; a WhatsApp, Gmail, correo, Drive o el menú
  de compartir, con el destinatario ya puesto
- Contactos de envío guardados, con editar y borrar
- Importar estados de cuenta (PDF, Excel, CSV) y archivos compartidos a Finzo
- **Crear tus propias categorías** con dibujo (181 iconos + 55 logos) y color;
  editarlas y borrarlas. Personalizar las de fábrica sigue existiendo pero su
  puerta se quitó de Ajustes.
- Bloqueo con PIN o huella, copia en la nube, tres idiomas (es/en/pt)
- Pantalla **Comandos de voz** en Ajustes, con ejemplos de gastos Y de
  ingresos, de anotar, preguntar, comparar y exportar

---

## Lo que falta para Play Store

Esto es lo pendiente de verdad, en orden de bloqueo:

1. **Premium se regala.** No hay Play Billing ni precio en ninguna parte del
   código: el botón "Actualizar a Premium" llama a `setIsPremium(true)` y ya.
   O se cobra de verdad o se quita la etiqueta PRO.
2. **"Sin anuncios" es una promesa vacía** en los textos de Premium: no hay
   anuncios que quitar. Google lo trata como afirmación engañosa.
3. **Política de privacidad sin URL pública.** Además está desfasada: ahora se
   guardan también correos, números de teléfono e imágenes de categorías, y
   tiene que decirlo.
4. **Falta la página web de borrado de cuenta.** Google la exige aunque la app
   ya tenga el botón: se pide poder borrar la cuenta *sin* instalar la app.
5. **Declarar el lector de notificaciones** en el formulario de permisos
   sensibles, si se mantiene esa función.
6. **12 probadores × 14 días** en prueba cerrada, para cuentas nuevas de
   desarrollador.

---

## Categorías propias — hecho el 03-04/08/2026

Se pueden **crear, editar y borrar** categorías con nombre, dibujo y color, todo
desde la pestaña "Tus categorías" de la pantalla de elegir categoría: se toca una,
se le cambia lo que sea, y se confirma con Aplicar. Esa cuadrícula ya no vive en
"Nuevo movimiento": se mudó a su propia pantalla el 06/08/2026 — ver más abajo.

**El catálogo** (`constants/iconos.tsx`): 181 iconos de línea en 12 grupos
(lucide) y 55 logos de marca (FontAwesome, dentro de @expo/vector-icons). No
hizo falta instalar nada.

Los genéricos se importan uno a uno a propósito: importar la librería entera
metería 1.749 iconos en la app para usar ciento y pico. Las marcas van por
nombre porque son una tipografía — agregar una más no pesa nada.

### NI UN LOGO FINANCIERO, Y ES DELIBERADO

Ni Visa, ni Mastercard, ni PayPal, ni Yape, ni bancos. Todo logo es marca
registrada; lo que cambia es la probabilidad de que su dueño se moleste, y los
financieros son otro nivel: **una app de dinero mostrando el logo de un banco
es justo lo que hace pensar "esto tiene relación con mi banco"**. Es el reclamo
más fácil de recibir y el más difícil de defender.

Se acordó con el usuario el 03/08/2026 sabiendo que ni así el riesgo es cero.
Por eso **todas las marcas viven en un solo archivo**: si alguien reclama,
quitar una es borrar una línea. Hay una prueba que vigila las dos cosas.

Y nunca en el icono de la app ni en las fotos de la tienda: ahí sí parecería
que Finzo es oficial de esa marca.

### Decisiones que costaron pensarse

- **El tipo no se pregunta**: sale de la pestaña donde se tocó "Nueva".
- **El id lleva prefijo `propia_`.** Sin él, quien cree una "Comida" chocaría
  con la de fábrica y una de las dos desaparecería, llevándose la categoría de
  todos sus movimientos anteriores.
- **Borrarla NO borra sus movimientos**: caen en "Otros" y siguen contando.
  Antes de borrar se dice cuántos son, con el número. "Se va a borrar" no
  informa igual que "tus 3 movimientos pasan a Otros".
- **Se descartó el toque largo** para editar: es invisible, y quien no lo sepa
  no encuentra nunca cómo cambiar lo que acaba de crear.
- **Fuera los emojis** de toda la app (03/08/2026). La misma categoría se veía
  con emoji al elegirla y con icono de línea en Inicio. Y con emojis no se
  puede ofrecer un catálogo de mil dibujos.

### El catálogo iba lento, y el primer arreglo fue al sitio equivocado

Reportado el 04/08/2026: "al usar la categoría, poner nueva y más, se pone
lento". Se arreglaron dos cosas medibles y **siguió lento**:

1. `iconoDe` devolvía un componente recién creado en cada llamada. Para React
   eso no es "el mismo dibujo otra vez", es otro dibujo: tiraba el anterior y
   lo construía de cero. 55 logos por pulsación. Se guardan en `LOGOS_HECHOS`.
2. La cuadrícula entera se rehacía con cada letra del nombre. `memo`.

Las dos eran ciertas y ninguna era la principal. **Memorizar evita rehacer los
dibujos, no tenerlos.** El coste real era montar los 236 de golpe en una
pantalla donde caben veinte, y cada uno es un dibujo vectorial de verdad, no
una letra.

Arreglo (05/08/2026): el catálogo se aplana en títulos y filas de cinco, y va
en un `FlatList` que **solo construye lo que se ve**. Con `initialNumToRender`
y `removeClippedSubviews`, porque sin ellos la lista igual monta todo lo que
cree que entra.

Dos trampas anotadas en el código y vigiladas por pruebas, porque las dos se
ven bien al leerlas:

- **La lista no puede ir dentro de un `ScrollView`**: ahí cree que tiene sitio
  infinito y construye todo. Sería el mismo fallo con más código. El
  `ScrollView` que queda es solo el de los colores, en la otra rama.
- **No puede volver un componente que dibuje todos los grupos sin condición.**
  Hay una prueba que falla si reaparece `memo(function Catalogo`.

La lección, otra vez: se midió una causa real, se arregló, y no era la que
dolía. Lo que evitó darlo por bueno fue que el usuario lo probara y lo dijera.

**Y el arreglo trajo dos cosas suyas** (05/08/2026, con foto: "está disparejo
los iconos y está lento, se siente feo al abrirlo"):

- **Disparejo.** Al pasar a filas de cinco, las casillas quedaron con ancho
  fijo: no llegaban al borde y sobraba un vacío a la derecha. Ahora el ancho lo
  reparte la fila. Pero eso solo trae el problema contrario: la última fila de
  cada grupo casi nunca viene completa, y sus dibujos se estiran para llenarla
  y salen más grandes. Se rellena con espacio vacío. Las dos mitades hacen
  falta; con una sola se ve chueco por el otro lado.
- **Feo al abrir.** No era el coste de los dibujos, era **cuándo** se hacen:
  la pantalla entra con animación y construirlos en ese mismo instante la
  atropella. Abaratarlos más no habría arreglado esto nunca.

  **Y se intentó apartarlo de la animación dos veces, y las dos salieron
  peor.** Primero, no dibujar nada hasta que la animación acabara: *"luego de 1
  segundo aparece los iconos como si estuviera cargando"*. Después, esperar
  solo los dibujos con la cuadrícula vacía ya puesta: mejor, pero *"ni bien
  entro debería ya estar los iconos"*. Las dos veces el usuario tenía razón.

  **Esperar nunca era el arreglo.** El arreglo era construir menos, y el
  culpable estaba a la vista: `windowSize` se cuenta en **pantallas**, no en
  renglones. Con 3, la lista levantaba la visible más una arriba y otra abajo:
  unos 175 dibujos donde caben 60. Con 2 y una primera pasada corta, los
  iconos entran de una y no hace falta apartarlos de nada.

  De paso, dos cosas aprendidas sobre `InteractionManager`: no espera a la
  animación, espera a que no quede **nada** pendiente, que puede ser mucho más;
  y usarlo para tapar un coste que no se ha bajado solo cambia un tirón por una
  pantalla que parece cargando. El tirón pasa; la pantalla vacía se ve.

  **Pero el tope se le puso al número equivocado**, y eso costó otro fallo:
  *"cuando deslizo para abajo están recién apareciendo los iconos como si
  estuvieran cargando"*. Son dos cosas distintas y se confundieron:

  - `initialNumToRender` es la **primera** pasada, la única que ocurre mientras
    la pantalla se abre. **Ese** es el número que decide si abrir pesa, y ahí va
    el tope (≤ 8).
  - `windowSize` es la **reserva** que se mantiene lista alrededor de lo que se
    ve. Se llena en tandas, después, mientras la persona mira: no pelea con la
    animación. Bajarlo a 2 no ganó nada al abrir y dejó la reserva tan justa
    que el dedo la agotaba. Está en 5, y la prueba ahora exige un **mínimo**,
    no un máximo.
  - Las tandas van de a 8 cada 16 ms: si se llenan más despacio que el dedo, el
    hueco se ve igual aunque la reserva sea grande.
  - **Fuera `removeClippedSubviews`.** Suelta las vistas que salen de pantalla
    para ahorrar memoria, y en Android es causa conocida de celdas en blanco
    porque al volver hay que rehacerlas. Con 236 casillas la memoria no era el
    problema; los huecos sí.

## "La app la siento lenta": las pestañas rehacían el catálogo (07/08/2026)

*"Cuando le doy a elegir categoría como que se demora en entrar a la pestaña donde
están los iconos. Quiero que la aplicación se sienta rápida y fluida."*

Tres causas, y **las tres las habíamos introducido nosotros estos días**:

**1. Cada pestaña se dibujaba solo si era la elegida.** Así que volver a la de los
dibujos construía **las 236 casillas otra vez**, y otra vez en cada ida y vuelta.

El primer arreglo fue dejarlas **las cuatro puestas** y esconder la que no toca
(`display: "none"`). Arregló el cambio de pestaña y **empeoró lo que más molestaba**:
abrir la pantalla pasó a construirlas todas —incluida la lista de categorías con sus
fotos— cuando antes solo montaba una. Y entrar era justo la queja.

**Lo correcto es lo de los dos: cada pestaña se construye la PRIMERA vez que se mira
y a partir de ahí se queda puesta** (`vistas`). Abrir cuesta solo la de los dibujos, y
cambiar de pestaña se paga una vez y nunca más. Yoga saca de la cuenta lo que lleva
`display: none`, así que la parte deslizable sigue midiendo solo lo que se ve.

**2. ~~Cada casilla traía una vista ANIMADA dentro.~~ SE INTENTÓ Y ROMPIÓ LA
CUADRÍCULA — REVERTIDO.** `TouchableOpacity` usa una vista animada para bajar la
opacidad al tocarla: eran 236 valores animados creados al abrir sin que ninguno haga
nada hasta que se toca uno. Se cambió por `Pressable`… y para dar ese aviso con
`Pressable` hay que pasar la medida en una **función**
(`style={({pressed}) => [...]}`). **Las clases de NativeWind se aplican también por
`style`, así que con una función de por medio el ancho y el alto no llegan**: las
casillas salieron como pastillas altas y estrechas.

Lo vio el usuario en el celular: *"no quiero que se vea así, estaba bien como estaba
antes"*. Vuelto a `TouchableOpacity`. La prueba **no vigila qué componente se usa**
—eso da igual— vigila que **la medida llegue**, en un objeto y no en una función.

**3. Las 236 recortaban su contenido.** `overflow-hidden` obliga a Android a darle a
cada casilla su propia capa para cortar lo que sobresale. Se puso en todas el mismo
día, al permitir fotos en favoritos — **sin pensar en que la cuadrícula grande no
tiene ninguna foto**. Ahora solo recortan las que llevan foto.

> Ninguna es un cálculo mal hecho: son **cosas añadidas por un motivo bueno y
> aplicadas donde no hacían falta**. El escenario que las delató es el mismo de
> siempre —usar la pantalla de verdad, ir y volver— y ninguna se ve leyendo el
> archivo de una sola pasada.

### LA CAUSA DE FONDO: 236 casillas con clases de Tailwind (7ago-14)

El usuario volvió a medirlo con el celular en la mano: **2 a 3 segundos en entrar** y
**1 a 2 segundos en marcar un dibujo**. Los arreglos anteriores ayudaron y no era eso.

**Cada casilla llevaba su aspecto en clases de NativeWind.** Un componente con clases
se apunta al sistema de estilos para enterarse de los cambios de tema, y resuelve su
cadena: son **236 apuntes y 236 resoluciones solo para abrir la pantalla**, y otros
tantos que comparar en cada toque. Eso explica las dos cosas a la vez — entrar y
marcar.

Ahora el aspecto se calcula **una vez para toda la pantalla** (`aspectoDeCasilla`) y
las 236 comparten **dos objetos**. Ninguna usa clases. Y como el objeto es siempre el
mismo, la memorización de cada casilla por fin sirve: al marcar un dibujo se rehacen
dos, no 236.

Para eso hicieron falta los tonos **100 y 500** en `constants/colors.ts`, que antes
solo salían por las clases. Son los mismos valores de Tailwind, así que **no cambia
nada de lo que se ve** — cuatro de los dieciocho se pudieron verificar contra
`GOAL_COLOR_HEX`, que ya los tenía escritos.

Hay una prueba que comprueba que **los 18 colores tengan su entrada en los tres
mapas**: si a uno le falta, no hay error — cae en el gris de reserva y esa casilla se
ve apagada mientras las demás se ven bien.

> **Y añadir esos dos mapas rompió un auditor**, que fue lo mejor que pudo pasar.
> `auditar-fondo` comprobaba que dos categorías no usen colores parecidos leyendo
> *"todo lo que hay antes de GOAL_COLOR_HEX"*. Con tres mapas de las mismas claves,
> el último pisaba al primero y acabó comparando colores que no son los que se ven.
> Avisó en falso; podría haber sido al contrario. Ahora lee **el bloque del 600** y
> falla si no consigue leerlo, en vez de pasar sin haber mirado.

### Y el nombre salía como clave interna (7ago-13)

En la misma captura: al tocar "Mascotas", la vista previa y la casilla del nombre
decían **"category.mascotas"**. El `label` de una categoría de fábrica es una
**clave** de traducción, no el nombre, y se metía tal cual. Venía del 7ago-01, cuando
tocar una categoría pasó a cargarla arriba.

Se traduce con `t()`, que sirve para las dos clases sin preguntar: en una categoría
propia el `label` ya es el nombre escrito a mano y el traductor devuelve tal cual lo
que no reconoce.

**Y "cómo era" guarda el nombre YA TRADUCIDO**, el mismo que se ve. Guardando la
clave, dar a Aplicar sin tocar nada habría escrito "Mascotas" como nombre propio de
esa categoría — y habría dejado de traducirse al cambiar el idioma de la app, por no
haber hecho nada.

### EL CATÁLOGO EN DOS TANDAS — lo que faltaba (7ago-16)

Con todo lo anterior arreglado seguía lento. Lo que quedaba es el fondo del asunto:
**cada dibujo es una letra de una tipografía y Android tiene que MEDIR cada letra.**
227 medidas es un coste que **no se puede abaratar, solo repartir** — y puestas todas
de golpe caen justo encima de la animación de entrada.

**No es lo que se rechazó en agosto, y la diferencia es la que importa:**

| Rechazado entonces | Lo que se hace ahora |
|---|---|
| Los grupos **de a uno** → huecos al deslizar | **Dos** tandas |
| Nada dibujado hasta acabar la animación → un segundo en blanco | La primera tanda son **4 grupos (~70 dibujos, más de 3 pantallas)**: lo que se ve está completo desde el primer instante |
| — | La segunda trae **TODO el resto de una vez**, fuera de la vista, a los 350 ms |

`GRUPOS_AL_ABRIR = 4` es el equilibrio y no se toca a la ligera: menos y un deslizón
rápido llega al final de lo dibujado; más y volvemos a cargar la entrada. **Hay una
prueba que lo cuenta de verdad** — suma los dibujos de esos grupos y exige que pasen
de tres pantallas.

Y la prueba que decía *"están los 236 desde el principio"* **se cambió con su motivo
escrito**, no para que pasara: la regla vieja tenía buenas razones y las nuevas son
otras.

### Y el retraso AL TOCAR: las 48 filas se rehacían (7ago-16)

Cada fila recibía "el dibujo elegido de la pantalla". Cambiaba con cada toque, así que
**las 48 filas se rehacían** —y las 236 casillas se volvían a comparar— aunque el
cambio afectara a dos.

Ahora una fila recibe el elegido **solo si está en ella**, y nulo si no. Las que no lo
tienen reciben lo mismo que antes (nulo) y la memorización las deja fuera: se rehacen
**dos** filas, la que suelta la marca y la que la toma.

Lo que **sigue rechazado**: virtualizar (`FlatList`), `windowSize`, cargar de a uno, y
`InteractionManager` —que no espera a la animación, espera a que no quede *nada*
pendiente—. Ver la sección del catálogo lento del 05/08.

### Séptima causa: cada icono de Expo es una CLASE CON ESTADO (7ago-17)

Esta es la primera que **no** se encontró leyendo nuestro código, sino leyendo el de la
librería: `node_modules/@expo/vector-icons/build/createIconSet.js`.

Un icono de `@expo/vector-icons` parecía un dibujo. No lo es. Es una **clase con
estado**:

```js
state = { fontIsLoaded: Font.isLoaded(fontName) };
async componentDidMount() {
  if (!this.state.fontIsLoaded) { await Font.loadAsync(font); this.setState({ fontIsLoaded: true }); }
}
render() {
  if (!this.state.fontIsLoaded) { return <Text />; }   // ← vacío
  return <RNVIconComponent {...this.props} />;          // ← y por dentro OTRO componente
}
```

Lo que eso significaba con 227 casillas:

- **227 clases con estado** en vez de 227 dibujos. Cada una con su ciclo de vida.
- Si la tipografía no estaba lista —y al abrir por primera vez no lo está—, las 227
  pedían la tipografía **cada una por su cuenta** y luego avisaban **227 veces** "ya
  cargué". Son 227 redibujados de la cuadrícula, uno detrás de otro.
- Y mientras eso pasaba, cada casilla devolvía un `<Text />` **vacío**.
- Incluso ya cargada, cada casilla eran **cuatro piezas** apiladas: la clase, el
  componente de dentro, su `Text`, y la letra.

Ahora `dibujo()` en [constants/iconos.tsx](constants/iconos.tsx) **pinta la letra él
mismo**: pide la tabla de la tipografía una vez, saca el carácter con
`String.fromCodePoint` **al guardar el dibujo en la memoria** —no al pintarlo— y lo
suelta en un `<Text>` pelado. Es exactamente lo que hace el componente de Expo por
dentro, sin la clase, sin el estado y sin la capa de más.

**El detalle que casi se pierde, y que era el que decidía si esto servía de algo:**
quien pedía la tipografía era el componente de Expo, la primera vez que se dibujaba.
Al dejar de usarlo, **nadie la pedía**: `Font.isLoaded` habría dicho "no" siempre, cada
casilla habría caído en el camino de reserva —el componente de Expo— y no se habría
ganado nada, sin que nada se rompiera a la vista. Por eso se pide al cargar el archivo
(`MaterialCommunityIcons.loadFont()`), y **hay una prueba solo para esa línea**.

El camino de reserva se queda: si la tipografía no estuviera lista o el nombre no
existiera, se usa el componente de Expo. Sin él, el fallo sería el más caro de todos —
las 227 casillas vacías.

Se conservan los cuatro detalles de aspecto que pone Expo (`allowFontScaling={false}`,
`fontWeight`, `fontStyle`, `selectable={false}`); si falta alguno el dibujo cambia de
tamaño o de grosor y parece otro icono. **Los cuatro están en la prueba.**

> Las nueve afirmaciones nuevas se comprobaron contra la versión anterior y **fallan**
> las nueve. La décima —"y no se vuelve a calcular dentro del dibujo"— pasa sola y está
> marcada como tal: vale solo pegada a la anterior.

Y un arreglo de paso en las pruebas: `expo-font` arrastra `expo-asset`, que esbuild no
sabe resolver, y con eso dejaban de compilar **ocho** pruebas que no hablan de iconos.
Tienen su sustituto en [pruebas/stubs/font.ts](pruebas/stubs/font.ts). El de
`@expo/vector-icons` ahora devuelve **la tabla de letras de verdad**, leída del propio
paquete: con una tabla vacía las pruebas recorrerían el camino de reserva, o sea el
código que en el celular no se usa.

### DÓNDE QUEDÓ ESTO, Y QUÉ PROBAR DESPUÉS (07/08/2026)

Tras los seis primeros arreglos: *"mejoró un poco pero sigue lento"*. Lo dejó en pausa
él, y luego pidió volver: *"que audites código, depures, encuentres fallas"*. De esa
auditoría salió la séptima causa de arriba, que es de otra clase que las seis
anteriores —está en la librería, no en nuestro código— y por eso **está sin medir
todavía**.

**Lo que ya está descartado como causa** —no volver a mirarlo—: las clases de
NativeWind en las casillas, el remontaje al cambiar de pestaña, montar las cuatro
pestañas al abrir, `overflow` en las 236, las 48 filas rehaciéndose al tocar, y la
vista animada de `TouchableOpacity` (esa además rompió la cuadrícula).

### Lo que midió él con 7ago-17

| | Antes | Con 7ago-17 |
|---|---|---|
| Entrar a Elegir categoría | 2–3 segundos | **1 segundo** |
| Tocar un icono | 1–2 segundos | **sigue sin ser instantáneo** |

**Entrar quedó resuelto**: la séptima causa era la gorda de esa mitad. Lo que queda es
solo el toque.

### Octava causa, y NO era lentitud: la marca se pintaba al soltar (7ago-20)

Lo que midió el medidor: **262 ms · 2 filas**.

Las "2 filas" contestaron una pregunta de golpe: **la memorización sí funciona en el
celular**, no se está rehaciendo la cuadrícula entera. Ahí no hay nada que buscar.

Y los 262 ms **estaban mal medidos, por mi culpa**: contaban desde que el dedo se apoya,
pero la marca se decide cuando se levanta, así que dentro de ese número estaba el rato
que la persona tuvo el dedo encima. No se podía saber cuánto era de cada uno.

Pero el error de medición **señaló la causa**. Si la marca se decide al levantar el
dedo, entonces:

> **Por muy rápida que sea la app, la marca llega siempre después del dedo.** No es
> lentitud. Es dónde está puesto el aviso. Siete arreglos de velocidad no podían mover
> esto, y por eso no lo movieron.

Ahora la casilla **se pinta ella misma al ser tocada**, sin preguntarle a la pantalla:
no se rehace ninguna fila, no hay nada que esperar, aparece en el mismo cuadro. Cuando
el dedo se levanta llega la marca de verdad y, como ya estaba pintada, no se ve cambio.

Tiene tres piezas y no una, y cada una tapa un agujero real:

1. **Al apoyar** se pinta (`onPressIn`).
2. **Si era un deslizón** y no un toque, se despinta (`onPressOut` sin que hubiera
   habido `onPress`). Sin esto, deslizar el catálogo dejaría casillas marcadas por el
   camino.
3. **Al elegir otra**, esta se despinta aunque nadie la toque (un efecto que mira cuándo
   deja de ser la elegida). Sin esto quedarían dos marcadas a la vez.

Las cinco afirmaciones nuevas de `verificar-elegir-categoria` fallan contra la versión
anterior. Las dos que pasan están marcadas: una encuentra el bloque de código y la otra
vigila que al pintar antes no se haya dejado de elegir.

### Novena causa: el primer toque hacía cola detrás de 223 dibujos (7ago-21)

Con el medidor arreglado, el número que dio: **el primer toque después de abrir, 6000 ms
en la parte de "app"**.

Marcar una casilla no cuesta eso ni de lejos. Lo que pasaba es que el toque **hacía cola**
detrás del golpe que armaba los 223 dibujos que faltaban — la segunda tanda, que llegaba
entera de una vez a los 350 ms. Mientras ese golpe dura, el dedo no existe para la app.

**La solución obvia estaba prohibida, y por escrito.** Lo primero que se me ocurrió fue
armarlos según se desliza. Es lo que él ya rechazó con estas palabras, guardadas en
`verificar-categorias-propias`: *"los iconos ya deberían estar ahí fijos, no deberían
cargar recién cuando yo deslizo"*. Cuatro entregas se fueron en eso. **Se descartó antes
de escribir una línea**, y ahora hay una prueba que guarda esa puerta — precisamente
porque es la idea que se le ocurre a cualquiera al ver el problema.

Lo que sí se puede: el trabajo total **no se abarata** —son 227 letras que Android tiene
que medir— pero sí se **parte**. Ahora el resto llega en tandas de dos grupos, una tras
otra, **solas**, sin que nadie deslice. En cuanto acaban están los 227 puestos para
siempre, igual que antes.

La diferencia no está en cuánto tardan todas, sino en que **entre tanda y tanda la app
cede el turno**, y ahí entra el toque que estaba esperando. Un toque espera, como mucho,
lo que dura **una** tanda. De ahí que las tandas sean chicas: subir `GRUPOS_POR_TANDA`
para "que acabe antes" devuelve la espera, y hay una prueba con números que lo impide.

Y tampoco es el escalonado de a uno que se rechazó en agosto: aquel iba justo por detrás
del dedo y dejaba huecos visibles. Aquí la primera tanda ya llena más de tres pantallas y
cada una añade unas dos más.

> **Se añadió un segundo número temporal al medidor:** cuánto tardó en armarse todo el
> resto. Si sale grande y parecido a los 6000 ms, queda confirmado que era esto. Es la
> forma de no volver a suponerlo.

### Décima causa, y la que lo cerró: tandas de dos FILAS y pausa al tocar (7ago-22)

Los dos números que dio el celular con las tandas de dos grupos:

| | |
|---|---|
| `app` (levantar el dedo → verlo marcado) | **136 y 353 ms** — venía de 6000 |
| armar todo el resto del catálogo | **2370 y 2759 ms** |
| filas rehechas por toque | **2**, o sea que la memorización va bien |

Y su respuesta, que es la que ordenó lo que había que hacer: *"SOLUCIONALO DE UNA VEZ, NO
PUEDO ESTAR HACIENDO PRUEBAS CADA RATO, DALE UNA SOLUCION REAL"*. **Tenía razón.** Cuatro
entregas seguidas pidiéndole que midiera es demasiado.

Lo que faltaba, leyendo esos números:

1. **La tanda era una medida mala.** Un grupo tiene de 6 a 20 dibujos, así que la tanda
   más gorda era el triple de la más chica y el peor caso lo marcaba ella. **Ahora se
   reparte por FILAS**: una fila son siempre cinco, y una tanda son **diez dibujos
   exactos**. Nunca veinticinco.
2. **El reparto ahora se para mientras hay un dedo en la pantalla** (`QUIETO_MS`, medio
   segundo). Esto es la otra mitad y es lo que quita el "peor caso" de la práctica:
   mientras se está eligiendo no se arma nada, y el trabajo se hace en los huecos. La
   hora del último toque vive en un objeto de módulo y **no** en un estado — si fuera un
   estado, apuntarla redibujaría la pantalla en cada toque, que es el coste que se está
   quitando.
3. **`TouchableOpacity` → `Pressable` en la casilla.** Eran 227 vistas animadas y 227
   valores animados creados al abrir para un efecto que ya no se usa.

> **Esto ya se intentó una vez y rompió la cuadrícula**, así que hay que decir por qué
> ahora no puede fallar por lo mismo. Falló porque el aviso de "estoy tocando" obligaba a
> pasar la medida en una **función** —`style={({pressed}) => …}`— y NativeWind aplica las
> clases también por `style`: el ancho y el alto no llegaban y las casillas salieron como
> pastillas. Desde 7ago-20 **ese aviso no se le pide a nadie**: la casilla se pinta ella
> misma. La medida vuelve a ir en un **objeto**, que era lo único que hacía falta, y la
> casilla no usa ni una clase de NativeWind. La prueba que existe vigila justamente eso
> —objeto y no función— y dice explícitamente que el componente da igual.

Y de paso, cada fila iba envuelta en una vista que no pintaba nada: **46 vistas menos**,
ahora es un fragmento.

**El medidor se quitó.** Sus números quedaron escritos en el comentario de
`NuevaCategoria.tsx` donde estaba, porque de ahí salen las medidas del archivo y sin eso
parecerían elegidas a dedo.

### Dos iconos marcados a la vez — el fallo que trajo el arreglo (7ago-23)

Lo vio en el celular y lo mandó con foto: al cambiar de icono se quedaban **los dos
marcados**, el viejo y el nuevo, mientras el dedo estaba apoyado. *"soluciona los problemas
que tenga, no me des otro fallando o con otro error"*.

**Era culpa del arreglo de 7ago-20.** Cada casilla llevaba SU PROPIA marca para que
encender fuera instantáneo. Pero con la marca dentro de cada casilla, **la vieja no tenía
cómo enterarse** de que ya no era la elegida hasta que el dedo se levantaba y la pantalla
entera se rehacía. Instantáneo para encender, tarde para apagar.

Es otra vez **el fallo de la costura**: las dos mitades por separado estaban bien —encender
rápido, apagar cuando la pantalla se entera— y el fallo estaba en el hueco entre las dos.

Ahora la marca vive en **un solo sitio, fuera de React**, y las casillas se apuntan para
que les avisen. Cada aviso hace que cada casilla mire una pregunta —*"¿soy yo la
marcada?"*— y **solo se rehacen las dos que cambian de respuesta**. Sigue siendo
instantáneo, ya no puede haber dos marcadas, y de paso salió algo mejor: la marca ya no
viaja por las filas, así que **ninguna fila se rehace al elegir**.

> **Y al revisarlo apareció un segundo fallo, este antes de entregarlo.** El orden de los
> dos avisos de Android —"dedo levantado" y "toque completado"— **depende de cuánto duró el
> toque**. Se leyó `Pressability.js` de React Native: con menos de 130 ms el de "dedo
> levantado" se retrasa y llega **después**; con más de 130 ms llega **antes**. Como la
> marca volvía atrás si el toque no se había completado, un toque normal —que pasa de 130
> ms de sobra— habría hecho que la marca saltara al icono viejo y volviera. Un parpadeo,
> visible solo en el celular. Se arregla comprobándolo **en el siguiente turno**, cuando
> los dos avisos ya llegaron en el orden que sea. Tiene prueba propia porque es el detalle
> más fácil de "limpiar" sin saber qué se rompe.

### Undécima causa: se atacó CUÁNTAS VECES se dibuja, nunca CUÁNTO CUESTA (7ago-25)

*"Se siente lento, no fluido. Piensa diferente."* Y pensar diferente era **mirar fuera de
lo que se llevaba toda la tarde optimizando**.

El número estaba delante desde el principio y no se leyó bien: **un dibujado de esta
pantalla cuesta entre 136 y 353 ms**. Los diez arreglos anteriores atacaron *cuántas veces
se dibuja* —tandas, pausas, memorizar filas, la marca fuera de React—. **Ninguno atacó
cuánto cuesta cada dibujado.**

Y cuesta eso porque cada dibujado arrastraba consigo todo lo que **no** está memorizado:

| | |
|---|---|
| "Tus categorías" | 14 casillas × 4 piezas, con **3 clases cada una** y dos de ellas armadas al vuelo (`bg-${color}-100`) |
| "Color" | 18 casillas con su clase |
| "Favoritos" | `enFilas(favoritos)` devolvía un **array nuevo** cada vez, así que la memorización de la fila no servía |

Son unas **90 piezas y unas 60 clases** resueltas en cada dibujado. Y una clase armada al
vuelo es lo más caro que hay: no se puede preparar de antemano, hay que resolverla en el
momento.

**El catálogo ya estaba arreglado** —casillas memorizadas y sin clases, y eso se midió— y
estas dos cuadrículas, **en la misma pantalla**, nunca recibieron el mismo trato. Otra vez
media pantalla optimizada y la otra media no.

> **El arreglo que NO se hizo, a propósito.** No se les quitaron las clases; solo se
> memorizaron. Quitarlas ahorraría algo más pero obliga a reescribir medidas a mano, y eso
> ya salió mal: *"no quiero que se vea así, estaba bien como estaba antes"*. **Memorizadas,
> un dibujado no las toca y sus clases no se resuelven: el mismo ahorro sin poder cambiar
> cómo se ven.** Cuando hay dos caminos con el mismo resultado, se toma el que no puede
> romper nada.

Y la mitad que se olvida: memorizar y luego pasarle **una función nueva en cada dibujado**
deja el trabajo hecho a medias sin que nada avise. `elegirDeLaLista` se escribe de nuevo en
cada dibujado, así que va por una caja (`elegirDeLaListaEstable`), y el nombre llega **ya
traducido** en vez de la función de traducir. Las dos cosas tienen prueba.

### Lo que se encontró de paso y NO se tocó, con su motivo

**El reparto de datos de la app crea su paquete de nuevo en cada dibujado**
(`AppDataContext`, el `value={{…}}` sin memorizar). Consecuencia: **cualquier cambio ahí
redibuja todas las pantallas montadas a la vez**.

No se arregló, y conviene que quede escrito por qué: memorizar ese paquete es una lista de
casi cien dependencias, y equivocarse en una sola significa **datos viejos en pantalla en
una app de dinero** — un movimiento que no aparece, un saldo que no cuadra. El riesgo no se
parece al beneficio. Si algún día hace falta, se hace **partiendo el contexto en varios**
(datos, ajustes, acciones), no memorizando el de cien.

Lo que sí se comprobó de sus dos relojes, y los dos están bien: el de 8 segundos solo
redibuja **si de verdad llegó algo**, y el de 60 solo corre **mientras haya una prueba
Premium abierta**.

### Duodécima causa: la pestaña escondida se seguía dibujando (7ago-27)

**El fallo lo descubrió una foto suya, no una medición.** Mandó una captura estando en
"Color": los círculos de colores **encima** de "Tu propia foto" y del catálogo, las dos
pestañas dibujadas a la vez. *"Cuando salgo de la pestaña se pone así."*

Y la causa de ese dibujo roto **era también la causa de lo lento**, que es lo que llevaba
todo el día sin ver:

> `display: "none"` deja la caja en **cero de alto**, pero **Android sigue dibujando sus
> hijos**. No los recorta. Así que la pestaña escondida se pintaba igual, encima de la que
> sí toca.

Lo que eso significaba para la velocidad: **esconder una pestaña no ahorraba nada.** Estando
en "Color", Android seguía dibujando las **227 casillas del catálogo** —unas 500 piezas—
además de los colores. Cada pasada de dibujo arrastraba **las cuatro pestañas**, no la que
se ve. Y él lo pidió así: *"tienes que mejorar la velocidad de toda la pestaña de iconos,
favoritos, tus categorías, color, no solo uno específico"*.

El arreglo es una línea, y arregla las dos cosas: la pestaña escondida **recorta** lo que
lleva dentro (`overflow: "hidden"`), así que una caja de alto cero deja de dibujar. Se ve
bien y deja de costar.

El estilo pasó de escribirse a mano en las cuatro pestañas a salir de **dos constantes**
(`PESTANA_A_LA_VISTA` / `PESTANA_ESCONDIDA`): escrito cuatro veces, la cuarta se olvida —y
la prueba cuenta que sean cuatro justamente por eso. Lleva también `height: 0`, por si algún
día una versión de React Native cambia cómo trata `display`.

Y el último trozo que quedaba sin proteger: los **18 títulos de grupo** del catálogo, que se
rehacían en cada dibujado. Ahora son un componente memorizado.

> **La lección, y es distinta de las anteriores:** un fallo que se VE puede ser la única
> pista visible de un fallo que solo se SIENTE. Once causas se buscaron midiendo y leyendo;
> la doceava llegó en una captura de pantalla de algo que se veía mal.

### Decimotercera causa, Y LA METÍ YO: un bucle que redibujaba sin hacer nada (7ago-29)

*"La pestaña de elegir icono está lenta, se siente raro."* **Y "raro" era la palabra
exacta.** Esta vez la causa no estaba en la librería ni en Android: estaba en mi propio
cambio de la noche anterior.

La pausa del reparto (7ago-22) tenía un estado, `reintento`, y al encontrar un dedo reciente
hacía `setReintento(r + 1)` para volver a mirar. Eso montaba un bucle:

1. El reloj mira → hay un toque reciente → pide volver a mirar.
2. **Pedirlo es un cambio de estado, así que la pantalla se rehace ENTERA.**
3. El reloj se rearma con espera **cero** → dispara al instante.
4. Sigue habiendo un toque reciente, porque falta medio segundo → **vuelta al 1**.

Mientras el dedo estaba sobre un icono, la pantalla **se rehacía decenas de veces por
segundo sin hacer absolutamente nada**. No era trabajo de más: era **trabajo inútil ahogando
al dedo**, que es justo lo que se siente como "raro" y no como "lento".

Dos cosas lo arreglan y hacen falta las dos:

- **Se espera lo que falta** para cumplir el medio segundo, no cero. Con cero se volvía a
  mirar para encontrar exactamente lo mismo.
- **Y se espera sin estado.** El reloj se rearma solo. Volver a mirar no cambia lo que se ve
  —solo la hora—, así que no puede redibujar nada.

> **La lección, y es la más incómoda de las trece:** el arreglo de ayer causó el fallo de
> hoy, y once causas de búsqueda me habían entrenado a mirar hacia fuera —la librería,
> Android, el celular—. Cuando algo empeora **justo después de un arreglo mío**, lo primero
> que hay que releer es el arreglo.

### Decimocuarta causa: el color viajaba a las 227 casillas (7ago-30)

Su descripción fue la que resolvió esto, y merece leerse entera: *"yo me refiero al hacer
cambios; por ejemplo toco un color rojo y paso a otro, se siente como una lentitud, al igual
pasa con los demás: favoritos, color, tus categorías. **En iconos parece que ya está bien**,
solo los demás están con lentitud"*.

Esa última frase es la que señala el sitio. La pestaña de iconos estaba arreglada — **y lo
que la hacía lenta era lo que pasaba en las otras**.

El aspecto de una casilla salía de **una sola función que recibía el color**:

```ts
const aspecto = useMemo(() => aspectoDeCasilla(color, lado, oscuro), [color, lado, oscuro]);
```

Y ese objeto se le pasaba a las **46 filas** y de ahí a las **227 casillas**. Así que tocar
un color creaba un objeto nuevo y **las 227 se rehacían** — estando en la pestaña de Color,
con el catálogo ni a la vista. Lo mismo al tocar una categoría en "Tus categorías", que
también cambia el color.

**El arreglo: partirlo en dos, porque son dos cosas distintas.**

| | Depende de | Quién lo necesita |
|---|---|---|
| El **gris** (sin elegir) | la medida y el tema. **No del color** | las 226 |
| El del **color** (elegida + tinta) | el color | **una sola**, la marcada |

El gris viaja como propiedad y **ya no cambia al cambiar de color**. El del color va por el
mismo canal que la marca, donde solo lo mira la casilla marcada.

> **El detalle que hace que funcione:** la respuesta que cada casilla le da al canal pasó de
> ser *sí/no* a ser **el nombre del color**. Al cambiar de color, las 226 no marcadas siguen
> contestando vacío —misma respuesta, no se rehacen— y la marcada contesta otro color, así
> que **se rehace solo ella**. Con un sí/no, la marcada no se enteraría del cambio y se
> quedaría pintada del color anterior.

### Lo que dejaron las diez causas, por si vuelve a ir lento

Está descartado —no volver a mirarlo—: las clases de NativeWind en las casillas, el
remontaje al cambiar de pestaña, montar las cuatro pestañas al abrir, `overflow` en las
227, las 48 filas rehaciéndose al tocar, la clase con estado de los iconos de Expo, que la
marca se pintara al soltar el dedo, y el golpe único del resto del catálogo.

Si volviera a ir lento, **lo primero es medir, no leer**. Es la lección de la tarde y está
demostrada: siete causas encontradas leyendo dieron "un poco mejor"; el medidor encontró
las tres gordas en dos intentos. Un medidor temporal en pantalla cuesta veinte minutos.

Y lo que queda sin tocar, que es **decisión suya**: **recortar el catálogo**. Son 227
dibujos en 18 grupos y armarlos cuesta unos 2,5 segundos de trabajo repartido. Con la
mitad, costaría la mitad. El catálogo grande lo pidió él, así que no se toca sin pedirlo.

> **La lección, ya con las diez:** seis causas encontradas leyendo nuestro código dieron
> "un poco mejor". La séptima salió de leer el código de la LIBRERÍA. Y las tres últimas
> —las que de verdad lo arreglaron— salieron de **un número sacado del celular**. Cuando
> arreglar lo que se ve no mueve la aguja, no hay que releer: hay que medir.

## La voz no se oía con TODO en verde: el idioma (7ago-28, 07/08/2026) — NECESITA APK

Mandó dos capturas y son la mejor pista que ha dado: **Servicio Conectado**, el yapeo
**Registrado · S/ 1.00**, *Decirlo en voz alta* **encendido**… y silencio. *"No se escucha
en voz alta, capaz pueda ser mi celular."*

**Tenía razón en sospechar del celular, y esa es justo la parte que la app no podía
responder.**

### El fallo: se pedía la voz de Perú y no se miraba si existía

```kotlin
motor?.language = Locale("es", "PE")   // ← sin mirar el resultado
```

**Casi ningún celular trae la voz de Perú instalada.** Cuando no está, Android devuelve
`LANG_NOT_SUPPORTED`, **el idioma se queda como estaba** —inglés, casi siempre— y una frase
en español puede no sonar. La app creía haber hablado: apuntaba `hablo` y se quedaba tan
tranquila.

Ahora se prueba **es-PE → es-ES → es**, mirando la respuesta cada vez, y si no hay español
de ninguna clase **se deja dicho** (`sin-espanol`) en vez de callar. La comprobación vive en
**un solo sitio** (`ProbadorDeVoz.ponerEspanol`) que usan el servicio y el botón de probar:
dos copias de esta regla es exactamente como empezaron los otros fallos de la voz.

### Y los PASOS, con un botón cada uno

Pedido: *"necesito que incorpores en registro automático los pasos que se deben seguir para
una correcta funcionamiento para cualquier celular"*, y luego: *"como botones que te manden
a una pestaña y te diga qué tengas que hacer"*.

Para que un yapeo se oiga tienen que cumplirse **cuatro** cosas, y si falla una el resultado
es el mismo —silencio—, así que desde fuera **no hay forma de saber cuál**:

| Hace falta | Cómo se sabía antes |
|---|---|
| El lector enganchado | Ya se veía: "Conectado" |
| Un sistema de voz instalado | No se sabía |
| Ese sistema **con español** | No se sabía |
| Volumen de **avisos** > 0 | No se sabía |

El cuarto es el más traicionero: **el volumen de avisos va aparte del de la música**, así
que el celular puede sonar perfecto con música y tener los avisos mudos. La voz habla de
verdad y no se oye.

**El botón que importa es "Probar la voz ahora":** dice la frase ahí mismo y responde cuál
de las cuatro falta. Es lo único que convierte *"no funciona"* en *"te falta esto"*. Debajo,
tres botones que abren el ajuste de Android que arregla cada cosa —voz, sonido, batería— y
si un celular no tiene esa pantalla, **lo dice** en vez de no hacer nada al tocarlo.

> **La prueba vigila lo que falla callado:** que cada uno de los cinco resultados tenga sus
> **dos** textos —qué pasó y qué hacer— en los **tres** idiomas. Una clave que falte no da
> error: en pantalla sale el nombre de la clave, que es peor que nada.

Y de paso, la quinta vez que una aserción se cae **por su propia explicación**: el
comentario que cuenta cuál era el fallo contiene el fallo escrito. Se le quitan los
comentarios antes de comprobar, como en las otras.

## Tras instalar el APK, el lector de avisos quedó desenganchado (7ago-26, 07/08/2026)

Reportado justo después de instalar `7ago-24`: *"cuando me ingresa una notificación de que
me yapearon ya no habla en voz alta... ¿por qué cuando me llega un yapeo se demora en
leerlo?"*.

**Lo primero fue descartar mi propio cambio de la noche anterior**, que era el sospechoso
obvio: la regla nueva de la dirección. No era. Su aviso —*"...te envió un pago por S/
20"*— contiene "te envio", que está en la lista de entradas, así que la regla lo acepta.

**El fallo de verdad:** dar el permiso y que el lector esté **enganchado** son dos cosas
distintas. Al actualizar la app, Android mata el proceso del lector y **no lo vuelve a
enganchar**. En los ajustes del sistema el permiso sigue dado —así que desde fuera todo
parece correcto— pero el lector no recibe ni un aviso. Ni registra ni habla.

El servicio **ya pedía** reengancharse... pero solo en `onListenerDisconnected`, y **ese
aviso no llega cuando se actualiza la app**: el proceso muere de golpe, sin que nadie pueda
avisar de nada. Nadie pedía la reconexión.

> **Y se podía arreglar a mano: había un botón en "Captura automática".** Ese es el error
> que este proyecto repite —*se puede* pero *no se encuentra*—, y ya van tres veces. Hay que
> saber que el botón existe, que hay que tocarlo, y que hay que tocarlo **justo después de
> instalar**. Nadie sabe eso.

Ahora la app pide la reconexión **sola**: al arrancar y cada vez que vuelve al frente
(`reengancharLector`). Pedirla cuando ya está enganchado no hace nada, así que se puede
pedir tranquilamente. Solo se pide si el permiso está dado — pedirla sin permiso no arregla
nada y deja un error apuntado que despista al buscar de verdad.

### Y eso explica también la demora

Arrancar el motor de voz de Android tarda **2 a 4 segundos**: es el sistema cargando el
idioma, no Finzo pensando. Por eso el servicio lo enciende **en cuanto Android lo engancha**
(`onListenerConnected`), para que esté caliente cuando llegue el primer yapeo.

Con el lector desenganchado, **eso nunca pasaba**. El motor estaba frío y la espera se oía.
Con la reconexión al arrancar, el motor se calienta con la app delante y el yapeo suena en
el momento.

### El hueco que queda apuntado y NO se tocó

`prepararVoz()` hace `if (motor != null) return`. Si el motor se creara pero su arranque no
terminara nunca —pasa si Android está actualizando su sistema de voz— quedaría
`motor != null` con `vozLista = false` para siempre, y cada yapeo se encolaría en silencio.

No se le puso un reintento a propósito: es un caso raro, no se puede probar desde aquí, y
**la reconexión ya lo cura** — un lector reenganchado es un servicio nuevo, con su motor
nuevo. Meter lógica de reintentos sin poder probarla en un servicio del sistema es más
riesgo que beneficio.

## La voz leía la publicidad de Yape (7ago-24, 07/08/2026) — NECESITA APK

Reportado así: *"me llegó una notificación de Yape pero no era alguien que me había
yapeado, sino un mensaje normal, ejemplo: sin dinero solicita tu préstamo por S/2000
preaprobados págalo en 6 cuotas"*. Y con la captura de lo que **sí** debe leerse:
*"Confirmación de Pago Yape! JEFFERSON GIOVANNI LEON CARLOS te envió un pago por S/ 20"*.

**Ya había una lista negra de palabras de anuncio desde el 02/08** —"preaprobado",
"solicita tu", "promoción", "sorteo"— **y no bastó.** Esa carrera no se gana: Yape puede
redactar un anuncio de mil maneras y todos llevan un monto.

**El fallo real, y es otra vez la costura.** El intérprete de la app ya rechazaba estos
avisos: exige que el texto diga si el dinero **entra o sale**, y si no lo dice devuelve
`noDirection`. La voz no miraba eso — le bastaba que hubiera un monto.

Y con **"leer también las salidas" activado era peor**: la comprobación era *"si NO leo
salidas y NO parece ingreso, callar"*, así que al encender ese ajuste **la única
comprobación que quedaba era la del monto**. Cualquier aviso de Yape con una cifra se leía
en voz alta. El ajuste debe ensanchar la regla, nunca apagarla.

Ahora la voz pide lo mismo que el intérprete: una **dirección reconocida**. Se añadió
`PALABRAS_DE_SALIDA` **copiada** de `EXPENSE_HINTS` (escribirla a mano es lo que dejó la
voz muda en agosto, por faltarle "te envio"), y el motivo nuevo `sin-direccion` aparece en
*Captura automática* con su texto en los tres idiomas.

### Y un fallo DE LA PRUEBA, que es el tercero de este tipo en ese archivo

`verificar-voz-yape` imita en JavaScript lo que el servicio hace en Kotlin. Se añadió la
regla nueva a la imitación… y las comprobaciones de la publicidad **pasaban también contra
la versión anterior del servicio**. Dos causas, las dos arregladas:

1. `listaDelKotlin` devolvía una **lista vacía** cuando no encontraba la lista, así que
   todo caía del mismo lado y pasaba **por el motivo equivocado**. Ahora para la prueba con
   un mensaje claro.
2. Faltaba lo esencial: **comprobar que la regla está en el Kotlin**, no solo en la
   imitación. Una imitación solo vale si alguien verifica que se parece al original.

Se comprobaron los dos escenarios de rotura: quitar la lista (la prueba para en seco) y
quitar **solo** la regla dejando la lista (fallan cuatro afirmaciones).

> **ESTO ES CÓDIGO NATIVO: NO VIAJA POR OTA.** Hace falta instalar el APK. Mientras no se
> instale, el celular sigue leyendo los anuncios.

## El micrófono perdía casi todo lo dictado (7ago-19, 07/08/2026)

Pedido así: *"el micrófono no está registrando correctamente los ingresos y gastos
cuando hablo rápido y tampoco entender correctamente al momento de hablarle, le digo
varias cosas por ejemplo gasté 10 salchipapa, 10 mandarina, 10 tenedor, 10 papel, 10
cuchara y más"*.

Eran **dos fallos distintos con el mismo síntoma**, y ese fue el hallazgo. Lo primero
que se hizo fue meter la frase exacta en el intérprete: **la entendía perfectamente y
sacaba los cinco movimientos**. O sea que el intérprete no era el culpable de esa queja
— la frase nunca le llegaba completa.

### Fallo 1: la escucha se cerraba en el primer trozo

Android no entrega lo dicho de una vez: lo va **cerrando por trozos**. Se leyó su código
para confirmarlo (`ExpoSpeechService.kt`, `onSegmentResults`: manda `isFinal: true` y
**no se detiene**). Y la documentación de la librería lo dice sin rodeos sobre
`continuous: false` — *"on Android, recognition will run until a result with isFinal:
true is received"*.

La pantalla hacía dos cosas que juntas tiraban casi todo:

1. Cada trozo **reemplazaba** al anterior en vez de sumarse. De cinco compras quedaba
   una.
2. Al primer trozo marcado como final **cerraba la escucha**. Lo demás no se perdía: no
   se llegaba ni a escuchar.

Eso explica los dos síntomas exactos. Hablando rápido, Android cierra el primer trozo
antes de que uno acabe la lista; dictando varias cosas, cada una tapaba a la anterior.

Ahora: `continuous: true`, los trozos se **acumulan**, y el micrófono lo cierra
**`SILENCIO_MS` (4 s) rearmable con cada palabra** o el botón **"Listo"**. Dos caminos a
propósito: si el reloj falla en algún celular, el botón salva el dictado.

> **El detalle invisible que habría dejado el arreglo a medias.** Nuestras
> `androidIntentOptions` se aplican **después** de las de la librería (se leyó el
> Kotlin), y su forma de conseguir la escucha seguida en **Android 12 o menos** es poner
> esas mismas esperas en diez minutos. Nuestros 5 segundos las habrían borrado: el
> arreglo habría andado en un celular nuevo y no en uno viejo, sin que nada avisara.
> Hay una prueba que prohíbe volver a mandarlas.

Y una red de seguridad: si el celular no puede con la escucha seguida, se reabre a la
antigua. Nunca queda peor que antes de este cambio.

### Fallo 2: el intérprete contaba como dinero lo que no lo era

Esto salió de **hacerlo hablar**, no de leerlo: 35 frases reales por un script. Tres
errores de verdad, los tres inventando o perdiendo movimientos:

| Se dijo | Se registraba | Ahora |
|---|---|---|
| "gasté 10 en **2** mandarinas" | S/ 10 sin nombre **+ un gasto de S/ 2 que no existió** | un solo gasto de S/ 10, "mandarinas" |
| "gasté 30 en pan **a las 5**" | el pan **+ un gasto de S/ 5** | solo el pan |
| "el pan me costó 5 soles" | S/ 5 **sin nombre** → caía en "Otros" | S/ 5, "pan" |

Y de paso, **"pollo a la brasa"** se quedaba en "pollo" — en Perú eso es media carta.

Las tres reglas son estrechas a propósito, y las pruebas guardan el límite de cada una:
"la cuenta **de 45 soles**" sigue siendo dinero (detrás va "soles", no el nombre de una
cosa); "gasté 30 en pan **a las 5**" no se lleva la hora al nombre; y buscar el nombre
hacia atrás **solo vale para el primer monto**, porque en "recibí 500 de sueldo y gasté
20" mirar atrás desde el 20 encontraría "sueldo" y llamaría "sueldo" a un gasto — un
error peor que el que arregla.

`pruebas/verificar-voz-dictado.ts` es la prueba nueva: **23 de sus afirmaciones fallan
contra la versión anterior**. Las de la sección "lo que ya andaba" pasan en las dos
versiones a propósito: no describen el arreglo, vigilan que no se rompiera nada.

## La pantalla de Premium, rediseñada (07/08/2026)

Pedido con **tres maquetas**: *"cuando le doy click y entre a Finzo Premium quiero ver
este diseño de las 3 imágenes"*. Antes era una sola columna —lo gratis y debajo lo
Premium— y con eso no se puede comparar: para saber qué se gana hay que recordar la
lista de arriba mientras se lee la de abajo. Tampoco había precio ni forma de probarlo.

Ahora: selector **mensual / anual** arriba, las dos columnas **lado a lado**, el botón
grande, y la prueba gratuita de 24 horas con su aviso en la propia pantalla.

### Lo que NO se copió de las maquetas, y por qué

Traían "Categorías con emojis" y "Recordatorio de exportación". **Los emojis se
quitaron de la app entera el 03/08** y el recordatorio pasó a llamarse "Exportación
automática" el 05/08. Copiarlas habría puesto la pantalla a prometer cosas que no
existen — justo el tipo de texto que se lleva días limpiando. La lista es la de verdad.

Y **"Sin anuncios" se fue**: no hay anuncios que quitar, así que era una promesa vacía.
Estaba en la lista de cosas que bloquean Play Store.

### EL PAGO NO EXISTE, Y LA PANTALLA LO DICE

No hay cobro integrado. El botón "ADQUIRIR VERSIÓN PREMIUM" activa Premium como antes,
y debajo va una línea pequeña: *"El pago todavía no está disponible en esta versión"*.
Un botón que no cobra y no lo advierte es lo que hace que alguien se sienta engañado.

Sigue siendo uno de los puntos a resolver antes de publicar: **vender algo que no se
cobra es motivo de rechazo**.

Los precios viven en `constants/precios.ts` porque los mismos números salen en cuatro
sitios de la pantalla; escritos a mano, cambiar el precio una vez dejaría dos diciendo
otra cosa. El "por mes" del plan anual se **calcula**.

### La prueba de 24 horas NO se mezcla con el Premium de la cuenta

Son dos cosas y se guardan aparte. Si estuvieran juntas pasaría lo peor en las dos
direcciones:

- alguien que **ya tiene** Premium toca "probar" por curiosidad y al día siguiente lo
  ha perdido, porque al caducar la prueba se apagó todo;
- o la prueba se guarda como Premium comprado y queda **para siempre**, también en la
  nube y en cualquier otro celular.

Las pantallas ven **una sola respuesta** (`isPremium` = el de la cuenta **o** la prueba
corriendo), calculada en un único sitio: si cada pantalla tuviera que acordarse de
mirar también la prueba, alguna no lo haría.

La prueba **no viaja a la nube** (sincronizarla haría que la gastada en un teléfono
bloqueara la de otro) y **se suelta al cerrar sesión**, porque es de la cuenta que se
va, no del aparato.

Y se comprueban los bordes con números, que es donde esto falla: el instante exacto en
que caduca, y **un reloj movido hacia atrás** — basta cambiar la fecha del teléfono
después de activarla para que la resta dé negativo y la prueba se quede abierta para
siempre.

## Los favoritos van a la nube — y aparecieron TRES fallos al hacerlo (07/08/2026)

Era el pendiente "los favoritos se pierden al cambiar de celular". Se pidió empezar
por lo que no necesitara nada del usuario, y este era. **Lo que se encontró por el
camino es más grave que la función pedida.**

### 1. Las categorías propias y la personalización SE SUBÍAN Y NO SE BAJABAN

Estaban en el tipo del documento, se enviaban bien, y **quien lee la nube no las
leía**. Así que al entrar desde otro celular volvían vacías: las categorías creadas
desaparecían, sus movimientos se veían como "Otros", y los nombres, colores y fotos
se perdían — **con la copia correcta guardada en la nube todo el tiempo**.

No dio ningún error porque el lado que escribe estaba bien y el que lee devolvía
`undefined`, que quien lo recibe convierte en vacío.

> **Y había una prueba que decía "viajan a la copia de la nube". Solo comprobaba
> que el TIPO nombrara el campo.** Una aserción que mira la declaración y no el
> camino completo da la tranquilidad sin dar la garantía; es peor que no tenerla.
> Ahora se comprueba que quien lee la nube los devuelva.

Además, al bajarlos se usaba `setPropias`/`setOverrides`, que solo tocan memoria:
se veían bien **hasta cerrar la app**, y al reabrir volvía el disco vacío. Ahora se
usan `savePropias`/`saveOverrides`, que escriben las dos cosas.

### 2. Cerrar sesión habría borrado los favoritos de la nube

Había **dos** armadores del paquete que se sube: el de la subida normal y el de
cerrar sesión. El nuevo campo entró en el primero y no en el segundo — y subir
**reemplaza el documento entero**, así que cerrar sesión los habría borrado justo
después de guardarlos. Ya había pasado con la personalización y con las propias.

Ahora hay **un solo armador** (`datosParaLaNube`), y una prueba exige que los dos
sitios que suben lo usen y que ninguno escriba su propia lista.

### 3. FALLO DE PRIVACIDAD: la cuenta siguiente heredaba los datos de la anterior

El borrado de fin de sesión tenía una lista escrita a mano, y **tres claves no
estaban en ella**: categorías propias, personalización y favoritos. Cada una vivía
en su propio archivo, así que esa lista no las conocía.

Consecuencia real: alguien cierra sesión, entra otra cuenta en ese celular, y hereda
las categorías de la persona anterior, sus nombres, colores **y sus fotos**.

Las tres claves se declaran ahora en `STORAGE_KEYS` y sus archivos las leen de ahí.
La prueba **no comprueba esas tres**: comprueba **todas** — cualquier clave que se
añada y no entre en el borrado hace fallar la prueba. `themeMode` es la única
excepción, y está dicho por qué (es preferencia del aparato, no de la cuenta).

### Y lo pedido: los favoritos viajan

Los del catálogo suben con el resto. **Las fotos propias no**, y es a propósito: una
pesa ~18 KB y el documento entero tiene un tope de 1 MB compartido con los
movimientos. Treinta fotos serían medio megabyte gastado en atajos, y pasarse del
tope no deja el documento a medias: **lo deja sin guardar, y con él los gastos**.
Perder un atajo es molesto; perder los movimientos, grave. La foto en sí no se
pierde si está puesta en una categoría — eso sí viaja.

Y marcar un favorito **dispara la subida**: la pantalla llamaba directo al disco,
que no avisa a nadie, así que se quedaba en el celular hasta que cambiara otra cosa.
Ahora pasa por el contexto. Mismo fallo que ya tuvieron la personalización y las
propias — tercera vez.

## La tarjeta del saldo, igual en las dos pantallas (07/08/2026)

*"Redondea las esquinas y los bordes emparéjalos al igual que los demás, y ponle un
color que vaya de acorde, no ese aparente blanco que se ve feo"*, con las dos
capturas juntas: la de Inicio y la del Panorama en Reportes.

Son **la misma tarjeta en dos sitios** —el mismo número con el mismo título— y
estaban escritas a mano en cada pantalla. Tres diferencias, y una era un fallo:

- Verde más apagado en Reportes (`#065f46` → `#047857`).
- Esquina de 24 puntos contra 32.
- **Le faltaba `overflow-hidden`, y eso era "el blanco".** Sin recortar, en Android
  el degradado se pinta con las esquinas **cuadradas** y el borde blanco se dibuja
  redondeado encima: en cada esquina asoma el arco claro con el verde saliéndose
  por fuera. No era un color mal elegido, era el relleno sin recortar.

El aspecto vive ahora en `SALDO_VERDE` y `SALDO_TARJETA` (`constants/style.ts`), y
lo usan las dos. El contorno se queda en blanco al 45%: al 20% se perdía sobre el
verde y la tarjeta parecía la única sin contorno.

### Y el primer arreglo lo empeoró: LAS CLASES DE TAILWIND NO VIAJAN

Compartir el aspecto como **texto de clases** (`"rounded-[32px] overflow-hidden …"`)
desde `constants/style.ts` **no funcionó, y no dio ningún error.** Tailwind genera
las clases **leyendo archivos**, y solo lee `app/`, `screens/` y `components/` (el
`content` de `tailwind.config.js`). `constants/` no está en esa lista, así que
`rounded-[32px]` dejó de existir y **las dos tarjetas se quedaron sin esquina** —
incluida la que ya estaba bien.

Lo vio el usuario en el celular antes que nosotros: *"redondea las esquinas, te
faltó eso"*.

Ahora va en **medidas** (`borderRadius: 32`, `overflow: "hidden"`, …) por `style`:
con números no hay nada que generar y da igual dónde viva el archivo. Es el mismo
motivo por el que `CARD_SHADOW` es un objeto desde siempre.

> **Una clase de Tailwind escrita fuera de las carpetas que Tailwind lee no falla:
> desaparece.** Hay una prueba que recorre `constants/`, `utils/`, `contexts/` y
> `modules/` buscando clases con corchetes (`rounded-[32px]`, `w-[80px]`), que son
> las que no pueden existir por casualidad. Las normales pueden colarse y funcionar
> **de rebote** porque otra pantalla las usa — y eso es peor, porque funciona hasta
> que esa otra pantalla cambia.

## En el PDF, los límites sin gasto no salen (07/08/2026)

*"Si no hay movimiento en presupuesto por categoría, quítalo; solo debe aparecer
cuando haya algún movimiento"*. En la captura: **trece filas seguidas diciendo
"€ 0.00 / € 50.00"**, ninguna con nada dentro. Media hoja que no contesta nada y
que empuja los gráficos y la lista de movimientos hacia abajo.

**Y la pantalla de Reportes ya seguía esa regla** —ahí solo se dibujan los límites
con gasto—, así que el PDF y la pantalla enseñaban **cosas distintas del mismo
mes**. Otra vez: decisión tomada en un sitio, sin aplicar en el de al lado.

Ahora se filtran en `reportePdfDatos`, que es el armador que comparten el PDF de a
mano y el automático — así los dos cambian juntos. Si ninguna tuvo gasto, el bloque
entero no se dibuja: `buildPdfHtml` ya se salta lo que no tiene filas.

## Las columnas por mes del PDF salían gigantes (07/08/2026)

*"Las barras tienen un tamaño desproporcional, deberían tener un tamaño normal"*,
con la captura del PDF: dos bloques enormes en vez de dos columnas.

Las columnas se reparten el ancho de la hoja, así que con **dos** meses cada una se
quedaba con media hoja.

**Y el arreglo ya estaba escrito en el archivo, en el gráfico de al lado.** El de
"Día a día" tenía su tope con el comentario puesto: *"no pasa de 30 para que con dos
o tres días no salgan tres columnas gordísimas"*. El mensual no lo tenía.

> **Es el fallo que este proyecto repite: una lección aprendida en un sitio y sin
> aplicar en el de al lado.** Igual que los dos `TODOS_LOS_GRUPOS`, los dos
> armadores de reporte, el papel del PDF automático contra el de a mano.

Ahora el número es **uno solo** (`ANCHO_MAX_BARRA`) y lo usan los dos gráficos, con
una prueba que lo comprueba en el HTML de verdad. Compartiéndolo no puede volver a
pasar en uno y no en el otro.

## La tarjeta de límites se contradecía (07/08/2026)

Reportado con captura, señalando la línea *"13 categorías sin gastos este mes ·
€ 650.00 sin usar · Ver"*: **"no sé por qué me sale eso, quítalo, no me gusta"**.

Y tenía razón, porque justo encima la misma tarjeta decía **"Aún no le pusiste
límite a ninguna categoría"**. Las dos cosas a la vez, y las dos no pueden ser
verdad: había trece límites puestos, sumando 650.

**El motivo:** ese primer texto se decidía con las categorías que **tienen gasto**,
no con las que tienen límite. Con trece límites y ningún gasto en ellos, "no
pusiste ninguno" era falso. Es **el mismo fallo de la pantalla de exportación
automática** —dos textos decidiendo por su cuenta— y la solución es la misma: una
sola pregunta, `hayLimites`, que sale del mismo cálculo que las barras.

Ahora la tarjeta dice una de dos, y las dos son ciertas:

- sin límites → "Aún no le pusiste límite a ninguna categoría."
- con límites y sin gasto en ellos → "Todavía no gastaste en ninguna categoría con
  límite este mes."

**Y el resumen de las intactas se fue**, con su lista desplegable. Se defendía con
que "no gastar en algo también es información" — es verdad, pero el sitio estaba
mal: esa tarjeta contesta *"¿cómo voy con mis límites?"* y una lista de las que ni
he tocado no contesta eso. Además ese "€ 650.00 sin usar" se leía como dinero
disponible. Quien quiera ver sus límites los tiene todos en su propia pantalla.
Hay una prueba para que no vuelva sin un motivo nuevo.

## Un solo botón "Elegir categoría" (06/08/2026)

Pedido con la pantalla delante y la mitad marcada en azul: *"quiero que solo
quede un botón que diga Elegir categoría y todo lo que está en azul desaparezca,
que siga funcionando normal como está hasta ahora"*. Lo azul era la cuadrícula de
doce casillas más "Nueva", "Ver más" y "Editar «X»", que se comía media pantalla:
para llegar a la fecha, la descripción y las notas había que desplazarse.

Ahora en "Nuevo movimiento" hay **una fila** con el dibujo de la categoría
puesta, el texto "Elegir categoría" y su nombre a la derecha. Todo lo demás se
mudó a la pantalla del catálogo de dibujos, que se abre en el catálogo y lleva
"Tus categorías" como primera pestaña — costó dos intentos, ver más abajo.

**Se le ofreció la variante con las cuatro más usadas al lado del botón, para
conservar el toque único, y eligió el botón solo.** Queda anotado: elegir pasó de
un toque a tres (abrir, elegir, volver) y fue una decisión suya, informada.

De regalo, dos cosas que la cuadrícula arrastraba y se fueron con la mudanza:

- **Fuera el "Ver más".** Existía porque no había sitio; donde está ahora caben
  todas. Con él se va el problema de que las categorías propias vivieran
  escondidas detrás de un botón — que es también por lo que la pantalla de
  agregar tenía que encender "Ver más" al volver de crear una.
- Los textos `addSheet.seeMore` / `seeLess` se borraron de los tres idiomas. Un
  texto sin dueño es lo que hace que dentro de un año nadie sepa si se puede
  tocar.

### DOS INTENTOS FALLIDOS ANTES DE ACERTAR, Y LOS DOS POR LO MISMO

**Intento 1: una pantalla aparte con la lista de categorías.** El usuario lo
señaló con las tres capturas: *"al darle click a elegir categoría debería
mandarme a la 3 imagen no a la 2"*. Quería el catálogo, y la lista de por medio
era un paso que no había pedido nadie.

**Intento 2: juntarlas, con la lista SUELTA ARRIBA** del catálogo, en la misma
pantalla. Volvió a decir lo mismo, marcando en azul justo esa parte: *"la idea era
que solo quede la parte de abajo y todo lo que esté de azul ya no esté, y donde
dice o crea una nueva debería decir Tus categorías"*. Tenía razón otra vez: media
pantalla por delante del catálogo estorba igual, solo que sin cambiar de pantalla.

**Borrar la lista no era una opción, y se le dijo las dos veces:** es lo que se
usa en CADA gasto. Sin ella habría que crear una categoría nueva cada vez, con
los reportes repartidos entre veinte "Comida".

**La salida fue la que él mismo nombró: "Tus categorías" es una PESTAÑA**, la
primera de cuatro (Tus categorías · Ícono · Favoritos · Color). De pestaña no
ocupa nada hasta que se toca, así que la pantalla se **abre en el catálogo** —lo
que pedía— y elegir una que ya existe sigue costando un toque.

La lección, que ya es la tercera vez en este proyecto: **cuando el usuario dice
"sobra esto", la respuesta no es moverlo un poco más abajo.**

### TOCAR UNA CATEGORÍA LA MARCA; VOLVER ES COSA DE "APLICAR" (07/08/2026)

Pedido así: *"cuando le doy click a un icono en Tus categorías automáticamente te
manda a la [pantalla del movimiento]; debería yo seleccionar el icono y recién
cuando le doy aplicar mandarme [al movimiento], aparte podría cambiarle el
color"*.

Y **con esto se entiende por fin lo que quería desde el principio.** Tres veces
pidió que la pantalla quedara con solo Ícono · Favoritos · Color, y se leyó como
"quita la lista". No era eso: **las cuatro pestañas son un solo formulario.** Se
elige una categoría de la lista, se le retoca el dibujo o el color, y se confirma
con Aplicar. Volver de golpe al tocarla dejaba las otras tres pestañas sin poder
usarse sobre una categoría que ya existe — no había forma de tenerla elegida y
cambiarle nada.

Cómo quedó:

- Tocar una la deja **marcada**, y carga arriba su nombre, su dibujo y su color.
- De ahí se le cambia lo que sea en las otras pestañas.
- **Aplicar** guarda los cambios, la deja puesta en el movimiento y vuelve.
- Si no se tocó ninguna, Aplicar **crea** una nueva, como antes.

**Solo se guarda lo que de verdad cambió**, y eso importa en el nombre: escribirlo
siempre dejaría "Comida" fijado en español, y esa categoría dejaría de traducirse
al cambiar el idioma de la app. Un daño que nadie relacionaría con haber tocado un
color meses antes.

Las de fábrica se cambian con la **personalización** (el mismo parche que usa
"Personalizar categorías"), y las propias en su propio sitio. Para que el dibujo
también se pudiera cambiar en una de fábrica hubo que añadir `icono` a
`CategoryOverride` y hacer que `catInfo` lo lea: sin eso, el dibujo nuevo se veía
en la vista previa y al guardar volvía el de antes — la pantalla prometiendo algo
que no podía cumplir.

**"Editar «X»" se queda**, apuntando ahora a la marcada. Lo único que solo está
ahí dentro es **borrarla**.

#### Las fotos también entran en Favoritos, y se pueden quitar (7ago-03)

**Pedido:** *"los iconos que les tomé foto o subí una imagen también deberían poder
añadirse a favoritos"* y *"las fotos o imágenes que suba en tus categorías debería
haber una opción o icono para poder borrarlos"*.

**Lo de favoritos estaba mal razonado y así estaba escrito en el código:** "un
favorito es un ícono del catálogo, y una foto propia no está en el catálogo — no
habría a dónde volver". Suena bien y mira lo que no importa. Lo que importa es que
recortar una foto cuesta cámara, encuadre y zoom, y volver a hacerlo para la
siguiente categoría es **justo lo que un favorito evita**. El argumento miraba de
dónde sale el dibujo en vez de cuánto cuesta conseguirlo.

Ahora la estrella marca **lo que se está viendo**: la foto si hay una, y si no el
dibujo. Una foto se guarda como su propio texto (`data:image/jpeg;…`), así que
entra en la misma lista sin cambiar nada de cómo se guardaba — las listas que ya
estaban en los celulares se leen igual. `esFoto()` las distingue.

Peso: unos 18 KB por foto (256 px, calidad 0.8), así que 30 serían medio megabyte.
Cabe porque los favoritos son **solo de este celular**. *El día que viajen a la
nube hay que volver a mirar ese número: ahí el documento entero tiene un tope de
1 MB y las fotos de las categorías ya ocupan parte de él.*

**Quitarle la foto a una categoría ya se podía** —la casilla de la foto con su ✕
está en la pestaña del catálogo—, pero ahí no la encuentra nadie que venga de la
lista: hay que saber que la foto se quita desde donde se eligen los dibujos. Ahora
hay un "Quitar la foto de «X»" en "Tus categorías", y solo cuando esa categoría
tiene foto. Se guarda con Aplicar, como todo lo demás.

#### Y borrar una categoría, también (7ago-04)

*"No me deja eliminar los iconos, en tus categorías se quedan"*. **Sí se podía** —
"Editar «X»" → abajo → "Borrar esta categoría"— y no lo encontró. **Segunda cosa
escondida detrás del mismo enlace**, después de quitar la foto.

Así que "Editar «X»" **se quitó**, y sus dos funciones están en la lista:

- "🗑 Borrar «X»", solo con una propia marcada, con la confirmación en el sitio y
  **el número de movimientos** que pasan a "Otros".
- **No se sale de la pantalla al borrar.** Quien borra una de sus pruebas
  normalmente borra tres, y volver al movimiento tras cada una obligaría a entrar
  otra vez. Antes el borrado estaba en la otra pantalla y sí salía.
- Si la borrada era la marcada, se suelta: el formulario se quedaría hablando de
  algo que ya no existe y Aplicar intentaría guardar cambios sobre una categoría
  borrada.

Con eso, la lista hace **todo**: elegir, cambiar nombre / dibujo / color, quitar la
foto y borrar. El modo `id` de la ruta —editar una sola, sin lista— se conserva
aunque ya no se use desde ningún sitio: es la puerta que haría falta para llegar
aquí desde el historial o un reporte.

> **Dos veces seguidas, lo que el usuario dio por imposible existía y estaba a un
> toque de distancia dentro de un enlace llamado "Editar".** "Se puede" y "se
> encuentra" no son lo mismo, y en esta app la diferencia la ha marcado siempre
> el mismo error: esconder una acción detrás de una palabra que no la nombra.

#### Y salió a la primera con el dibujo quieto (7ago-02)

*"cuando le doy click al icono de salud, en la imagen de arriba no cambia, se
queda estática"*. El nombre y el color sí cambiaban; el dibujo no.

**De un dibujo ya hecho no se puede volver atrás a su nombre.** Las categorías de
fábrica se definían con `icon: iconoDe("HeartPulse")`, y ahí el `"HeartPulse"` se
perdía: quedaba el componente. La pantalla lo buscaba en los dos sitios donde sí
había nombre —la personalización y las propias— y para una de fábrica no
encontraba nada, así que se quedaba con el dibujo que ya estuviera puesto.

Arreglo: `Category` lleva ahora `iconoNombre`, y las 25 categorías se definen con
un `...dibujo("HeartPulse")` que **devuelve el dibujo y su nombre del mismo
argumento**. Escritos por separado se podrían desincronizar, y sería un fallo
silencioso: la categoría se vería bien en todas las pantallas y solo al abrir el
catálogo aparecería marcado el dibujo equivocado. Hay una prueba que compara los
dos, categoría por categoría.

### Antes de entenderlo, dos rondas perdidas — y la lección

Se leyó "quita la lista" y se le contestó tres veces que sin ella no habría forma
de poner "Comida" en un gasto. Era cierto, pero **no era lo que estaba pidiendo**.
Hizo falta dibujarlo (tres maquetas: hoy · si solo se quita · lo propuesto) para
que él dijera "déjalo así de momento", y una captura más para que se viera que el
problema era el **volver de golpe**, no la lista.

> **Cuando alguien insiste tres veces en algo que parece un error, lo más probable
> es que se esté entendiendo mal la petición, no que la petición sea mala.** La
> pregunta útil no era "¿seguro que quieres quitarla?" sino "¿qué esperabas que
> pasara al tocar una?".
>
> Y: **cuando una explicación no se entiende a la segunda, dibujarla.** Dos
> mensajes de texto no sirvieron; una maqueta sí.

### El precio, dicho y anotado en el código

`pestana` arranca en `"icono"`, no en `"tuyas"`. Es decisión suya, pedida tres
veces, y **no es simétrica**: crear una categoría se hace de vez en cuando, y
elegir una se hace en cada gasto. Si algún día dice que elegir se le hace pesado,
lo que hay que cambiar es ese valor inicial y nada más. Está escrito ahí mismo.

### Lo que se descartó por el camino (no volver sobre ello)

- **La lista suelta encima de la vista previa.** Rechazada por el usuario.
- **`stickyHeaderIndices` para pegar la vista previa.** Hizo falta solo mientras
  la lista iba encima y la empujaba fuera de la vista. Al pasar la lista a
  pestaña, la vista previa vuelve a estar fija fuera de la parte deslizable, que
  es más simple y era la solución original.
- **La casilla "Nueva" que bajaba con `scrollTo`.** Sin lista suelta, no hay a
  dónde bajar: la clave `nuevaCat.boton` se borró de los tres idiomas.
- Y una trampa que quedó aprendida aunque el código se fuera: **`onLayout` dentro
  de un bloque pegajoso no mide lo que parece.** React lo envuelve en una caja
  propia, así que su `y` se cuenta desde esa caja y sale 0. Se encontró leyendo,
  no probando: las pruebas pasaban igual.

### Cómo vuelve la elegida, y por qué editar va con `replace`

Por el **contexto** (`elegirCategoriaEnMovimiento`), no por una propiedad: son
dos pantallas y esta se apila encima, con la de agregar viva debajo y el monto ya
escrito. Es el mismo canal por el que ya volvía una categoría recién creada — el
significado es idéntico, "adopta esta".

"Editar «X»" navega con **`router.replace`** a la misma ruta con `id`: así su
"atrás" —al guardar, al borrar o al cambiar de idea— deja directamente en el
movimiento. Apilando haría falta un toque más para cerrar una lista que ya no
sirve.

**Se descartó encadenar dos `router.back()` seguidos.** Dos órdenes de
navegación en el mismo instante es justo el tipo de cosa que funciona en la
computadora y falla a medias en el celular.

La ruta `/nueva-categoria` tiene ahora **tres modos**, y los deciden los
parámetros: con `actual` se puede elegir; con `id` se edita (sin lista: quien
viene a renombrar "Broster" no viene a elegir otra); sin nada, solo crear.

## El PDF automático — RESUELTO Y CONFIRMADO (07/08/2026)

> **Probado en el celular del usuario con el APK 6ago-10: *"ya instalé y probé,
> está exportando automáticamente"*.** El PDF sale solo a su hora, con la app
> cerrada, igual que el Excel. Con eso quedan los tres formatos igualados, que es
> lo que se pidió el 06/08.

Lo que sigue es el fallo y cómo se encontró. Se conserva entero —incluidos los dos
intentos equivocados— porque la lección es más valiosa que el arreglo.

### Se colgaba: ERA ESPERAR LA MEDIDA (06/08/2026)

**La conversión a PDF no contestaba nunca.** El usuario tocó "Probar ahora" y el
botón se quedó en "Probando…" para siempre: ni PDF, ni error. A la hora fijada
pasaba lo mismo sin que se viera — el trabajo de fondo se colgaba y Android lo
mataba en silencio al agotar sus 120 s.

### La causa, tras dos intentos fallidos

Convertir HTML en PDF con el adaptador de impresión de un `WebView` son dos
órdenes: **medir** el documento y **escribir**lo. Lo natural es pedir la medida,
esperar la respuesta y escribir después.

**Esa respuesta no llega nunca** cuando el `WebView` no está dentro de ninguna
pantalla. No falla: no llega.

`expo-print` —que es lo que esta misma app usa para el PDF de a mano, y que
funciona en este mismo celular— hace lo contrario: pide la medida con **una
respuesta vacía que nadie escucha** y pasa **directamente** a escribir. El
adaptador ya quedó medido por dentro; lo único que hay que esperar de verdad es la
escritura, y esa sí contesta.

Los dos intentos previos:

1. Esperar la medida. Es lo natural, y es lo que colgaba.
2. Darle al navegador el tamaño de una A4 a mano (`measure` + `layout`), creyendo
   que medir 0 × 0 era la causa. **No lo era**: siguió colgado exactamente igual,
   y con el tope ya puesto el mensaje fue *"no contestó en 30 segundos"*. Ese
   código se quitó — expo-print no mide nada y funciona.

> **Cuando algo de Android ya funciona en esta app, la primera fuente que hay que
> leer es ESO — no la documentación ni la intuición.** Dos entregas perdidas por
> no empezar por ahí. `HtmlAPdf` ahora se pega a expo-print a propósito: mismo
> orden, mismo papel, misma forma de cargar el HTML. Cada diferencia es un sitio
> donde uno puede funcionar y el otro no.

### Y de paso, el papel no era el mismo

Aquí había **A4 a 300 puntos por pulgada** y el PDF de a mano sale en **Carta a
72** (el valor por defecto de expo-print, porque la pantalla lo llama sin decirle
tamaño). El mismo reporte habría salido en hojas de distinto tamaño y con los
saltos de página en otro sitio: dos documentos distintos con el mismo nombre, que
es justo lo que este módulo existe para evitar.

Ahora los números se **leen de expo-print** en una prueba y se comparan con los
nuestros: el día que cambien su valor por defecto, lo dice la prueba en vez de
descubrirse comparando dos PDF.

### No había NINGÚN tope de tiempo, en ninguna de las dos mitades. Y sin tope,
"colgado" y "no pasó nada" se ven idénticos desde fuera. Ahora hay tres, y están
**escalonados a propósito** (con una prueba que lo vigila, porque son números en
dos lenguajes distintos):

| Tope | Dónde | Cuánto |
|---|---|---|
| Conversión | Kotlin, `HtmlAPdf` | 30 s |
| Reserva | JS, `htmlAPdfEnFondo` | 40 s |
| Trabajo de fondo | Kotlin, `FinzoExportService` | 120 s |

El de Android salta primero porque **su mensaje dice más**: ahora incluye la etapa
en la que se quedó (cargando el HTML, midiendo, escribiendo). El de JavaScript
existe porque **los APK anteriores no traen el de Android y no se les puede añadir
por internet**: sin él, quien tenga un APK viejo se queda con el botón girando
para siempre. Y los 80 s de diferencia con el trabajo de fondo son para que quepa
la subida del archivo después de convertirlo.

**Ese tope es lo que encontró el fallo.** Sin él el síntoma era "no pasa nada"; con
él fue un mensaje concreto en pantalla que el usuario pudo mandar en una captura.

Además: se contesta **una sola vez** (el tope y el resultado real podrían
contestar los dos, y el segundo hace reventar la promesa), y el navegador se
suelta al terminar en vez de quedar uno por reporte.

## Cómo se llegó hasta aquí (06/08/2026, ya resuelto arriba)

Reportado así: *"en exportación automática relleno la información y no se exporta
de manera automática en pdf, parece que tuviera el mismo problema que tuvo el
excel antes"*. Y al insistir: *"no se está exportando de manera automática como
lo hace excel"*.

**EL PRIMER DIAGNÓSTICO FUE EQUIVOCADO, y conviene que quede escrito.** Se dio por
hecho que el conversor de PDF no estaba instalado —vive en el APK, y por internet
no viaja código de Android—. La captura de *Acerca de* lo desmintió: el celular
enseña **`✓ reporte solo · ✓ PDF solo`**. El conversor SÍ está.

Así que el fallo es real y está en nuestro código. **Todavía no se sabe cuál es**,
y la razón de no saberlo era la falta de instrumentación, no la falta de ideas.

### Lo que se sabe con certeza

- El despertador funciona: el Excel automático sale a su hora.
- El camino es el mismo para los dos hasta la rama del formato, así que el fallo
  está en la rama del PDF: `htmlDelReporte` → `htmlAPdfEnFondo` → el WebView de
  Kotlin.
- Ese conversor nativo **no se había ejecutado nunca**: compilaba y estaba
  revisado, pero la primera ejecución real fue esta. De ahí que un fallo así
  llegara hasta el usuario. *(Ya corre bien desde el 6ago-10.)*
- El sospechoso principal: un `WebView` que no está en ninguna pantalla no tiene
  tamaño, y sin tamaño la medida del documento puede fallar o salir sin páginas.

### Por qué no se arregló a ciegas

Cambiar Kotlin obliga a compilar e instalar un APK. Adivinando, serían dos APK y
dos esperas. Con el error a la vista, uno. Se eligió instrumentar primero.

### Lo que se hizo para poder verlo (6ago-08)

- **El texto del error se guarda y se enseña**, seleccionable para copiarlo.
  Antes el `catch` guardaba `"error"` y tiraba el mensaje: el único caso que
  necesita detalle era justo el que lo perdía.
- **Un PDF de cero bytes ya no se sube**, y tiene su propio motivo
  (`pdf-vacio`). Sin eso, un PDF sin páginas se subiría, el reporte diría
  "listo", y en Drive quedaría un archivo que no abre — peor que no tener
  ninguno, porque así nadie lo revisa.
- **La ruta del PDF se arma con la misma pieza que la del Excel**
  (`new File(Paths.cache, ...)`). Pegando textos salía una barra doble, porque
  `Paths.cache` ya acaba en barra: de las cosas que funcionan en un sitio y no en
  el siguiente.

### Y esa instrumentación es la que encontró el fallo

No fue el texto del error: fue el **botón girando para siempre**. Antes de que
"Probar ahora" corriera el camino de verdad, ese síntoma no existía — la prueba
abría la pantalla de exportar y salía bien. El fallo llevaba desde el 6ago-03 sin
que nada lo delatara.

> **Un botón de probar que prueba otro camino no es "casi lo mismo": es lo que
> convierte "no sé si funciona" en "comprobé que funciona".**

### Tres defectos reales que lo escondieron, y ninguno es de cálculo

**1. La app contaba un límite que ya no existía.** Tres textos decían que el PDF
*no se puede* armar con la app cerrada — verdad hasta esa misma tarde. El usuario
leyó "El PDF es el único que no se puede armar con la app cerrada. Elige Excel o
CSV" y sacó la única conclusión posible: la app no sabe hacerlo. Uno de ellos
seguía nombrando el correo, que dejó de ser un destino el 05/08.

Ese texto es también lo que hizo creer que el APK no estaba instalado: decía "no
se puede", así que la explicación parecía obvia. Un texto desfasado no solo
confunde a quien usa la app — también a quien la arregla.

> **Un límite se cuenta siempre junto a lo que hay que hacer.** Un texto que dice
> "no se puede" cuando la verdad es "te falta instalar algo" no es impreciso: es
> lo que hace que se busque el fallo donde no está.

**2. "Probar ahora" probaba otro camino.** Abría la pantalla de exportar y hacía
el archivo con la app delante. Salía bien, el archivo aparecía en Drive, y a la
hora fijada no llegaba nada. Son dos rutas distintas y se estaba probando la que
no iba a usarse — que convierte "no sé si funciona" en "comprobé que funciona".

Ahora, si la configuración sale sola, el botón llama al **mismo** trabajo que
despierta el despertador (`exportarEnFondo(true)`) y dice el resultado con su
motivo. Forzando se salta el calendario, pero **no** apunta el reporte como
hecho: probar a las tres no puede dejar sin reporte a las siete.

**3. No había forma de saber qué trae el celular.** `CODE_MARKER` dice qué
JavaScript corre, y por internet llega siempre el último: el celular decía
"6ago-06" con la parte de Android de dos APK antes. Preguntar "¿qué versión
tienes?" daba una respuesta correcta e inútil.

*Acerca de* ya tenía la línea de partes nativas y le faltaban justo estas dos.
Ahora enseña **`✓/✗ reporte solo`** y **`✓/✗ PDF solo`** — dos y no una, porque el
despertador llegó en un APK y el conversor en otro posterior: existen celulares
con el primero y sin el segundo, que es exactamente este caso. Una captura
contesta la pregunta.

### El colchón, que sigue en pie

Si la conversión falla, el trabajo **no** apunta el reporte como hecho, así que el
PDF sale igual al abrir la app. El peor caso es lo de antes, nunca un reporte
perdido. Por eso este fallo es molesto y no grave.

### Y la lección de haberme equivocado en el diagnóstico

Se dio una causa por segura sin poder verla, y encajaba: el usuario no había
confirmado instalar el APK, el texto de la app decía "no se puede", y todo cerraba.
La captura de *Acerca de* lo tumbó en un segundo.

> **Cuando no se puede ver el estado del celular, lo primero que hay que entregar
> es la forma de verlo — no la explicación.** Las dos marcas nativas y el texto
> del error valían más que el diagnóstico, y se hicieron después.

## Exportación automática — cambio de nombre y de fondo (05/08/2026)

Se llamaba "Recordatorio de exportación" y el nombre estaba **defendido con un
comentario largo** en `utils/scheduledExport.ts`: no era automática, así que
llamarla así sería mentir. El usuario pidió el nombre *y* el comportamiento, y
esta vez el nombre se sostiene, porque los dos destinos que quedan se hacen
solos:

- **Carpeta del teléfono** (nueva). Se elige una vez con el selector de Android
  y el permiso **queda guardado y sobrevive a reiniciar**. Desde ahí los
  reportes se escriben solos. Está en `utils/carpetaTelefono.ts`.
- **Google Drive** (ya existía y ya era automático).

Y se quitaron **compartir, correo, Gmail y WhatsApp**: los cuatro abren otra
aplicación y esperan a que una persona toque enviar, así que no pueden ser
automáticos. Siguen estando para exportar a mano.

Lo demás que se pidió: **hora a mano** (03:15 y cualquier otra) además de las
horas en punto, y **fuera la repesca** ("si no exportas, insistir a los N
minutos") con sus seis textos en tres idiomas.

**La hora a mano se entregó invisible**, y el usuario la volvió a pedir al día
siguiente: el botón "Otra hora" estaba al FINAL de la fila de horas, y esa fila
se desliza — detrás de diez horas en punto quedaba fuera de la pantalla. Ahora va
primera, y con borde de rayas para que se distinga de las horas fijas. Hay una
prueba que compara su posición con la de las horas: entregar una opción donde no
se ve es lo mismo que no entregarla.

Cosas que había que no romper, cada una con prueba:

- **Migrar los ajustes guardados.** Quien tuviera "WhatsApp" como destino se
  quedaba apuntando a una opción que ya no existe: la pantalla se vería sin
  destino y la exportación no haría nada. Ahora `loadSchedule` lo pasa a Drive.
- **La hora guardada se valida al cargar.** Una hora fuera de rango deja el
  aviso sin programar, sin error y sin señal.
- **Los avisos de repesca ya programados se cancelan.** A quien los tuviera
  puestos le seguirían sonando y no habría forma de callarlos desde la app; por
  eso la marca vieja se conserva solo para retirarlos.
- **La copia automática usa el destino elegido**, no `"drive"` fijo como estaba:
  quien eligiera la carpeta recibía su copia en Drive.
- **Si falta elegir la carpeta se avisa en la pantalla, en ámbar.** Ese fallo
  llegaría de madrugada, a la hora del reporte, sin nadie mirando.

### Dropbox (05/08/2026)

Tercer destino automático. Se autoriza una vez en el navegador y los reportes se
suben solos a `Dropbox/Aplicaciones/<nombre de la app>/`.

**Se entregó por actualización, sin APK.** Yo había dicho que hacía falta APK y
me equivoqué: las piezas ya estaban dentro (`expo-web-browser`, `expo-crypto`,
`expo-secure-store`, y el esquema `finzo` registrado). No hizo falta la librería
oficial de Dropbox: son tres llamadas de red.

El usuario creó la app en `dropbox.com/developers/apps` con **"carpeta de
aplicaciones"** y el único permiso `files.content.write`. La clave pública está en
`utils/dropbox.ts`; **el secreto no está y no debe estar**, se usa PKCE.

**La clave se leyó mal de una captura.** El penúltimo carácter era una `l`
minúscula y en imagen se veía igual que un `1`. Se pidió escrita, y por eso hay
una prueba que comprueba su forma (15 caracteres, minúsculas y dígitos): una
letra mal copiada da "app no encontrada", que no dice nada útil.

**LA TRAMPA QUE SE EVITÓ, Y ES LA LECCIÓN DE ESTE CAMBIO:** lo natural aquí era
usar `btoa`, `new URL(...).searchParams` y `URLSearchParams`. Las tres son lo
normal en un navegador y las tres son una trampa aquí: en el motor del celular
`btoa` **no existe** y `URL.searchParams` está a medias. Con ellas todo esto
**pasa las pruebas en la computadora y falla solo en el celular**, con un error
que parece "permiso rechazado" y manda a buscar al sitio equivocado. Se comprobó
antes de publicar que nada en la app las usaba — este archivo iba a ser el
primero. Las cuentas puras viven en `utils/pkce.ts` (sin nada nativo, para poder
comprobarlas) y hay pruebas que prohíben las tres funciones.

También se tapó un hueco del auditor de pantallas externas: solo lee el texto de
las pantallas, así que una llamada indirecta no se ve. Se añadieron `elegirCarpeta`
y `conectarDropbox` a su lista, igual que ya estaba `applySchedule`.

### La pantalla no decía qué pasa a la hora fijada (05/08/2026)

Con todo ya configurado, el usuario preguntó: *"debería automáticamente ya
exportar a la hora que le puse, ¿cierto o no?"*. Tenía razón en preguntar: **no
se decía en ningún sitio**.

Y las tres notas de destino lo empeoraban, porque **se contradecían en la misma
frase**: "Con Drive sí es automático **del todo**: la copia se sube sola la
próxima vez que **abras Finzo**". Las dos mitades no pueden ser verdad a la vez.

Ahora hay un aviso fijo debajo de la hora —"a esa hora te llega un aviso; el
archivo se crea solo en cuanto abras Finzo, no a la hora exacta con la app
cerrada"— y las tres notas dicen lo mismo sin prometer de más. Hay una prueba que
prohíbe que vuelva a aparecer "del todo" / "fully automatic" / "de verdade" en
esas notas.

La lección: **el límite hay que decirlo en la pantalla, no solo en el chat.** Yo
se lo había explicado bien en la conversación, y eso no sirve de nada tres
semanas después, ni a nadie más que use la app.

### El reporte se arma con la app cerrada (05/08/2026) — CAMBIO DE APK

*"La idea es que yo rellene los datos y por ejemplo ponga una hora y que se
exporte de manera automática, no tenga que hacer nada el usuario."*

Ahora sí. A la hora fijada el archivo se arma y se guarda solo, con Finzo
cerrada. **Solo Excel y CSV**: el PDF se dibuja en una ventana del navegador de
Android y esa ventana necesita la app en pantalla. Es la única razón.

**`modules/export-scheduler`** (nuevo): un despertador de Android
(`AlarmManager`), un receptor que lo atiende y un `HeadlessJsTaskService` que
arranca el JavaScript sin pantalla. **Es el mismo patrón que ya funciona para
leer los yapes con la app cerrada**, copiado a propósito: es el que se sabe que
funciona en este celular.

**`utils/exportarEnFondo.ts`**: el trabajo. Vuelve a leer todo del disco
—movimientos, idioma, ajustes— porque ahí no hay app.

Y antes de nada hubo que **sacar la generación del Excel fuera de la pantalla**
(`utils/reporteArchivo.ts`): estaba dentro de un componente, y un componente no
existe cuando la app está cerrada.

#### Decisiones que no se pueden cambiar sin romperlo

- **Despertador INEXACTO** (`setAndAllowWhileIdle`). El exacto clava el minuto
  pero desde Android 12 exige `SCHEDULE_EXACT_ALARM`, que Google solo aprueba
  para alarmas y calendarios: pedirlo para un reporte de gastos es de las cosas
  por las que rechazan una app en la tienda. Unos minutos de desvío no los nota
  nadie. El `AllowWhileIdle` sí importa: sin él, un reporte de madrugada con el
  celular quieto no llegaría nunca.
- **Un RECEPTOR en medio**, no el servicio directo. Desde Android 8 una app en
  segundo plano no puede arrancar un servicio; un receptor sí.
- **El candado de energía se pide ANTES** de arrancar el servicio: entre que el
  receptor termina y el servicio empieza hay un hueco donde Android puede volver
  a dormir el celular.
- **`BOOT_COMPLETED`.** Los despertadores no sobreviven a reiniciar el teléfono.
  Sin esto, apagar y encender dejaba la exportación muerta **en silencio**, con
  la pantalla diciendo que seguía activa. Y al reiniciar NO se exporta: solo se
  repone el despertador, o saldría un reporte por cada reinicio.
- **El despertador se repone SIEMPRE**, también cuando el reporte falla. Solo al
  terminar bien, un día sin internet mataría la función para siempre.
- **Tope de 120 s** y no los 30 del registro de yapes: aquí se sube un archivo
  por internet, y con mala señal 30 s corta la subida a medias.
- **Corre también con la app en pantalla** (`true`), al contrario que el registro
  de yapes. Con `false` se saltaría a quien esté usando Finzo a esa hora.
- **El día se comprueba otra vez en JavaScript**: un despertador retrasado hasta
  pasada la medianoche haría el reporte de un día que no tocaba.
- **`proximaEjecucion` vive en JavaScript**, no duplicada en Kotlin. Dos
  calendarios se desincronizan y el que falla es el que nadie mira. Hay ~200
  comprobaciones de que el momento devuelto **nunca cae en el pasado**: si
  cayera, Android lo dispara de inmediato y luego nunca más.
- **Cero movimientos no se sube**: llenaría la nube de archivos vacíos.

#### Y se puede saber si corrió

Se guarda el último intento con su motivo —listo, hoy no tocaba, sin
movimientos, el PDF necesita la app abierta, falló— y la pantalla lo enseña. Un
trabajo de fondo sin esto es imposible de arreglar: "no llegó nada" se ve igual
con diez causas. Misma lección que dejó el registro de la captura de yapes.

La pantalla también pregunta si **este APK** trae el módulo (`puedeExportarEnFondo`)
y solo entonces promete que sale solo. Las actualizaciones por internet no traen
código de Android, así que con un APK anterior dice la verdad de antes.

#### TRAMPA AL ENTREGAR UN APK: publicar la OTA ANTES de que se instale

Al terminar el APK `5ago-19`, la última actualización publicada era `5ago-18`. Si
se instala el APK en ese estado, la app **descarga la 5ago-18 y la pone encima**
del código que trae dentro: se instala el APK correcto, Acerca de sigue diciendo
`5ago-18`, la exportación automática no aparece **y parece que el APK está roto**.

La regla: **al entregar un APK, publicar antes una actualización con el mismo
código.** Así, use el código de dentro o el de internet, es el mismo.

Y por eso el módulo nativo se pide con `requireOptionalNativeModule`: la
actualización `5ago-19` llega también a celulares con un APK viejo que no trae el
despertador. Ahí las funciones no hacen nada y queda el comportamiento de antes,
en vez de reventar al arrancar.

#### Lo que hay que hacer en el celular, una vez

Quitarle a Finzo el **ahorro de batería** en los ajustes de Android. Los Honor y
Xiaomi son de los más agresivos matando procesos de fondo, y sin eso pueden
retrasar o saltarse el reporte. No es algo que el código pueda arreglar.

### LO QUE SIGUE PENDIENTE DE ESTA PETICIÓN, Y POR QUÉ

Del pedido largo quedó fuera lo que no depende de programar más:

- **El PDF con la app cerrada.** Excel y CSV ya salen solos (ver arriba); el PDF
  no, porque se dibuja en una ventana del navegador de Android que necesita la
  app en pantalla. Para lograrlo habría que dibujarlo con `PdfDocument` de
  Android o renderizar el HTML fuera de pantalla con `createPrintDocumentAdapter`.
  Lo segundo es lo que conviene intentar primero: mantiene el diseño actual. Es
  la parte incierta de esta petición y el usuario aceptó dejarla para después.
- **OneDrive.** Necesita que el dueño de la cuenta registre la app en Azure y dé
  el identificador; eso no lo puede hacer el código. **Lo demás sí se puede por
  actualización**, igual que Dropbox: se copia `utils/dropbox.ts` cambiando las
  tres direcciones y el permiso a `Files.ReadWrite.AppFolder`.
- **Correo automático.** No se puede enviar correo desde el celular sin abrir la
  app de correo. Hace falta un **servicio de envío** con su clave (Resend,
  SendGrid…) y eso implica un servidor y un coste mensual.
- **Historial, varias programaciones a la vez, reintentos.** Se pueden hacer con
  lo que hay, pero son otra pantalla y otro almacén; no se metieron en la misma
  entrega para no mezclarlo con el cambio de destinos.

### El recorte no caía donde el marco prometía (05/08/2026)

Reportado con fotos: en el marco entraba la taza entera y en el icono salía un
pedazo del borde, ampliado.

**Se medía con `Image.getSize` y se recortaba con el manipulador de imágenes, y
en una foto de cámara los dos no coinciden.** El archivo suele guardarse tumbado
con una marca de "gírame al mostrar": `Image.getSize` daba las medidas de cómo se
VE, el manipulador trabajaba sobre cómo está GUARDADA. Así que el recorte se
pedía en un sistema de medidas y se aplicaba en otro: se salía de la imagen,
quedaba la parte que cabía, y al agrandarla a 256 salía un trozo ampliado.

Arreglo: al abrir, la imagen se pasa por el manipulador y **se trabaja siempre
con esa copia** — se enseña esa, se mide esa y se recorta esa. La copia ya tiene
la rotación aplicada, así que no hay dos sistemas que puedan discrepar. Cuesta
una pasada más al abrir, y a cambio el marco no puede mentir.

Es el mismo patrón que ya mordió tres veces en este proyecto: **dos mitades que
por separado están bien, con el fallo en la costura.** El espacio entre JS y
Kotlin en la voz, el emoji contra el icono en las categorías, y ahora las
medidas de un sitio y los píxeles de otro.

Y las pruebas de esto son **de texto, no de cálculo, a propósito**: `cropRect`
siempre estuvo bien. El fallo no estaba en las cuentas sino en de dónde venían
los números, y eso ninguna cuenta lo detecta. Lo que se vigila es que las tres
—enseñar, medir, recortar— apunten a la copia, y que el archivo original solo
se use para hacerla.

### El recortador: marco con la forma real, pinza de dos dedos (05/08/2026)

Pedido: *"que se aparezca el espacio de todo lo que aparecerá en el icono y se
pueda acortar, meterle zoom"*. Al mirarlo salieron **tres** cosas, y la primera
no la había pedido nadie porque nadie la había notado:

- **El marco era un CÍRCULO y el icono es un cuadrado redondeado.** Herencia de
  cuando las categorías se dibujaban redondas; son casillas desde el 03/08.
  Encuadrabas una cara en un círculo y en la lista salía con las esquinas
  puestas. El texto de ayuda incluso decía "lo que quede en el círculo". Ahora el
  marco lleva el redondeo proporcional de la casilla real (`REDONDEO = 0.3`, que
  sale de 16 sobre ~55 y de 24 sobre 80: la misma forma a otro tamaño).
- **El arrastre no tenía tope, pero el recorte sí.** Así que arrastrando de más
  se veía la imagen corrida —hasta con borde vacío— y al guardar salía otra cosa,
  porque el recorte se topaba por su cuenta. Los dos usan ahora `limitarPan`.
  Ojo: la prueba que compara `cropRect` consigo mismo **no habría cazado esto**,
  porque `cropRect` ya topaba; lo que no topaba era la pantalla. Hay una
  aserción aparte para eso.
- **El zoom era de cinco pasos con botones.** Ahora se pellizca con dos dedos,
  continuo, de 1× a 4×. Los botones − y + se quedan: con una mano ocupada no se
  puede pellizcar.

Detalle del gesto: cámara y pinza van en un solo `PanResponder` porque los dedos
entran y salen a mitad de camino. **Cada vez que cambia el número de dedos hay
que volver a tomar la referencia**, o la imagen salta justo al apoyar o levantar
el segundo — es el fallo clásico de una pinza hecha a mano, y hay una prueba que
lo vigila. Y `limitarZoom` aguanta un `NaN`, porque la pinza divide una
separación por otra y dos dedos en el mismo punto dan división por cero.

### Foto propia como dibujo de categoría (05/08/2026)

En "Nueva categoría", arriba del catálogo: **cámara y galería**. Va ahí y no en
una pestaña aparte porque es otra forma de contestar la misma pregunta —"¿con
qué dibujo?"— y una pestaña más la esconde.

Casi todo estaba hecho ya: `CategoriaPropia.image`, `catInfo` la reparte,
`CategoryAvatar` la dibuja, y `ImageCropper` recorta a 256×256 JPEG. Lo único
que faltaba era la forma de elegirla — la pantalla que la tenía es la que se
quitó de Ajustes el 03/08.

Lo que había que no romper:

- **`/nueva-categoria` tuvo que entrar en `KEEP_ON_RETURN`.** Al volver de la
  cámara la app cierra la pantalla y manda a Inicio, así que se perdían el
  nombre y el color a medio escribir. **Lo cazó `auditar-pantallas-externas`**,
  no yo; se comprobó que lo caza de verdad quitando la línea a propósito.
- **La foto quitada viaja como `null`, no como `undefined`.** Con `undefined`,
  `editar` no distingue "no la toques" de "bórrala" y quitar no haría nada.
- **El icono no se borra al poner una foto**: queda debajo y vuelve a salir al
  quitarla. Quien prueba una foto y no le gusta no pierde lo que había elegido.
- **Sin foto no queda ni la clave** en el objeto. La copia de nube es un solo
  documento con tope de 1 MB y un `image: undefined` viaja como campo.
- **Tiene que haber forma de sacarla**: elegir un icono no la quita, porque la
  foto manda. Sin eso es un callejón sin salida.
- **Cámara y galería terminan las dos en el recortador propio**, sin
  `allowsEditing`: el recorte de Android cambia de un celular a otro.

### EL ARREGLO DE VERDAD: los dibujos son tipografía, no vectores (05/08/2026)

**Confirmado por el usuario: "ahora todos aparecen al instante".** Se queda.

Cinco entregas intentando repartir el mismo segundo. El usuario lo encontraba
siempre, y su queja final era la respuesta: *"no le das una solución real"*.
Tenía razón — todo lo anterior escondía el coste en distintos sitios en vez de
quitarlo.

**Armar 236 dibujos vectoriales tarda cerca de un segundo, y ese segundo no se
puede esconder.** Con `MaterialCommunityIcons` cada dibujo es una letra de una
tipografía: no se arma, se pinta. Los 236 salen de una, sin lista virtual, sin
cargar por partes, sin nada que aparezca después.

La pista estuvo delante todo el tiempo: **los logos de marca ya eran tipografía y
nunca dieron un solo problema.**

Lo que se paga: los dibujos no son idénticos a los de lucide. Son de línea igual
y del mismo estilo, pero no los mismos trazos.

Decisiones que sostienen esto:

- **Los identificadores NO cambian.** Una categoría guardada dice
  `icono: "Coffee"` y sigue diciéndolo; hay una tabla de 173 pares
  identificador → nombre en la tipografía. Renombrarlos habría dejado sin dibujo
  a todas las categorías ya creadas y a las copias de nube viejas.
- **Las categorías de fábrica también pasaron por `iconoDe`.** Antes traían su
  dibujo a mano. Si solo hubieran cambiado las propias, "Comida" de fábrica y una
  "Broster" creada por la persona se verían de dos estilos distintos — el mismo
  fallo que ya pasó una vez con emoji contra icono.
- **Un nombre de tipografía mal escrito NO da error**: la casilla sale vacía y
  nadie se entera. Por eso los 173 se comprueban contra la lista real de la
  tipografía (`glyphmaps/MaterialCommunityIcons.json`, 7.448 nombres), y también
  que no haya dos ids con el mismo dibujo, que se verían idénticos en la
  cuadrícula.
- **Se quitó el escalonado por grupos** que se había puesto la entrega anterior.
  Hacía falta con vectores; con tipografía solo dejaría huecos visibles si se
  desliza en ese instante, que es justo lo que se estaba arreglando.

### La lista virtual era la herramienta equivocada, y costó cuatro entregas verlo

*(Lo de abajo quedó resuelto por lo de arriba. Se conserva porque explica por qué
no volver a intentarlo.)*

Con un deslizón fuerte se quedaba en blanco **la pantalla entera**. Se probó
todo lo que una `FlatList` ofrece para eso: `windowSize` 2, 3 y 5; tandas de 4 y
de 8; quitar `removeClippedSubviews`; y darle las medidas exactas con
`getItemLayout`. Cada intento mejoraba y ninguno lo resolvía, porque **una lista
virtual arma y suelta a propósito**: es su razón de existir. El dedo siempre
puede ir más rápido que el armado.

El usuario lo dijo tal cual y era la respuesta: *"los iconos ya deberían estar
ahí fijos, no deberían cargar recién cuando yo deslizo"*.

Ahora es una pantalla deslizable normal con los 236 dibujos **armados una vez y
nunca soltados**. Después del primer segundo no hay nada que cargar: se deslice
como se deslice, están todos.

Lo único que no se puede hacer es armarlos todos de golpe —eso tarda casi un
segundo y la pantalla no abriría—, así que **entran de a un grupo por vuelta**:
los tres primeros (lo que se ve) en el primer instante, el resto mientras la
persona mira. Y el hueco de un grupo que aún no está mide **exactamente** lo que
va a medir, porque si midiera de menos el contenido crecería bajo el dedo y la
pantalla saltaría sola.

Ojo con no confundir esto con los dos intentos de "esperar" de más arriba:
aquellos hacían esperar a **lo que se estaba mirando**. Aquí lo visible está
completo desde el primer instante y lo que entra después está fuera de pantalla.

Las medidas viven en `constants/catalogoFilas.ts`, **sin React**, para poder
comprobarlas con números: que las cinco casillas llenen justo el ancho a seis
anchos distintos, que ninguna fila quede corta, que al partir en filas no se
pierda ni se repita un dibujo, que el hueco reservado mida lo mismo que las
filas que reemplaza. Y ya no salen de clases de estilo (`flex-1`,
`aspect-square`): se veía igual, pero nadie sabía cuánto medía una casilla hasta
después de dibujarla.

Hay cuatro pruebas que **prohíben** volver a meter una lista virtual aquí, con el
motivo escrito al lado. Es lo que un ojo entrenado propondría como mejora.

### El bug que llevaba dos días ahí y lo encontró una prueba, no un ojo

Al escribir la comprobación de "ninguna clave de renglón repetida" saltó que
**dos grupos se llamaban `iconos.servicios`**: el de luz, agua e internet, y el
de Uber, Airbnb y Dropbox. Existía desde que nació el catálogo (03/08/2026).
Hacía dos daños a la vez:

- El título **"Servicios" salía dos veces** en la pantalla.
- Tres renglones quedaban con la **misma clave**, y la clave es de lo que se
  agarra la lista para saber qué dibujar dónde. Es de la familia exacta de
  fallos que el usuario estaba reportando al deslizar.

El grupo de marcas pasó a `iconos.apps` ("Apps y servicios"), en los tres
idiomas. Hay dos pruebas: una sobre la causa (ningún grupo repite nombre) y otra
sobre la consecuencia (ninguna clave repetida), porque la segunda sin la primera
no dice qué arreglar.

Y de la misma auditoría salió un duplicado **recién hecho por mí**: `iconos.tsx`
ya exportaba `TODOS_LOS_GRUPOS` y el archivo nuevo armó otra lista igual. Dos
listas de lo mismo es una que se queda atrás. `GRUPOS_GENERICOS` y
`GRUPOS_MARCAS` ya no se exportan, para que no vuelva a poder juntarse por
fuera.

- **Y recién entonces se podía arreglar lo brusco.** Con los iconos ya al
  instante, quedaba el cambio de pantalla en sí. La ruta `nueva-categoria` no
  estaba declarada en el layout, así que tomaba la animación por defecto de
  Android y pintaba el fondo nativo blanco un instante: las dos mitades de lo
  brusco. Ahora **se desliza desde la derecha** y con el fondo del tema en
  `contentStyle` (el mismo patrón que las pantallas de arriba en ese archivo).

  **El fundido se probó y se quitó el mismo día.** Se le ofreció como
  alternativa, lo pidió, se publicó, y al usarlo lo quitó. Sobre el papel es
  más suave; en la mano la pantalla aparece de la nada y el fundido se nota
  como un parpadeo en vez de un movimiento. Queda anotado para no volver a
  proponerlo. La prueba guarda la elección concreta, no un genérico "que haya
  animación": es gusto del usuario y no se deduce del código.

  Importa el orden: **la animación la corre el sistema, no nuestro código**, así
  que sigue siendo suave aunque la pantalla esté armando sus iconos. Puesta
  antes de bajar el coste, habría tapado el problema en vez de resolverlo.

Y una lección sobre las pruebas de esta tanda: las que dicen **"esto ya no debe
existir"** se caían por su propia explicación, porque el comentario que cuenta
por qué se quitó algo contiene su nombre. Pasó tres veces (`Catalogo`,
`dibujar`, `removeClippedSubviews`). Una prueba que castiga documentar el motivo
acaba haciendo que se borre el motivo. Ahora esas comprobaciones van contra la
pantalla **sin comentarios** (`codigo` en `verificar-categorias-propias.ts`).

Aviso para el futuro: **este proyecto no tiene configuración de prettier.**
Correrlo reformatea el archivo entero a 80 columnas cuando el resto del código
usa 100, y el cambio de verdad se pierde entre 90 líneas de ruido. Se hizo una
vez y hubo que deshacerlo.

### Dos fallos que cazaron las herramientas, no las pruebas

- **eslint**: al agregar el campo de la nube avisó de una dependencia que
  faltaba. No era ruido — sin ella, crear una categoría no disparaba la subida
  y se perdía al cambiar de celular.
- **El sustituto de iconos de las pruebas** tenía 24 nombres escritos a mano.
  Al llegar el catálogo, cinco pruebas que ni hablan de iconos dejaron de
  compilar de golpe. Ahora se genera con los 5.984 nombres de la librería:
  `node pruebas/stubs/generar-lucide.mjs`

---

## El micrófono del escritorio — se probó y se volvió atrás (02/08/2026)

El widget de la pantalla de inicio **ya existía** y ya hacía lo importante:
abre `finzo://voice` directo y el micrófono empieza a escuchar solo. Eso no se
toca.

Lo que el usuario quería era que **no se viera Finzo**: la tarjeta flotando
sobre su fondo de pantalla. Se intentaron dos pasos intermedios —salir de
Finzo al terminar de dictar, y tapar el fondo con un oscuro opaco— y **el
usuario pidió deshacerlos**. Están revertidos.

**No volver a proponerlos sin preguntar.** Y si algún día se retoma:

- **Lo que de verdad pedía** es una segunda ventana de la app, propia y
  transparente, que muestre solo la tarjeta. Es trabajo nativo: una Activity
  aparte con tema translúcido, un segundo punto de entrada de React, y hay que
  resolver el bloqueo (esa ventana no pasa por la huella) y "exporta enero"
  (un PDF no cabe en una tarjeta flotante).
- **Lo que NO hay que hacer nunca**: volver translúcida la ventana de toda la
  app. Con `windowIsTranslucent`, Android deja de redimensionar la ventana con
  el teclado, y escribir un monto o el PIN se rompe en TODAS las pantallas.
  Es el atajo evidente y es una trampa.

---

## El saldo que pasa de un mes a otro — explicado el 02/08/2026

Se preguntó tres veces, así que conviene tenerlo escrito: **el saldo no se
guarda, se recalcula.** `prevBalance` suma los presupuestos de todos los meses
anteriores más los ingresos, menos los gastos.

Es un **relevo, mes a mes**: enero le pasa a febrero, febrero a marzo. Nunca
salta. Si febrero está vacío, cierra con lo mismo que recibió — y por eso
*parece* que enero le pasa a marzo, pero es febrero pasando lo que no tocó.
Los mismos 300, no 300 nuevos cada mes.

Como se recalcula, corregir un gasto de hace tres meses ajusta solos todos los
meses siguientes.

**Sugerido y sin respuesta: un "Ajustar saldo".** El arrastre es *presupuesto
menos lo anotado*, no la plata real. Cada gasto sin anotar mete un error que
nunca se corrige y se acumula: a los doce meses Finzo puede decir S/ 2.400
cuando hay S/ 600. Se propuso poder decirle "en realidad tengo S/ X" y que
anote la diferencia, como cuadrar caja. Es solo JavaScript.

**Descartado: cortar el arrastre por año.** Castiga al que ahorró de verdad
—borrarle lo suyo el 1 de enero es mentirle— y le perdona la deuda al que se
pasó. Al 31 de diciembre no le pasa nada a la plata. El botón de "poner en
cero" ya existe para cortarlo a mano cuando haga falta.

---

## LO SIGUIENTE A HACER

**Propuesto y sin respuesta: aligerar la pantalla de registro automático.**
Más de la mitad es texto que sirve una vez y estorba siempre. Se propuso el
02/08/2026, con las capturas delante:

- El paso 1, ya concedido, encogido a una línea con su ✓
- "Avisos vistos: 13.933", el nombre del paquete y "la voz en el último
  aviso" detrás de un toque: es diagnóstico, no información de uso diario
- Los textos de los dos interruptores de la voz, a una línea

Quedaría en la mitad de largo sin perder nada. El párrafo de arriba y el de
privacidad ya se acortaron.

**Y solo Yape.** Decisión del 02/08/2026: fuera Plin y los catorce bancos.
Ninguno se probó nunca con un movimiento real y el aviso de clave de
Scotiabank se colaba en la pantalla. Para volver a meter uno hace falta un
aviso REAL suyo — se agrega en `MONEY_APP_HINTS` (Kotlin) y `APPS_ACEPTADAS`
(`utils/notificationParser.ts`), que una prueba obliga a mantener iguales.

**Pendiente de respuesta del usuario:** el registro de diagnóstico guarda el
TEXTO de los avisos descartados, y entre ellos van los de clave ("Tu código
de verificación es 4821"). Queda escrito en el celular (cifrado, local, los
últimos 40) y a la vista de cualquiera que agarre el celular desbloqueado.

Propuesto el 02/08/2026: seguir anotando que llegó un aviso de seguridad,
pero sin guardar su texto. Para diagnosticar un yapeo que no entra, el texto
de un código no sirve de nada. Es solo JavaScript.

Sin probar de verdad: **Plin y los bancos**. Las listas de palabras están
escritas según cómo suelen redactar sus avisos, pero solo se ha comprobado
con Yape. Hoy quedó claro lo que cuesta dar por bueno lo que no se probó.

## La voz que anuncia los yapeos — hecha el 02/08/2026

El celular dice el nombre y el monto apenas llega el yapeo, aunque Finzo esté
cerrada (`FinzoNotificationListener.kt`). Lee el aviso de Yape tal cual, sin
armar la frase.

Dos interruptores, los dos **apagados de fábrica** (en la pantalla de
registro automático):
- Decirlo en voz alta — la función entera
- También cuando pagas — aparte, porque anunciar un pago suena en la caja
  del súper delante de todos

Se corrigió que leyera cosas que no son un yapeo: el aviso "Operación en
curso. Hemos generado y autocompletado la clave" que Yape manda pegado a cada
pago, y avisos de otros bancos (Scotiabank y parecidos) que no traen un monto.

### El espacio que no es un espacio (02/08/2026)

Ese arreglo trajo otro fallo, y **es el más instructivo del proyecto**:

Yape escribe el monto con un espacio **duro** —el que impide que "S/" y el
número se partan en dos líneas—. En pantalla se ve igual que uno normal. Para
JavaScript **es** un espacio; para Kotlin **no lo es**.

El registro lo hace JavaScript, así que anotó el yapeo. La voz la hace Kotlin,
no reconoció el monto y se calló. Un carácter invisible separando las dos
mitades de la app.

**Y la prueba decía que todo estaba bien.** Tenía el texto real de la captura
y afirmaba que hablaría. El servicio está en Kotlin y la prueba lo imitaba en
JavaScript, escribiendo `\s` en los dos sitios como si significara lo mismo.
Probaba una versión más permisiva que la real.

De aquí salen dos reglas que valen para todo el proyecto:

1. **Una prueba escrita en otro idioma que el código que prueba tiene que
   traducir también las diferencias del idioma.** Si no, miente. Ahora
   `verificar-voz-yape` traduce las reglas a las de Java antes de comparar, y
   las lee del propio `.kt` en vez de copiarlas.
2. **Cuando la voz y el registro deciden por separado, acaban discrepando.**
   Hay una prueba que comprueba que los dos vean lo mismo como monto.

### Varios yapes seguidos (02/08/2026)

Preguntado pensando en un negocio, y había un fallo de verdad: `hablar()`
creaba un motor de voz **nuevo por cada aviso**. `QUEUE_ADD` encola dentro de
SU motor, así que cinco motores son cinco colas independientes — los cinco
yapes hablaban a la vez y no se entendía ninguno.

Ahora hay **un solo motor**, se reutiliza, y las frases hacen cola de verdad.
Lo que llega mientras arranca espera (arrancar tarda, y en una ráfaga los
primeros avisos caen justo en ese hueco), todo pasa por el hilo principal
—las notificaciones llegan por hilos distintos— y el motor se suelta tras un
minuto sin nada que decir, no después de cada frase.

El registro no se ralentiza: son milésimas. Lo único que va por detrás en una
ráfaga es la voz, que habla más lento de lo que llegan los yapes.

Y para que no cueste otro día: el servicio **deja anotado por qué se calló**
(solo el motivo, nunca el texto) y la pantalla de registro automático lo
enseña — "Calló: no le vio el monto". Antes, "no dijo nada" se veía idéntico
estuviera apagada, no reconociera el monto o lo tomara por un pago tuyo.

En Acerca de, la línea de partes nativas trae **`✓ voz afinada`**: distingue
este APK del de esa misma mañana, que ya traía la voz pero muda.

---

## Qué separa el plan Gratis del Premium (revisado el 02/08/2026)

**Gratis:** movimientos ilimitados, historial completo, reportes básicos,
presupuesto mensual, saldo anterior automático, buscar, modo claro/oscuro,
sincronización en la nube.

**Premium:** presupuesto por categoría, metas de ahorro, Finzo IA, exportar
PDF, exportar Excel, importar (Excel/CSV), "sin anuncios".

El candado sí funciona: las pantallas de metas, presupuesto por categoría,
exportar PDF, importar, exportación programada y bloqueo con PIN comprueban
`isPremium` antes de dejar entrar. Lo único que falta es el cobro.

Tres cosas que no cuadran y hay que decidir:

- **El bloqueo con PIN/huella es Premium pero no sale en la lista** de la
  pantalla. Se paga sin saber que lo incluye, o se topa uno con el candado
  sin entender por qué.
- **El registro automático y la voz de los yapeos no están en ninguna lista.**
  Hoy los tiene todo el mundo. Es la función más llamativa de la app y la
  candidata natural al Premium — o al menos debería figurar.
- **"Sin anuncios"**: ver el punto 2 de arriba.

---

## El registro automático, entero (02/08/2026)

El servicio de Android mira los avisos de **18 apps de dinero** y descarta el
resto sin leerlo. Lo que reconoce está en `utils/notificationParser.ts`:
entradas (te yapearon, te plinearon, te transfirieron, abono, depósito...) y
salidas (yapeaste, plineaste, pagaste, transferiste, retiro...).

**Cómo llega a registrarse**, por el camino más corto que haya:

1. **App abierta y escuchando** → el servicio avisa por el evento `onCapture`
   y se registra al instante. Es nativo: `ba4972c` en adelante.
2. **App cerrada** → se despierta `FinzoCaptureService` (trabajo de fondo).
3. **Si Android se niega** → se queda en el buzón y entra al abrir la app.

Nunca 1 y 2 a la vez: levantar el trabajo de fondo con la app delante es
despertar un proceso para nada, y además Android lo prohíbe. El repaso cada
8 segundos y la recogida al volver al frente **se quedan** como red: cubren
el APK anterior y lo que llegue con la app cerrada.

**Lo que protege el dinero** (cada una costó su fallo):

- Nada de hace más de 7 días se registra.
- El repetido solo se compara contra lo escrito a mano: tres yapes de S/ 1
  de la misma persona el mismo día son TRES movimientos.
- Entre vaciar el buzón y guardar hay un instante en que el yapeo no está en
  ningún sitio; se aparta en una lista de pendientes y solo se suelta cuando
  ya está guardado.
- La app **junta** en vez de pisar lo que escribió el trabajo de fondo, tanto
  los movimientos (`mergeTransactions`) como el registro de avisos
  (`mergeCaptureLog`).

---

## Pendientes que no bloquean

- **Escáner de boletas: EN PAUSA** desde el 30/07/2026, a pedido del usuario.
  Nunca se probó con una boleta real. Antes de darlo por bueno, hay que
  probarlo con una de verdad.
- **El presupuesto mensual no se repite solo** cada mes: hay que volver a
  ponerlo.
- ~~La exportación programada sale sin gráficos~~ **HECHO el 07/08/2026 (7ago-29).**
  Tiene su interruptor en la pantalla de exportación automática, solo visible con PDF
  elegido. Viene **apagado**, y los ajustes guardados de antes de esta versión valen
  apagado: nadie ve cambiar su documento sin pedirlo.

---

## Decisiones tomadas (no volver sobre ellas sin motivo)

- **Los gráficos vienen apagados.** Ocupan media hoja y empujan la lista de
  movimientos a la siguiente. Se encienden a mano o diciendo "gráficos".
- **Una sola rosquilla, la de gastos.** Se probó dibujar también la de
  ingresos y se quitó: en un mes normal los ingresos son dos o tres
  categorías, y esa rosquilla costaba una hoja entera.
- **El destinatario se elige cada vez, no se guarda como fijo.** Un
  destinatario fijo se olvida a los tres meses y un día el estado de cuenta se
  va a quien no toca.
- **Con dos contactos que encajan, no se elige ninguno.** Mandar un documento
  de dinero a la persona equivocada por adivinar es peor que preguntar.
- **Los fallos silenciosos se convierten en visibles.** Es el hilo conductor de
  medio proyecto: banner en Inicio cuando un archivo compartido no se pudo
  abrir, el motivo exacto del error de actualización escrito en pantalla, el
  aviso de "no elegiste a quién", el conteo de dígitos del teléfono. Un fallo
  que no avisa cuesta días.

---

## Historial de entregas

Ver [ENTREGAS.md](ENTREGAS.md).

---

## Lo que NO está en este repositorio

- **Los APK y las actualizaciones** viven en Expo, no aquí. Un APK pesa unos
  70 MB y git guarda **todas** las versiones para siempre: diez entregas serían
  700 MB que se descargan enteros en cada clon. Lo que sí está aquí son los
  enlaces y de qué commit salió cada uno, que es lo que hace falta saber.
- **La llave que firma la app** está en los servidores de Expo. Es lo correcto:
  no debe estar en git.

  Aquí decía que perder el acceso a esa cuenta dejaba la app **sin poder
  actualizarse en Play Store nunca más**. Eso está **desfasado** y corregido el
  02/08/2026, porque asustaba de más y una nota que asusta de más hace tomar
  malas decisiones.

  Con **Play App Signing** —lo normal en una app nueva de hoy— Google guarda
  una copia de la llave de verdad: se firma con una llave "de subida" y ellos
  vuelven a firmar. Si esa llave de subida se pierde, **se puede pedir a Google
  que la reponga**. Es un trámite, no el fin.

  Lo que sigue siendo cierto: hay que cuidarla, y perderla cuesta tiempo y
  papeleo. Si algún día se compila en local, la llave pasa a ser un archivo del
  usuario y **hay que guardarle dos copias** (nube y USB). Ahí está mejor que
  hoy, porque hoy no se puede tener copia de nada.

  Y mientras Finzo **no esté publicada**, perder la llave solo obliga a
  desinstalar y reinstalar. El problema serio empieza el día de la publicación.
- **Los datos del usuario**: movimientos, contactos y presupuestos están solo
  en su celular, cifrados, y en su copia de nube. Nunca en el repositorio.
