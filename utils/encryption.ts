import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cbc } from "@noble/ciphers/aes.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { base64 } from "@scure/base";

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

async function hasEncryptedDataOnDevice(): Promise<boolean> {
  // SecureStore puede devolver null si Android pierde/invalida su llave. En
  // ese caso crear otra llave destruiria la posibilidad de recuperar los
  // datos ya cifrados. Solo es seguro crearla en una instalacion sin datos.
  const keys = await AsyncStorage.getAllKeys();
  for (const [, raw] of await AsyncStorage.multiGet(keys)) {
    if (raw && (raw.startsWith("v2:") || /^[0-9a-f]{32}:/i.test(raw))) {
      return true;
    }
  }
  return false;
}

async function readOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_STORAGE_NAME);
  if (existing !== null) {
    if (!/^[0-9a-f]{64}$/i.test(existing)) throw new Error("encryption-key-invalid");
    return existing;
  }
  if (await hasEncryptedDataOnDevice()) {
    throw new Error("encryption-key-missing-with-existing-data");
  }
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

// Cifra un texto. El resultado incluye un "IV" (un valor aleatorio único
// por cada guardado, necesario para descifrar) pegado adelante — el IV
// no es secreto, solo debe ser distinto cada vez.
export async function encryptText(plaintext: string): Promise<string> {
  const keyHex = await getOrCreateKey();
  const key = hexToBytes(keyHex);
  const iv = await Crypto.getRandomBytesAsync(16);
  // Mismo AES-256-CBC/PKCS7 y formato v2: cambia la implementación, no los
  // datos guardados. No hace falta reescribir historiales al actualizar.
  const encrypted = cbc(key, iv).encrypt(new TextEncoder().encode(plaintext));
  const ivHex = bytesToHex(iv);
  const cipherPart = base64.encode(encrypted);
  // AES-CBC oculta el contenido, pero por sí solo no detecta alteraciones.
  // El HMAC impide aceptar como válido un dato manipulado o dañado.
  const mac = bytesToHex(hmac(sha256, key, new TextEncoder().encode(`${ivHex}:${cipherPart}`)));
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
    if (parts.length !== (authenticated ? 4 : 2)) return null;
    const ivHex = authenticated ? parts[1] : parts[0];
    const cipherPart = authenticated ? parts[2] : parts[1];
    const storedMac = authenticated ? parts[3] : undefined;
    if (!ivHex || !/^[0-9a-f]{32}$/i.test(ivHex) || !cipherPart) return null;
    if (authenticated && (!storedMac || !/^[0-9a-f]{64}$/.test(storedMac))) return null;
    const cipherBytes = base64.decode(cipherPart);
    if (!cipherBytes.length || cipherBytes.length % 16 !== 0) return null;
    const keyHex = await getOrCreateKey();
    const key = hexToBytes(keyHex);
    if (authenticated) {
      if (!storedMac) return null;
      const expectedMac = bytesToHex(hmac(sha256, key, new TextEncoder().encode(`${ivHex}:${cipherPart}`)));
      if (!constantTimeEqual(storedMac, expectedMac)) return null;
    }
    const iv = hexToBytes(ivHex);
    const decrypted = cbc(key, iv).decrypt(cipherBytes);
    // La lectura estricta conserva BOM y rechaza UTF-8 dañado, como antes.
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(decrypted);
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
