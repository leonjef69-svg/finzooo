export function getRandomBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));
}

export async function getRandomBytesAsync(length: number): Promise<Uint8Array> {
  return getRandomBytes(length);
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
