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
    if (movement.personalOwnerUid !== uid) return sum;
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

/** Un espacio solo se puede cerrar o purgar cuando no queda saldo ni aportes pendientes. */
function canCloseLinkedSpace(movements) {
  if (Math.abs(balance(movements)) > CENT) return false;
  const contributors = new Set(
    movements
      .filter(movement => typeof movement.personalTransactionId === "number" && typeof movement.personalOwnerUid === "string")
      .map(movement => movement.personalOwnerUid),
  );
  return [...contributors].every(uid => personalNet(movements, uid) <= CENT);
}

function hasUnreturnedPersonalContribution(movements, uid) {
  return personalNet(movements, uid) > CENT;
}

module.exports = { CENT, contributionLimits, canCloseLinkedSpace, hasUnreturnedPersonalContribution };
