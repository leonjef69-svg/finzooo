"use strict";

const CENT = 0.005;

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function balance(movements) {
  return movements.reduce((sum, movement) => sum + (movement.tipo === "ingreso" ? numberOrZero(movement.monto) : -numberOrZero(movement.monto)), 0);
}

function personalNet(movements, uid) {
  return Math.max(0, movements.reduce((sum, movement) => {
    // Los movimientos familiares antiguos guardaban el UID del creador aunque
    // todavía no tuvieran `personalOwnerUid`. Para una devolución eso permite
    // atribuir el reembolso a la misma persona sin tratarlo como dinero ajeno.
    const responsibleUid = movement.personalOwnerUid || movement.creadoPor;
    if (uid && responsibleUid !== uid) return sum;
    if (movement.tipo === "ingreso" && typeof movement.personalTransactionId === "number") return sum + numberOrZero(movement.monto);
    return sum - numberOrZero(movement.personalReturnAmount);
  }, 0));
}

/** El máximo que puede deshacerse de un aporte sin tocar lo ya gastado. */
function contributionLimits(movements, uid, original) {
  const refundable = Math.max(0, Math.min(balance(movements), personalNet(movements, uid)));
  return {
    refundable,
    minimum: Math.max(0, original - Math.min(original, refundable)),
    canDelete: original <= refundable + CENT,
  };
}

function invalidPersonalReturns(movements) {
  if (movements.some(item => !Number.isFinite(item.monto) || item.monto <= 0)) return true;
  const contributions = movements.filter(item => item.tipo === "ingreso" && typeof item.personalTransactionId === "number");
  const returns = movements.filter(item => item.personalReturnAmount != null);
  if (returns.some(item => item.tipo !== "gasto" || !Number.isFinite(item.personalReturnAmount)
    || item.personalReturnAmount <= 0 || Math.abs(item.personalReturnAmount - item.monto) > CENT)) return true;
  const unknownOwner = [...contributions, ...returns].some(item => !(item.personalOwnerUid || item.creadoPor));
  const totals = new Map();
  for (const item of contributions) {
    const owner = unknownOwner ? "legacy" : item.personalOwnerUid || item.creadoPor;
    totals.set(owner, (totals.get(owner) || 0) + item.monto);
  }
  for (const item of returns) {
    const owner = unknownOwner ? "legacy" : item.personalOwnerUid || item.creadoPor;
    totals.set(owner, (totals.get(owner) || 0) - item.personalReturnAmount);
  }
  return [...totals.values()].some(total => total < -CENT);
}

/** Saldo cero: lo gastado se considera consumido, no una deuda de devolución. */
function canCloseLinkedSpace(movements) {
  return Math.abs(balance(movements)) <= CENT && !invalidPersonalReturns(movements);
}

function hasUnreturnedPersonalContribution(movements, uid) {
  return invalidPersonalReturns(movements) || balance(movements) < -CENT
    || Math.min(Math.max(0, balance(movements)), personalNet(movements, uid)) > CENT;
}

module.exports = { CENT, contributionLimits, canCloseLinkedSpace, hasUnreturnedPersonalContribution };
