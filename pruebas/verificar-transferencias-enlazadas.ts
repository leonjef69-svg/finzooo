import {
  balanceOfSpace,
  allocatePersonalReturn,
  canSpendFromSpace,
  canCloseLinkedSpace,
  hasUnreturnedPersonalContribution,
  canUndoContribution,
  isTrustedLegacyFamilyContribution,
  minimumContributionAmount,
  isLinkedSpaceReturn,
  isLinkedSpaceTransfer,
  linkedTransferLedger,
  netTransferredFromPersonal,
  hasUnreturnedPersonalContributions,
  orphanedPersonalTransferIds,
  personalTransferStatuses,
  returnableToPersonal,
  totalAcrossPersonalAndSpace,
} from "@/utils/linkedTransfers";

function igual(actual: unknown, esperado: unknown, mensaje: string) {
  if (actual !== esperado) throw new Error(`${mensaje}: ${actual} !== ${esperado}`);
}

const aporte = { id: "aporte", tipo: "ingreso" as const, monto: 200, personalTransactionId: 10, personalOwnerUid: "yo" };
const intacto = [aporte];
igual(balanceOfSpace(intacto), 200, "el espacio recibe el aporte");
igual(totalAcrossPersonalAndSpace(300, intacto), 500, "transferir conserva el total");
igual(returnableToPersonal(intacto), 200, "un aporte intacto se puede devolver completo");
igual(canUndoContribution(intacto, aporte), true, "un aporte intacto se puede deshacer");

const usado = [aporte, { id: "gasto", tipo: "gasto" as const, monto: 50 }];
igual(balanceOfSpace(usado), 150, "el gasto reduce solo el espacio");
igual(canSpendFromSpace(usado, 151), false, "no permite gastar por encima del saldo");
igual(canSpendFromSpace(usado, 150), true, "permite gastar exactamente el saldo");
igual(returnableToPersonal(usado), 150, "solo se devuelve lo que sigue disponible");
igual(canUndoContribution(usado, aporte), false, "no se borra un aporte parcialmente usado");
igual(minimumContributionAmount(usado, aporte), 50, "no se reduce por debajo del dinero utilizado");
igual(hasUnreturnedPersonalContributions(usado), true, "un aporte Personal gastado sigue pendiente de devolución");
igual(hasUnreturnedPersonalContribution(usado, "yo"), true, "el preflight detecta el aporte pendiente del miembro que quiere salir");
igual(canCloseLinkedSpace(usado), false, "un espacio no se cierra aunque luego se lleve el saldo a cero sin devolver a Personal");

const devuelto = [...usado, { id: "retorno", tipo: "gasto" as const, monto: 100, personalTransactionId: 11, personalReturnAmount: 100 }];
igual(returnableToPersonal(devuelto), 50, "una devolución no puede repetirse");
igual(totalAcrossPersonalAndSpace(400, devuelto), 450, "devolver conserva el total restante después del gasto real");
const liquidado = [...intacto, { id: "retorno-final", tipo: "gasto" as const, monto: 200, personalTransactionId: 12, personalReturnAmount: 200 }];
igual(hasUnreturnedPersonalContributions(liquidado), false, "la devolución completa liquida el aporte de Personal");
igual(canCloseLinkedSpace(liquidado), true, "solo un espacio sin saldo ni aporte pendiente se puede cerrar");

const personales = [
  { id: 21, internalTransfer: "family" as const, internalTransferLink: "familia-vigente" },
  { id: 22, internalTransfer: "family" as const, internalTransferLink: "familia-borrada" },
  { id: 23, internalTransfer: "family" as const },
  { id: 24, internalTransfer: "box" as const, internalTransferLink: "caja-vigente" },
];
igual(orphanedPersonalTransferIds(personales, "family", ["familia-vigente"], false).length, 0, "no repara antes de terminar la carga");
igual(orphanedPersonalTransferIds(personales, "family", ["familia-vigente"], true).join(","), "22,23", "detecta vínculos borrados y transferencias antiguas sin vínculo");
igual(orphanedPersonalTransferIds(personales, "family", [], true).join(","), "21,22,23", "sin familia activa limpia todas sus transferencias huérfanas");

const resumenPersonal = [
  { id: 31, type: "expense" as const, amount: 200, internalTransfer: "box" as const }, // monto inicial desde Personal
  { id: 32, type: "expense" as const, amount: 50, internalTransfer: "box" as const },  // agregar dinero desde Personal
  { id: 33, type: "income" as const, amount: 80, internalTransfer: "box" as const },   // devolución a Personal
  { id: 34, type: "expense" as const, amount: 300, internalTransfer: "family" as const },
  { id: 35, type: "income" as const, amount: 100, internalTransfer: "family" as const },
  { id: 36, type: "income" as const, amount: 999, internalTransfer: undefined },        // dinero externo: no cuenta
  { id: 37, type: "expense" as const, amount: 9_000_000_000_000, internalTransfer: "box" as const },
];
igual(netTransferredFromPersonal(resumenPersonal, "box"), 9_000_000_000_170, "Caja suma aportes, resta devoluciones e ignora dinero externo");
igual(netTransferredFromPersonal(resumenPersonal, "family"), 200, "Familia conserva su saldo neto separado");
igual(netTransferredFromPersonal([{ id: 38, type: "income", amount: 20, internalTransfer: "box" }], "box"), 0, "una devolución sin aporte no deja tarjeta negativa");
igual(netTransferredFromPersonal([{ id: 39, type: "expense", amount: 0.1, internalTransfer: "family" }, { id: 40, type: "expense", amount: 0.2, internalTransfer: "family" }, { id: 41, type: "income", amount: 0.3, internalTransfer: "family" }], "family"), 0, "los decimales no dejan una tarjeta fantasma");

