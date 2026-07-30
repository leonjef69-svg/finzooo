// PREPARAR LA FOTO ANTES DE LEERLA
//
// Una foto de celular sale de 12 megapíxeles. Dársela así al lector de texto
// tarda varios segundos y no lee mejor: el lector trabaja sobre una versión
// reducida de todos modos.
//
// Lo que sí importa es NO reducirla de más. La letra de una boleta ya es
// chica; si se achica la foto a 800px, el total pasa a medir 6 píxeles de
// alto y deja de leerse. Por eso el tope es alto (2000px) y solo se toca
// cuando la foto lo pasa.

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Lado largo máximo. Por encima de esto se reduce; por debajo se deja igual. */
const MAX_SIDE = 2000;

/**
 * Deja la foto lista para el lector de texto y devuelve la ruta del archivo.
 *
 * Si algo falla, devuelve la foto original sin tocar: es mejor intentar leer
 * una foto grande que quedarse sin escáner por un problema al redimensionar.
 */
export async function prepareForOcr(
  uri: string,
  width?: number,
  height?: number
): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri);

    // Solo se reduce si de verdad hace falta. Cuando el selector no informa
    // el tamaño (width/height vienen vacíos), se deja la foto como está: sin
    // saber cuánto mide, achicarla a ciegas puede borrar la letra chica.
    const longSide = Math.max(width ?? 0, height ?? 0);
    if (longSide > MAX_SIDE) {
      if ((width ?? 0) >= (height ?? 0)) context.resize({ width: MAX_SIDE });
      else context.resize({ height: MAX_SIDE });
    }

    const image = await context.renderAsync();
    // Calidad alta a propósito: el JPEG agresivo emborrona los bordes de las
    // letras, que es justo de lo que vive el lector.
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    return saved.uri;
  } catch {
    return uri;
  }
}
