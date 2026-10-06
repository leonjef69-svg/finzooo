"use strict";

// Compartido con la app. Sin SDK, Node ni algoritmos financieros duplicados.
function privateBoxSourceString(box, rows, currency) {
  return JSON.stringify({
    box: { id: box.id, nombre: box.nombre, creadaEn: box.creadaEn, updatedAt: box.updatedAt ?? box.creadaEn }, currency,
    rows: [...rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(row => ({
      id: row.id, cajaId: row.cajaId, tipo: row.tipo, monto: row.monto, descripcion: row.descripcion,
      fecha: row.fecha, creadoEn: row.creadoEn, updatedAt: row.updatedAt ?? row.creadoEn,
      category: row.category || "", notes: row.notes || "", method: row.method || "",
      personalTransactionId: row.personalTransactionId ?? null, personalReturnAmount: row.personalReturnAmount ?? null,
    })),
  });
}

function sharedBoxMovement(row, uid) {
  return { tipo: row.tipo, monto: row.monto, descripcion: row.descripcion, fecha: row.fecha,
    creadoPor: uid, creadoEn: row.creadoEn,
    ...(row.category ? { category: row.category } : {}), ...(row.notes ? { notes: row.notes } : {}),
    ...(row.method ? { method: row.method } : {}),
    ...(row.personalTransactionId != null ? { personalTransactionId: row.personalTransactionId, personalOwnerUid: uid } : {}),
    ...(row.personalReturnAmount != null ? { personalReturnAmount: row.personalReturnAmount } : {}),
  };
}

function copiedBoxMovementMatches(actual, row, uid) {
  const expected = sharedBoxMovement(row, uid);
  // El índice de copia es transitorio; los valores monetarios/IDs no lo son.
  const allowed = new Set([...Object.keys(expected), "migrationSourceIndex"]);
  return Object.keys(actual).every(key => allowed.has(key))
    && Object.entries(expected).every(([key, value]) => actual[key] === value);
}

module.exports = { privateBoxSourceString, sharedBoxMovement, copiedBoxMovementMatches };
