import { currencySymbolFor } from "@/constants/currencies";
import { fmt } from "@/utils/format";

/** Formateador estable para el texto de los avisos del calendario. */
export function paymentNotificationFormatter(currency: string): (amount: number) => string {
  return (amount) => fmt(amount, currencySymbolFor(currency), currency);
}
