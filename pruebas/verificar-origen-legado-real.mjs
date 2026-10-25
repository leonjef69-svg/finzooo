import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createSourceReader } from "./helpers/source-reader.mjs";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import { recordOriginOriginal } from "./helpers/record-origin-original.mjs";

// Las funciones públicas se leen de la revisión pedida. El productor común
// de fixtures es original actual para ambas versiones; no crea un API antiguo
// ficticio. La regresión falla porque antes se elegía una copia ambigua.
const read = createSourceReader({ revision: process.env.FINO_TEST_LEGACY_ORIGIN_BASELINE ?? "" });
const require = createRequire(import.meta.url), root = process.cwd();
async function original(file) {
  const result = await build({ entryPoints: [file], bundle: true, write: false, platform: "node", format: "cjs",
    alias: { "@": root }, plugins: [{ name: "source-revision", setup(builder) {
      builder.onLoad({ filter: /\.[jt]sx?$/ }, args => {
        const name = path.relative(root, args.path).split(path.sep).join("/");
        if (!["utils/mergeTransactions.ts", "utils/importCommit.ts", "utils/cloudHistoryMigration.ts"].includes(name)) return;
        return { contents: read(name), loader: name.endsWith(".ts") ? "ts" : "js" };
      });
    } }] });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}
const [merge, importer] = await Promise.all([original("utils/mergeTransactions.ts"), original("utils/importCommit.ts")]);
const identities = recordOriginOriginal(), nodeIdentities = require("../functions/src/record-origin.js");
// Quitar una referencia tampoco demuestra que el registro sea una edición.
// Se comprueban las funciones públicas de ambas revisiones, no una copia
// de la comparación ni la existencia de una función añadida recientemente.
const referencedBase = { id: 90, creationId: "manual-original", updatedAt: 10,
  type: "expense", amount: 10, category: "otros", date: "2026-10-09", description: "Fixture" };
for (const references of [
  { captureId: "aviso-original" },
  { internalTransferLink: "aporte-original", internalTransfer: "box", internalTransferSpaceId: "caja-original" },
]) {
  const referenced = { ...referencedBase, ...references };
  for (const field of Object.keys(references)) {
    const missing = { ...referenced, updatedAt: 20 };
    delete missing[field];
    const unchanged = JSON.stringify([referenced, missing]);
    for (const [a, b] of [[referenced, missing], [missing, referenced]]) {
      assert.throws(() => merge.mergeTransactions([a], [b]), /record-origin-conflict/,
        "la ausencia de " + field + " no permite sustituir el original");
      assert.throws(() => merge.hayNovedades([a], [b]), /record-origin-conflict/);
    }
    const edited = identities.identityForExplicitEdit(referenced, missing);
    assert.equal(edited[field], referenced[field], "editar conserva " + field + " aunque el formulario no lo envíe");
    assert.equal(merge.mergeTransactions([referenced], [edited])[0].updatedAt, 20);
    assert.equal(JSON.stringify([referenced, missing]), unchanged);
  }
}
assert.equal(identities.compatibleRecordCreation({ id: 1, creationId: null }, { id: 1 }), true,
  "dos ausencias históricas conservan compatibilidad sin inventar UUID");
const record = { id: 1, updatedAt: 10, type: "expense", amount: 10, category: "otros", date: "2026-10-09",
  description: "Cena de María 👩🏽‍💻", method: "cash", notes: "a\u00a0b\ud800" };
const other = { ...record, amount: 30, updatedAt: 20 }, before = JSON.stringify([record, other]);
for (const [a, b] of [[record, other], [other, record]]) {
  assert.throws(() => merge.mergeTransactions([a], [b]), /record-origin-conflict/,
    "la fecha/número no prueba que dos originales antiguos distintos sean la misma edición");
  assert.throws(() => merge.hayNovedades([a], [b]), /record-origin-conflict/);
}
assert.equal(JSON.stringify([record, other]), before);
const proof = identities.legacyCreationId(record);
assert.equal(proof, nodeIdentities.legacyCreationId(record), "SHA real de Noble y Node con canonical común");
assert.equal(proof, identities.legacyCreationId({ ...record, updatedAt: 999 }));
assert.equal(proof, identities.legacyCreationId(Object.fromEntries(Object.entries(record).reverse())));
for (const field of ["amount", "category", "date", "description", "method", "notes"]) {
  const changed = { ...record, [field]: field === "amount" ? 20 : "otro valor" };
  assert.notEqual(proof, identities.legacyCreationId(changed), `la huella no ignora ${field}`);
}
assert.equal(merge.mergeTransactions([record], [{ ...record, updatedAt: 20 }]).length, 1,
  "los mismos datos antiguos con otra fecha de edición no se duplican");
const explicit = identities.identityForExplicitEdit(record, other);
assert.equal(explicit.creationId, proof);
assert.equal(record.creationId, undefined, "no etiqueta el original al abrir/unir");
assert.equal(merge.mergeTransactions([record], [explicit])[0].amount, 30);
assert.equal(merge.mergeTransactions([explicit], [record])[0].amount, 30);
assert.throws(() => merge.mergeTransactions([explicit], [{ ...record, amount: 50 }]), /record-origin-conflict/);
const secondEdit = identities.identityForExplicitEdit(explicit, { ...explicit, amount: 40, updatedAt: 30 });
assert.equal(secondEdit.creationId, proof, "conserva el mismo original, no la huella de cada monto posterior");
assert.equal(merge.mergeTransactions([explicit], [secondEdit])[0].amount, 40);
const imported = importer.applyImportedTransactions([record], [], [other], [], 50);
assert.equal(imported.count, 1);
assert.equal(imported.transactions[0].creationId, proof);
assert.equal(merge.mergeTransactions([record], imported.transactions)[0].amount, 30);
assert.throws(() => importer.applyImportedTransactions([record], [other], [], []), /record-origin-conflict/);

const live = { current: [record] }, writes = [], notices = [];
const save = handlerOriginal("contexts/AppDataContext.tsx", "addOrUpdateTransaction", {
  ...merge, ...identities, transactionsLive: live, deletedTransactionIdsRef: { current: [] },
  issuedCreationId: () => undefined, isSafeMoneyAmount: () => true,
  auth: { currentUser: { uid: "ficticio" } }, localSessionVersion: { current: 1 },
  async commitTransactionMutation(upserts, _ids, _history, _legacy, prepare) {
    live.current = prepare ? prepare(live.current, []) : upserts;
    writes.push(live.current);
    return true;
  },
  showToast: value => notices.push(value), t: key => key,
  setTransactions: update => { live.current = update(live.current); writes.push(live.current); },
}, read("contexts/AppDataContext.tsx"));
assert.equal(await save({ ...record, amount: 20 }, false, true), true);
assert.equal(live.current[0].creationId, proof);
assert.equal(live.current[0].amount, 20);
assert.equal(writes.length, 1);
assert.ok(notices.includes("toast.transactionUpdated"));
assert.equal(JSON.stringify(record), JSON.stringify(JSON.parse(before)[0]));
// Exclusión es contrato estático, no prueba del módulo de tarjetas.
assert.ok(read("contexts/AppDataContext.tsx").includes('existing.method !== "credit-card-payment" && t2.method !== "credit-card-payment"'));
console.log("Originales: antiguos distintos no se eligen por fecha; edición/reemplazo explícitos conservan su original con SHA Noble/Node idéntico, segunda edición estable y copias intactas. No restaura datos perdidos ni acredita Android; tarjetas no auditadas.");
