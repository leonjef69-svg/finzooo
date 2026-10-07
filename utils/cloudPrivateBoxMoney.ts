import { collection, doc, getDocFromServer, getDocsFromServer, limit, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/utils/firebase";
import { captureAccountTask } from "@/utils/accountTask";
import { validarCajas, validarRevisionImporte, type DatosCajas, type RevisionImporteCaja } from "@/utils/cajas";
import { historyDocumentId } from "@/utils/cloudHistoryMigration";
import { confirmarRevisionImporteLocal, retirarRevisionImporteLocal } from "@/utils/privateBoxMoneyReview";
import { assertPrivateBoxMoneyReviewLease, type PrivateBoxCloudLease } from "@/utils/privateBoxSync";
import { hasUnreadableLocalData, loadJSON, STORAGE_KEYS } from "@/utils/storage";
import { canonical, moneyAcknowledgement, type MoneyAck, type MoneyReview } from "../functions/src/private-box-money-shared.js";
import type { Transaction } from "@/types";

export type PrivateBoxMoneySources = { data: DatosCajas; transactions: Transaction[]; deletedIds: number[] };
export type PrivateBoxMoneyLocal = { transactions: Transaction[]; deletedIds: number[]; currency: string };
const receipts = new WeakMap<MoneyAck, { uid: string; entry: string; lease: PrivateBoxCloudLease; current: () => boolean }>();
export type MoneyRetireAck = { status: "retired"; uid: string; id: string; boxId: string; movementId: string; personalId: number; digest: string };
type MoneyRetireReply = MoneyRetireAck | { status: "applied"; uid: string; id: string };
const retirements = new WeakMap<MoneyRetireAck, { uid: string; entry: string; lease: PrivateBoxCloudLease; current: () => boolean }>();

function check(uid: string, lease: PrivateBoxCloudLease): void {
  assertPrivateBoxMoneyReviewLease(uid, lease);
  if (!uid || uid.length > 128 || uid.includes("/") || !auth.currentUser?.emailVerified || hasUnreadableLocalData()) throw new Error("cajas-money-unconfirmed");
}

/** Fuentes para mostrar, no permiso para sobrescribirlas. El servidor las relee
 * en su transacción final. Nunca convierte falta de red/cache en lista vacía.
 * Dentro de la cola de revisión: no llama a las descargas ordinarias pausadas.
 */
export async function loadPrivateBoxMoneySources(uid: string, movementId: string, personalId: number,
  currency: string, lease: PrivateBoxCloudLease): Promise<PrivateBoxMoneySources> {
  check(uid, lease);
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(movementId) || !Number.isSafeInteger(personalId) || personalId <= 0
    || !/^[A-Z]{3}$/.test(currency)) throw new Error("cajas-money-changed");
  const root = await lease.wait(() => getDocFromServer(doc(db, "users", uid)));
  if (root.metadata.fromCache || root.metadata.hasPendingWrites || !root.exists()) throw new Error("cajas-money-unconfirmed");
  const profile = root.data();
  if (profile.hasOnboarded !== true || profile.accountDeletionPending === true || profile.userCurrency !== currency
    || (profile.historyFormat !== undefined && ![1, 2].includes(profile.historyFormat))) throw new Error("cajas-money-changed");
  const snapshot = await lease.wait(() => getDocFromServer(doc(db, "cajas", uid)));
  if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites || !snapshot.exists()) throw new Error("cajas-money-unconfirmed");
  const raw = snapshot.data();
  if (raw.revisionesNombre !== undefined || raw.revisionesImporte !== undefined) throw new Error("cajas-money-changed");
  const data = validarCajas(raw);
  const moves = data.movimientos.filter(row => row.id === movementId);
  if (moves.length !== 1 || moves[0].personalTransactionId !== personalId || data.movimientosBorrados.includes(movementId)
    || data.movimientos.filter(row => row.personalTransactionId === personalId).length !== 1) throw new Error("cajas-money-changed");
  let rows: Transaction[];
  if (profile.historyFormat === 2) {
    const history = collection(db, "users", uid, "history");
    const [saved, links] = await lease.wait(() => Promise.all([
      getDocFromServer(doc(history, historyDocumentId(personalId))),
      getDocsFromServer(query(history, where("transaction.internalTransferLink", "==", movementId), limit(2))),
    ]));
    if (saved.metadata.fromCache || saved.metadata.hasPendingWrites || links.metadata.fromCache || links.metadata.hasPendingWrites
      || links.docs.some(row => row.metadata.fromCache || row.metadata.hasPendingWrites)) throw new Error("cajas-money-unconfirmed");
    if (!saved.exists() || saved.id !== historyDocumentId(personalId) || saved.data().id !== personalId
      || saved.data().deleted !== false || saved.data().transaction?.id !== personalId
      || links.docs.length !== 1 || links.docs[0].id !== saved.id) throw new Error("cajas-money-changed");
    rows = [saved.data().transaction];
  } else {
    if (!Array.isArray(profile.transactions) || (profile.deletedTransactionIds !== undefined && !Array.isArray(profile.deletedTransactionIds))
      || (profile.deletedTransactionIds || []).includes(personalId)) throw new Error("cajas-money-changed");
    rows = profile.transactions.filter((row: Transaction) => row?.id === personalId);
    if (profile.transactions.filter((row: Transaction) => row?.internalTransferLink === movementId).length !== 1) throw new Error("cajas-money-changed");
  }
  if (rows.length !== 1 || rows[0].internalTransferLink !== movementId) throw new Error("cajas-money-changed");
  check(uid, lease);
  // No incorpora otras transacciones al formulario ni demuestra una ausencia.
  return { data, transactions: rows, deletedIds: [] };
}

