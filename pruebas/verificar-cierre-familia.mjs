import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import vm from "node:vm";

// Run the real cloud module against a transactional in-memory Firestore boundary.
const documents = new Map();
let failCommit = false;
let addedDocuments = 0;
let callableUid = "";
let generatedFamilyIds = 0;
let generatedMovementIds = 0;
const keyOf = ref => typeof ref === "string" ? ref : ref.path;
const snap = ref => {
  const key = keyOf(ref);
  return { exists: () => documents.has(key), data: () => documents.get(key), id: key.split("/").pop() };
};
const api = {
  doc: (dbOrCollection, ...parts) => {
    if (parts.length) return (typeof dbOrCollection === "string" ? [dbOrCollection, ...parts] : parts).join("/");
    const collection = keyOf(dbOrCollection);
    if (collection === "familySpaces") {
      const id = `new-family-${++generatedFamilyIds}`;
      return { id, path: `familySpaces/${id}` };
    }
    if (collection.endsWith("/movements")) {
      const id = `initial-movement-${++generatedMovementIds}`;
      return { id, path: `${collection}/${id}` };
    }
    return dbOrCollection;
  },
  collection: (_db, ...parts) => parts.join("/"),
  getDoc: async ref => snap(ref),
  getDocs: async ref => ({ docs: [...documents.keys()].filter(key => key.startsWith(keyOf(ref) + "/")).map(snap) }),
  orderBy: () => null,
  query: ref => ref,
  arrayUnion: (...values) => values,
  serverTimestamp: () => 1,
  addDoc: async (ref, value) => {
    const id = `movement${++addedDocuments}`;
    documents.set(keyOf(ref) + `/${id}`, value);
    return { id };
  },
  updateDoc: async (ref, value) => documents.set(keyOf(ref), { ...documents.get(keyOf(ref)), ...value }),
  runTransaction: async (_db, callback) => {
    const staged = new Map();
    await callback({
      get: async ref => snap(ref),
      update: (ref, value) => staged.set(keyOf(ref), { ...documents.get(keyOf(ref)), ...value }),
      set: (ref, value) => staged.set(keyOf(ref), { ...documents.get(keyOf(ref)), ...value }),
      delete: ref => staged.set(keyOf(ref), undefined),
    });
    if (failCommit) throw Error("offline");
    staged.forEach((value, ref) => value === undefined ? documents.delete(ref) : documents.set(ref, value));
  },
  writeBatch: () => {
    const staged = new Map();
    return {
      update: (ref, value) => staged.set(keyOf(ref), { ...documents.get(keyOf(ref)), ...value }),
      set: (ref, value) => staged.set(keyOf(ref), { ...documents.get(keyOf(ref)), ...value }),
      delete: ref => staged.set(keyOf(ref), undefined),
      commit: async () => {
        if (failCommit) throw Error("offline");
        staged.forEach((value, ref) => value === undefined ? documents.delete(ref) : documents.set(ref, value));
      },
    };
  },
};
const contributionApi = {
  cerrarEspacioCompartido: async (_kind, familyId) => {
    const family = documents.get(`familySpaces/${familyId}`);
    if (!family || family.ownerUid !== callableUid) throw Error("not-owner");
    if (failCommit) throw Error("offline");
    const prefix = `familySpaces/${familyId}/movements/`;
    const movements = [...documents.entries()].filter(([key]) => key.startsWith(prefix)).map(([, value]) => value);
    const balance = movements.reduce((sum, item) => sum + (item.tipo === "ingreso" ? item.monto : -item.monto), 0);
    if (Math.abs(balance) > 0.005) throw Error("unsettled-personal-contributions");
    documents.set(`familySpaces/${familyId}`, { ...family, closed: true, closing: false });
  },
  prepararBorradoEspacioCompartido: async () => {},
  salirEspacioCompartido: async () => {},
};
const compiled = buildSync({ entryPoints: ["utils/cloudFamilia.ts"], bundle: true, write: false, platform: "node", format: "cjs", external: ["firebase/firestore", "@/utils/firebase", "@/utils/familia", "@/utils/personalContribution", "@/utils/legalAcceptance"] });
const module = { exports: {} };
// Solo el cierre financiero; aceptación se comprueba en su suite original aparte.
vm.runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports, require: id => id === "firebase/firestore" ? api : id === "@/utils/firebase" ? { db: {} } : id === "@/utils/personalContribution" ? contributionApi : id === "@/utils/legalAcceptance" ? { assertSharedContentAccepted: async () => {} } : { crearCodigoFamilia: () => "TESTCODE" } });
const cloud = module.exports;
const initialMovement = {
  tipo: "ingreso", monto: 10, descripcion: "Monto inicial desde Personal", fecha: "2026-10-02",
  method: "transfer", personalTransactionId: 700, personalOwnerUid: "owner",
};
failCommit = true;
await assert.rejects(() => cloud.crearFamilia("owner", "Owner", "Atomic failed", "PEN", initialMovement), /offline/);
assert.equal([...documents.keys()].some(key => key.startsWith("familySpaces/new-family-1")), false, "si se rechaza el aporte inicial no queda una Familia parcial");
failCommit = false;
const creadaConAporte = await cloud.crearFamilia("owner", "Owner", "Atomic success", "PEN", initialMovement);
assert.equal(typeof creadaConAporte.movimientoInicialId, "string");
assert.equal(documents.get(`familySpaces/${creadaConAporte.id}/movements/${creadaConAporte.movimientoInicialId}`).monto, 10, "el aporte inicial se confirma en la misma operación que la Familia");
documents.set("familySpaces/f", { ownerUid: "owner", nombre: "Family" });
documents.set("familyUsers/owner", { activeFamilyId: "f" });
documents.set("familySpaces/f/members/owner", { uid: "owner", rol: "owner" });
callableUid = "guest";
await assert.rejects(() => cloud.cerrarFamilia("guest", "f"));
assert.equal(documents.get("familySpaces/f").closed, undefined);
failCommit = true;
callableUid = "owner";
await assert.rejects(() => cloud.cerrarFamilia("owner", "f"));
assert.equal(documents.get("familyUsers/owner").activeFamilyId, "f");
assert.equal(documents.get("familySpaces/f").closed, undefined);
failCommit = false;
await cloud.guardarMovimientoFamilia("f", "owner", { tipo: "gasto", monto: 20, descripcion: "Dinner", fecha: "2026-09-06", method: "debit" });
assert.equal((await cloud.listarMovimientosFamilia("f"))[0].method, "debit");
await assert.rejects(() => cloud.cerrarFamilia("owner", "f"), /unsettled-personal-contributions/);
assert.equal(documents.get("familySpaces/f").closed, undefined);
await cloud.guardarMovimientoFamilia("f", "owner", { tipo: "ingreso", monto: 20, descripcion: "Refund", fecha: "2026-09-06", method: "cash" });
await cloud.cerrarFamilia("owner", "f");
assert.equal(documents.get("familySpaces/f").closed, true);
assert.equal(documents.get("familyUsers/owner").activeFamilyId, "");
assert.equal(documents.get("familySpaces/f/movements/movement1").monto, 20);
documents.set("familyUsers/guest", { activeFamilyId: "f" });
assert.equal(await cloud.cargarFamiliaActiva("guest"), null);
console.log("Cierre familiar: propietario, operación atómica, historial conservado y método de pago verificados.");
