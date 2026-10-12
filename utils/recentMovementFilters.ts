export type RecentMovement = {
  type: "income" | "expense";
  internalTransfer?: string;
};

export function availableRecentMovementTypes(movements: readonly RecentMovement[]) {
  return {
    income: movements.some(movement => !movement.internalTransfer && movement.type === "income"),
    expense: movements.some(movement => !movement.internalTransfer && movement.type === "expense"),
  };
}
