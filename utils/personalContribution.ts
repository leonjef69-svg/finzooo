import { httpsCallable } from "firebase/functions";
import { functions } from "@/utils/firebase";

type SpaceKind = "family" | "box";

/** Las reducciones y borrados de aportes enlazados se validan en servidor. */
export async function actualizarAportePersonal(kind: SpaceKind, spaceId: string, movementId: string, amount: number, description: string): Promise<void> {
  await httpsCallable(functions, "changePersonalContribution")({ kind, spaceId, movementId, action: "update", amount, description });
}

export async function borrarAportePersonal(kind: SpaceKind, spaceId: string, movementId: string): Promise<void> {
  await httpsCallable(functions, "changePersonalContribution")({ kind, spaceId, movementId, action: "delete" });
}

export async function cerrarEspacioCompartido(kind: SpaceKind, spaceId: string): Promise<void> {
  await httpsCallable(functions, "manageLinkedSpace")({ kind, spaceId, action: "close" });
}

export async function prepararBorradoEspacioCompartido(kind: SpaceKind, spaceId: string): Promise<void> {
  await httpsCallable(functions, "manageLinkedSpace")({ kind, spaceId, action: "prepare-delete" });
}

export async function salirEspacioCompartido(kind: SpaceKind, spaceId: string, targetUid?: string): Promise<void> {
  await httpsCallable(functions, "leaveLinkedSpace")({ kind, spaceId, ...(targetUid ? { targetUid } : {}) });
}
