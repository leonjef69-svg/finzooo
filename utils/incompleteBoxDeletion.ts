import { httpsCallable } from "firebase/functions";
import { functions } from "@/utils/firebase";
import { captureAccountTask } from "@/utils/accountTask";

/** Sin Pro, sin descargar clones/historial y solo para la cuenta vigente. */
export async function prepararBorradoConversionesCaja(uid: string, action: "inspect" | "discard"): Promise<void> {
  const task = captureAccountTask(uid);
  const reply = await task.wait(() => httpsCallable(functions, "prepareIncompleteBoxDeletion", { timeout: 550_000 })({ action }));
  const value = reply.data as { ok?: unknown; uid?: unknown };
  if (value?.ok !== true || value.uid !== uid) throw new Error("incomplete-box-invalid-response");
}
