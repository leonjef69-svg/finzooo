import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { buildSync } from "esbuild";

const root = process.cwd(), require = createRequire(import.meta.url);
const built = buildSync({ entryPoints: ["constants/legal.ts"], bundle: true, platform: "node", format: "cjs", write: false });
const policy = { exports: {} }; new Function("module", "exports", built.outputFiles[0].text)(policy, policy.exports);
const { DOCUMENTS } = require("../functions/src/legal-acceptance.js");
const docs = { termsHash: createHash("sha256").update(policy.exports.TERMS_AND_CONDITIONS).digest("hex"),
  privacyHash: createHash("sha256").update(policy.exports.PRIVACY_POLICY).digest("hex") };
assert.equal(docs.termsHash, DOCUMENTS.termsHash); assert.equal(docs.privacyHash, DOCUMENTS.privacyHash);
for (const value of [DOCUMENTS.version, ...Object.values(docs)]) assert.ok(readFileSync("firestore.rules", "utf8").includes(`'${value}'`), "contrato exacto app/servidor/reglas, no prueba de reglas publicadas");
function environment() {
  const module = { exports: {} }, auth = { currentUser: { uid: "A" } };
  let session = 1, calls = 0, now = 1000, implementation = async payload => ({ data: { ...payload, format: 1, uid: auth.currentUser.uid, version: DOCUMENTS.version, acceptedAt: Date.now() } });
  const js = ts.transpileModule(readFileSync("utils/legalAcceptanceRemote.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modules = { "firebase/functions": { httpsCallable: (_functions, name) => { assert.equal(name, "acceptLegalDocuments"); return async payload => { calls++; return implementation(payload); }; } },
    "@/utils/firebase": { auth, functions: {} }, "@/utils/storage": { getAccountStorageSession: () => session }, "@/utils/withTimeout": { withTimeout: promise => promise } };
  new Function("module", "exports", "require", "Date", js)(module, module.exports, name => { if (!(name in modules)) throw new Error(`Unknown IO ${name}`); return modules[name]; }, { now: () => now });
  return { ...module.exports, auth, calls: () => calls, time: value => { now = value; }, session: value => { session = value; }, response: fn => { implementation = fn; } };
}
{
  const a = environment();
  await Promise.all([a.confirmLegalAcceptance("A", docs), a.confirmLegalAcceptance("A", docs)]);
  await a.confirmLegalAcceptance("A", docs); assert.equal(a.calls(), 1, "misma sesión/documentos no repite lecturas remotas");
  a.session(2); await a.confirmLegalAcceptance("A", docs); assert.equal(a.calls(), 2);
  a.time(301001); await a.confirmLegalAcceptance("A", docs); assert.equal(a.calls(), 3, "vence la confirmación de memoria, sin escribir otra aceptación");
  a.forgetLegalAcceptanceConfirmation("A"); await a.confirmLegalAcceptance("A", docs); assert.equal(a.calls(), 4, "volver a elegir retira confirmación antigua");
  a.auth.currentUser = { uid: "B" }; await assert.rejects(a.confirmLegalAcceptance("A", docs), /legal-account-changed/);
}
for (const change of [{ uid: "B" }, { termsHash: "f".repeat(64) }, { privacyHash: "f".repeat(64) }, { acceptedAt: 0 }, { termsAccepted: false }, { format: 2 }, { version: "" }]) {
  const a = environment(); a.response(async payload => ({ data: { ...payload, format: 1, uid: "A", version: DOCUMENTS.version, acceptedAt: 1000, ...change } }));
  await assert.rejects(a.confirmLegalAcceptance("A", docs), /legal-invalid-response/);
  a.response(async payload => ({ data: { ...payload, format: 1, uid: "A", version: DOCUMENTS.version, acceptedAt: 1000 } }));
  await a.confirmLegalAcceptance("A", docs); assert.equal(a.calls(), 2, "error permite reintentar, sin guardar falsa confirmación");
}
for (const change of ["account", "session"]) {
  const a = environment(); let resolve;
  a.response(payload => new Promise(done => { resolve = () => done({ data: { ...payload, format: 1, uid: "A", version: DOCUMENTS.version, acceptedAt: 1000 } }); }));
  const pending = a.confirmLegalAcceptance("A", docs), rejected = assert.rejects(pending, /legal-account-changed/);
  if (change === "account") { a.auth.currentUser = { uid: "B" }; a.auth.currentUser = { uid: "A" }; }
  else a.session(2);
  resolve(); await rejected;
}
console.log("Confirmación original con IO adaptado: ACK propio/exacto, sesión A→B→A, doble llamada compartida y errores sin caché; huellas app/servidor/reglas iguales. No prueba HTTP, jurídica ni Android.");
