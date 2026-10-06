import { doc, getDocFromServer } from "firebase/firestore";
import { db } from "@/utils/firebase";
import { captureAccountTask } from "@/utils/accountTask";
import { historyDocumentId } from "@/utils/cloudHistoryMigration";
import type { Transaction } from "@/types";

/** Solo los IDs que se van a revisar. Nunca usa caché ni una descarga fallida como ausencia. */
export async function loadPrivateBoxRepairCloud(uid: string, ids: number[]): Promise<{ transactions: Transaction[]; deletedIds: number[] }> {
  const task = captureAccountTask(uid), wanted = new Set(ids);
  const root = await task.wait(() => getDocFromServer(doc(db, "users", uid)));
  if (root.metadata.fromCache || root.metadata.hasPendingWrites) throw new Error("private-box-cloud-unconfirmed");
  if (!root.exists()) return { transactions: [], deletedIds: [] };
  const data = root.data();
  if (data.accountDeletionPending === true) throw new Error("account-deletion-pending");
  if (data.historyFormat === 2) {
    const transactions: Transaction[] = [], deletedIds: number[] = [];
    // Lotes pequeños, sin consultas de todo el historial ni índices compuestos.
    const unique = [...wanted];
    for (let i = 0; i < unique.length; i += 20) {
      const snapshots = await task.wait(() => Promise.all(unique.slice(i, i + 20).map(id => getDocFromServer(doc(db, "users", uid, "history", historyDocumentId(id))))));
      for (const snap of snapshots) {
        if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) throw new Error("private-box-cloud-unconfirmed");
        if (!snap.exists()) continue;
        const row = snap.data();
        if (snap.id !== historyDocumentId(row.id) || !wanted.has(row.id)) throw new Error("private-box-cloud-invalid");
        if (row.deleted === true) deletedIds.push(row.id);
        else if (row.deleted === false && row.transaction?.id === row.id) transactions.push(row.transaction);
        else throw new Error("private-box-cloud-invalid");
      }
    }
    return { transactions, deletedIds };
  }
  if ((data.historyFormat !== undefined && data.historyFormat !== 1)
    || (data.transactions !== undefined && !Array.isArray(data.transactions))
    || (data.deletedTransactionIds !== undefined && !Array.isArray(data.deletedTransactionIds))) throw new Error("private-box-cloud-invalid");
  return { transactions: (data.transactions || []).filter((row: Transaction) => wanted.has(row.id)),
    deletedIds: (data.deletedTransactionIds || []).filter((id: number) => wanted.has(id)) };
}

/** La memoria debe haber recibido una edición/borrado remoto antes de repararlo. */
export function assertPrivateBoxRepairCloud(rows: Transaction[], remote: { transactions: Transaction[]; deletedIds: number[] }): void {
  const byId = new Map(rows.map(row => [row.id, row]));
  const stable = (value: unknown) => JSON.stringify(value, (key, item) => key === "updatedAt" ? undefined
    : item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item);
  if (remote.deletedIds.length || remote.transactions.some(row => {
    const local = byId.get(row.id);
    return !local || stable(local) !== stable(row);
  })) throw new Error("private-box-source-changed");
}
