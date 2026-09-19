import {
  balanceOfSpace,
  canSpendFromSpace,
  canUndoContribution,
  minimumContributionAmount,
  orphanedPersonalTransferIds,
  returnableToPersonal,
  totalAcrossPersonalAndSpace,
} from "@/utils/linkedTransfers";

function igual(actual: unknown, esperado: unknown, mensaje: string) {
  if (actual !== esperado) throw new Error(`${mensaje}: ${actual} !== ${esperado}`);
}

const aporte = { id: "aporte", tipo: "ingreso" as const, monto: 200, personalTransactionId: 10 };
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

const devuelto = [...usado, { id: "retorno", tipo: "gasto" as const, monto: 100, personalTransactionId: 11, personalReturnAmount: 100 }];
igual(returnableToPersonal(devuelto), 50, "una devolución no puede repetirse");
igual(totalAcrossPersonalAndSpace(400, devuelto), 450, "devolver conserva el total restante después del gasto real");

const personales = [
  { id: 21, internalTransfer: "family" as const, internalTransferLink: "familia-vigente" },
  { id: 22, internalTransfer: "family" as const, internalTransferLink: "familia-borrada" },
  { id: 23, internalTransfer: "family" as const },
  { id: 24, internalTransfer: "box" as const, internalTransferLink: "caja-vigente" },
];
igual(orphanedPersonalTransferIds(personales, "family", ["familia-vigente"], false).length, 0, "no repara antes de terminar la carga");
igual(orphanedPersonalTransferIds(personales, "family", ["familia-vigente"], true).join(","), "22,23", "detecta vínculos borrados y transferencias antiguas sin vínculo");
igual(orphanedPersonalTransferIds(personales, "family", [], true).join(","), "21,22,23", "sin familia activa limpia todas sus transferencias huérfanas");

console.log("Transferencias: conservación, sobregiro, devolución, borrado y edición verificados.");
