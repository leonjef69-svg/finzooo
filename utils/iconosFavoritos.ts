// LOS ÍCONOS MARCADOS COMO FAVORITOS
//
// Son 236 dibujos en el catálogo. Quien usa siempre los mismos cinco no debería
// tener que buscarlos entre todos cada vez que crea una categoría.
//
// SE GUARDA EL ÍCONO, NO LA CATEGORÍA
//
// Un favorito es el dibujo ("Utensils"), no "Comida". Así el mismo dibujo sirve
// para categorías distintas, que es como se usa: quien marca el tenedor lo
// quiere para "Almuerzos", "Cena fuera" y "Broster".
//
// POR QUÉ VIVE EN UNA VARIABLE SUELTA, IGUAL QUE LAS CATEGORÍAS PROPIAS
//
// Mismo motivo que en utils/categoriasPropias: la pantalla de crear categoría
// necesita saber los favoritos al dibujarse, y leerlos del disco en cada
// dibujado sería leer el disco en cada letra que se escribe. Se cargan una vez
// al abrir la app y se avisa a mano cuando cambian.
//
// SOLO EN ESTE CELULAR, POR AHORA
//
// No viajan a la nube. Al cambiar de teléfono se pierden, y está dicho al
// usuario. Añadirlos a la copia de la cuenta es fácil de escribir y tocaría los
// sitios que suben datos, así que se dejó fuera de esta entrega a propósito.

import { loadJSON, saveJSON } from "@/utils/storage";

const STORAGE_KEY = "finzo:iconosFavoritos";

/**
 * Cuántos se pueden guardar.
 *
 * Un tope existe porque la pestaña no se desliza: si alguien marcara ochenta,
 * los últimos quedarían fuera de la pantalla sin forma de llegar a ellos. Con
 * 30 caben seis filas de cinco, que es más de lo que nadie usa.
 */
export const MAX_FAVORITOS = 30;

let favoritos: string[] = [];

/** Los favoritos, del más reciente al más antiguo. */
export function getFavoritos(): string[] {
  return favoritos;
}

export function esFavorito(id: string): boolean {
  return favoritos.includes(id);
}

export function setFavoritos(lista: string[]): void {
  favoritos = limpiar(lista);
}

/**
 * Deja la lista en algo usable: sin repetidos, sin basura y con el tope puesto.
 *
 * Hace falta porque la lista llega del disco, y ahí pudo quedar cualquier cosa:
 * una versión anterior, una copia a medio escribir, o un texto que no es un
 * identificador. Un valor raro no puede dejar la pestaña en blanco.
 */
function limpiar(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const x of lista) {
    if (typeof x !== "string" || x === "" || vistos.has(x)) continue;
    vistos.add(x);
    salida.push(x);
    if (salida.length >= MAX_FAVORITOS) break;
  }
  return salida;
}

/**
 * Marca o desmarca, y devuelve la lista nueva.
 *
 * El recién marcado va PRIMERO, no al final: el último que interesó es el que
 * más probablemente se vuelva a usar, y así no hay que buscarlo entre los de
 * hace meses.
 *
 * Y al pasarse del tope se cae el más viejo, en vez de negarse a marcar. Un
 * "no caben más" obligaría a ir a borrar uno antes de poder guardar el que
 * importa ahora.
 */
export function alternar(lista: string[], id: string): string[] {
  if (lista.includes(id)) return lista.filter((x) => x !== id);
  return [id, ...lista].slice(0, MAX_FAVORITOS);
}

export async function loadFavoritos(): Promise<string[]> {
  favoritos = limpiar(await loadJSON<unknown>(STORAGE_KEY, []));
  return favoritos;
}

export function saveFavoritos(lista: string[]): void {
  favoritos = limpiar(lista);
  saveJSON(STORAGE_KEY, favoritos);
}
