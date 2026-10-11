export function canonicalValue(value: unknown): string;
export function legacyCanonical(record: object): string;
export function canAnchorLegacy(record: object): boolean;
export function compatibleCreation(a: object, b: object, legacyId: (record: object) => string): boolean;
export function explicitEditIdentity<T extends object>(original: T, candidate: T, legacyId: (record: object) => string): T;
export function originForRecord(record: object, legacyId: (record: object) => string): string;
export function deletionIdentity(record: object, legacyId: (record: object) => string): Record<string, string>;
