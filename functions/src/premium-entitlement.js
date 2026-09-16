"use strict";

function premium(data, now = Date.now(), testerData = null) {
  return testerData?.active === true
    || data?.isPremium === true
    || (Number.isFinite(data?.premiumTrialStartedAt)
      && data.premiumTrialStartedAt <= now
      && data.premiumTrialStartedAt + 86_400_000 > now);
}

async function premiumForUser(db, uid, userData, transaction = null) {
  const ref = db.collection("testerPremium").doc(uid);
  const snapshot = await (transaction ? transaction.get(ref) : ref.get());
  return premium(userData, Date.now(), snapshot.exists ? snapshot.data() : null);
}

module.exports = { premium, premiumForUser };
