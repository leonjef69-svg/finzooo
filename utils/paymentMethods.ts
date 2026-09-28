import { PAYMENT_METHODS } from "@/constants/i18n";
import type { Transaction } from "@/types";

/** Métodos que se pueden elegir al crear un movimiento en cada país. */
export function availablePaymentMethods(country: string) {
  return PAYMENT_METHODS.filter((method) =>
    (method.id !== "plin" || country === "PE")
    && (method.id !== "yape" || country === "PE" || country === "BO")
  );
}

/** Conserva métodos antiguos al editar, aunque ya no se ofrezcan en ese país. */
export function initialPaymentMethod(
  transaction?: Pick<Transaction, "method">,
): string {
  return transaction?.method || "debit";
}
