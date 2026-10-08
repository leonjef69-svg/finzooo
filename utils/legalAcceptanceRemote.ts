import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/utils/firebase";
import { getAccountStorageSession } from "@/utils/storage";
import { withTimeout } from "@/utils/withTimeout";

type Documents = { termsHash: string; privacyHash: string };
type Proof = { user: typeof auth.currentUser; session: number; documents: string; pending: Promise<void>; confirmedAt?: number };
const proofs = new Map<string, Proof>();
export function forgetLegalAcceptanceConfirmation(uid: string): void { proofs.delete(uid); }
/** Solo tras comprobar una elección local explícita; nunca aceptar al arrancar. */
export async function confirmLegalAcceptance(uid: string, documents: Documents): Promise<void> {
  const user = auth.currentUser, session = getAccountStorageSession();
  if (!user || user.uid !== uid || session === null) throw new Error("legal-account-changed");
  const current = () => {
    if (auth.currentUser !== user || getAccountStorageSession() !== session) throw new Error("legal-account-changed");
  };
  const version = `${documents.termsHash}:${documents.privacyHash}`, existing = proofs.get(uid);
  const age = existing?.confirmedAt === undefined ? undefined : Date.now() - existing.confirmedAt;
  if (existing?.user === user && existing.session === session && existing.documents === version
    && (age === undefined || (age >= 0 && age < 300000))) {
    await existing.pending; current(); return;
  }
  const proof: Proof = { user, session, documents: version, pending: Promise.resolve() };
  const pending = (async () => {
    current();
    const response = await withTimeout(httpsCallable(functions, "acceptLegalDocuments")({ ...documents, termsAccepted: true, privacyRead: true }));
    current();
    const value = response.data as Record<string, unknown> | null;
    if (!value || value.uid !== uid || value.format !== 1 || typeof value.version !== "string" || !value.version
      || value.termsHash !== documents.termsHash || value.privacyHash !== documents.privacyHash
      || value.termsAccepted !== true || value.privacyRead !== true
      || typeof value.acceptedAt !== "number" || !Number.isSafeInteger(value.acceptedAt) || value.acceptedAt <= 0) throw new Error("legal-invalid-response");
    if (proofs.get(uid) === proof) proof.confirmedAt = Date.now();
  })();
  proof.pending = pending;
  proofs.set(uid, proof);
  if (proofs.size > 32) proofs.delete(proofs.keys().next().value!);
  try { await pending; current(); }
  catch (error) { if (proofs.get(uid)?.pending === pending) proofs.delete(uid); throw error; }
}
