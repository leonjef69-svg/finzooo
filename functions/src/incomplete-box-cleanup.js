"use strict";
const { sourceFrom } = require("./private-box-migration");
const { copiedBoxMovementMatches } = require("./private-box-source");
const fail = reason => { const error = new Error(reason); error.reason = reason; throw error; };

function sourceIdFor(uid, ref) {
  const id = ref.id.startsWith(`${uid}_`) ? ref.id.slice(uid.length + 1) : "";
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) fail("incomplete-box-conflict");
  return id;
}

// Nunca interpreta un saldo positivo copiado como una nueva deuda/aportación.
// Protocolos nuevos aislados, o legado comprobado contra el origen privado.
async function checkCopy(tx, db, uid, ref) {
  const root = await tx.get(ref);
  if (!root.exists || root.data().migrationComplete !== false) return null;
  const data = root.data(), sourceId = sourceIdFor(uid, ref);
  const [members, receipt] = await Promise.all([
    tx.get(ref.collection("members")), tx.get(db.doc(`privateBoxMigrations/${uid}/operations/${sourceId}`)),
  ]);
  if (data.ownerUid !== uid || receipt.exists
    || members.docs.some(doc => doc.id !== uid || doc.data().rol !== "owner")
    || (data.migrationDeletionPending !== true && (data.closed === true || data.closing === true || data.deleting === true))) fail("incomplete-box-conflict");
  if (![2, 3].includes(data.migrationProtocol)) {
    if (data.migrationProtocol != null) fail("incomplete-box-conflict");
    const [source, copied] = await Promise.all([tx.get(db.doc(`cajas/${uid}`)), tx.get(ref.collection("movements"))]);
    if (!source.exists) fail("incomplete-box-conflict");
    let original;
    try { original = sourceFrom(source.data(), sourceId); } catch { fail("incomplete-box-conflict"); }
    const rows = new Map(original.rows.map(row => [row.id, row]));
    if (data.nombre !== original.box.nombre || typeof data.currency !== "string" || !/^[A-Z]{3}$/.test(data.currency)
      || copied.docs.some(doc => !rows.has(doc.id) || !copiedBoxMovementMatches(doc.data(), rows.get(doc.id), uid))) fail("incomplete-box-conflict");
  }
  return data;
}

async function eachPage(query, visit) {
  let after;
  while (true) {
    const page = await (after ? query.startAfter(after) : query).limit(100).get();
    if (page.empty) return;
    for (const doc of page.docs) await visit(doc);
    after = page.docs.at(-1);
  }
}

async function discardCopy(db, uid, ref, deletedAuth) {
  const frozen = await db.runTransaction(async tx => {
    const data = await checkCopy(tx, db, uid, ref);
    if (!data) return false; // Finalizar ganó: NO borrar una Caja publicada.
    // El legado comprobado también queda como barrera administrativa nueva;
    // después de borrar su origen privado, Auth podrá reconocerla y purgarla.
    tx.update(ref, { migrationProtocol: 3, migrationDeletionPending: true, migrationCancelled: true,
      closed: true, closing: false, deleting: true });
    tx.delete(db.doc(`boxUsers/${uid}/spaces/${ref.id}`));
    return true;
  });
  if (!frozen) return;
  for (const child of ["movements", "invites"]) {
    while (true) {
      const done = await db.runTransaction(async tx => {
        const root = await tx.get(ref);
        if (!root.exists) return true;
        if (root.data().ownerUid !== uid || root.data().migrationComplete !== false
          || root.data().migrationDeletionPending !== true || root.data().closed !== true || root.data().deleting !== true) fail("incomplete-box-conflict");
        const query = child === "movements" ? ref.collection(child) : db.collection("boxInvites").where("boxId", "==", ref.id);
        const rows = await tx.get(query.limit(200));
        for (const doc of rows.docs) tx.delete(doc.ref);
        return rows.empty;
      });
      if (done) break;
    }
  }
  await db.runTransaction(async tx => {
    const [root, members, movements] = await Promise.all([tx.get(ref), tx.get(ref.collection("members")), tx.get(ref.collection("movements").limit(1))]);
    if (!root.exists) return;
    if (root.data().ownerUid !== uid || root.data().migrationComplete !== false || root.data().migrationDeletionPending !== true
      || !movements.empty || members.docs.some(doc => doc.id !== uid || doc.data().rol !== "owner")) fail("incomplete-box-conflict");
    tx.delete(db.doc(`boxUsers/${uid}/spaces/${ref.id}`));
    // Antes de borrar Auth conserva barrera/membresía: SDK atrasado no la recrea.
    if (deletedAuth) { for (const doc of members.docs) tx.delete(doc.ref); tx.delete(ref); }
  });
}

async function cleanStaleIndexes(db, uid) {
  await eachPage(db.collection(`boxUsers/${uid}/spaces`), async link => {
    await db.runTransaction(async tx => {
      const root = await tx.get(db.doc(`boxSpaces/${link.id}`));
      if (!root.exists || (root.data().ownerUid === uid && root.data().migrationComplete === false && root.data().migrationDeletionPending === true)) tx.delete(link.ref);
    });
  });
}

async function prepareIncompleteBoxDeletion(db, uid, action) {
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/") || !["inspect", "discard", "deleted"].includes(action)) fail("incomplete-box-invalid-request");
  await eachPage(db.collection("boxSpaces").where("ownerUid", "==", uid).where("migrationComplete", "==", false), async doc => {
    if (action === "inspect") await db.runTransaction(tx => checkCopy(tx, db, uid, doc.ref));
    else await discardCopy(db, uid, doc.ref, action === "deleted");
  });
  if (action !== "inspect") await cleanStaleIndexes(db, uid);
  return { ok: true, uid };
}

module.exports = { prepareIncompleteBoxDeletion };
