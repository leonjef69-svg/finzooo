// BLOQUEO DE LA APP
//
// Huella, cara, o un PIN de respaldo. Todo lo de esta función vive SOLO en
// este celular, en el cajón cifrado del sistema (expo-secure-store), y a
// propósito no se sincroniza con la nube.
//
// La razón es concreta: si el interruptor viajara a la nube, al entrar en un
// celular nuevo la app aparecería bloqueada pero sin PIN guardado en ese
// aparato — o sea, cerrada por dentro y sin llave. El bloqueo protege un
// dispositivo, así que se configura por dispositivo.
//
// El PIN nunca se guarda tal cual. Se guarda su huella digital matemática
// (SHA-256) mezclada con un número al azar propio de esta instalación. Con
// eso se puede comprobar si un PIN es correcto, pero de lo guardado no se
// puede volver al PIN — ni siquiera teniendo el teléfono en la mano.

import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const KEY_ENABLED = "finzo.lock.enabled";
const KEY_HASH = "finzo.lock.hash";
const KEY_SALT = "finzo.lock.salt";
// El PIN señuelo. El nombre de la clave es a propósito anodino: quien mire
// el cajón cifrado con herramientas no debería poder deducir de un vistazo
// que existe un segundo PIN, y menos aún cuál de los dos es el de verdad.
const KEY_DECOY = "finzo.lock.alt";

export const PIN_LENGTH = 4;

/** Qué tipo de biometría tiene este celular, para nombrarla bien en pantalla. */
export type BiometricKind = "fingerprint" | "face" | "iris" | "none";

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Sin cajón cifrado no hay bloqueo posible; quien llama comprueba el
    // resultado leyendo de nuevo, así que un fallo aquí acaba en "no se
    // pudo activar" y no en un bloqueo a medias.
  }
}

async function remove(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ídem.
  }
}

/**
 * Qué biometría hay disponible AHORA.
 *
 * Son dos preguntas distintas y las dos importan: si el aparato tiene lector
 * (`hasHardware`) y si la persona ha registrado alguna huella o cara
 * (`isEnrolled`). Un celular con lector pero sin huellas registradas no
 * puede desbloquear nada, y ofrecerlo sería mandar a un callejón sin salida.
 */
export async function biometricKind(): Promise<BiometricKind> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware || !isEnrolled) return "none";

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "face";
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return "iris";
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "fingerprint";
    return "none";
  } catch {
    return "none";
  }
}

/**
 * Pide la huella o la cara.
 *
 * `disableDeviceFallback` en true a propósito: si fallara al PIN del celular,
 * el PIN de respaldo de Finzo no serviría para nada. Aquí la única
 * alternativa es el PIN propio, que es lo que se pidió.
 */
export async function promptBiometrics(reason: string, cancelLabel: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel,
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function isLockEnabled(): Promise<boolean> {
  return (await read(KEY_ENABLED)) === "1";
}

export async function hasPin(): Promise<boolean> {
  return (await read(KEY_HASH)) !== null;
}

/** Convierte un PIN en la huella matemática que sí se puede guardar. */
async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

/**
 * Guarda un PIN nuevo y enciende el bloqueo.
 *
 * Devuelve false si el cajón cifrado no aceptó la escritura: mejor decir que
 * no se pudo activar que dejarlo activado a medias, que sería la única forma
 * de quedarse fuera de verdad.
 */
export async function enableLock(pin: string): Promise<boolean> {
  if (pin.length !== PIN_LENGTH) return false;
  // Un número al azar por instalación. Con esto, dos personas con el mismo
  // PIN no comparten la huella guardada.
  const salt = Crypto.randomUUID();
  const hash = await hashPin(pin, salt);

  await write(KEY_SALT, salt);
  await write(KEY_HASH, hash);
  await write(KEY_ENABLED, "1");

  // Se comprueba leyendo de vuelta: si algo del cajón cifrado falló, esto
  // devuelve false y la pantalla no dice que quedó activado.
  return (await isLockEnabled()) && (await hasPin());
}

/** Apaga el bloqueo y borra los dos PIN. */
export async function disableLock(): Promise<void> {
  await remove(KEY_ENABLED);
  await remove(KEY_HASH);
  await remove(KEY_SALT);
  await remove(KEY_DECOY);
}

/** ¿Hay un PIN señuelo configurado? */
export async function hasDecoyPin(): Promise<boolean> {
  return (await read(KEY_DECOY)) !== null;
}

/**
 * Guarda el PIN señuelo. Comparte la misma sal que el de verdad, así que
 * de lo guardado tampoco se puede volver al PIN.
 *
 * Devuelve false si es igual al PIN real: entonces no habría señuelo
 * ninguno, solo la falsa sensación de tenerlo.
 */
export async function setDecoyPin(pin: string): Promise<boolean> {
  if (pin.length !== PIN_LENGTH) return false;
  const salt = await read(KEY_SALT);
  if (!salt) return false;
  const hash = await hashPin(pin, salt);
  if (hash === (await read(KEY_HASH))) return false;
  await write(KEY_DECOY, hash);
  return (await read(KEY_DECOY)) === hash;
}

export async function clearDecoyPin(): Promise<void> {
  await remove(KEY_DECOY);
}

/** Cuál de los dos PIN se escribió, si alguno. */
export type PinMatch = "real" | "decoy" | null;

/**
 * Comprueba el PIN y dice CUÁL era.
 *
 * El real se mira primero. Si por un descuido al configurarlo los dos
 * acabaran siendo el mismo, gana el de verdad: quedarse encerrado fuera de
 * los datos propios sería peor que quedarse sin señuelo.
 */
export async function verifyPin(pin: string): Promise<PinMatch> {
  const [hash, salt, decoy] = await Promise.all([
    read(KEY_HASH),
    read(KEY_SALT),
    read(KEY_DECOY),
  ]);
  if (!salt) return null;
  const attempt = await hashPin(pin, salt);
  if (hash && attempt === hash) return "real";
  if (decoy && attempt === decoy) return "decoy";
  return null;
}
