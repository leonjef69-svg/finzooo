export type RecentMovement = {
  type?: "income" | "expense";
  tipo?: "ingreso" | "gasto";
  internalTransfer?: string;
  personalTransactionId?: number;
  personalReturnAmount?: number;
};

export function availableRecentMovementTypes(movements: readonly RecentMovement[]) {
  const isRegularMovement = (movement: RecentMovement) => !movement.internalTransfer
    && movement.personalTransactionId == null && !(movement.personalReturnAmount && movement.personalReturnAmount > 0);
  return {
    income: movements.some(movement => isRegularMovement(movement)
      && (movement.type === "income" || movement.tipo === "ingreso")),
    expense: movements.some(movement => isRegularMovement(movement)
      && (movement.type === "expense" || movement.tipo === "gasto")),
  };
}

/** Apartados y devoluciones se consultan desde el filtro Ahorro del Historial. */
export function showInPersonalRecent(movement: RecentMovement): boolean {
  return movement.internalTransfer !== "goal";
}
