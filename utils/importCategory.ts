import { suggestCategory } from "@/utils/classifier";
import { matchCategory, type RawRow } from "@/utils/importEngine";

/**
 * Respeta primero la categoría escrita en el archivo. Solo cuando no se
 * reconoce, permite que el clasificador use el comercio o la descripción.
 */
export function categoryForImportedRow(
  raw: Pick<RawRow, "categoryRaw" | "type" | "merchant" | "description">,
  translate: (key: string) => string,
  merchantLearned: Record<string, string>,
): string {
  const fromFile = matchCategory(raw.categoryRaw, raw.type, translate);
  const fallback = raw.type === "expense" ? "otros" : "otro_ingreso";
  return fromFile === fallback
    ? suggestCategory(raw.merchant || raw.description, raw.type, merchantLearned)
    : fromFile;
}
