"use strict";
const { createHash } = require("node:crypto");
const { canonicalValue, legacyCanonical, canAnchorLegacy, compatibleCreation, explicitEditIdentity, originForRecord, deletionIdentity } = require("./record-origin-canonical");

function legacyCreationId(record) {
  return `legacy:${createHash("sha256").update(legacyCanonical(record), "utf8").digest("hex")}`;
}
function compatibleRecordCreation(a, b) {
  return compatibleCreation(a, b, legacyCreationId);
}
function identityForExplicitEdit(original, candidate) {
  return explicitEditIdentity(original, candidate, legacyCreationId);
}
function recordOriginOf(record) { return originForRecord(record, legacyCreationId); }
function recordDeletionIdentity(record) { return deletionIdentity(record, legacyCreationId); }
module.exports = { canonicalValue, legacyCanonical, canAnchorLegacy, legacyCreationId, compatibleRecordCreation, identityForExplicitEdit, recordOriginOf, recordDeletionIdentity };
