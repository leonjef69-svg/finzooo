import { TODOS_LOS_GRUPOS } from "@/constants/iconos";

/**
 * El catálogo de dibujos, aplanado en renglones, y las medidas de la cuadrícula.
 *
 * POR QUÉ ESTO NO VIVE EN LA PANTALLA
 *
 * Son cuentas, no dibujo, y de ellas depende que la lista de "Nueva categoría"
 * no se quede en blanco al deslizar rápido: la lista necesita saber dónde
 * empieza cada renglón SIN haberlo dibujado. Mientras las medidas salían de
 * clases de estilo ("flex-1", "aspect-square"), solo se sabían después de
 * dibujar, y un deslizón fuerte dejaba la pantalla vacía.
 *
 * Aquí, sin nada de React, se pueden comprobar con números en las pruebas — que
 * es lo que hace falta, porque una medida mal calculada se ve peor que un hueco:
 * las filas se montan unas sobre otras o quedan separadas.
 */

/** Cuántos dibujos caben de ancho. */
export const POR_FILA = 5;
/** El hueco entre casillas, y el de debajo de cada fila. */
export const SEPARACION = 10;
/** El aire a cada costado. Tiene que ser el mismo que el "px-5" de la lista. */
export const MARGEN_LATERAL = 20;
/** El renglón con el nombre del grupo, con su aire arriba y abajo. */
export const ALTO_TITULO = 36;

/**
 * El lado de una casilla para que las cinco llenen justo el ancho.
 *
 * Se calcula en vez de fijarse: con una medida fija, las cinco casillas no
 * llegaban al borde y sobraba un vacío a la derecha.
 */
export const LADO_DE = (anchoPantalla: number) =>
  (anchoPantalla - MARGEN_LATERAL * 2 - SEPARACION * (POR_FILA - 1)) / POR_FILA;

type Renglon =
  | { clase: "titulo"; clave: string }
  | { clase: "fila"; clave: string; iconos: (string | null)[] };

/**
 * Títulos y filas de cinco, en una sola lista.
 *
 * Aplanado a propósito: así la lista puede construir solo lo que se ve. Con la
 * cuadrícula normal, los 236 dibujos se montaban TODOS a la vez aunque en
 * pantalla cupieran veinte, y cada uno es un dibujo vectorial, no una letra.
 *
 * Se calcula una vez al cargar el archivo, no en cada dibujado.
 */
export const RENGLONES: Renglon[] = TODOS_LOS_GRUPOS.flatMap((g) => {
  const filas: Renglon[] = [{ clase: "titulo", clave: g.titulo }];
  for (let i = 0; i < g.iconos.length; i += POR_FILA) {
    const trozo: (string | null)[] = g.iconos.slice(i, i + POR_FILA);
    // La última fila de cada grupo casi nunca viene completa. Se rellena con
    // huecos para que TODAS midan lo mismo: si no, sus dibujos se reparten el
    // ancho de otra forma y salen más grandes que los de arriba.
    while (trozo.length < POR_FILA) trozo.push(null);
    filas.push({ clase: "fila", clave: g.titulo + i, iconos: trozo });
  }
  return filas;
});

/**
 * Dónde empieza y cuánto mide cada renglón.
 *
 * No hay una multiplicación simple que sirva, porque los renglones son de dos
 * tamaños: los títulos miden ALTO_TITULO y las filas lo que se le pase.
 */
export function medidasDe(altoFila: number) {
  const altos = RENGLONES.map((r) => (r.clase === "titulo" ? ALTO_TITULO : altoFila));
  const desde: number[] = [];
  let acumulado = 0;
  for (const alto of altos) {
    desde.push(acumulado);
    acumulado += alto;
  }
  return { altos, desde, total: acumulado };
}
