export function getRandomBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));
}

export async function getRandomBytesAsync(length: number): Promise<Uint8Array> {
  return getRandomBytes(length);
}

/** Adaptador de IO para pruebas Node; no acredita entropía nativa Android. */
export function getRandomValues<T extends Uint8Array>(array: T): T {
  array.set(getRandomBytes(array.length));
  return array;
}

let nextId = 0;
export function randomUUID(): string {
  nextId += 1;
  return `test-export-${nextId}`;
}

export const CryptoDigestAlgorithm = { SHA256: "SHA256" };
export async function digestStringAsync(_algorithm: string, value: string): Promise<string> {
  return `hash:${value}`;
}
