import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/utils/firebase";
import type { CreditBackupV1 } from "@/utils/creditStore";

const COLLECTION = "creditCards";

function currentUid() {
  const user = auth.currentUser;
  return user?.emailVerified ? user.uid : null;
}

export async function loadCreditCloudBackup(): Promise<CreditBackupV1 | null> {
  const uid = currentUid();
  if (!uid) return null;
  try {
    const snapshot = await getDoc(doc(db, COLLECTION, uid));
    if (!snapshot.exists()) return null;
    const backup = snapshot.data()?.backup as CreditBackupV1 | undefined;
    return backup?.version === 1 ? backup : null;
  } catch {
    return null;
  }
}

export async function saveCreditCloudBackup(backup: CreditBackupV1) {
  const uid = currentUid();
  if (!uid) return false;
  try {
    await setDoc(doc(db, COLLECTION, uid), {
      backup: JSON.parse(JSON.stringify(backup)),
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteCreditCloudAccount(uid: string) {
  await deleteDoc(doc(db, COLLECTION, uid));
}
