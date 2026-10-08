/** Adaptador de IO del recibo local. NO acredita callable/reglas publicados. */
import { auth } from "./firebase-local";
export function httpsCallable(_functions: unknown, name: string) {
  if (name !== "acceptLegalDocuments") throw new Error("unexpected-test-callable");
  return async (input: Record<string, unknown>) => ({ data: { ...input, uid: auth.currentUser?.uid,
    format: 1, version: "test-documents", acceptedAt: Date.now() } });
}
