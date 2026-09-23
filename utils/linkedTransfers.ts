export type LinkedSpaceMovement = {
  id: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  creadoEn?: number;
  personalTransactionId?: number;
  personalOwnerUid?: string;
  personalReturnAmount?: number;
};

export type TransferAllocation = { transactionId: number; amount: number };
export type TransferStatus = "pending" | "partial" | "returned";

export type PersonalLinkedTransfer = {
  id: number;
  type?: "expense" | "income";
  amount?: number;
  internalTransfer?: "family" | "box";
  internalTransferLink?: string;
  internalTransferSpaceId?: string;
  internalTransferAllocations?: TransferAllocation[];
};

/** La mitad que vive en Personal de una transferencia a un espacio. */
export type PersonalTransferMovement = PersonalLinkedTransfer & {
  type: "expense" | "income";
  amount: number;
};

/** Datos mínimos de un aporte familiar antiguo, previo al vínculo doble. */
export type LegacyFamilyContribution = LinkedSpaceMovement & {
  descripcion: string;
  method?: string;
  creadoPor: string;
};

const CENT = 0.005;
const money = (value: number) => Math.round(value * 100) / 100;

export function isLinkedSpaceTransfer(item: LinkedSpaceMovement): boolean {
  return item.personalTransactionId != null || (item.personalReturnAmount || 0) > 0;
}

export function isLinkedSpaceReturn(item: LinkedSpaceMovement): boolean {
  return item.tipo === "gasto" && item.personalTransactionId != null && (item.personalReturnAmount || 0) > 0;
}

/**
 * Une aportes y devoluciones sin exigir campos nuevos en Firestore. Las
 * devoluciones se aplican en orden a los aportes más antiguos de esa persona.
 * Así los datos anteriores obtienen el mismo estado que los nuevos.
 */
export function linkedTransferLedger(items: LinkedSpaceMovement[], ownerUid?: string): {
  allocationsByReturnId: Map<string, TransferAllocation[]>;
  progressByTransactionId: Map<number, { returned: number; remaining: number; status: TransferStatus }>;
} {
  const ordered = [...items]
    .filter(item => !ownerUid || item.personalOwnerUid === ownerUid)
    .sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0) || a.id.localeCompare(b.id));
  const contributions = new Map<number, { amount: number; returned: number; ownerUid?: string }>();
  const order: number[] = [];
  const allocationsByReturnId = new Map<string, TransferAllocation[]>();

  for (const item of ordered) {
    if (item.tipo === "ingreso" && item.personalTransactionId != null) {
      if (!contributions.has(item.personalTransactionId)) order.push(item.personalTransactionId);
      contributions.set(item.personalTransactionId, { amount: money(item.monto), returned: 0, ownerUid: item.personalOwnerUid });
      continue;
    }
    if (!isLinkedSpaceReturn(item)) continue;
    let available = money(item.personalReturnAmount || item.monto);
    const allocations: TransferAllocation[] = [];
    for (const transactionId of order) {
      if (available <= CENT) break;
      const contribution = contributions.get(transactionId);
      if (!contribution) continue;
      // A return only settles contributions from the same person. Otherwise,
      // one member's return could change another member's transfer status.
      if (contribution.ownerUid !== item.personalOwnerUid) continue;
      const remaining = money(Math.max(0, contribution.amount - contribution.returned));
      const applied = money(Math.min(remaining, available));
      if (applied <= CENT) continue;
      contribution.returned = money(contribution.returned + applied);
      available = money(available - applied);
      allocations.push({ transactionId, amount: applied });
    }
    allocationsByReturnId.set(item.id, allocations);
  }

  const progressByTransactionId = new Map<number, { returned: number; remaining: number; status: TransferStatus }>();
  for (const [transactionId, contribution] of contributions) {
    const returned = money(Math.min(contribution.amount, contribution.returned));
    const remaining = money(Math.max(0, contribution.amount - returned));
    progressByTransactionId.set(transactionId, {
      returned,
      remaining,
      status: remaining <= CENT ? "returned" : returned > CENT ? "partial" : "pending",
    });
  }
  return { allocationsByReturnId, progressByTransactionId };
}