/** Envía SOLO una elección ya guardada con sus originales. No guarda dinero
 * localmente ni cambia su marca. Debe mantenerse esta misma revisión/cola
 * abierta hasta terminar el lote financiero del contexto.
 */
async function callPrivateBoxMoney(name: "resolvePrivateBoxMoney" | "recoverPrivateBoxMoney", uid: string,
  entry: RevisionImporteCaja, lease: PrivateBoxCloudLease, local: () => PrivateBoxMoneyLocal, current: () => boolean): Promise<MoneyAck> {
  check(uid, lease); validarRevisionImporte(entry);
  const original = canonical(entry);
  const selected: RevisionImporteCaja = JSON.parse(JSON.stringify(entry));
  const task = captureAccountTask(uid, current);
  const assertLocal = async () => {
    check(uid, lease);
    if (selected.uid !== uid || selected.estado !== "pendiente" || original !== canonical(entry)) throw new Error("cajas-money-changed");
    // La lectura cifrada en disco es obligatoria: una referencia de pantalla
    // o un guardado fallido no permiten enviar una corrección.
    const data = validarCajas(await task.wait(() => lease.wait(() => loadJSON<DatosCajas | null>(STORAGE_KEYS.cajasDinero, null))));
    check(uid, lease);
    const actual = local();
    confirmarRevisionImporteLocal(data, actual.transactions, actual.deletedIds, selected, moneyAcknowledgement(selected), uid, actual.currency);
    if (!task.current()) throw new Error("account-task-obsolete");
  };
  await assertLocal();
  const payload: MoneyReview = { id: selected.id, uid: selected.uid, currency: selected.currency, box: selected.box,
    local: selected.local, remote: selected.remote, chosen: selected.chosen, createdAt: selected.createdAt, version: selected.version };
  const call = httpsCallable<MoneyReview, MoneyAck>(functions, name, { timeout: 120_000 });
  const result = await task.wait(() => lease.wait(() => call(payload)));
  if (canonical(result.data) !== canonical(moneyAcknowledgement(selected))) throw new Error("cajas-money-unconfirmed");
  await assertLocal();
  // Identidad del objeto + sesión + cola: copiar/calcular los campos del ack
  // no equivale a haber recibido confirmación del servicio real.
  const ack = Object.freeze({ ...result.data });
  receipts.set(ack, { uid, entry: original, lease, current: task.current });
  return ack;
}

export function requestPrivateBoxMoneyReview(uid: string, entry: RevisionImporteCaja, lease: PrivateBoxCloudLease,
  local: () => PrivateBoxMoneyLocal, current: () => boolean): Promise<MoneyAck> {
  return callPrivateBoxMoney("resolvePrivateBoxMoney", uid, entry, lease, local, current);
}

