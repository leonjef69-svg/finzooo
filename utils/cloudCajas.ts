import { deleteDoc, doc, getDocFromServer, runTransaction } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { fusionarCajas, normalizarCajas, validarCajas, type DatosCajas } from "@/utils/cajas";
import { captureAccountTask } from "@/utils/accountTask";
import { hasUnreadableLocalData } from "@/utils/storage";

function documento(uid: string) {
  return doc(db, "cajas", uid);
}

export async function bajarCajas(uid: string): Promise<DatosCajas | null> {
  // Un fallo de permisos/red no demuestra que las Cajas estén vacías.
  const task = captureAccountTask(uid);
  const snap = await task.wait(() => getDocFromServer(documento(uid)));
  if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) throw new Error("cajas-unconfirmed");
  return snap.exists() ? validarCajas(snap.data()) : null;
}

export async function subirCajas(uid: string, datos: DatosCajas, onError?: (error: unknown) => void, onConfirmed?: (data: DatosCajas) => void): Promise<boolean> {
  const task = captureAccountTask(uid);
  try {
    if (hasUnreadableLocalData()) throw new Error("cajas-local-unreadable");
    const clean = validarCajas(JSON.parse(JSON.stringify(datos)));
    // La señal de una conversión incierta protege ESTE celular; no es una
    // edición monetaria ni un campo de la copia en Firebase.
    for (const box of clean.cajas) { delete box.sharingPending; delete box.sharingAttempt; }
    const ref = documento(uid);
    const saved = await task.wait(() => runTransaction(db, async (transaction) => {
      const snap = await task.wait(() => transaction.get(ref));
      const remoto = snap.exists()
        ? validarCajas(snap.data())
        : normalizarCajas(null);
      if (hasUnreadableLocalData()) throw new Error("cajas-local-unreadable");
      const merged = fusionarCajas(clean, remoto);
      for (const box of merged.cajas) { delete box.sharingPending; delete box.sharingAttempt; }
      transaction.set(ref, merged);
      return merged;
    }));
    onConfirmed?.(saved);
    return true;
  } catch (error) {
    if (task.current()) onError?.(error);
    return false;
  }
}

export async function borrarCajasDeLaNube(uid: string): Promise<void> {
  await deleteDoc(documento(uid));
}
