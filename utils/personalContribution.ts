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
