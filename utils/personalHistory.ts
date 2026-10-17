import type { Transaction } from "@/types";
import { moneyUnits } from "@/utils/moneyPrecision";
import { identityForExplicitEdit } from "@/utils/recordOrigin";

export function visiblePersonalMovement(row: Transaction): boolean { return row.hiddenFromHistory !== true; }

type HistoryIndex = { rows: Map<number, Transaction>; links: Map<number, Set<number>>; checked: Map<number, number[]>; duplicates: Set<number> };
const indices = new WeakMap<Transaction[], HistoryIndex>();
function indexOf(rows: Transaction[]): HistoryIndex {
  const cached = indices.get(rows); if (cached) return cached;
  const index: HistoryIndex = { rows: new Map(), links: new Map(), checked: new Map(), duplicates: new Set() };
  for (const row of rows) { if (index.rows.has(row.id)) index.duplicates.add(row.id); index.rows.set(row.id, row); }
  const connect = (a: number, b: number) => { if (!index.links.has(a)) index.links.set(a, new Set()); index.links.get(a)!.add(b); };
  for (const row of rows) {
    if (row.type !== "income" || !["family", "box"].includes(row.internalTransfer || "") || !Array.isArray(row.internalTransferAllocations)) continue;
    for (const part of row.internalTransferAllocations) { connect(row.id, part.transactionId); connect(part.transactionId, row.id); }
  }
  indices.set(rows, index); return index;
}

/** Componente completo de aportes/devoluciones. No infiere parejas por nombre,
 * importe o fecha ni confunde dinero consumido con dinero devuelto. */
export function returnedTransferHistoryIds(rows: Transaction[], id: number): number[] {
  const index = indexOf(rows), checked = index.checked.get(id); if (checked) return checked;
  const start = index.rows.get(id);
  if (!start || !["family", "box"].includes(start.internalTransfer || "")) return [];
  const space = start.internalTransferSpaceId;
  if (!space || !start.internalTransferLink) return [];
  const component = new Set([id]), queue = [id];
  for (let position = 0; position < queue.length; position++) for (const neighbor of index.links.get(queue[position]) || []) {
    if (!component.has(neighbor)) { component.add(neighbor); queue.push(neighbor); }
  }
  // También se recuerdan rechazos para no recorrer el mismo grupo por cada
  // fila. El índice es por array inmutable y no se comparte entre cuentas.
  const finish = (result: number[]) => { for (const key of component) index.checked.set(key, result); return result; };
  const group = queue.map(key => index.rows.get(key));
  if (group.some(row => !row || row.internalTransfer !== start.internalTransfer || row.internalTransferSpaceId !== space || index.duplicates.has(row.id))
    || !group.some(row => row?.type === "expense") || !group.some(row => row?.type === "income")) return finish([]);
  const returned = new Map<number, bigint>();
  for (const row of group as Transaction[]) {
    if (!Number.isFinite(row.amount) || row.amount <= 0 || !row.internalTransferLink || !Number.isFinite(row.internalTransferConsumedAmount ?? 0) || (row.internalTransferConsumedAmount ?? 0) > 0) return finish([]);
    if (row.type === "expense") continue;
    const parts = row.internalTransferAllocations;
    if (!Array.isArray(parts) || !parts.length || new Set(parts.map(part => part.transactionId)).size !== parts.length) return finish([]);
    let sum = 0n;
    for (const part of parts) {
      if (!Number.isFinite(part.amount) || part.amount <= 0 || index.rows.get(part.transactionId)?.type !== "expense") return finish([]);
      const amount = moneyUnits(part.amount); sum += amount; returned.set(part.transactionId, (returned.get(part.transactionId) || 0n) + amount);
    }
    if (sum !== moneyUnits(row.amount)) return finish([]);
  }
  if ((group as Transaction[]).some(row => row.type === "expense" && returned.get(row.id) !== moneyUnits(row.amount))) return finish([]);
  return finish(queue);
}

export function removablePersonalHistoryIds(rows: Transaction[]): Set<number> {
  const result = new Set<number>(), checked = new Set<number>();
  for (const row of rows) {
    if (!visiblePersonalMovement(row)) continue;
    if (!row.internalTransfer || row.internalTransfer === "goal") { result.add(row.id); continue; }
    if (checked.has(row.id)) continue;
    const ids = returnedTransferHistoryIds(rows, row.id);
    for (const id of ids) { checked.add(id); result.add(id); }
  }
  return result;
}

/** Solo presentación. Se retienen los pares y sus fechas para que ni el saldo
 * actual ni el arrastre de otro mes cambien al quitar una fila del historial. */
export function preparePersonalHistoryRemoval(rows: Transaction[], ids: number[]): Transaction[] {
  const index = indexOf(rows);
  const hidden = new Set<number>();
  for (const id of ids) {
    if (hidden.has(id)) continue;
    const row = index.rows.get(id);
    if (!row) throw new Error("history-movement-missing");
    if (row.internalTransfer === "goal") hidden.add(id);
    else {
      const group = returnedTransferHistoryIds(rows, id);
      if (!group.length) throw new Error("history-transfer-not-returned");
      group.forEach(value => hidden.add(value));
    }
  }
  return rows.filter(row => hidden.has(row.id) && visiblePersonalMovement(row)).map(row => identityForExplicitEdit(row, { ...row, hiddenFromHistory: true }));
}
