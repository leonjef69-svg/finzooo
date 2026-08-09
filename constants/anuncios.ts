// LOS ANUNCIOS: GRATIS CON, PREMIUM SIN (decisión suya, 08/08/2026)
//
// Se le explicaron los costes —cuenta de AdMob, APK nuevo, y volver a tocar la política de
// privacidad porque los anuncios SÍ recogen datos— y lo confirmó igual. Es su app y es una
// forma legítima de ganar dinero, así que aquí está.
//
// Y de paso arregla una incoherencia: hasta el 8ago-12 la pantalla de Premium prometía "sin
// publicidad" sin que hubiera publicidad, que es lo que Google llama afirmación engañosa. Con
// anuncios de verdad en la versión gratuita, esa frase vuelve a ser cierta.
//
// ---- FALTAN DOS DATOS, Y NO LOS PUEDE PONER EL CÓDIGO ----
//
// Google exige que el dueño abra una cuenta de AdMob, dé de alta la app y saque de ahí sus
// identificadores. Es un trámite suyo, igual que el de Dropbox. Hasta que existan, las
// constantes están vacías, `anunciosActivos()` devuelve false y **no se dibuja ni un hueco**.
//
// Es el mismo criterio que se usó con OneDrive: una función a medias que se puede ver y no
// funciona manda a buscar un fallo en el celular cuando lo que falta es un trámite.
//
// ---- Y HACE FALTA UN APK NUEVO ----
//
// Los anuncios son código de Android (react-native-google-mobile-ads), así que NO viajan por
// actualización. Todo lo de este archivo y el componente que lo usa sí: por eso se entregan
// primero, apagados, y el APK se compila una vez cuando estén los identificadores.

/**
 * El identificador de la app en AdMob. **VACÍO HASTA QUE EL DUEÑO LO REGISTRE.**
 *
 * Sale en apps.admob.com → tu app → Configuración de la app. Tiene la forma
 * `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY` — con VIRGULILLA (~) antes de la segunda parte.
 *
 * También hay que pegarlo en `app.json`, dentro del plugin de anuncios: Android lo lee de ahí
 * al arrancar, no de aquí. Si falta en app.json, la app se cierra sola al abrir — y ese fallo
 * no dice que el problema sea un identificador.
 */
export const ADMOB_APP_ID = "";

/**
 * El identificador del banner. **VACÍO HASTA QUE EL DUEÑO LO CREE.**
 *
 * Es OTRO distinto del de arriba, y se crea aparte: apps.admob.com → Bloques de anuncios →
 * Crear → Banner. Tiene la forma `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY` — con BARRA (/), no
 * con virgulilla. Confundirlos es el error más común y da anuncios que nunca cargan sin decir
 * por qué.
 */
export const ADMOB_BANNER_ID = "";

/**
 * ¿Se pueden mostrar anuncios en esta versión de la app?
 *
 * Falso mientras falten los identificadores. Que sea una función y no una constante suelta es
 * a propósito: así el sitio donde se decide es UNO, y las pantallas no repiten la condición
 * —que es como se cuela el día en que una de ellas se olvida de mirarla—.
 */
export function anunciosActivos(): boolean {
  return ADMOB_APP_ID !== "" && ADMOB_BANNER_ID !== "";
}

/**
 * ¿Le toca ver anuncios a esta persona?
 *
 * **LA REGLA QUE NO SE PUEDE ROMPER: quien paga NO ve anuncios.** Es lo que se le vende en la
 * pantalla de Premium, así que enseñarle uno a alguien que pagó no es un fallo de dibujo: es
 * cobrar por algo que no se entregó, y de eso se entera el usuario antes que nadie.
 *
 * Por eso la comprobación vive aquí y no dentro del componente: un solo sitio que decir "no",
 * y una prueba que lo vigila.
 */
export function tocaVerAnuncios(esPremium: boolean): boolean {
  return anunciosActivos() && !esPremium;
}
