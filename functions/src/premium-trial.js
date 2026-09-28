"use strict";

/** La fecha la decide el servidor y la transacción impide dos activaciones. */
async function activatePremiumTrial(db, uid, now = Date.now()) {
  const userRef = db.doc(`users/${uid}`);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists || snapshot.data().hasOnboarded !== true) {
      throw new Error("ACCOUNT_NOT_READY");
    }
    const current = snapshot.data().premiumTrialStartedAt;
    if (Number.isFinite(current)) return { activated: false, startedAt: current };
    transaction.update(userRef, { premiumTrialStartedAt: now });
    return { activated: true, startedAt: now };
  });
}

module.exports = { activatePremiumTrial };
