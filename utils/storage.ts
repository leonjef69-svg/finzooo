import AsyncStorage from "@react-native-async-storage/async-storage";
import { decryptText, encryptText } from "@/utils/encryption";

export const STORAGE_KEYS = {
  profile: "finzo:profile",
  budgets: "finzo:budgets",
  categoryBudgets: "finzo:categoryBudgets",
  transactions: "finzo:transactions",
  goals: "finzo:goals",
  isPremium: "finzo:isPremium",
  themeMode: "finzo:themeMode",
  merchantLearned: "finzo:merchantLearned",
} as const;

// Borra todos los datos de la cuenta de golpe (operación atómica y
// esperada). themeMode se conserva porque es preferencia del dispositivo,
// no de la cuenta.
export async function clearAccountData(): Promise<void> {
  // Primero se descartan los guardados en cola: son de la sesión que se
  // está cerrando y, si llegaran después del borrado, volverían a escribir
  // en el celular los datos que acabamos de eliminar.
  discardPendingSaves();
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.profile,
      STORAGE_KEYS.budgets,
      STORAGE_KEYS.categoryBudgets,
      STORAGE_KEYS.transactions,
      STORAGE_KEYS.goals,
      STORAGE_KEYS.isPremium,
      STORAGE_KEYS.merchantLearned,
    ]);
  } catch {
    // Si falla el borrado, los saveJSON individuales de abajo sirven de
    // respaldo — la cuenta sigue sin datos relevantes.
  }
}

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    const decrypted = await decryptText(raw);
    if (decrypted != null) {
      return JSON.parse(decrypted) as T;
    }
    // Dato guardado antes de activar el cifrado: lo leemos tal cual por
    // esta vez (la próxima vez que se guarde, va a quedar cifrado).
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Guardados agrupados ("debounce") por clave.
//
// Por qué: cifrar es una operación pesada que corre en el mismo hilo que
// la interfaz — con AES sobre TODA la lista de movimientos. Antes, cada
// cambio de estado disparaba su guardado al instante, así que un solo
// toque podía provocar varios cifrados completos seguidos y la app se
// sentía trabada. Ahora los cambios que ocurren juntos se agrupan y se
// cifran UNA sola vez.
//
// El retardo es corto (400 ms) a propósito: suficiente para agrupar la
// ráfaga de cambios de una misma acción, pero lo bastante breve como para
// que un cierre normal de la app no alcance a perder nada. Para los casos
// donde sí hace falta certeza (cerrar sesión, borrar cuenta), existe
// flushPendingSaves() más abajo.
const DEBOUNCE_MS = 400;

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingValues = new Map<string, unknown>();

function writeNow(key: string, value: unknown): Promise<void> {
  return encryptText(JSON.stringify(value))
    .then((encrypted) => AsyncStorage.setItem(key, encrypted))
    .catch(() => {
      // Si falla el guardado (ej. sin espacio), la app sigue funcionando
      // normalmente, solo que ese cambio no quedó guardado.
    });
}

export function saveJSON(key: string, value: unknown): void {
  pendingValues.set(key, value);

  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);

  pendingTimers.set(
    key,
    setTimeout(() => {
      pendingTimers.delete(key);
      const pending = pendingValues.get(key);
      pendingValues.delete(key);
      writeNow(key, pending);
    }, DEBOUNCE_MS)
  );
}

// Escribe YA todo lo que estuviera esperando su turno, y espera a que
// termine. Se usa antes de acciones que no admiten perder nada a medias:
// cerrar sesión y eliminar la cuenta (ambas borran el almacenamiento
// justo después, así que un guardado pendiente llegaría tarde y
// reescribiría datos de la sesión anterior).
export async function flushPendingSaves(): Promise<void> {
  const writes: Promise<void>[] = [];
  for (const [key, timer] of pendingTimers) {
    clearTimeout(timer);
    const value = pendingValues.get(key);
    pendingValues.delete(key);
    writes.push(writeNow(key, value));
  }
  pendingTimers.clear();
  await Promise.all(writes);
}

// Cancela los guardados pendientes SIN escribirlos. Se usa al borrar los
// datos de la cuenta: lo que quedara en cola pertenece a la sesión que se
// está cerrando y volvería a escribir en disco lo que se acaba de borrar.
export function discardPendingSaves(): void {
  for (const timer of pendingTimers.values()) clearTimeout(timer);
  pendingTimers.clear();
  pendingValues.clear();
}
