/**
 * Si la pantalla de bloqueo está puesta ahora mismo.
 *
 * POR QUÉ HACE FALTA SABERLO DESDE FUERA
 *
 * Compartir un estado de cuenta a Finzo con el bloqueo activado hacía esto:
 * Android traía la app al frente, el candado aparecía, y mientras la persona
 * ponía su huella o su PIN, el código que abre Importar ya se había rendido.
 * Al desbloquear salía Inicio y del archivo no quedaba rastro.
 *
 * Eran dos problemas a la vez y los dos venían de dar por hecho que abrir la
 * app tarda un instante:
 *
 *   1. Se reintentaba abrir Importar durante tres segundos. Poner un PIN
 *      tarda más que eso. Cuando la persona desbloqueaba, ya no quedaba
 *      nadie intentándolo.
 *
 *   2. Aunque hubiera aguantado, abrir Importar POR DEBAJO del candado no
 *      sirve: el cuadro de la huella lo dibuja Android encima de la app, y
 *      al cerrarse la app cree que "volvió del segundo plano" y se manda
 *      sola a Inicio — llevándose la importación por delante.
 *
 * Así que ahora se espera. Mientras el candado esté puesto no se navega a
 * ningún sitio; el archivo queda guardado y Importar se abre justo después
 * de desbloquear, que es cuando la persona puede verlo.
 */
let bloqueada = false;

export function setAppLocked(value: boolean): void {
  bloqueada = value;
}

export function isAppLocked(): boolean {
  return bloqueada;
}
