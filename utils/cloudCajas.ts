import { deleteDoc, doc, getDocFromServer, runTransaction } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { cajaNombreCoincide, copiaPrivadaCoincide, fusionarCajasProtegidas, normalizarCajas, validarCajas, type Caja, type MovimientoCaja, type DatosCajas, type RevisionNombreCaja } from "@/utils/cajas";
import { captureAccountTask } from "@/utils/accountTask";
import { hasUnreadableLocalData } from "@/utils/storage";
import { privateBoxCloudResponseCurrent, withPrivateBoxCloudOperation } from "@/utils/privateBoxSync";

// Una sola referencia, sin disco ni consultas nuevas. Es una pista para elegir
// la ruta rápida; begin SIEMPRE vuelve a verificar el origen en el servidor.
let ultimaCopiaConfirmada: { uid: string; data: DatosCajas; protegidas: readonly string[] } | null = null;
export function origenCajaConfirmado(uid: string, caja: Caja, movimientos: MovimientoCaja[]): boolean {
  const copy = ultimaCopiaConfirmada;
  if (!copy || copy.uid !== uid || !privateBoxCloudResponseCurrent(uid, copy.data)) {
    ultimaCopiaConfirmada = null;
    return false;
  }
  return !copy.protegidas.includes(caja.id) && copiaPrivadaCoincide(caja, movimientos, copy.data);
}

function documento(uid: string) {
  return doc(db, "cajas", uid);
}

/** Conserva la fuente remota para una revisión; no autoriza sobrescribirla. */
export class CloudCajasConflictError extends Error {
  constructor(public readonly cajaRemota: DatosCajas) { super("cajas-sync-conflict"); }
}
function servidor(value: unknown): DatosCajas {
  const data = validarCajas(value);
  if (data.revisionesNombre || data.revisionesImporte) throw new Error("cajas-invalid-data");
  return data;
}

export async function bajarCajas(uid: string): Promise<DatosCajas | null> {
  // Un fallo de permisos/red no demuestra que las Cajas estén vacías.
  return withPrivateBoxCloudOperation(uid, async lease => {
  const task = captureAccountTask(uid);
  const snap = await task.wait(() => getDocFromServer(documento(uid)));
  if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) throw new Error("cajas-unconfirmed");
  const data = snap.exists() ? lease.remember(servidor(snap.data())) : null;
  ultimaCopiaConfirmada = data ? { uid, data, protegidas: [] } : null;
  return data;
  });
}

export async function subirCajas(uid: string, datos: DatosCajas, onError?: (error: unknown) => void, onConfirmed?: (data: DatosCajas) => void, cajasProtegidas: readonly string[] = [], current: () => boolean = () => true): Promise<boolean> {
  const task = captureAccountTask(uid, current);
  try {
    return await withPrivateBoxCloudOperation(uid, async lease => {
    if (!task.current()) throw new Error("cloud-copy-paused");
    if (hasUnreadableLocalData()) throw new Error("cajas-local-unreadable");
    const clean = validarCajas(JSON.parse(JSON.stringify(datos)));
    if (clean.revisionesImporte?.some(entry => entry.estado === "pendiente")) throw new Error("cajas-sync-conflict");
    delete clean.revisionesNombre;
    delete clean.revisionesImporte;
    // La señal de una conversión incierta protege ESTE celular; no es una
    // edición monetaria ni un campo de la copia en Firebase.
    for (const box of clean.cajas) { delete box.sharingPending; delete box.sharingAttempt; delete box.archivadaLocal; }
    const ref = documento(uid);
    const saved = await task.wait(() => runTransaction(db, async (transaction) => {
      const snap = await task.wait(() => transaction.get(ref));
      const remoto = snap.exists()
        ? servidor(snap.data())
        : normalizarCajas(null);
      if (hasUnreadableLocalData()) throw new Error("cajas-local-unreadable");
      let merged: { local: DatosCajas; remoto: DatosCajas };
      try { merged = fusionarCajasProtegidas(clean, remoto, cajasProtegidas); }
      catch (error) { if ((error as { message?: string })?.message === "cajas-sync-conflict") throw new CloudCajasConflictError(remoto); throw error; }
      // Las fuentes protegidas del servidor se conservan tal como estaban.
      for (const box of merged.remoto.cajas) {
        if (!cajasProtegidas.includes(box.id)) { delete box.sharingPending; delete box.sharingAttempt; }
      }
      lease.assertCurrent();
      if (!task.current()) throw new Error("cloud-copy-paused");
      transaction.set(ref, merged.remoto);
      return merged.local;
    }));
    lease.remember(saved);
    ultimaCopiaConfirmada = { uid, data: saved, protegidas: [...cajasProtegidas] };
    onConfirmed?.(saved);
    return true;
    });
  } catch (error) {
    if (task.current()) onError?.(error);
    return false;
  }
}

/** Modifica SOLO el nombre confirmado, sin fusionar ni reemplazar movimientos. */
export async function resolverNombreCaja(uid: string, entry: RevisionNombreCaja): Promise<CajaNameAck> {
  return withPrivateBoxCloudOperation(uid, async lease => {
  const task = captureAccountTask(uid);
  validarCajas({ ...normalizarCajas(null), revisionesNombre: [entry] });
  if (entry.uid !== uid || hasUnreadableLocalData()) throw new Error("cajas-name-changed");
  return lease.wait(() => task.wait(() => runTransaction(db, async transaction => {
    const ref = documento(uid), snap = await task.wait(() => transaction.get(ref));
    if (!snap.exists() || hasUnreadableLocalData()) throw new Error("cajas-name-changed");
    const actual = servidor(snap.data()), box = actual.cajas.find(box => box.id === entry.boxId);
    if (!box || actual.cajasBorradas.includes(entry.boxId) || actual.conversiones?.[entry.boxId]) throw new Error("cajas-name-changed");
    if (cajaNombreCoincide(box, entry.elegido)) return { uid, id: entry.id, boxId: entry.boxId, nombre: box.nombre, version: box.updatedAt! };
    if (!cajaNombreCoincide(box, entry.remoto)) throw new Error("cajas-name-changed");
    // update conserva también campos de futuras versiones que este cliente
    // no reconoce. No reescribe movimientos, borrados ni confirmaciones.
    lease.assertCurrent();
    transaction.update(ref, { syncFormat: actual.syncFormat === 3 ? 3 : 2,
      cajas: actual.cajas.map(item => item.id === entry.boxId ? { ...item, nombre: entry.elegido.nombre, updatedAt: entry.elegido.updatedAt } : item) });
    return { uid, id: entry.id, boxId: entry.boxId, nombre: entry.elegido.nombre, version: entry.elegido.updatedAt! };
  })));
  });
}

export type CajaNameAck = { uid: string; id: string; boxId: string; nombre: string; version: number };

export async function borrarCajasDeLaNube(uid: string): Promise<void> {
  await deleteDoc(documento(uid));
}
