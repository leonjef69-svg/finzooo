export const STORAGE_KEYS = {};
export async function loadJSON<T>(_key: string, fallback: T): Promise<T> { return fallback; }
export function saveJSON(): never { throw new Error('La prueba no debe escribir datos'); }
export async function saveJSONBatchNow(): Promise<never> { throw new Error('La prueba no debe escribir datos'); }
