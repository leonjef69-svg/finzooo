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

export function saveJSON(key: string, value: unknown): void {
  encryptText(JSON.stringify(value))
    .then((encrypted) => AsyncStorage.setItem(key, encrypted))
    .catch(() => {
      // Si falla el guardado (ej. sin espacio), la app sigue funcionando
      // normalmente, solo que ese cambio no quedó guardado.
    });
}
