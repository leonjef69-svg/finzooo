import { useSyncExternalStore } from "react";

/**
 * El estado de cuenta que llegó de otra app y todavía no se ha abierto.
 *
 * POR QUÉ EXISTE ESTA SEGUNDA VÍA
 *
 * Compartir un estado de cuenta a Finzo abría la app y se quedaba en Inicio
 * sin hacer nada. Se arreglaron dos causas —el archivo se tiraba, y la regla
 * de "vuelve a Inicio" se comía la pantalla— y aun así volvió a pasar.
 *
 * El problema de fondo no es cuál de las causas era: es que TODAS fallaban en
 * silencio. La app abría, no ocurría nada, y no había forma de saber si el
 * archivo había llegado y se perdió, o si nunca llegó. Sin esa información,
 * arreglarlo es adivinar.
 *
 * Así que además de intentar abrir Importar, el archivo se apunta AQUÍ. Y si
 * por lo que sea no se llegó a abrir la pantalla, Inicio enseña un aviso con
 * el nombre del archivo para tocarlo a mano. Deja de haber un final silencioso:
 * o se abre Importar, o se ve el aviso. Nunca "no pasa nada".
 *
 * Se limpia cuando Importar carga el archivo de verdad — no al pedir la
 * navegación. Es la diferencia entre "se mandó abrir" y "se abrió", que es
 * justo donde se perdía antes.
 */
export type PendingImport = { uri: string; name: string };

let pendiente: PendingImport | null = null;
const oyentes = new Set<() => void>();

export function setPendingImport(file: PendingImport | null): void {
  if (pendiente === file) return;
  pendiente = file;
  for (const o of oyentes) o();
}

export function getPendingImport(): PendingImport | null {
  return pendiente;
}

function subscribe(listener: () => void): () => void {
  oyentes.add(listener);
  return () => {
    oyentes.delete(listener);
  };
}

/** Para que una pantalla se entere sola cuando llega o se va un archivo. */
export function usePendingImport(): PendingImport | null {
  return useSyncExternalStore(subscribe, getPendingImport, getPendingImport);
}
