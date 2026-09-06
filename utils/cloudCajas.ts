import { deleteDoc, doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { fusionarCajas, normalizarCajas, type DatosCajas } from "@/utils/cajas";

function documento(uid: string) {
  return doc(db, "cajas", uid);
}

export async function bajarCajas(uid: string): Promise<DatosCajas | null> {
  try {
    const snap = await getDoc(documento(uid));
    return snap.exists() ? normalizarCajas(snap.data() as Partial<DatosCajas>) : null;
  } catch {
    return null;
  }
}

export async function subirCajas(uid: string, datos: DatosCajas): Promise<boolean> {
  try {
    const ref = documento(uid);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      const remoto = snap.exists()
        ? normalizarCajas(snap.data() as Partial<DatosCajas>)
        : normalizarCajas(null);
      transaction.set(ref, fusionarCajas(datos, remoto));
    });
    return true;
  } catch {
    return false;
  }
}

export async function borrarCajasDeLaNube(uid: string): Promise<void> {
  await deleteDoc(documento(uid));
}
