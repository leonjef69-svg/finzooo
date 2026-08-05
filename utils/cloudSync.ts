import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { isDecoyActive } from "@/utils/decoyMode";
import type { Goal, Transaction } from "@/types";

// EL CANDADO DE LA NUBE EN MODO SEÑUELO
//
// Con el señuelo encendido, esta app no habla con la nube. Ni sube ni baja.
// Los dos sentidos son igual de graves y por motivos opuestos:
//
//   SUBIR  → los movimientos inventados pisarían el respaldo real. Sería
//            perder los datos de verdad, para siempre, sin avisar. Es el
//            peor desenlace posible de toda esta función.
//   BAJAR  → traería los movimientos REALES desde la nube y los enseñaría
//            dentro del señuelo. O sea: el modo pensado para esconder los
//            datos acabaría revelándolos.
//
// El candado está aquí abajo, en la única puerta que da a Firestore, y no en
// cada sitio que llama. Hoy hay tres llamadas —la sincronización
// automática, la de cerrar sesión y la de entrar desde otro celular— pero lo
// que importa es la cuarta, la que alguien escriba dentro de seis meses sin
// acordarse de que este modo existe. Desde aquí no hace falta que se
// acuerde.

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
  // Nombre, color e imagen propios de cada categoria. Opcional: las cuentas
  // creadas antes de esto no lo tienen, y sin el "?" leerlas fallaria.
  categoryOverrides?: Record<string, { name?: string; color?: string; image?: string }>;
  // Las categorias que creo la persona. Opcional: las cuentas de antes de
  // esto no lo tienen, y sin el "?" leerlas fallaria.
  categoriasPropias?: {
    id: string;
    nombre: string;
    tipo: "expense" | "income";
    color: string;
    icono: string;
    image?: string;
  }[];
  // Meses cuyo "Saldo anterior" se muestra en cero, cada uno por separado
  // (claves "AAAA-MM"). Opcional: las cuentas creadas antes de esta
  // función no lo tienen guardado.
  carryoverCleared?: string[];
};

// Trae los datos guardados en la nube para esta cuenta (o "null" si esta
// cuenta nunca terminó de configurarse, o si no hay internet ahora mismo).
export async function loadCloudData(uid: string): Promise<CloudData | null> {
  // Ver el candado explicado arriba: bajar aquí enseñaría los datos reales.
  if (isDecoyActive()) return null;
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
      carryoverCleared: data.carryoverCleared || [],
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
  // Ver el candado explicado arriba: subir aquí borraría el respaldo real.
  if (isDecoyActive()) return Promise.resolve();
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
  // Desde el señuelo no se borra la cuenta de verdad. Requiere la
  // contraseña, que quien esté obligando a abrir la app no tiene, pero un
  // borrado irreversible no debería depender solo de eso.
  if (isDecoyActive()) throw new Error("No disponible");
  await deleteDoc(doc(db, "users", uid));
}
