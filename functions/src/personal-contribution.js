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

/** Un espacio solo se puede cerrar o purgar cuando no queda saldo ni aportes pendientes. */
function canCloseLinkedSpace(movements) {
  if (Math.abs(balance(movements)) > CENT) return false;
  const contributions = movements.filter(movement =>
    movement.tipo === "ingreso" && typeof movement.personalTransactionId === "number",
  );
  // Si un aporte antiguo no conserva ni propietario ni creador, no es seguro
  // cerrar: no se puede confirmar a qué cuenta de Personal debe devolverse.
  if (contributions.some(movement => !(movement.personalOwnerUid || movement.creadoPor))) return false;
  const returns = movements.filter(movement => numberOrZero(movement.personalReturnAmount) > CENT);
  // Las devoluciones antiguas sin responsable no pueden atribuirse a un UID.
  // En ese caso usamos el neto agregado; si sigue pendiente, no cerramos.
  if (returns.some(movement => !(movement.personalOwnerUid || movement.creadoPor))) {
    return personalNet(movements) <= CENT;
  }
  const contributors = new Set(
    contributions.map(movement => movement.personalOwnerUid || movement.creadoPor),
  );
  return [...contributors].every(uid => personalNet(movements, uid) <= CENT);
}

function hasUnreturnedPersonalContribution(movements, uid) {
  return personalNet(movements, uid) > CENT;
}

module.exports = { CENT, contributionLimits, canCloseLinkedSpace, hasUnreturnedPersonalContribution };
