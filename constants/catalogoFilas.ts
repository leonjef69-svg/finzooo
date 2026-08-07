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
 * Cuántos grupos se dibujan A LA VEZ QUE SE ABRE la pantalla.
 *
 * EL RESTO LLEGA JUSTO DESPUÉS, TODO DE UNA VEZ. Ver la nota larga en la pantalla.
 *
 * Cuatro grupos son unos 70 dibujos, y en la pantalla caben unos 20: hay más de tres
 * pantallas de contenido antes de llegar al final de lo dibujado. Ni el deslizón más
 * rápido alcanza el borde en el rato que tarda en llegar el resto.
 *
 * Este número es el equilibrio de todo el asunto y no se cambia a la ligera: menos y
 * un deslizón rápido llega al final; más y volvemos a cargar la entrada de la
 * pantalla, que es lo que se está arreglando.
 */
export const GRUPOS_AL_ABRIR = 4;

/**
 * Cuántos grupos entran en cada tanda DESPUÉS de la primera.
 *
 * POR QUÉ DEJÓ DE SER "TODO EL RESTO DE UNA VEZ" (07/08/2026)
 *
 * El medidor lo dijo con un número: el PRIMER toque después de abrir tardaba **6000 ms**.
 * Eso no lo tarda marcar una casilla — es el toque esperando a que la pantalla acabe de
 * armar los 223 dibujos que faltaban, que llegaban todos en un solo golpe. Mientras ese
 * golpe dura, el dedo no existe para la app.
 *
 * ESTO NO ES CARGAR AL DESLIZAR, Y LA DIFERENCIA ES TODA LA CUESTIÓN. El usuario rechazó
 * eso con estas palabras: *"los iconos ya deberían estar ahí fijos, no deberían cargar
 * recién cuando yo deslizo"*. Siguen llegando **solos**, sin que nadie deslice, y en
 * cuanto acaban están todos puestos para siempre. Lo único que cambia es que el trabajo
 * se parte, y entre trozo y trozo la app puede atender un toque.
 *
 * Tampoco es el escalonado de a uno que se rechazó antes: aquel dejaba huecos VISIBLES
 * al deslizar porque iba justo por detrás del dedo. Aquí la primera tanda ya llena más
 * de tres pantallas y cada tanda añade unas dos más, así que lo que se ve siempre está
 * completo.
 *
 * Dos y no cinco porque lo que importa es cuánto dura el trozo MÁS LARGO: ese es lo que
 * un toque tiene que esperar en el peor caso.
 */
export const GRUPOS_POR_TANDA = 2;

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
