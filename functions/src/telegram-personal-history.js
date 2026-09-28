"use strict";

const { FieldValue } = require("firebase-admin/firestore");

function isV2(userData) { return userData?.historyFormat === 2; }
function assertActive(userData) {
  if (userData?.accountDeletionPending === true) throw new Error("ACCOUNT_DELETION_PENDING");
}
function rowRef(userRef, id) {
  if (!Number.isSafeInteger(id)) throw new Error("INVALID_ID");
  return userRef.collection("history").doc(String(id));
}

async function allPersonalTransactions(userRef, userData, tx) {
  assertActive(userData);
  if (!isV2(userData)) return Array.isArray(userData.transactions) ? userData.transactions : [];
  const ref = userRef.collection("history");
  const snap = tx ? await tx.get(ref) : await ref.get();
  return snap.docs.filter(item => item.data().deleted === false).map(item => item.data().transaction);
}

async function personalRecord(tx, userRef, userData, id) {
  assertActive(userData);
  if (!isV2(userData)) {
    return { transaction: (Array.isArray(userData?.transactions) ? userData.transactions : []).find(item => item.id === id) || null };
  }
  const ref = rowRef(userRef, id);
  const snap = await tx.get(ref);
  return { ref, transaction: snap.exists && snap.data().deleted === false ? snap.data().transaction : null, exists: snap.exists };
}

function addPersonal(tx, userRef, userData, record, movement, maxBytes) {
  assertActive(userData);
  if (record.transaction || record.exists) throw new Error("DUPLICATE_ID");
  if (isV2(userData)) {
    tx.set(record.ref, { id: movement.id, deleted: false, transaction: movement, syncAt: FieldValue.serverTimestamp() });
    return;
  }
  const next = [...(Array.isArray(userData.transactions) ? userData.transactions : []), movement];
  if (Buffer.byteLength(JSON.stringify({ ...userData, transactions: next }), "utf8") > maxBytes) throw new Error("TOO_LARGE");
  tx.update(userRef, { transactions: next });
}

function editPersonal(tx, userRef, userData, record, edited, maxBytes) {
  assertActive(userData);
  if (!record.transaction) throw new Error("NOTHING_TO_EDIT");
  if (isV2(userData)) {
    tx.set(record.ref, { id: edited.id, deleted: false, transaction: edited, syncAt: FieldValue.serverTimestamp() });
    return;
  }
  const next = userData.transactions.map(item => item.id === edited.id ? edited : item);
  if (Buffer.byteLength(JSON.stringify({ ...userData, transactions: next }), "utf8") > maxBytes) throw new Error("TOO_LARGE");
  tx.update(userRef, { transactions: next });
}

function deletePersonal(tx, userRef, userData, record, id) {
  assertActive(userData);
  if (!record.transaction) throw new Error("NOTHING_TO_UNDO");
  if (isV2(userData)) {
    tx.set(record.ref, { id, deleted: true, syncAt: FieldValue.serverTimestamp() });
    return;
  }
  const deletedTransactionIds = [...new Set([
    ...(Array.isArray(userData.deletedTransactionIds) ? userData.deletedTransactionIds : []), id,
  ])].slice(-5000);
  tx.update(userRef, {
    transactions: userData.transactions.filter(item => item.id !== id), deletedTransactionIds,
  });
}

module.exports = { isV2, allPersonalTransactions, personalRecord, addPersonal, editPersonal, deletePersonal };
