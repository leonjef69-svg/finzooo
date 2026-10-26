/** Normalización compartida por el lector y la detección de duplicados.
 * Separada de categorías/UI para que validar un guardado sea liviano. */
export function normalizeHeader(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