/** Distribución que debe guardar la próxima devolución en Personal. */
export function allocatePersonalReturn(items: LinkedSpaceMovement[], amount: number, ownerUid?: string): TransferAllocation[] {
  const ledger = linkedTransferLedger(items, ownerUid);
  const orderedContributions = [...items]
    .filter(item => (!ownerUid || item.personalOwnerUid === ownerUid) && item.tipo === "ingreso" && item.personalTransactionId != null)
    .sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0) || a.id.localeCompare(b.id));
  let available = money(amount);
  const result: TransferAllocation[] = [];
  for (const item of orderedContributions) {
    if (available <= CENT) break;
    const progress = ledger.progressByTransactionId.get(item.personalTransactionId!);
    const remaining = progress?.remaining ?? money(item.monto);
    const applied = money(Math.min(remaining, available));
    if (applied <= CENT) continue;
    result.push({ transactionId: item.personalTransactionId!, amount: applied });
    available = money(available - applied);
  }
  return result;
}

export function personalTransferStatuses(items: PersonalLinkedTransfer[]): Map<number, TransferStatus> {
  const returnedById = new Map<number, number>();
  for (const item of items) {
    if (item.type !== "income" || !item.internalTransfer || !Array.isArray(item.internalTransferAllocations)) continue;
    for (const allocation of item.internalTransferAllocations) {
      if (!Number.isFinite(allocation.transactionId) || !Number.isFinite(allocation.amount) || allocation.amount <= 0) continue;
      returnedById.set(allocation.transactionId, money((returnedById.get(allocation.transactionId) || 0) + allocation.amount));
    }
  }
  const result = new Map<number, TransferStatus>();
  for (const item of items) {
    if (item.type !== "expense" || !item.internalTransfer || !Number.isFinite(item.amount) || (item.amount || 0) <= 0) continue;
    const returned = returnedById.get(item.id) || 0;
    result.set(item.id, returned >= (item.amount || 0) - CENT ? "returned" : returned > CENT ? "partial" : "pending");
  }
  return result;
}

export function balanceOfSpace(items: LinkedSpaceMovement[]): number {
  return items.reduce((sum, item) => sum + (item.tipo === "ingreso" ? item.monto : -item.monto), 0);
}

export function netFromPersonal(items: LinkedSpaceMovement[], ownerUid?: string): number {
  return Math.max(0, items.reduce((sum, item) => {
    if (ownerUid && item.personalOwnerUid !== ownerUid) return sum;
    if (item.tipo === "ingreso" && item.personalTransactionId != null) return sum + item.monto;
    return sum - (item.personalReturnAmount || 0);
  }, 0));
}

export function returnableToPersonal(items: LinkedSpaceMovement[], ownerUid?: string): number {
  return Math.max(0, Math.min(balanceOfSpace(items), netFromPersonal(items, ownerUid)));
}

/**
 * Un espacio no se puede cerrar solo porque su saldo global sea cero. Si un
 * aporte de Personal se gastó, cerrar el espacio borraría su contraparte y
 * haría que reaparezca en Personal. Cada aporte enlazado debe volver primero
 * a la cuenta que lo puso.
 */
export function hasUnreturnedPersonalContributions(items: LinkedSpaceMovement[]): boolean {
  // Los vínculos antiguos no tenían `personalOwnerUid`. Siguen siendo dinero
  // salido de Personal y no se puede permitir que el cierre los haga
  // desaparecer solo porque les falte ese dato nuevo.
  if (items.some(item => item.personalTransactionId != null && !item.personalOwnerUid)) {
    return netFromPersonal(items) > CENT;
  }
  const contributors = new Set(
    items
      .filter(item => item.personalTransactionId != null && item.personalOwnerUid)
      .map(item => item.personalOwnerUid!),
  );
  return [...contributors].some(uid => netFromPersonal(items, uid) > CENT);
}

export function hasUnreturnedPersonalContribution(items: LinkedSpaceMovement[], ownerUid: string): boolean {
  return netFromPersonal(items, ownerUid) > CENT;
}