const legado = { id: "legado", tipo: "ingreso" as const, monto: 100, descripcion: "Monto inicial desde Personal", method: "transfer", creadoPor: "yo" };
igual(isTrustedLegacyFamilyContribution(legado, "yo"), true, "migra solo el aporte familiar antiguo generado por Fino");
igual(isTrustedLegacyFamilyContribution({ ...legado, descripcion: "Dinero externo" }, "yo"), false, "no convierte dinero externo en aporte Personal");
igual(isTrustedLegacyFamilyContribution({ ...legado, creadoPor: "otra-persona" }, "yo"), false, "no toma el aporte de otra persona");
igual(isTrustedLegacyFamilyContribution({ ...legado, personalTransactionId: 9 }, "yo"), false, "no repite una migración ya enlazada");

const historialEnlazado = [
  { id: "aporte-1", tipo: "ingreso" as const, monto: 50, creadoEn: 1, personalTransactionId: 101, personalOwnerUid: "yo" },
  { id: "aporte-2", tipo: "ingreso" as const, monto: 30, creadoEn: 2, personalTransactionId: 102, personalOwnerUid: "yo" },
  { id: "devolucion-1", tipo: "gasto" as const, monto: 20, creadoEn: 3, personalTransactionId: 201, personalOwnerUid: "yo", personalReturnAmount: 20 },
];
const ledgerParcial = linkedTransferLedger(historialEnlazado, "yo");
igual(isLinkedSpaceTransfer(historialEnlazado[0]), true, "el aporte se reconoce como transferencia y no como ingreso");
igual(isLinkedSpaceReturn(historialEnlazado[2]), true, "la devolución se reconoce como transferencia y no como gasto");
igual(ledgerParcial.progressByTransactionId.get(101)?.status, "partial", "el aporte original cambia a Parcial");
igual(ledgerParcial.progressByTransactionId.get(101)?.remaining, 30, "el estado conserva el monto todavía pendiente");
igual(ledgerParcial.progressByTransactionId.get(102)?.status, "pending", "el siguiente aporte continúa Pendiente");
igual(JSON.stringify(allocatePersonalReturn(historialEnlazado, 60, "yo")), JSON.stringify([{ transactionId: 101, amount: 30 }, { transactionId: 102, amount: 30 }]), "la siguiente devolución se enlaza con los aportes exactos");

const historialDeDosPersonas = [
  { id: "aporte-otra", tipo: "ingreso" as const, monto: 40, creadoEn: 1, personalTransactionId: 301, personalOwnerUid: "otra" },
  { id: "aporte-yo", tipo: "ingreso" as const, monto: 50, creadoEn: 2, personalTransactionId: 302, personalOwnerUid: "yo" },
  { id: "devolucion-yo", tipo: "gasto" as const, monto: 20, creadoEn: 3, personalTransactionId: 303, personalOwnerUid: "yo", personalReturnAmount: 20 },
];
const ledgerCompartido = linkedTransferLedger(historialDeDosPersonas);
igual(ledgerCompartido.progressByTransactionId.get(301)?.status, "pending", "la devolución de un miembro no cambia el aporte de otra persona");
igual(ledgerCompartido.progressByTransactionId.get(302)?.status, "partial", "el historial completo enlaza la devolución con su verdadero propietario");

const estadosPersonales = personalTransferStatuses([
  { id: 101, type: "expense", amount: 50, internalTransfer: "family" },
  { id: 102, type: "expense", amount: 30, internalTransfer: "family" },
  { id: 201, type: "income", amount: 20, internalTransfer: "family", internalTransferAllocations: [{ transactionId: 101, amount: 20 }] },
  { id: 202, type: "income", amount: 60, internalTransfer: "family", internalTransferAllocations: [{ transactionId: 101, amount: 30 }, { transactionId: 102, amount: 30 }] },
]);
igual(estadosPersonales.get(101), "returned", "Personal marca como Devuelta la transferencia liquidada");
igual(estadosPersonales.get(102), "returned", "una devolución puede cerrar más de un aporte sin perder el vínculo");

console.log("Transferencias: tercer tipo, estados, vínculos, conservación, sobregiro, devolución, borrado y edición verificados.");
