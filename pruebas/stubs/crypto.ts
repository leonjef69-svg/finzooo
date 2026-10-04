export function getRandomBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));
}

export async function getRandomBytesAsync(length: number): Promise<Uint8Array> {
  return getRandomBytes(length);
}
