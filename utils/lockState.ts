/**
 * Si la pantalla de bloqueo está puesta ahora mismo.
 *
 * POR QUÉ HACE FALTA SABERLO DESDE FUERA
 *
 * Compartir un estado de cuenta a Fino con el bloqueo activado hacía esto:
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
import { useSyncExternalStore } from "react";

// Al arrancar todavía no se leyó SecureStore. La duda se trata como bloqueo.
let bloqueada = true;
const listeners = new Set<() => void>();

export function setAppLocked(value: boolean): void {
  if (bloqueada === value) return;
  bloqueada = value;
  listeners.forEach((listener) => listener());
}

export function isAppLocked(): boolean {
  return bloqueada;
}

function subscribeAppLock(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useAppLocked(): boolean {
  return useSyncExternalStore(subscribeAppLock, isAppLocked, isAppLocked);
}
