import { httpsCallable } from "firebase/functions";
import { collection, doc } from "firebase/firestore";
import { auth, db, functions } from "@/utils/firebase";
import { captureAccountTask } from "@/utils/accountTask";
import { getAccountStorageSession } from "@/utils/storage";
import type { MovimientoFamilia } from "@/utils/cloudFamilia";

type Movement = Omit<MovimientoFamilia, "id" | "creadoEn" | "creadoPor">;
type Receipt = { movementId: string; createdAt: number };
// Una respuesta perdida conserva el ID para el reintento en esta sesión.
// Se incluye la sesión local para no reutilizar órdenes de una cuenta anterior.
const attempts = new Map<string, string>();

export async function guardarMovimientoCompartido(kind: "family" | "box", spaceId: string, uid: string, movement: Movement): Promise<string> {
  const task = captureAccountTask(uid);
  const key = JSON.stringify([uid, getAccountStorageSession(), kind, spaceId, movement]);
  const movementId = attempts.get(key) ?? doc(collection(db, kind === "family" ? "familySpaces" : "boxSpaces", spaceId, "movements")).id;
  attempts.set(key, movementId);
  try {
    const response = await task.wait(() => httpsCallable<unknown, Receipt>(functions, "mutateSharedMovement")({ kind, spaceId, movementId, action: "create", movement }));
    if (response.data.movementId !== movementId || !Number.isFinite(response.data.createdAt)) throw new Error("shared-invalid-response");
    attempts.delete(key);
    return movementId;
  } catch (error) {
    const reason = (error as { details?: { reason?: unknown } })?.details?.reason;
    if (typeof reason === "string") attempts.delete(key); // Rechazo definitivo, no pérdida de conexión.
    throw error;
  }
}

export async function borrarMovimientoCompartido(kind: "family" | "box", spaceId: string, movementId: string): Promise<void> {
  const task = captureAccountTask(auth.currentUser?.uid ?? "");
  await task.wait(() => httpsCallable(functions, "mutateSharedMovement")({ kind, spaceId, movementId, action: "delete" }));
}
