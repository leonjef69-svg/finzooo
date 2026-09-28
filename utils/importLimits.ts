/** Límite defensivo para no cargar archivos completos demasiado grandes en memoria. */
export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

export function isImportTooLarge(size: number | null | undefined): boolean {
  return Math.max(0, size ?? 0) > MAX_IMPORT_BYTES;
}
