import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import vm from "node:vm";

// Run the real cloud module against a transactional in-memory Firestore boundary.
const documents = new Map();
let failCommit = false;
const snap = ref => ({ exists: () => documents.has(ref), data: () => documents.get(ref), id: ref.split("/").pop() });
const api = {
  doc: (_db, ...parts) => parts.join("/"),
  collection: (_db, ...parts) => parts.join("/"),
  getDoc: async ref => snap(ref),
  getDocs: async ref => ({ docs: [...documents.keys()].filter(key => key.startsWith(ref + "/")).map(snap) }),
  orderBy: () => null,
  query: ref => ref,
  serverTimestamp: () => 1,
  addDoc: async (ref, value) => documents.set(ref + "/movement", value),
  runTransaction: async (_db, callback) => {
    const staged = new Map();
    await callback({
      get: async ref => snap(ref),
      update: (ref, value) => staged.set(ref, { ...documents.get(ref), ...value }),
      set: (ref, value) => staged.set(ref, { ...documents.get(ref), ...value }),
    });
    if (failCommit) throw Error("offline");
    staged.forEach((value, ref) => documents.set(ref, value));
  },
};
const compiled = buildSync({ entryPoints: ["utils/cloudFamilia.ts"], bundle: true, write: false, platform: "node", format: "cjs", external: ["firebase/firestore", "@/utils/firebase", "@/utils/familia"] });
const module = { exports: {} };
vm.runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, require: id => id === "firebase/firestore" ? api : id === "@/utils/firebase" ? { db: {} } : { crearCodigoFamilia: () => "TESTCODE" } });
const cloud = module.exports;
documents.set("familySpaces/f", { ownerUid: "owner", nombre: "Family" });
documents.set("familyUsers/owner", { activeFamilyId: "f" });
await assert.rejects(() => cloud.cerrarFamilia("guest", "f"));
assert.equal(documents.get("familySpaces/f").closed, undefined);
failCommit = true;
await assert.rejects(() => cloud.cerrarFamilia("owner", "f"));
assert.equal(documents.get("familyUsers/owner").activeFamilyId, "f");
assert.equal(documents.get("familySpaces/f").closed, undefined);
failCommit = false;
await cloud.guardarMovimientoFamilia("f", "owner", { tipo: "gasto", monto: 20, descripcion: "Dinner", fecha: "2026-09-06", method: "debit" });
assert.equal((await cloud.listarMovimientosFamilia("f"))[0].method, "debit");
await cloud.cerrarFamilia("owner", "f");
assert.equal(documents.get("familySpaces/f").closed, true);
assert.equal(documents.get("familyUsers/owner").activeFamilyId, "");
assert.equal(documents.get("familySpaces/f/movements/movement").monto, 20);
documents.set("familyUsers/guest", { activeFamilyId: "f" });
assert.equal(await cloud.cargarFamiliaActiva("guest"), null);
console.log("Cierre familiar: propietario, operación atómica, historial conservado y método de pago verificados.");
