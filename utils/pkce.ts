// LAS CUENTAS DEL INICIO DE SESIÓN SEGURO (PKCE), SIN NADA NATIVO
//
// Están aparte de utils/dropbox.ts por dos motivos:
//
//   1. Se pueden comprobar con números en las pruebas. dropbox.ts habla con el
//      navegador, el almacén seguro y el sistema de archivos, y nada de eso
//      existe en la computadora donde corren las pruebas.
//   2. Aquí es donde vive la tentación peligrosa. Ver el aviso de abajo.
//
// ---- NADA DE btoa, URL NI URLSearchParams ----
//
// Lo natural aquí sería usar `btoa` para el base64, `new URL(...).searchParams`
// para leer el código de la vuelta y `URLSearchParams` para armar el cuerpo del
// formulario. Las tres son la forma normal de hacerlo en un navegador y las tres
// son una trampa en este proyecto: en el motor de JavaScript del celular `btoa`
// no existe y `URL.searchParams` está a medias.
//
// Con ellas, todo esto pasa las pruebas en la computadora y falla SOLO en el
// celular, con un error que parece "permiso rechazado" y manda a buscar el fallo
// al sitio equivocado. Nada en la app las usaba; este fue el primer archivo con
// la tentación, y hay pruebas que la vigilan.

/**
 * Las 64 letras y signos con los que se arma el número secreto.
 *
 * Son 64 exactas y no 66 a propósito: al repartir un byte (0..255) entre ellas
 * con el resto de la división, 64 reparte parejo y 66 dejaría los dos primeros
 * caracteres saliendo un poco más a menudo. En un secreto, "un poco menos al
 * azar" es un defecto, no un detalle.
 *
 * Todas están permitidas por PKCE, así que el texto viaja tal cual dentro de una
 * dirección web sin tener que cambiar nada.
 */
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** El número secreto de PKCE, una letra por byte al azar. */
export function verificadorPkce(bytes: Uint8Array): string {
  let texto = "";
  for (const b of bytes) texto += ALFABETO[b % ALFABETO.length];
  return texto;
}

/**
 * De base64 normal a base64url.
 *
 * Los caracteres `+`, `/` y `=` significan otra cosa dentro de una dirección
 * web, así que viajarían cambiados y la huella no cuadraría al otro lado.
 */
export function aBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Un cuerpo de formulario, con cada valor escapado. */
export function comoFormulario(campos: Record<string, string>): string {
  return Object.entries(campos)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/**
 * El código de autorización que viene en la dirección de vuelta.
 *
 * Devuelve cadena vacía si no hay ninguno — que es el caso normal cuando la
 * persona dice "no" o cierra el navegador, no un error del que alarmarse.
 */
export function codigoDeLaVuelta(url: string): string {
  // El [?&] delante importa: sin él, un parámetro llamado "mycode" también
  // encajaría y se tomaría su valor por el código bueno.
  const m = /[?&]code=([^&#]+)/.exec(url);
  // decodeURIComponent no es opcional: el código llega escapado y Dropbox lo
  // rechaza si se le devuelve tal cual.
  return m ? decodeURIComponent(m[1]) : "";
}
