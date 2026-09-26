export function getRandomBytes(length: number): Uint8Array {
  return Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));
}
