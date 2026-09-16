import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/utils/firebase";
import {
  TESTER_PREMIUM_INACTIVE,
  testerPremiumFromData,
  type TesterPremiumState,
} from "@/utils/testerPremiumState";

/** Escucha testerPremium/{uid}. No expone ninguna operación de escritura al cliente. */
export function subscribeTesterPremium(uid: string, onChange: (state: TesterPremiumState) => void) {
  return onSnapshot(
    doc(db, "testerPremium", uid),
    { includeMetadataChanges: true },
    (snapshot) => onChange(
      snapshot.exists()
        ? testerPremiumFromData(snapshot.data(), snapshot.metadata.fromCache)
        : TESTER_PREMIUM_INACTIVE,
    ),
    () => onChange(TESTER_PREMIUM_INACTIVE),
  );
}
