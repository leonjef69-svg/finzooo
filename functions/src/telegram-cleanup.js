"use strict";

// Las comprobaciones y el borrado comparten transacción para no retirar una
// conexión que se haya vuelto a vincular mientras llega un evento antiguo.
async function cleanupTelegram(db, uid, accountDeleted = false) {
  const connections = await db.collection("telegramConnections").where("uid", "==", uid).get();
  for (const item of connections.docs) {
    await db.runTransaction(async tx => {
      const statusRef = db.collection("telegramUsers").doc(uid);
      const [connection, status, user] = await Promise.all([
        tx.get(item.ref), tx.get(statusRef), tx.get(db.collection("users").doc(uid)),
      ]);
      if (!connection.exists || connection.data().uid !== uid) return;
      if (accountDeleted && user.exists) return;
      if (!accountDeleted && status.exists && status.data().active === true && status.data().chatId === item.id) return;
      const draftRef = db.collection("telegramDrafts").doc(item.id);
      const undoRef = db.collection("telegramUndo").doc(item.id);
      const [draft, undo] = await Promise.all([tx.get(draftRef), tx.get(undoRef)]);
      tx.delete(item.ref);
      if (draft.exists && (!draft.data().uid || draft.data().uid === uid)) tx.delete(draftRef);
      if (undo.exists && undo.data().uid === uid) tx.delete(undoRef);
      if (accountDeleted && status.exists && status.data().chatId === item.id) tx.delete(statusRef);
    });
  }
  if (accountDeleted) {
    for (const collection of ["telegramLinkRequests", "telegramDrafts", "telegramUndo"]) {
      const rows = await db.collection(collection).where("uid", "==", uid).get();
      for (const item of rows.docs) {
        await db.runTransaction(async tx => {
          const [user, current] = await Promise.all([tx.get(db.collection("users").doc(uid)), tx.get(item.ref)]);
          if (!user.exists && current.exists && current.data().uid === uid) tx.delete(item.ref);
        });
      }
    }
    await db.runTransaction(async tx => {
      const user = await tx.get(db.collection("users").doc(uid));
      if (!user.exists) tx.delete(db.collection("telegramUsers").doc(uid));
    });
  }
}

// Usa el vencimiento numérico existente; no requiere una política TTL nueva.
async function cleanupExpiredTelegram(db, now = Date.now()) {
  for (const collection of ["telegramLinkRequests", "telegramDrafts", "telegramUndo"]) {
    const rows = await db.collection(collection).where("expiresAtMs", "<=", now).limit(200).get();
    for (const item of rows.docs) {
      await db.runTransaction(async tx => {
        const current = await tx.get(item.ref);
        if (current.exists && Number.isFinite(current.data().expiresAtMs) && current.data().expiresAtMs <= now) tx.delete(item.ref);
      });
    }
  }
}

module.exports = { cleanupTelegram, cleanupExpiredTelegram };