/** Recupera respuesta perdida sin Pro. El endpoint no tiene vía de escritura. */
export function recoverPrivateBoxMoneyReview(uid: string, entry: RevisionImporteCaja, lease: PrivateBoxCloudLease,
  local: () => PrivateBoxMoneyLocal, current: () => boolean): Promise<MoneyAck> {
  return callPrivateBoxMoney("recoverPrivateBoxMoney", uid, entry, lease, local, current);
}

/** El guardado financiero exige la respuesta genuina en la misma cola. */
export function assertPrivateBoxMoneyReceipt(uid: string, entry: RevisionImporteCaja, ack: MoneyAck, lease: PrivateBoxCloudLease): void {
  check(uid, lease);
  const proof = receipts.get(ack);
  if (!proof || proof.uid !== uid || proof.lease !== lease || !proof.current() || proof.entry !== canonical(entry)
    || canonical(ack) !== canonical(moneyAcknowledgement(entry))) throw new Error("cajas-money-unconfirmed");
}

/** El retiro jamás elige un monto. Si el servidor ya aplicó la elección,
 * devuelve «applied» y el flujo debe recuperar su recibo verdadero.
 */
export async function requestPrivateBoxMoneyRetirement(uid: string, entry: RevisionImporteCaja, lease: PrivateBoxCloudLease,
  local: () => PrivateBoxMoneyLocal, current: () => boolean): Promise<MoneyRetireReply> {
  check(uid, lease); validarRevisionImporte(entry);
  const original = canonical(entry), selected: RevisionImporteCaja = JSON.parse(JSON.stringify(entry));
  const task = captureAccountTask(uid, current);
  const assertLocal = async () => {
    check(uid, lease);
    if (selected.uid !== uid || selected.estado !== "pendiente" || original !== canonical(entry)) throw new Error("cajas-money-changed");
    const data = validarCajas(await task.wait(() => lease.wait(() => loadJSON<DatosCajas | null>(STORAGE_KEYS.cajasDinero, null))));
    const actual = local();
    retirarRevisionImporteLocal(data, actual.transactions, actual.deletedIds, selected, uid, actual.currency);
    if (!task.current()) throw new Error("account-task-obsolete");
  };
  await assertLocal();
  const payload: MoneyReview = { id: selected.id, uid: selected.uid, currency: selected.currency, box: selected.box,
    local: selected.local, remote: selected.remote, chosen: selected.chosen, createdAt: selected.createdAt, version: selected.version };
  const call = httpsCallable<MoneyReview, MoneyRetireReply>(functions, "retirePrivateBoxMoney", { timeout: 120_000 });
  const result = await task.wait(() => lease.wait(() => call(payload)));
  const ack = result.data;
  if (!ack || ack.uid !== uid || ack.id !== selected.id || !["retired", "applied"].includes(ack.status)) throw new Error("cajas-money-unconfirmed");
  if (ack.status === "retired" && (ack.boxId !== selected.box.id || ack.movementId !== selected.remote.movement.id
    || ack.personalId !== selected.remote.personal.id || !/^[a-f0-9]{64}$/.test(ack.digest))) throw new Error("cajas-money-unconfirmed");
  await assertLocal();
  if (ack.status === "applied") return ack;
  const proof = Object.freeze({ ...ack });
  retirements.set(proof, { uid, entry: original, lease, current: task.current });
  return proof;
}

export function assertPrivateBoxMoneyRetirement(uid: string, entry: RevisionImporteCaja, ack: MoneyRetireAck, lease: PrivateBoxCloudLease): void {
  check(uid, lease);
  const proof = retirements.get(ack);
  if (!proof || proof.uid !== uid || proof.lease !== lease || !proof.current() || proof.entry !== canonical(entry)
    || ack.status !== "retired" || ack.uid !== uid || ack.id !== entry.id || ack.boxId !== entry.box.id
    || ack.movementId !== entry.remote.movement.id || ack.personalId !== entry.remote.personal.id
    || !/^[a-f0-9]{64}$/.test(ack.digest)) throw new Error("cajas-money-unconfirmed");
}
