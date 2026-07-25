// Cuentas/bancos de donde puede salir el dinero.
//
// OJO: esto NO es lo mismo que el "método de pago" (efectivo, débito,
// crédito...). Una tarjeta de débito del BCP y una del BBVA son las dos
// "Tarjeta débito", pero son cuentas distintas. Necesitamos separarlas
// para poder detectar movimientos repetidos con precisión: si el monto y
// la fecha coinciden PERO son de bancos distintos, casi seguro son dos
// gastos diferentes, no uno repetido.

export type BankAccount = {
  id: string;
  label: string;
  // Palabras que suelen aparecer dentro del archivo exportado por ese
  // banco. Sirven para adivinar de qué banco es el archivo sin que la
  // persona tenga que elegirlo a mano.
  hints: string[];
};

export const BANK_ACCOUNTS: BankAccount[] = [
  { id: "bcp", label: "BCP", hints: ["bcp", "credito del peru", "crédito del perú", "viabcp"] },
  { id: "bbva", label: "BBVA", hints: ["bbva", "continental"] },
  { id: "interbank", label: "Interbank", hints: ["interbank", "banco internacional"] },
  { id: "scotiabank", label: "Scotiabank", hints: ["scotiabank", "scotia"] },
  { id: "yape", label: "Yape", hints: ["yape"] },
  { id: "plin", label: "Plin", hints: ["plin"] },
  { id: "bim", label: "BIM", hints: ["bim", "billetera movil", "billetera móvil"] },
  { id: "efectivo", label: "Efectivo", hints: ["efectivo", "cash"] },
  { id: "otro", label: "Otro", hints: [] },
];

export function accountLabelFor(id: string | undefined): string {
  if (!id) return "";
  return BANK_ACCOUNTS.find((a) => a.id === id)?.label ?? id;
}

// Intenta adivinar el banco a partir del nombre del archivo y de las
// primeras líneas de su contenido. Si no reconoce ninguno devuelve
// "undefined" (mejor no saberlo que inventarse un banco equivocado, que
// arruinaría la detección de repetidos).
export function guessAccount(fileName: string, sampleText: string): string | undefined {
  const haystack = `${fileName} ${sampleText}`.toLowerCase();
  for (const account of BANK_ACCOUNTS) {
    if (account.hints.some((hint) => haystack.includes(hint))) return account.id;
  }
  return undefined;
}
