// LAS CUENTAS DEL RECORTE DE UNA BOLETA (09/08/2026)
//
// POR QUÉ HAY UN RECORTADOR PROPIO
//
// El escáner usaba el de Android (`allowsEditing` de expo-image-picker). Ese recuadro lo pinta
// el sistema, cada fabricante a su manera, y en su celular sale **en blanco sobre la foto**:
// *"ese cuadro sigue siendo de color blanco, no se ve nada cuando se recorta la imagen"*. No
// hay forma de cambiarle el color desde aquí — esa pantalla no es de la app.
//
// Y NO SE REUSA components/ImageCropper
//
// Aquel recorta un CUADRADO, porque está hecho para la foto de una categoría. Una boleta es
// alta y estrecha: un cuadrado le corta el total, que es justo lo único que importa. Su
// matemática está atada al lado único, así que generalizarla tocaría el recorte de las
// categorías, que funciona.
//
// LO QUE VIVE AQUÍ Y POR QUÉ
//
// Solo la conversión de "lo que se ve" a "píxeles del archivo". Es donde está el error clásico
// de cualquier recortador —la imagen se enseña a 350 puntos y tiene 3.000 píxeles— y no se
// puede mirar a ojo: o el recorte cae donde se ve, o sale corrido y se lleva el total.

/** Un rectángulo, en lo que se ve en pantalla o en píxeles: las dos cosas se miden igual. */
export type Rect = { x: number; y: number; ancho: number; alto: number };

/**
 * Dónde se dibuja la imagen dentro de su hueco, cuando entra entera sin deformarse.
 *
 * Con una boleta —alta y estrecha— en una pantalla más ancha, sobra sitio a los lados: eso son
 * las **bandas**. Y el recorte se pide sobre la imagen, no sobre el hueco, así que sin
 * descontar esas bandas todo sale desplazado hacia la izquierda.
 */
export function imagenDentroDelHueco(
  anchoImagen: number,
  altoImagen: number,
  anchoHueco: number,
  altoHueco: number
): Rect & { escala: number } {
  if (anchoImagen <= 0 || altoImagen <= 0 || anchoHueco <= 0 || altoHueco <= 0) {
    return { x: 0, y: 0, ancho: 0, alto: 0, escala: 1 };
  }
  // La imagen entera dentro del hueco: manda el lado que se queda corto primero.
  const escala = Math.min(anchoHueco / anchoImagen, altoHueco / altoImagen);
  const ancho = anchoImagen * escala;
  const alto = altoImagen * escala;
  return { x: (anchoHueco - ancho) / 2, y: (altoHueco - alto) / 2, ancho, alto, escala };
}

/**
 * El rectángulo que se ve, convertido a píxeles del archivo.
 *
 * SE TOPA A LOS BORDES DE LA IMAGEN, y no es por prudencia: pedir un recorte que se sale hace
 * **fallar la operación entera**, y entonces no se recorta nada y la boleta se lee con la mesa
 * y la mano dentro. Es la misma lección que ya está escrita en components/ImageCropper.
 */
export function recorteEnPixeles(
  seleccion: Rect,
  dibujo: Rect & { escala: number },
  anchoImagen: number,
  altoImagen: number
): { originX: number; originY: number; width: number; height: number } {
  const { escala } = dibujo;
  if (escala <= 0) return { originX: 0, originY: 0, width: anchoImagen, height: altoImagen };

  const x = (seleccion.x - dibujo.x) / escala;
  const y = (seleccion.y - dibujo.y) / escala;
  const ancho = seleccion.ancho / escala;
  const alto = seleccion.alto / escala;

  const originX = Math.round(Math.max(0, Math.min(anchoImagen, x)));
  const originY = Math.round(Math.max(0, Math.min(altoImagen, y)));
  return {
    originX,
    originY,
    // Al menos un píxel: un recorte de ancho cero también hace fallar la operación.
    width: Math.max(1, Math.round(Math.min(ancho, anchoImagen - originX))),
    height: Math.max(1, Math.round(Math.min(alto, altoImagen - originY))),
  };
}

/** Lo más chico que se puede dejar el recuadro, en lo que se ve. Debajo de esto no se agarra. */
export const MINIMO = 60;

/**
 * Mueve o estira el recuadro sin dejarlo salirse de la imagen.
 *
 * VA APARTE DE LOS DEDOS a propósito: así el tope se puede comprobar con números, y sobre todo
 * **es el mismo tope que usa el recorte**. Con dos, se podría arrastrar más allá de la imagen y
 * al guardar saldría otra cosa — que es el fallo que ya costó una vez en el recortador de las
 * categorías.
 */
export function encajar(seleccion: Rect, dibujo: Rect): Rect {
  const ancho = Math.max(MINIMO, Math.min(seleccion.ancho, dibujo.ancho));
  const alto = Math.max(MINIMO, Math.min(seleccion.alto, dibujo.alto));
  return {
    ancho,
    alto,
    x: Math.max(dibujo.x, Math.min(dibujo.x + dibujo.ancho - ancho, seleccion.x)),
    y: Math.max(dibujo.y, Math.min(dibujo.y + dibujo.alto - alto, seleccion.y)),
  };
}
