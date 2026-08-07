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
// Y TAMBIÉN VALEN LAS FOTOS PROPIAS (07/08/2026)
//
// Pedido: *"los iconos que les tomé foto o subí una imagen también deberían poder
// añadirse a favoritos"*. Antes no se ofrecía, con el argumento de que un favorito
// es un dibujo del catálogo y una foto no está en el catálogo. Visto de otra
// forma: recortar una foto cuesta trabajo —cámara, encuadre, zoom— y volver a
// hacerlo para la siguiente categoría es justo lo que los favoritos evitan. El
// argumento estaba mirando de dónde sale el dibujo en vez de cuánto cuesta
// conseguirlo.
//
// Una foto se guarda como su propio texto ("data:image/jpeg;base64,..."), así que
// entra en la misma lista sin cambiarla. Ver esFoto().
//
// POR QUÉ VIVE EN UNA VARIABLE SUELTA, IGUAL QUE LAS CATEGORÍAS PROPIAS
//
// Mismo motivo que en utils/categoriasPropias: la pantalla de crear categoría
// necesita saber los favoritos al dibujarse, y leerlos del disco en cada
// dibujado sería leer el disco en cada letra que se escribe. Se cargan una vez
// al abrir la app y se avisa a mano cuando cambian.
//
// VIAJAN A LA COPIA DE LA CUENTA (07/08/2026), MENOS LAS FOTOS
//
// Aquí decía "no viajan a la nube, al cambiar de teléfono se pierden". Ya no: los
// dibujos del catálogo suben con el resto de los datos. Las fotos propias NO — ver
// paraLaNube(), que explica por qué y qué se pierde exactamente.

import { loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";

// La clave se lee de STORAGE_KEYS y no se escribe aqui: la lista de lo que se
// borra al cerrar sesion esta alli, y una clave que solo conoce su propio archivo
// se queda fuera de ese borrado sin que nadie lo note. Ya paso con estas tres.
const STORAGE_KEY = STORAGE_KEYS.iconosFavoritos;

/**
 * Cuántos se pueden guardar.
 *
 * Un tope existe porque la pestaña no se desliza: si alguien marcara ochenta,
 * los últimos quedarían fuera de la pantalla sin forma de llegar a ellos. Con
 * 30 caben seis filas de cinco, que es más de lo que nadie usa.
 *
 * SOBRE EL TAMAÑO, ahora que también entran fotos: una foto recortada pesa unos
 * 18 KB (256 px, calidad 0.8 — ver ImageCropper), así que 30 fotos serían medio
 * megabyte. Cabe de sobra porque esto se guarda SOLO en el celular. El día que
 * los favoritos viajen a la nube hay que volver a mirar este número: ahí el
 * documento entero tiene un tope de 1 MB y las fotos de las categorías ya ocupan
 * parte de él.
 */
export const MAX_FAVORITOS = 30;

/**
 * ¿Este favorito es una foto propia y no un dibujo del catálogo?
 *
 * Se distingue por cómo empieza el texto, y no con un campo aparte, porque así la
 * lista guardada sigue siendo la de siempre: las que ya estaban en los celulares
 * se leen igual, sin convertir nada.
 */
export function esFoto(id: string): boolean {
  return typeof id === "string" && id.startsWith("data:");
}

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

/**
 * Los favoritos que SÍ pueden viajar a la copia de la cuenta: los del catálogo.
 *
 * POR QUÉ LAS FOTOS SE QUEDAN EN EL CELULAR
 *
 * Una foto recortada pesa unos 18 KB, y TODO el documento de la nube tiene un tope
 * de 1 MB — el mismo que comparten los movimientos y las fotos de las categorías.
 * Treinta fotos de favoritos serían medio megabyte gastado en atajos, y pasarse del
 * tope no deja el documento a medias: lo deja SIN GUARDAR, y con él los
 * movimientos. Perder un atajo es molesto; perder los gastos, grave.
 *
 * Un nombre del catálogo pesa diez bytes, así que esos van todos.
 *
 * La foto en sí NO se pierde al cambiar de celular si está puesta en una categoría:
 * las categorías propias y su imagen sí viajan. Lo que no vuelve es el atajo.
 */
export function paraLaNube(lista: string[]): string[] {
  return limpiar(lista).filter((x) => !esFoto(x));
}

export async function loadFavoritos(): Promise<string[]> {
  favoritos = limpiar(await loadJSON<unknown>(STORAGE_KEY, []));
  return favoritos;
}

export function saveFavoritos(lista: string[]): void {
  favoritos = limpiar(lista);
  saveJSON(STORAGE_KEY, favoritos);
}
