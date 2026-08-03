# Dónde nos quedamos

Actualizado: **2 de agosto de 2026** · Código publicado: **2ago-24**

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

Son 37 pruebas y 7 auditores. Cada prueba nueva tiene que **fallar contra la
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
- Personalizar categorías: imagen propia con recorte, color y nombre
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
- **La llave que firma la app** está en los servidores de Expo. Es lo correcto
  —no debe estar en git— pero si se pierde el acceso a esa cuenta, la app **no
  se puede volver a actualizar en Play Store nunca más**. Habría que publicarla
  como una app distinta y los usuarios perderían sus datos.
- **Los datos del usuario**: movimientos, contactos y presupuestos están solo
  en su celular, cifrados, y en su copia de nube. Nunca en el repositorio.
