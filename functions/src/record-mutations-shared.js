"use strict";

// Diario común cliente/servidor. La generación, no la hora del teléfono,
// distingue una copia atrasada de una recuperación intencional posterior.
function conflict() { return new Error("record-origin-conflict"); }
function mutationKey(domain, action, id, origin, from, to, toOrigin = origin) {
  if (!["transaction", "goal"].includes(domain) || !["delete", "restore"].includes(action)
    || !Number.isSafeInteger(id) || typeof origin !== "string" || !origin || typeof from !== "string"
    || action === "restore" && (typeof to !== "string" || !to || to === from || typeof toOrigin !== "string" || !toOrigin)) throw conflict();
  return `record-${action}:${domain}:${encodeURIComponent(JSON.stringify(action === "delete" ? [id, origin, from]
    : toOrigin === origin ? [id, origin, from, to] : [id, origin, from, to, toOrigin]))}`;
}
function mutationInfo(metadata, domain) {
  if (metadata != null && (typeof metadata !== "object" || Array.isArray(metadata))) throw conflict();
  const info = new Map();
  for (const [key, time] of Object.entries(metadata || {})) {
    if (key.startsWith("record-") && !["transaction", "goal"].some(group => ["delete", "restore"].some(type => key.startsWith(`record-${type}:${group}:`)))) throw conflict();
    const action = ["delete", "restore"].find(type => key.startsWith(`record-${type}:${domain}:`));
    if (!action) continue;
    if (!Number.isSafeInteger(time) || time < 0) throw conflict();
    let parts;
    try { parts = JSON.parse(decodeURIComponent(key.slice(`record-${action}:${domain}:`.length))); } catch { throw conflict(); }
    if (!Array.isArray(parts) || !(action === "delete" ? parts.length === 3 : [4, 5].includes(parts.length))
      || key !== mutationKey(domain, action, ...parts)) throw conflict();
    const [id, origin, from, to, toOrigin = origin] = parts;
    const state = info.get(id) || { id, origins: new Map(), deletes: new Map(), restores: new Map() };
    if (state.origins.has(from) && state.origins.get(from) !== origin) throw conflict();
    state.origins.set(from, origin);
    if (action === "delete") state.deletes.set(from, Math.max(time, state.deletes.get(from) ?? 0));
    else {
      const previous = state.restores.get(to);
      if (previous !== undefined && previous !== from) throw conflict();
      state.restores.set(to, from);
      if (state.origins.has(to) && state.origins.get(to) !== toOrigin) throw conflict();
      state.origins.set(to, toOrigin);
    }
    info.set(id, state);
  }
  for (const state of info.values()) {
    const children = new Map(), visited = new Set();
    for (const [child, parent] of state.restores) {
      if (!state.deletes.has(parent) || children.has(parent) && children.get(parent) !== child) throw conflict();
      children.set(parent, child);
    }
    let generation = "";
    while (children.has(generation)) {
      if (visited.has(generation)) throw conflict();
      visited.add(generation); generation = children.get(generation);
    }
    if (visited.size !== state.restores.size) throw conflict();
    for (const generation of state.deletes.keys()) if (generation && !state.restores.has(generation)) throw conflict();
    state.generation = generation; state.origin = state.origins.get(generation); state.deleted = state.deletes.has(generation);
    if (!state.origin) throw conflict();
  }
  return info;
}
function mergeMutationMetadata(a = {}, b = {}) {
  for (const domain of ["transaction", "goal"]) { mutationInfo(a, domain); mutationInfo(b, domain); }
  const metadata = {}, clock = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  for (const [key, value] of Object.entries(a)) metadata[key] = clock(value);
  for (const [key, value] of Object.entries(b)) metadata[key] = Math.max(clock(metadata[key]), clock(value));
  for (const domain of ["transaction", "goal"]) mutationInfo(metadata, domain);
  return metadata;
}
function nextClock(metadata, now) {
  let latest = Number.isSafeInteger(now) && now >= 0 ? now : 0;
  for (const value of Object.values(metadata)) if (Number.isSafeInteger(value) && value >= 0) latest = Math.max(latest, value);
  if (!Number.isSafeInteger(latest + 1)) throw conflict();
  return latest + 1;
}
function rememberDeletion(metadata, domain, records, originOf, now = Date.now()) {
  const info = mutationInfo(metadata, domain), next = { ...metadata }, time = nextClock(next, now);
  for (const record of records) {
    const origin = originOf(record), generation = record.restorationId || "", known = info.get(record.id);
    if (known && (known.origin !== origin || known.generation !== generation)) throw conflict();
    next[mutationKey(domain, "delete", record.id, origin, generation)] = time;
  }
  mutationInfo(next, domain); return next;
}
function rememberRestoration(metadata, domain, record, originOf, restorationId, now = Date.now()) {
  const state = mutationInfo(metadata, domain).get(record.id);
  if (!state || !state.deleted || state.origin !== originOf(record)) throw conflict();
  const restored = { ...record, restorationParent: state.generation, restorationId };
  const next = { ...metadata, [mutationKey(domain, "restore", record.id, state.origin, state.generation, restorationId)]: nextClock(metadata, now) };
  mutationInfo(next, domain); return { record: restored, metadata: next };
}
function rememberRebinding(metadata, domain, before, after, originOf, assertCreation, nonce, now = Date.now()) {
  if (before.id !== after.id) throw conflict();
  assertCreation(before, after);
  const deleted = rememberDeletion(metadata, domain, [before], originOf, now);
  const state = mutationInfo(deleted, domain).get(before.id), nextOrigin = originOf(after);
  const record = { ...after, restorationParent: state.generation, restorationId: nonce };
  const next = { ...deleted, [mutationKey(domain, "restore", before.id, state.origin, state.generation, nonce, nextOrigin)]: nextClock(deleted, now) };
  mutationInfo(next, domain); return { record, metadata: next };
}
function reconcileRecordCopies(local, remote, localDeleted, remoteDeleted, localMeta, remoteMeta, domain, originOf, assertOrigin, mergeRecords) {
  const left = mutationInfo(localMeta, domain), right = mutationInfo(remoteMeta, domain);
  const metadata = mergeMutationMetadata(localMeta, remoteMeta), states = mutationInfo(metadata, domain);
  const available = new Map(), rowsById = new Map();
  for (const record of [...local, ...remote]) {
    if (!Number.isSafeInteger(record.id)) throw conflict();
    const old = available.get(record.id);
    if (old) {
      const state = states.get(record.id), a = old.restorationId || "", b = record.restorationId || "";
      if (!state || a === b || state.origins.get(a) !== originOf(old) || state.origins.get(b) !== originOf(record)) assertOrigin(old, record);
    }
    available.set(record.id, record);
    const copies = rowsById.get(record.id) || []; copies.push(record); rowsById.set(record.id, copies);
  }
  for (const [rows, ids, ownInfo] of [[local, localDeleted, left], [remote, remoteDeleted, right]]) {
    for (const id of ids) {
      if (!Number.isSafeInteger(id)) throw conflict();
      const own = ownInfo.get(id);
      if (available.has(id) && !own || own && !own.deleted) throw conflict();
    }
    for (const record of rows) if (record.restorationId) {
      const own = ownInfo.get(record.id);
      if (!own || own.origins.get(record.restorationId) !== originOf(record) || own.restores.get(record.restorationId) !== record.restorationParent) throw conflict();
    }
  }
  const deleted = new Set([...localDeleted, ...remoteDeleted]);
  for (const [id, state] of states) {
    if (state.deleted) deleted.add(id); else deleted.delete(id);
    const records = rowsById.get(id) || [];
    if (records.some(record => originOf(record) !== state.origins.get(record.restorationId || ""))) throw conflict();
    if (!state.deleted && state.generation && !records.some(record => record.restorationId === state.generation)) throw conflict();
  }
  const keep = rows => rows.filter(record => {
    const state = states.get(record.id);
    return !deleted.has(record.id) && (!state || (record.restorationId || "") === state.generation);
  });
  return { records: mergeRecords(keep(local), keep(remote)), deletedIds: [...deleted].sort((a, b) => b - a), metadata };
}
function metadataForRecord(metadata, domain, id) {
  const out = {};
  mutationInfo(metadata, domain);
  for (const [key, time] of Object.entries(metadata || {})) {
    const action = ["delete", "restore"].find(type => key.startsWith(`record-${type}:${domain}:`));
    if (action && JSON.parse(decodeURIComponent(key.slice(`record-${action}:${domain}:`.length)))[0] === id) out[key] = time;
  }
  return out;
}
function metadataByRecord(metadata, domain) {
  const groups = new Map(); mutationInfo(metadata, domain);
  for (const [key, time] of Object.entries(metadata || {})) {
    const action = ["delete", "restore"].find(type => key.startsWith(`record-${type}:${domain}:`));
    if (!action) continue;
    const id = JSON.parse(decodeURIComponent(key.slice(`record-${action}:${domain}:`.length)))[0];
    const group = groups.get(id) || {}; group[key] = time; groups.set(id, group);
  }
  return groups;
}
module.exports = { mutationKey, mutationInfo, mergeMutationMetadata, rememberDeletion, rememberRestoration, rememberRebinding, reconcileRecordCopies, metadataForRecord, metadataByRecord };
