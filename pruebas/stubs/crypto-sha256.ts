/** IO Node para recibos: SHA-256 real; no acredita Keystore/entropía Android. */
import { createHash } from "node:crypto";
export { getRandomBytes, getRandomBytesAsync, getRandomValues, randomUUID } from "./crypto";
export const CryptoDigestAlgorithm = { SHA256: "SHA256" };
export async function digestStringAsync(_algorithm: string, value: string): Promise<string> {
  return createHash("sha256").update(value).digest("hex");
}