export function canCloseLinkedSpace(items: LinkedSpaceMovement[]): boolean {
  return Math.abs(balanceOfSpace(items)) <= CENT && !hasUnreturnedPersonalContributions(items);
}

export function canSpendFromSpace(items: LinkedSpaceMovement[], amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= balanceOfSpace(items) + CENT;
}

/** Un aporte solo puede deshacerse entero si ese dinero sigue dentro. */
export function canUndoContribution(items: LinkedSpaceMovement[], contribution: LinkedSpaceMovement, ownerUid?: string): boolean {
  if (contribution.tipo !== "ingreso" || contribution.personalTransactionId == null) return true;
  return contribution.monto <= returnableToPersonal(items, ownerUid) + CENT;
}

/** Monto mínimo al editar: nunca invade la parte ya utilizada. */
export function minimumContributionAmount(items: LinkedSpaceMovement[], contribution: LinkedSpaceMovement, ownerUid?: string): number {
  const reducible = Math.min(contribution.monto, returnableToPersonal(items, ownerUid));
  return Math.max(0, contribution.monto - reducible);
}

export function totalAcrossPersonalAndSpace(personal: number, items: LinkedSpaceMovement[]): number {
  return personal + balanceOfSpace(items);
}

/**
 * Dinero de Personal que sigue dentro de un tipo de espacio.
 *
 * Una salida enlazada es un aporte hecho desde Personal; una entrada enlazada
 * es una devolución. No se miran ingresos externos porque nunca generan una
 * mitad enlazada en Personal. Se redondea a centavos al final para que una
 * suma como 0.1 + 0.2 no deje una tarjeta visible por un residuo decimal.
 */
export function netTransferredFromPersonal(
  movements: PersonalTransferMovement[],
  kind: "family" | "box",
): number {
  const netBySpace = new Map<string, number>();
  for (const item of movements) {
    if (item.internalTransfer !== kind || !Number.isFinite(item.amount) || item.amount <= 0) continue;
    // Los registros antiguos sin espacio siguen conciliándose entre sí, pero
    // una devolución excedente de un espacio nunca oculta saldo de otro.
    const spaceId = item.internalTransferSpaceId || `legacy:${kind}`;
    const next = (netBySpace.get(spaceId) || 0) + (item.type === "expense" ? item.amount : -item.amount);
    netBySpace.set(spaceId, next);
  }
  const net = [...netBySpace.values()].reduce((sum, amount) => sum + Math.max(0, amount), 0);
  return Math.round(net * 100) / 100;
}

/**
 * Los primeros espacios Familia guardaban el origen solo como texto. Solo se
 * migra el texto exacto que Fino generaba, hecho por la propia cuenta y con
 * método transferencia; así un ingreso externo de un banco nunca se convierte
 * por error en una salida de Personal.
 */
export function isTrustedLegacyFamilyContribution(item: LegacyFamilyContribution, uid: string): boolean {
  const labels = new Set([
    "Monto inicial desde Personal",
    "Desde Personal",
    "Initial amount from Personal",
    "From Personal",
    "Valor inicial de Pessoal",
    "De Pessoal",
  ]);
  return item.tipo === "ingreso"
    && item.method === "transfer"
    && item.creadoPor === uid
    && item.personalTransactionId == null
    && item.personalOwnerUid == null
    && labels.has(item.descripcion.trim());
}

/**
 * Localiza la mitad de Personal cuyo movimiento de destino ya no existe.
 *
 * `counterpartLoaded` evita borrar nada mientras Familia/Caja todavía está
 * cargando. Cuando ya terminó la lectura, una transferencia sin vínculo o con
 * un vínculo inexistente es huérfana y puede reconciliarse de forma segura.
 */
export function orphanedPersonalTransferIds(
  transactions: PersonalLinkedTransfer[],
  kind: "family" | "box",
  validMovementIds: Iterable<string>,
  counterpartLoaded: boolean,
): number[] {
  if (!counterpartLoaded) return [];
  const valid = new Set(validMovementIds);
  return transactions
    .filter(item => item.internalTransfer === kind && (!item.internalTransferLink || !valid.has(item.internalTransferLink)))
    .map(item => item.id);
}
