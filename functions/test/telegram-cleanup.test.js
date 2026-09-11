"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanupTelegram, cleanupExpiredTelegram } = require("../src/telegram-cleanup");

function database(seed) {
  const data = new Map(Object.entries(seed));
  const ref = path => ({ path, id: path.split("/")[1] });
  const snap = r => ({ ref: r, id: r.id, exists: data.has(r.path), data: () => data.get(r.path) });
  return { data,
    collection: name => ({ doc: id => ref(`${name}/${id}`), where: (field, op, value) => {
      const query = { limit: () => query, get: async () => ({ docs: [...data.keys()].filter(path => {
        const row = data.get(path);
        return path.startsWith(`${name}/`) && (op === "==" ? row[field] === value : row[field] <= value);
      }).map(path => snap(ref(path))) }) };
      return query;
    } }),
    runTransaction: async callback => callback({ get: async r => snap(r), delete: r => data.delete(r.path) }),
  };
}
test("desconectar limpia datos del chat y conserva usuarios ajenos", async () => {
  const db = database({ "users/a": {}, "telegramConnections/1": { uid: "a" }, "telegramDrafts/1": { uid: "a" }, "telegramUndo/1": { uid: "a" }, "telegramConnections/2": { uid: "b" } });
  await cleanupTelegram(db, "a");
  assert.equal(db.data.has("telegramConnections/1"), false);
  assert.equal(db.data.has("telegramDrafts/1"), false);
  assert.equal(db.data.has("telegramUndo/1"), false);
  assert.equal(db.data.has("telegramConnections/2"), true);
});
test("un evento antiguo no borra una reconexión activa", async () => {
  const db = database({ "users/a": {}, "telegramUsers/a": { active: true, chatId: "1" }, "telegramConnections/1": { uid: "a" }, "telegramDrafts/1": { uid: "a" } });
  await cleanupTelegram(db, "a");
  assert.equal(db.data.has("telegramConnections/1"), true);
  assert.equal(db.data.has("telegramDrafts/1"), true);
});
test("cuenta eliminada limpia estado, códigos y borradores huérfanos", async () => {
  const db = database({ "telegramUsers/a": { active: true, chatId: "1" }, "telegramConnections/1": { uid: "a" }, "telegramLinkRequests/ABC": { uid: "a" }, "telegramUndo/old": { uid: "a" }, "telegramLinkRequests/DEF": { uid: "b" } });
  await cleanupTelegram(db, "a", true);
  assert.deepEqual([...db.data.keys()], ["telegramLinkRequests/DEF"]);
});
test("limpieza temporal conserva registros no vencidos", async () => {
  const db = database({ "telegramDrafts/old": { expiresAtMs: 100 }, "telegramDrafts/new": { expiresAtMs: 300 }, "telegramUndo/missing": {} });
  await cleanupExpiredTelegram(db, 200);
  assert.equal(db.data.has("telegramDrafts/old"), false);
  assert.equal(db.data.has("telegramDrafts/new"), true);
  assert.equal(db.data.has("telegramUndo/missing"), true);
});
