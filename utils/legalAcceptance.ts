import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { PRIVACY_POLICY, TERMS_AND_CONDITIONS } from "@/constants/legal";
import { decryptText, encryptText } from "@/utils/encryption";
import { auth } from "@/utils/firebase";
import { getAccountStorageSession } from "@/utils/storage";

const PREFIX = "finzo:legalAcceptance:v1:";
type Receipt = { format: 1; uid: string; termsHash: string; privacyHash: string;
  termsAccepted: true; privacyRead: true; acceptedAt: number };
const operations = new Map<string, Promise<unknown>>();
const closing = new Set<string>();
const listeners = new Set<(uid: string) => void>();
let documentHashes: Promise<{ termsHash: string; privacyHash: string }> | undefined;

function receiptKey(uid: string) {
  if (!uid || uid.length > 128) throw new Error("legal-account-invalid");
  return `${PREFIX}${encodeURIComponent(uid)}`;
}
function hashes() {
  documentHashes ??= Promise.all([
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, TERMS_AND_CONDITIONS),
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, PRIVACY_POLICY),
  ]).then(([termsHash, privacyHash]) => {
    if (!/^[a-f\d]{64}$/.test(termsHash) || !/^[a-f\d]{64}$/.test(privacyHash)) throw new Error("legal-hash-invalid");
    return { termsHash, privacyHash };
  }).catch(error => { documentHashes = undefined; throw error; });
  return documentHashes;
}
function enqueue<T>(uid: string, work: () => Promise<T>): Promise<T> {
  const previous = operations.get(uid) ?? Promise.resolve();
  const result = previous.then(work, work);
  const settled = result.then(() => undefined, () => undefined);
  operations.set(uid, settled);
  void settled.then(() => { if (operations.get(uid) === settled) operations.delete(uid); });
  return result;
}
function accountCheck(uid: string) {
  const user = auth.currentUser, session = getAccountStorageSession();
  if (!user || user.uid !== uid || closing.has(uid)) throw new Error("legal-account-changed");
  return () => {
    if (auth.currentUser !== user || auth.currentUser.uid !== uid || closing.has(uid)
      || getAccountStorageSession() !== session) throw new Error("legal-account-changed");
  };
}
function notify(uid: string) {
  for (const listener of listeners) {
    try { listener(uid); } catch { /* Un aviso de pantalla no invalida el guardado. */ }
  }
}
export function subscribeLegalAcceptance(listener: (uid: string) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Evidencia local de una elección, no consentimiento jurídico ni recibo del servidor. */
export async function hasAcceptedLegalDocuments(uid: string): Promise<boolean> {
  const key = receiptKey(uid), check = accountCheck(uid);
  return enqueue(uid, async () => {
    check();
    const raw = await AsyncStorage.getItem(key); check();
    if (raw === null) return false;
    // Este registro es nuevo: no admitir el cifrado heredado sin HMAC que
    // se conserva únicamente para recuperar datos financieros antiguos.
    if (raw.length > 4096 || !raw.startsWith("v2:")) throw new Error("legal-receipt-invalid");
    const text = await decryptText(raw); check();
    if (!text) throw new Error("legal-receipt-invalid");
    const receipt: Receipt = JSON.parse(text);
    if (!receipt || receipt.format !== 1 || receipt.uid !== uid || receipt.termsAccepted !== true || receipt.privacyRead !== true
      || !Number.isSafeInteger(receipt.acceptedAt) || receipt.acceptedAt < 0
      || !/^[a-f\d]{64}$/.test(receipt.termsHash) || !/^[a-f\d]{64}$/.test(receipt.privacyHash)) throw new Error("legal-receipt-invalid");
    const expected = await hashes(); check();
    return receipt.termsHash === expected.termsHash && receipt.privacyHash === expected.privacyHash;
  });
}

/** Solo llamar después de la casilla explícita; nunca desde un efecto de arranque. */
export async function recordLegalAcceptanceForCurrentAccount(): Promise<void> {
  const uid = auth.currentUser?.uid ?? "", key = receiptKey(uid), check = accountCheck(uid);
  return enqueue(uid, async () => {
    check();
    const documents = await hashes(); check();
    const receipt: Receipt = { format: 1, uid, ...documents, termsAccepted: true, privacyRead: true, acceptedAt: Date.now() };
    const encrypted = await encryptText(JSON.stringify(receipt)); check();
    await AsyncStorage.setItem(key, encrypted); check();
    if (await AsyncStorage.getItem(key) !== encrypted) throw new Error("legal-save-failed");
    check(); notify(uid);
  });
}

/** No cierra/borra datos ni exige Pro; únicamente protege altas de contenido. */
export async function assertSharedContentAccepted(uid = auth.currentUser?.uid ?? ""): Promise<void> {
  if (!await hasAcceptedLegalDocuments(uid)) throw new Error("legal-acceptance-required");
}

export async function deleteLegalAcceptance(uid: string): Promise<void> {
  const key = receiptKey(uid);
  closing.add(uid); // Impide que una elección atrasada vuelva a crear el recibo.
  return enqueue(uid, async () => {
    await AsyncStorage.removeItem(key);
    if (await AsyncStorage.getItem(key) !== null) throw new Error("legal-delete-failed");
    notify(uid);
  });
}
