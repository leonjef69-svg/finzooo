import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const tick = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function environment() {
  const auth = { currentUser: { uid: "A" } }, gate = deferred(), calls = [];
  let session = 1, revision = 0, pending = false, now = 1000;
  const entry = { exports: {} }, deps = {
    "@/utils/firebase": { auth }, "@/utils/storage": { getAccountStorageSession: () => session },
    "@/utils/familyMutation": { familyMutationVersion: () => revision, familyMutationPending: () => pending },
    "@/utils/spaceRead": { shareSpaceRead: (scope, work) => { calls.push(scope); return Promise.resolve().then(work); } },
    "@/utils/cloudFamilia": { listarFamilias: () => gate.promise },
    "@/utils/cloudCajasCompartidas": { listarCajasCompartidas: async () => [{ id: "b", nombre: "Caja" }] },
  };
  const js = ts.transpileModule(fs.readFileSync("utils/spaceCatalog.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(js, { module: entry, exports: entry.exports, Date: { now: () => now }, require: name => { assert.ok(name in deps, `no consulta historiales ni escribe: ${name}`); return deps[name]; } });
  return { ...entry.exports, auth, calls, gate, session: value => { session = value; }, mutate: () => { revision++; pending = true; }, time: value => { now = value; } };
}
{
  const e = environment(); e.warmSpaceCatalogs("A"); e.warmSpaceCatalogs("A"); await tick();
  assert.equal(e.calls.length, 2, "una lectura por catálogo, incluso con peticiones simultáneas");
  assert.equal(e.peekFamilyCatalog("A"), undefined, "un pendiente no es una lista vacía confirmada");
  e.gate.resolve([{ id: "f", nombre: "Familia" }]); await tick();
  assert.equal(e.peekFamilyCatalog("A")[0].id, "f"); assert.equal(e.peekBoxCatalog("A")[0].id, "b");
  e.warmSpaceCatalogs("A"); assert.equal(e.calls.length, 2);
  e.time(31001); assert.equal(e.peekFamilyCatalog("A")[0].id, "f", "los nombres conocidos no vuelven a ocultarse por tiempo; nunca confirman dinero");
  e.warmSpaceCatalogs("A"); await tick(); assert.equal(e.calls.length, 4, "la siguiente preparación sí renueva ambos catálogos vencidos");
}
for (const reason of ["other-account", "same-uid-object", "session", "money", "clock"]) {
  const e = environment(); e.warmSpaceCatalogs("A"); await tick();
  if (reason === "session") e.session(2);
  else if (reason === "money") e.mutate();
  else if (reason === "clock") e.time(1);
  else e.auth.currentUser = { uid: reason === "other-account" ? "B" : "A" };
  e.gate.resolve([{ id: "private-family" }]); await tick();
  assert.equal(e.peekFamilyCatalog("A"), undefined, reason); assert.equal(e.peekBoxCatalog("A"), undefined, reason);
}
{
  const e = environment(); e.warmSpaceCatalogs("B"); assert.equal(e.calls.length, 0);
  e.mutate(); e.warmSpaceCatalogs("A"); assert.equal(e.calls.length, 0, "ninguna consulta mientras cambia dinero");
}
{
  const e = environment(); e.warmSpaceCatalogs("A"); await tick(); e.gate.reject(Error("offline")); await tick();
  assert.equal(e.peekFamilyCatalog("A"), undefined); e.warmSpaceCatalogs("A"); await tick();
  assert.equal(e.calls.filter(x => x.key === "family:list").length, 2, "un fallo permite reintentar");
}
console.log("Catálogos originales con IO adaptado: solo nombres, lecturas únicas, sin historiales/escrituras; sesión/cuenta/revisión/reloj, fallos y vencimiento protegidos. No acredita arranque ni fluidez Android.");
