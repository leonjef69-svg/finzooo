# Dónde nos quedamos

Actualizado: **4 de agosto de 2026** · Código publicado: **4ago-03**

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

Se pueden **crear, editar y borrar** categorías con nombre, dibujo y color.
El botón "Nueva" está DENTRO de la cuadrícula al agregar un movimiento, y el
"Editar «X»" aparece debajo solo cuando hay una propia elegida.

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

### LO QUE SIGUE PENDIENTE DE ESTA PETICIÓN, Y POR QUÉ

Del pedido largo quedó fuera lo que no depende de programar más:

- **Ejecutarse a la hora en punto con la app cerrada** (WorkManager). El PDF se
  arma en un WebView, que necesita la app abierta. Hay que generar el archivo en
  código nativo y meterlo en un WorkManager: **cambio de APK**, no de
  actualización.
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
- **La exportación programada sale sin gráficos** desde el 1ago-17, porque no
  manda ese dato. Es coherente con "gráficos solo si se piden", pero si se
  quiere que los lleve siempre, necesita su propio interruptor.

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
