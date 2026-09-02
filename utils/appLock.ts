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
// Clave de una función retirada. Se elimina al actualizar o apagar el
// bloqueo para que no quede información obsoleta en el cajón cifrado.
const KEY_LEGACY_ALTERNATE_PIN = "finzo.lock.alt";
const KEY_FAILED_ATTEMPTS = "finzo.lock.failedAttempts";
const KEY_LOCK_UNTIL = "finzo.lock.lockUntil";

export const PIN_LENGTH = 4;

/**
 * Cuánto puede estar la app fuera antes de volver a pedir la huella.
 *
 * No es cero a propósito. La app manda a Android a otras pantallas como parte
 * de su funcionamiento normal —la cámara al escanear, el micrófono, el
 * selector de archivos— y sobre todo: se sale a Yape y se vuelve.
 *
 * Estaba en 30 segundos y se quedaba corto justo ahí. Hacer un yapeo tarda
 * más, así que al volver pedía la huella SIEMPRE. Subido a 2 minutos a
 * petición del usuario el 02/08/2026: cubre salir a Yape, contestar un
 * WhatsApp o mirar algo, y sigue bloqueando el celular olvidado en una mesa.
 */
export const GRACE_MS = 120_000;

// A qué hora se salió de la app. Se guarda EN DISCO, no solo en memoria, y el
// porqué está en recordarSalida().
const KEY_LEFT_AT = "finzo.lock.leftAt";

/**
 * Apunta que la app se va al fondo.
 *
 * VA A DISCO, Y ESA ES TODA LA GRACIA.
 *
 * Guardarlo solo en memoria bastaba mientras Android dejara viva la app. Pero
 * hay marcas —Honor, Huawei, Xiaomi— que la matan a los pocos segundos de
 * mandarla al fondo. Entonces volver no es "volver": es abrir desde cero, con
 * la memoria en blanco, y la app bloqueaba SIEMPRE aunque hubieran pasado
 * veinte segundos.
 *
 * Ese era el motivo de verdad de que pidiera la huella cada vez.
 */
export async function recordarSalida(): Promise<void> {
  await write(KEY_LEFT_AT, String(Date.now()));
}

export async function olvidarSalida(): Promise<void> {
  await remove(KEY_LEFT_AT);
}

/**
 * ¿Se salió hace tan poco que no hace falta volver a pedir la huella?
 *
 * ANTE LA DUDA, SE BLOQUEA. Si no hay nada guardado, si no se puede leer, o
 * si el número no tiene sentido, devuelve false. Un fallo aquí tiene que
 * dejar la app cerrada, nunca abierta.
 */
export async function salioHaceNada(): Promise<boolean> {
  try {
    const guardado = await read(KEY_LEFT_AT);
    if (!guardado) return false;
    const cuando = Number(guardado);
    if (!Number.isFinite(cuando)) return false;

    const pasado = Date.now() - cuando;
    // El negativo importa: si alguien atrasa el reloj del celular, "pasado"
    // sale negativo y sin esta comprobación pasaría por reciente para
    // siempre. Se exige que esté entre cero y el margen.
    return pasado >= 0 && pasado <= GRACE_MS;
  } catch {
    return false;
  }
}

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
 * el PIN de respaldo de Fino no serviría para nada. Aquí la única
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
  void remove(KEY_LEGACY_ALTERNATE_PIN);
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

/** Apaga el bloqueo y borra el PIN. */
export async function disableLock(): Promise<void> {
  await remove(KEY_ENABLED);
  await remove(KEY_HASH);
  await remove(KEY_SALT);
  await remove(KEY_LEGACY_ALTERNATE_PIN);
  await remove(KEY_FAILED_ATTEMPTS);
  await remove(KEY_LOCK_UNTIL);
}

export type PinMatch = "real" | "locked" | null;

export async function pinRetryAfterMs(now = Date.now()): Promise<number> {
  const until = Number(await read(KEY_LOCK_UNTIL));
  return Number.isFinite(until) ? Math.max(0, until - now) : 0;
}

async function clearPinFailures() {
  await remove(KEY_FAILED_ATTEMPTS);
  await remove(KEY_LOCK_UNTIL);
}

async function recordPinFailure(now = Date.now()) {
  const previous = Number(await read(KEY_FAILED_ATTEMPTS));
  const failures = Number.isFinite(previous) ? previous + 1 : 1;
  await write(KEY_FAILED_ATTEMPTS, String(failures));
  if (failures >= 5) {
    // Crece con los intentos: 30 s, 60 s, 2 min... con tope de 15 min.
    const delay = Math.min(15 * 60_000, 30_000 * 2 ** Math.min(5, failures - 5));
    await write(KEY_LOCK_UNTIL, String(now + delay));
    return true;
  }
  return false;
}

/** Comprueba el PIN real y aplica el bloqueo progresivo tras varios fallos. */
export async function verifyPin(pin: string): Promise<PinMatch> {
  if ((await pinRetryAfterMs()) > 0) return "locked";
  const [hash, salt] = await Promise.all([
    read(KEY_HASH),
    read(KEY_SALT),
  ]);
  if (!salt) return null;
  const attempt = await hashPin(pin, salt);
  if (hash && attempt === hash) {
    await clearPinFailures();
    return "real";
  }
  if (await recordPinFailure()) return "locked";
  return null;
}

/**
 * ¿SE USA LA HUELLA, O SOLO EL PIN? (19/08/2026)
 *
 * Hasta hoy no se preguntaba: si el celular tenía huella, se usaba. Y la pantalla se llamaba
 * *"Bloqueo con huella"* aunque lo primero que hacía al encenderla era pedir un PIN. Él lo
 * dijo tal cual: *"te falta la opción PIN, tienes que agregarle un botón; no es que
 * automáticamente seleccione huella y a fuerza tenga que poner un código PIN"*.
 *
 * **El PIN sigue haciendo falta siempre, y eso no es un capricho:** una huella falla —con el
 * dedo mojado, con una funda, cuando el sensor se raya— y sin nada detrás la persona se
 * queda fuera de su propio dinero. Lo que sí se puede elegir es si la huella se usa o si se
 * entra siempre con el PIN. Eso es lo que guarda esto.
 *
 * Por defecto **sí**, que es como se comportaba hasta ahora: nadie tiene que ir a encender
 * algo para que su app siga funcionando igual que ayer.
 */
const KEY_HUELLA = "finzo:lock:usaHuella";

export async function usaHuella(): Promise<boolean> {
  return (await read(KEY_HUELLA)) !== "0";
}

export async function guardarUsaHuella(valor: boolean): Promise<void> {
  await write(KEY_HUELLA, valor ? "1" : "0");
}
