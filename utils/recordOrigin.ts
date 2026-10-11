import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canAnchorLegacy, compatibleCreation, explicitEditIdentity, legacyCanonical, originForRecord, deletionIdentity } from "../functions/src/record-origin-canonical.js";

type RecordIdentity = { id: number; creationId?: string; captureId?: string;
  internalTransferLink?: string; internalTransfer?: string; internalTransferSpaceId?: string; method?: string };

/** Huella de un ORIGINAL conocido, no UUID inventado al abrir/fusionar copias.
 * Editar conserva la huella; nunca depende del contenido posterior del editado. */
export function legacyCreationId(record: object): string {
  return `legacy:${bytesToHex(sha256(utf8ToBytes(legacyCanonical(record))))}`;
}

export function compatibleRecordCreation(a: RecordIdentity, b: RecordIdentity): boolean {
  return compatibleCreation(a, b, legacyCreationId);
}

/** Solo una edición/reemplazo elegido sobre el original vigente. No sirve
 * para bautizar una copia remota dudosa ni para cambiar su número/referencias. */
export function identityForExplicitEdit<T extends RecordIdentity>(original: T, candidate: T): T {
  return explicitEditIdentity(original, candidate, legacyCreationId);
}

export function sameLegacyContents(a: object, b: object): boolean {
  return legacyCanonical(a) === legacyCanonical(b);
}

export function recordOriginOf(record: object): string { return originForRecord(record, legacyCreationId); }
export function recordDeletionIdentity(record: object): Record<string, string> { return deletionIdentity(record, legacyCreationId); }

export { canAnchorLegacy };
