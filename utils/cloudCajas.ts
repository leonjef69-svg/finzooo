import { deleteDoc, doc, getDocFromServer, runTransaction } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { cajaNombreCoincide, fusionarCajas, normalizarCajas, validarCajas, type DatosCajas, type RevisionNombreCaja } from "@/utils/cajas";
import { captureAccountTask } from "@/utils/accountTask";
import { hasUnreadableLocalData } from "@/utils/storage";

function documento(uid: string) {
  return doc(db, "cajas", uid);
}

/** Conserva la fuente remota para una revisión; no autoriza sobrescribirla. */
export class CloudCajasConflictError extends Error {
  constructor(public readonly cajaRemota: DatosCajas) { super("cajas-sync-conflict"); }
}
function servidor(value: unknown): DatosCajas {
  const data = validarCajas(value);
  if (data.revisionesNombre) throw new Error("cajas-invalid-data");
  return data;
}

export async function bajarCajas(uid: string): Promise<DatosCajas | null> {
  // Un fallo de permisos/red no demuestra que las Cajas estén vacías.
  const task = captureAccountTask(uid);
  const snap = await task.wait(() => getDocFromServer(documento(uid)));
  if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) throw new Error("cajas-unconfirmed");
  return snap.exists() ? servidor(snap.data()) : null;
}

export async function subirCajas(uid: string, datos: DatosCajas, onError?: (error: unknown) => void, onConfirmed?: (data: DatosCajas) => void): Promise<boolean> {
  const task = captureAccountTask(uid);
  try {
    if (hasUnreadableLocalData()) throw new Error("cajas-local-unreadable");
    const clean = validarCajas(JSON.parse(JSON.stringify(datos)));
    delete clean.revisionesNombre;
    // La señal de una conversión incierta protege ESTE celular; no es una
    // edición monetaria ni un campo de la copia en Firebase.
    for (const box of clean.cajas) { delete box.sharingPending; delete box.sharingAttempt; }
    const ref = documento(uid);
    const saved = await task.wait(() => runTransaction(db, async (transaction) => {
      const snap = await task.wait(() => transaction.get(ref));
      const remoto = snap.exists()
        ? servidor(snap.data())
        : normalizarCajas(null);
      if (hasUnreadableLocalData()) throw new Error("cajas-local-unreadable");
      let merged: DatosCajas;
      try { merged = fusionarCajas(clean, remoto); }
      catch (error) { if ((error as { message?: string })?.message === "cajas-sync-conflict") throw new CloudCajasConflictError(remoto); throw error; }
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

/** Modifica SOLO el nombre confirmado, sin fusionar ni reemplazar movimientos. */
export async function resolverNombreCaja(uid: string, entry: RevisionNombreCaja): Promise<CajaNameAck> {
  const task = captureAccountTask(uid);
  validarCajas({ ...normalizarCajas(null), revisionesNombre: [entry] });
  if (entry.uid !== uid || hasUnreadableLocalData()) throw new Error("cajas-name-changed");
  return task.wait(() => runTransaction(db, async transaction => {
    const ref = documento(uid), snap = await task.wait(() => transaction.get(ref));
    if (!snap.exists() || hasUnreadableLocalData()) throw new Error("cajas-name-changed");
    const actual = servidor(snap.data()), box = actual.cajas.find(box => box.id === entry.boxId);
    if (!box || actual.cajasBorradas.includes(entry.boxId) || actual.conversiones?.[entry.boxId]) throw new Error("cajas-name-changed");
    if (cajaNombreCoincide(box, entry.elegido)) return { uid, id: entry.id, boxId: entry.boxId, nombre: box.nombre, version: box.updatedAt! };
    if (!cajaNombreCoincide(box, entry.remoto)) throw new Error("cajas-name-changed");
    // update conserva también campos de futuras versiones que este cliente
    // no reconoce. No reescribe movimientos, borrados ni confirmaciones.
    transaction.update(ref, { syncFormat: actual.syncFormat === 3 ? 3 : 2,
      cajas: actual.cajas.map(item => item.id === entry.boxId ? { ...item, nombre: entry.elegido.nombre, updatedAt: entry.elegido.updatedAt } : item) });
    return { uid, id: entry.id, boxId: entry.boxId, nombre: entry.elegido.nombre, version: entry.elegido.updatedAt! };
  }));
}

export type CajaNameAck = { uid: string; id: string; boxId: string; nombre: string; version: number };

export async function borrarCajasDeLaNube(uid: string): Promise<void> {
  await deleteDoc(documento(uid));
}
