import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/utils/firebase";
import type { Goal, Transaction } from "@/types";

export type CloudData = {
  hasOnboarded: boolean;
  userName: string;
  userPhoto: string | null;
  userCurrency: string;
  userLanguage: string;
  budgets: Record<string, number>;
  categoryBudgets: Record<string, number>;
  transactions: Transaction[];
  goals: Goal[];
  isPremium: boolean;
  // Lo que la persona le enseñó al clasificador: "este comercio va en
  // esta categoría". Opcional para no romper cuentas viejas que no lo
  // tienen guardado todavía.
  merchantLearned?: Record<string, string>;
  // Mes desde el cual cuenta el "Saldo anterior" (formato "AAAA-MM").
  // Vacío o ausente = se cuenta todo el historial. Opcional por lo mismo:
  // las cuentas creadas antes de esta función no lo tienen guardado.
  carryoverFrom?: string;
};

// Trae los datos guardados en la nube para esta cuenta (o "null" si esta
// cuenta nunca terminó de configurarse, o si no hay internet ahora mismo).
export async function loadCloudData(uid: string): Promise<CloudData | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data?.hasOnboarded) return null;
    return {
      hasOnboarded: true,
      userName: data.userName || "",
      userPhoto: data.userPhoto || null,
      userCurrency: data.userCurrency || "PEN",
      userLanguage: data.userLanguage || "es",
      budgets: data.budgets || {},
      categoryBudgets: data.categoryBudgets || {},
      transactions: data.transactions || [],
      goals: data.goals || [],
      isPremium: !!data.isPremium,
      merchantLearned: data.merchantLearned || {},
      carryoverFrom: data.carryoverFrom || "",
    };
  } catch {
    return null;
  }
}

// Sube los datos actuales a la nube. Si no hay internet, falla en
// silencio — los datos ya están a salvo en este celular y se van a
// intentar subir de nuevo la próxima vez que algo cambie. Devuelve la
// promesa por si quien la llama necesita esperar a que termine (por
// ejemplo, antes de cerrar sesión) en vez de solo "lanzarla y olvidarla".
export function saveCloudData(uid: string, data: CloudData): Promise<void> {
  // Firestore RECHAZA cualquier campo cuyo valor sea "undefined" y tira el
  // guardado entero. Como los movimientos ahora tienen campos opcionales
  // (comercio, cuenta, referencia...), uno vacío podría hacer que la copia
  // en la nube fallara en silencio y la persona nunca se enterara.
  // Este paso los quita: JSON.stringify descarta las claves con undefined.
  const clean = JSON.parse(JSON.stringify(data)) as CloudData;
  return setDoc(doc(db, "users", uid), clean).catch(() => {});
}

// Borra por completo el documento de esta cuenta en la nube (se usa al
// eliminar la cuenta — a diferencia de "saveCloudData", aquí SÍ hace
// falta saber si funcionó, porque no queremos borrar la cuenta de
// inicio de sesión si sus datos no se pudieron borrar primero.
export async function deleteCloudAccount(uid: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid));
}
