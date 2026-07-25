import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import CryptoJS from "crypto-js";

// La "llave maestra" que cifra todo se guarda en el cajón cifrado del
// propio sistema operativo (respaldado por el hardware del celular),
// no en el mismo lugar que los datos que protege.
const KEY_STORAGE_NAME = "finzo_encryption_key_v1";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_STORAGE_NAME);
  if (existing) return existing;
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const key = bytesToHex(randomBytes);
  await SecureStore.setItemAsync(KEY_STORAGE_NAME, key);
  return key;
}

async function secureRandomWordArray(byteCount: number) {
  const randomBytes = await Crypto.getRandomBytesAsync(byteCount);
  return CryptoJS.enc.Hex.parse(bytesToHex(randomBytes));
}

// Cifra un texto. El resultado incluye un "IV" (un valor aleatorio único
// por cada guardado, necesario para descifrar) pegado adelante — el IV
// no es secreto, solo debe ser distinto cada vez.
export async function encryptText(plaintext: string): Promise<string> {
  const keyHex = await getOrCreateKey();
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = await secureRandomWordArray(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv });
  return `${iv.toString(CryptoJS.enc.Hex)}:${encrypted.toString()}`;
}

// Descifra un texto cifrado con encryptText(). Si el texto no se pudo
// descifrar (por ejemplo, porque es un dato viejo guardado antes de
// activar el cifrado, o está dañado), devuelve null en vez de fallar.
export async function decryptText(ciphertext: string): Promise<string | null> {
  try {
    const [ivHex, cipherPart] = ciphertext.split(":");
    if (!ivHex || !cipherPart) return null;
    const keyHex = await getOrCreateKey();
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(cipherPart, key, { iv });
    const text = decrypted.toString(CryptoJS.enc.Utf8);
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
