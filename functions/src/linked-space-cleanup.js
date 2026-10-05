"use strict";

function fail(reason) { const error = new Error(reason); error.reason = reason; throw error; }
function checkOwner(snapshot, uid) {
  if (!snapshot.exists || snapshot.data().ownerUid !== uid) fail("cleanup-not-owner");
  if (snapshot.data().deleting !== true) fail("cleanup-not-prepared");
}

function indexUpdates(data, spaceId) {
  const updates = {};
  if (data.activeFamilyId === spaceId) updates.activeFamilyId = "";
  if (Array.isArray(data.closedFamilyIds) && data.closedFamilyIds.includes(spaceId)) {
    updates.closedFamilyIds = data.closedFamilyIds.filter(id => id !== spaceId);
  }
  return updates;
}

/** Finaliza un borrado preparado, sin exponer índices privados ajenos. */
async function finalizeLinkedSpaceDeletion(db, uid, input) {
  const { kind, spaceId } = input || {};
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/")
    || !["family", "box"].includes(kind) || typeof spaceId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(spaceId)) fail("cleanup-invalid-request");
  const root = db.doc(`${kind === "family" ? "familySpaces" : "boxSpaces"}/${spaceId}`);
  checkOwner(await root.get(), uid);
  if (!(await root.collection("movements").limit(1).get()).empty) fail("cleanup-movements-remain");
  // El propietario conserva membresía e índice hasta la confirmación final:
  // una interrupción puede descubrir y retomar el espacio preparado.
  while (true) {
    const members = await root.collection("members").limit(200).get();
    const pending = members.docs.filter(member => member.id !== uid);
    if (!pending.length) break;
    for (const member of pending) {
      const index = db.doc(`${kind === "family" ? "familyUsers" : "boxUsers"}/${member.id}`);
      const link = index.collection("spaces").doc(spaceId);
      await db.runTransaction(async tx => {
        const space = await tx.get(root);
        checkOwner(space, uid);
        const saved = kind === "family" ? await tx.get(index) : null;
        if (saved?.exists) {
          const updates = indexUpdates(saved.data(), spaceId);
          if (Object.keys(updates).length) tx.update(index, updates);
        }
        tx.delete(link);
        tx.delete(member.ref);
      });
    }
  }
  const invites = db.collection(kind === "family" ? "familyInvites" : "boxInvites")
    .where(kind === "family" ? "familyId" : "boxId", "==", spaceId);
  while (true) {
    const rows = await invites.limit(200).get();
    if (rows.empty) break;
    const batch = db.batch();
    for (const row of rows.docs) batch.delete(row.ref);
    await batch.commit();
  }
  const ownIndex = db.doc(`${kind === "family" ? "familyUsers" : "boxUsers"}/${uid}`);
  await db.runTransaction(async tx => {
    const space = await tx.get(root);
    checkOwner(space, uid);
    const movements = await tx.get(root.collection("movements").limit(1));
    if (!movements.empty) fail("cleanup-movements-remain");
    const saved = kind === "family" ? await tx.get(ownIndex) : null;
    if (saved?.exists) {
      const updates = indexUpdates(saved.data(), spaceId);
      if (Object.keys(updates).length) tx.update(ownIndex, updates);
    }
    tx.delete(ownIndex.collection("spaces").doc(spaceId));
    tx.delete(root.collection("members").doc(uid));
    tx.delete(root);
  });
  return { ok: true };
}

module.exports = { finalizeLinkedSpaceDeletion };
