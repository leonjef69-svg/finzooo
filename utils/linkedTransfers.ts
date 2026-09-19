export type LinkedSpaceMovement = {
  id: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  personalTransactionId?: number;
  personalOwnerUid?: string;
  personalReturnAmount?: number;
};

export type PersonalLinkedTransfer = {
  id: number;
  internalTransfer?: "family" | "box";
  internalTransferLink?: string;
};

const CENT = 0.005;

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

export function canSpendFromSpace(items: LinkedSpaceMovement[], amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= balanceOfSpace(items) + CENT;
}

/** Cuánto de los aportes personales ya fue consumido dentro del espacio. */
export function personalMoneyUsed(items: LinkedSpaceMovement[], ownerUid?: string): number {
  return Math.max(0, netFromPersonal(items, ownerUid) - Math.max(0, balanceOfSpace(items)));
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
