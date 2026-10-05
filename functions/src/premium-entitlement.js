"use strict";

function testerPremium(testerData) {
  const grantedAt = testerData?.grantedAt;
  return testerData?.active === true && typeof grantedAt?.toMillis === "function"
    && Number.isFinite(grantedAt.toMillis()) && grantedAt.toMillis() > 0;
}

function premium(data, now = Date.now(), testerData = null) {
  return data?.accountDeletionPending !== true && (testerPremium(testerData)
    || data?.isPremium === true
    || (Number.isFinite(data?.premiumTrialStartedAt)
      && data.premiumTrialStartedAt <= now
      && data.premiumTrialStartedAt + 86_400_000 > now));
}

async function premiumForUser(db, uid, userData, transaction = null) {
  const ref = db.collection("testerPremium").doc(uid);
  const claimRef = db.collection("premiumTrialClaims").doc(uid);
  const [snapshot, claim] = await Promise.all([
    transaction ? transaction.get(ref) : ref.get(),
    transaction ? transaction.get(claimRef) : claimRef.get(),
  ]);
  if (claim.exists && claim.data().deletionPending === true) return false;
  return premium(userData, Date.now(), snapshot.exists ? snapshot.data() : null);
}

module.exports = { premium, premiumForUser, testerPremium };
