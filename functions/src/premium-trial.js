"use strict";

/** La fecha la decide el servidor y la transacción impide dos activaciones. */
async function activatePremiumTrial(db, uid, now = Date.now(), options = {}) {
  const userRef = db.doc(`users/${uid}`);
  const claimRef = db.doc(`premiumTrialClaims/${uid}`);
  return db.runTransaction(async transaction => {
    const [snapshot, claim] = await Promise.all([transaction.get(userRef), transaction.get(claimRef)]);
    if ((!snapshot.exists || snapshot.data().hasOnboarded !== true) && options.hasLocalSetup !== true) {
      throw new Error("ACCOUNT_NOT_READY");
    }
    if ((snapshot.exists && snapshot.data().accountDeletionPending === true)
      || (claim.exists && claim.data().deletionPending === true)) throw new Error("ACCOUNT_DELETING");
    // La prueba no se reinicia borrando únicamente la copia financiera. El
    // registro privado vive hasta que Auth confirma el borrado de la cuenta.
    const previouslyUsed = claim.exists ? claim.data().startedAt : snapshot.exists ? snapshot.data().premiumTrialStartedAt : undefined;
    if (claim.exists && (!Number.isFinite(previouslyUsed) || previouslyUsed < 0)) throw new Error("TRIAL_CLAIM_INVALID");
    const current = Number.isFinite(previouslyUsed) ? previouslyUsed : now;
    const activated = !Number.isFinite(previouslyUsed);
    if (!claim.exists) transaction.set(claimRef, { startedAt: current });
    if (!snapshot.exists) {
      // Gratis puede configurarse solo en el teléfono. Crear el permiso de
      // prueba NO crea una copia financiera vacía que parezca restaurable.
      transaction.set(userRef, { hasOnboarded: false, isPremium: false, premiumTrialStartedAt: current });
      return { activated, startedAt: current };
    }
    if (snapshot.data().premiumTrialStartedAt !== current) transaction.update(userRef, { premiumTrialStartedAt: current });
    return { activated, startedAt: current };
  });
}

module.exports = { activatePremiumTrial };
