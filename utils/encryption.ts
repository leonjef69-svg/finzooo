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

// La llave se lee del cajón seguro UNA sola vez por sesión y se guarda en
// memoria. Antes se pedía a SecureStore en CADA guardado y en CADA lectura
// — y como la app guarda cada vez que cambia algo (movimientos, metas,
// presupuestos, preferencias...), eso eran varias llamadas al sistema
// operativo por cada toque de botón, cada una atravesando el puente nativo.
// Era una de las causas medibles de que la app se sintiera lenta.
//
// Se guarda la PROMESA, no el texto: si dos guardados salen casi a la vez
// (algo normal, hay varios useEffect de guardado), ambos esperan la misma
// petición en curso en vez de lanzar una cada uno.
//
// Seguridad: la llave vive en memoria solo mientras la app está abierta;
// en disco sigue estando únicamente en el cajón cifrado del sistema.
let cachedKeyPromise: Promise<string> | null = null;

async function readOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_STORAGE_NAME);
  if (existing) return existing;
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const key = bytesToHex(randomBytes);
  await SecureStore.setItemAsync(KEY_STORAGE_NAME, key);
  return key;
}

function getOrCreateKey(): Promise<string> {
  if (!cachedKeyPromise) {
    cachedKeyPromise = readOrCreateKey().catch((err) => {
      // Si falló, no dejamos la promesa fallida en caché: el siguiente
      // intento vuelve a preguntarle al sistema en vez de fallar siempre.
      cachedKeyPromise = null;
      throw err;
    });
  }
  return cachedKeyPromise;
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
  const ivHex = iv.toString(CryptoJS.enc.Hex);
  const cipherPart = encrypted.toString();
  // AES-CBC oculta el contenido, pero por sí solo no detecta alteraciones.
  // El HMAC impide aceptar como válido un dato manipulado o dañado.
  const mac = CryptoJS.HmacSHA256(`${ivHex}:${cipherPart}`, key).toString(
    CryptoJS.enc.Hex,
  );
  return `v2:${ivHex}:${cipherPart}:${mac}`;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

// Descifra un texto cifrado con encryptText(). Si el texto no se pudo
// descifrar (por ejemplo, porque es un dato viejo guardado antes de
// activar el cifrado, o está dañado), devuelve null en vez de fallar.
export async function decryptText(ciphertext: string): Promise<string | null> {
  try {
    const parts = ciphertext.split(":");
    const authenticated = parts[0] === "v2";
    const ivHex = authenticated ? parts[1] : parts[0];
    const cipherPart = authenticated ? parts[2] : parts[1];
    const storedMac = authenticated ? parts[3] : undefined;
    if (!ivHex || !cipherPart) return null;
    const keyHex = await getOrCreateKey();
    const key = CryptoJS.enc.Hex.parse(keyHex);
    if (authenticated) {
      if (!storedMac) return null;
      const expectedMac = CryptoJS.HmacSHA256(
        `${ivHex}:${cipherPart}`,
        key,
      ).toString(CryptoJS.enc.Hex);
      if (!constantTimeEqual(storedMac, expectedMac)) return null;
    }
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const decrypted = CryptoJS.AES.decrypt(cipherPart, key, { iv });
    const text = decrypted.toString(CryptoJS.enc.Utf8);
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
