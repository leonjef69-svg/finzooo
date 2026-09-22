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

export function canCloseLinkedSpace(items: LinkedSpaceMovement[]): boolean {
  return Math.abs(balanceOfSpace(items)) <= CENT && !hasUnreturnedPersonalContributions(items);
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
  const net = movements.reduce((sum, item) => {
    if (item.internalTransfer !== kind || !Number.isFinite(item.amount) || item.amount <= 0) return sum;
    return sum + (item.type === "expense" ? item.amount : -item.amount);
  }, 0);
  return Math.max(0, Math.round(net * 100) / 100);
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
