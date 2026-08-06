import { TODOS_LOS_GRUPOS } from "@/constants/iconos";

/**
 * El catálogo de dibujos partido en filas, y las medidas de la cuadrícula.
 *
 * POR QUÉ ESTO NO VIVE EN LA PANTALLA
 *
 * Son cuentas, no dibujo. Aquí, sin nada de React, se pueden comprobar con
 * números en las pruebas: que las cinco casillas llenen justo el ancho, que
 * ninguna fila quede corta, que al partir el catálogo no se pierda ni se repita
 * un dibujo. Leyendo el código eso no se ve.
 *
 * POR QUÉ HAY MEDIDAS EN NÚMEROS Y NO EN CLASES DE ESTILO
 *
 * Porque hay que reservar el sitio de lo que todavía no se ha dibujado. Los
 * grupos entran de a uno tras abrir la pantalla, y mientras no están, su hueco
 * tiene que medir exactamente lo que van a medir — si no, el contenido crece
 * bajo el dedo y la pantalla salta.
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

/** Lo que ocupa una fila: la casilla más el hueco de debajo. */
export const ALTO_FILA_DE = (anchoPantalla: number) => LADO_DE(anchoPantalla) + SEPARACION;

type GrupoEnFilas = {
  titulo: string;
  /** Filas de POR_FILA. `null` es un hueco de relleno, no un dibujo. */
  filas: (string | null)[][];
};

/**
 * Cada grupo con sus dibujos ya repartidos en filas de cinco.
 *
 * Se calcula una vez al cargar el archivo, no en cada dibujado.
 */
/**
 * Parte una lista de dibujos en filas de cinco.
 *
 * Se usa para el catálogo y para la pestaña de favoritos, y por eso está aparte:
 * las dos son la misma elección, así que tienen que verse igual. Con dos
 * repartos distintos, los favoritos saldrían de otro tamaño que los de al lado.
 */
export function enFilas(iconos: string[]): (string | null)[][] {
  const filas: (string | null)[][] = [];
  for (let i = 0; i < iconos.length; i += POR_FILA) {
    const fila: (string | null)[] = iconos.slice(i, i + POR_FILA);
    // La última fila casi nunca viene completa. Se rellena con huecos para que
    // TODAS midan lo mismo: si no, sus dibujos se reparten el ancho de otra
    // forma y salen más grandes que los de arriba.
    while (fila.length < POR_FILA) fila.push(null);
    filas.push(fila);
  }
  return filas;
}

export const CATALOGO_EN_FILAS: GrupoEnFilas[] = TODOS_LOS_GRUPOS.map((g) => ({
  titulo: g.titulo,
  filas: enFilas(g.iconos),
}));

/** Lo que ocupan las filas de un grupo. Es el hueco a reservar mientras no están. */
export const altoDeLasFilas = (grupo: GrupoEnFilas, altoFila: number) =>
  grupo.filas.length * altoFila;
