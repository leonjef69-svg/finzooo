import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Bóveda, almacén y cifrado originales; IO Android/Auth adaptados en memoria.
// Las pausas se producen en las fronteras IO reales. No usa datos del emulador.
const root = process.cwd(), require = createRequire(import.meta.url);
const read = createSourceReader({ revision: process.env.FINO_VAULT_SESSION_BASELINE ?? "" });
const ownerKey = "finzo:localAccountOwner:v1", prefix = "finzo:localAccountVault:v1:";
const account = uid => ({ uid, email: `${uid.toLowerCase()}@example.test`, emailVerified: true });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
async function environment() {
  const result = await build({ stdin: { contents: `
    export { auth } from '@/utils/firebase';
    export { default as disk } from '@react-native-async-storage/async-storage';
    export { decryptText } from '@/utils/encryption';
    export { getAccountStorageSession, setAccountStorageAvailable, loadJSON, saveJSONNow, clearAccountData, STORAGE_KEYS } from '@/utils/storage';
    export { prepareLocalAccount, archiveLocalAccount, withLocalAccountOperation } from '@/utils/localAccountVault';
  `, resolveDir: root, sourcefile: "vault-session-original.ts", loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    alias: { "@": root, "@/utils/firebase": path.join(root, "pruebas/stubs/firebase-local.ts"),
      "@react-native-async-storage/async-storage": path.join(root, "pruebas/stubs/async-storage.ts"),
      "expo-secure-store": path.join(root, "pruebas/stubs/secure-store.ts") },
    plugins: [{ name: "original-vault-and-memory-io", setup(bundle) {
      bundle.onLoad({ filter: /[\\/]utils[\\/]localAccountVault\.ts$/ }, () => ({ contents: read("utils/localAccountVault.ts"), loader: "ts", resolveDir: path.join(root, "utils") }));
      bundle.onResolve({ filter: /^expo-crypto$/ }, () => ({ path: "crypto", namespace: "memory-io" }));
      bundle.onLoad({ filter: /.*/, namespace: "memory-io" }, () => ({ contents: `
        import { randomBytes, randomUUID as uuid, createHash } from 'node:crypto';
        export async function getRandomBytesAsync(length) { return randomBytes(length); }
        export function randomUUID() { return uuid(); }
        export const CryptoDigestAlgorithm = { SHA256: 'SHA256' };
        export async function digestStringAsync(_algorithm, text) { return createHash('sha256').update(text).digest('hex'); }
      `, loader: "js" }));
    } }] });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}
async function owner(api) { return JSON.parse(await api.decryptText(await api.disk.getItem(ownerKey))); }
async function snapshots(api) {
  const keys = (await api.disk.getAllKeys()).filter(key => key.startsWith(prefix)).sort();
  return new Map(await api.disk.multiGet(keys));
}
async function seed() {
  const api = await environment();
  api.setAccountStorageAvailable(true);
  api.auth.currentUser = account("A");
  await api.saveJSONNow(api.STORAGE_KEYS.profile, { hasOnboarded: true, userEmail: "a@example.test", userName: "Cuenta A sintética" });
  await api.saveJSONNow(api.STORAGE_KEYS.transactions, [{ id: 50, amount: 50, description: "A sintética" }]);
  await api.prepareLocalAccount("A", "a@example.test");
  await api.archiveLocalAccount("A", "a@example.test"); await api.clearAccountData();
  api.auth.currentUser = account("B");
  await api.prepareLocalAccount("B", "b@example.test");
  await api.saveJSONNow(api.STORAGE_KEYS.profile, { hasOnboarded: true, userEmail: "b@example.test", userName: "Cuenta B sintética" });
  await api.saveJSONNow(api.STORAGE_KEYS.transactions, [{ id: 70, amount: 70, description: "B sintética" }]);
  await api.archiveLocalAccount("B", "b@example.test"); await api.clearAccountData();
  api.auth.currentUser = account("A"); await api.prepareLocalAccount("A", "a@example.test");
  assert.equal((await api.loadJSON(api.STORAGE_KEYS.transactions, []))[0].amount, 50);
  return api;
}
const sessionError = error => error?.name === "LocalAccountVaultError" && error.reason === "owner";
async function blocked(api) {
  assert.equal(api.getAccountStorageSession(), null, "la restauración cancelada deja bloqueadas las lecturas");
  assert.deepEqual(await api.loadJSON(api.STORAGE_KEYS.transactions, []), [], "no expone los datos restaurados bajo otra sesión");
}
async function recover(api) {
  api.auth.currentUser = account("A"); assert.equal(await api.prepareLocalAccount("A", "a@example.test"), true);
  assert.equal((await api.loadJSON(api.STORAGE_KEYS.transactions, []))[0].amount, 50, "reintento recupera A desde su archivo genuino");
  api.auth.currentUser = account("B"); api.setAccountStorageAvailable(false);
  assert.equal(await api.prepareLocalAccount("B", "b@example.test"), true);
  assert.equal((await api.loadJSON(api.STORAGE_KEYS.transactions, []))[0].amount, 70, "reintento recupera B sin perder su copia genuina");
}
const cases = [], test = (name, run) => cases.push({ name, run });

for (const replacement of ["C", "B"]) {
  test(`cola conserva la instancia solicitante aunque Auth cambie a ${replacement}`, async () => {
    const api = await seed(), saved = await snapshots(api), beforeOwner = await api.disk.getItem(ownerKey);
    const reached = deferred(), released = deferred();
    const queue = api.withLocalAccountOperation(async () => { reached.resolve(); await released.promise; });
    await reached.promise;
    api.auth.currentUser = account("B"); api.setAccountStorageAvailable(false);
    const pending = api.prepareLocalAccount("B", "b@example.test");
    const rejected = assert.rejects(pending, sessionError, "petición encolada no empieza bajo otra instancia Auth");
    api.auth.currentUser = account(replacement); released.resolve(); await queue; await rejected;
    assert.equal(await api.disk.getItem(ownerKey), beforeOwner, "la petición descartada no cambia el dueño anterior");
    assert.deepEqual(await snapshots(api), saved, "los archivos/punteros confirmados permanecen idénticos");
    await blocked(api); await recover(api);
  });
}

for (const phase of ["read-owner", "clear", "copy", "claim"]) {
  for (const replacement of ["C", "B"]) {
    test(`cambio a ${replacement} durante ${phase} no confirma la restauración vieja`, async () => {
      const api = await seed(), saved = await snapshots(api), previousOwner = await api.disk.getItem(ownerKey);
      const get = api.disk.getItem, set = api.disk.setItem, remove = api.disk.multiRemove;
      let changed = false;
      const change = () => { changed = true; api.auth.currentUser = account(replacement); };
      api.disk.getItem = async key => {
        const raw = await get(key);
        if (!changed && phase === "read-owner" && key === ownerKey) change();
        return raw;
      };
      api.disk.multiRemove = async keys => {
        await remove(keys);
        if (!changed && phase === "clear" && keys.includes(api.STORAGE_KEYS.transactions)) change();
      };
      api.disk.setItem = async (key, raw) => {
        await set(key, raw);
        if (changed) return;
        if (phase === "copy" && key === api.STORAGE_KEYS.transactions) change();
        if (phase === "claim" && key === ownerKey) {
          const written = JSON.parse(await api.decryptText(raw));
          if (written.uid === "B" && written.mode === "active") change();
        }
      };
      api.auth.currentUser = account("B"); api.setAccountStorageAvailable(false);
      await assert.rejects(api.prepareLocalAccount("B", "b@example.test"), sessionError, "una restauración atrasada no anuncia apertura válida");
      assert.equal(changed, true, "se alcanzó la frontera IO real bajo prueba");
      api.disk.getItem = get; api.disk.setItem = set; api.disk.multiRemove = remove;
      if (phase === "read-owner") assert.equal(await api.disk.getItem(ownerKey), previousOwner);
      else assert.deepEqual(await owner(api), { uid: "A", mode: "archived" }, "conserva dueño/puntero recuperables, no pierde la identificación anterior");
      // Una restauración puede copiar parte de las claves activas antes de
      // detectar el cambio. Esas claves quedan bloqueadas; las snapshots
      // confirmadas nunca se borran por la cancelación. Archivar A activa
      // sí puede confirmar otra generación antes de empezar la restauración.
      // El puntero cambia legítimamente; mantiene la generación original.
      for (const [key, raw] of saved) {
        const currentRaw = await api.disk.getItem(key);
        if (key === `${prefix}A:manifest` && currentRaw !== raw) {
          const before = JSON.parse(await api.decryptText(raw));
          const after = JSON.parse(await api.decryptText(currentRaw));
          assert.equal(after.previous, before.current, "archivo nuevo conserva generación anterior exacta");
          const currentCopy = JSON.parse(await api.decryptText(await api.disk.getItem(after.current)));
          const rows = new Map(currentCopy.entries);
          const ref = rows.get(api.STORAGE_KEYS.transactions);
          assert.equal(JSON.parse(await api.decryptText(await api.disk.getItem(ref)))[0].amount, 50,
            "nueva generación conserva el dinero original de A");
        } else assert.equal(currentRaw, raw, `snapshot original preservada: ${key}`);
      }
      await blocked(api); await recover(api);
    });
  }
}

test("restauración moderna conocida por UID no pide nueva verificación legacy", async () => {
  const api = await seed(); api.auth.currentUser = { ...account("B"), emailVerified: false };
  api.setAccountStorageAvailable(false);
  assert.equal(await api.prepareLocalAccount("B", "b@example.test"), true);
  assert.equal((await api.loadJSON(api.STORAGE_KEYS.transactions, []))[0].amount, 70);
});

for (const scenario of ["A sin copia", "A con copia antigua", "B con copia antigua de A"]) {
  test(`perfil ausente: ${scenario} conserva los bloques activos y su dueño`, async () => {
    const api = scenario === "A sin copia" ? await environment() : await seed();
    if (scenario === "A sin copia") {
      api.auth.currentUser = account("A"); api.setAccountStorageAvailable(true);
      await api.saveJSONNow(api.STORAGE_KEYS.profile, { hasOnboarded: true, userEmail: "a@example.test" });
      await api.prepareLocalAccount("A", "a@example.test");
    }
    const original = [{ id: 50, amount: 50, description: "A original sintética" },
      { id: 91, amount: 91, description: "Cambio más reciente de A" }];
    await api.saveJSONNow(api.STORAGE_KEYS.transactions, original);
    await api.saveJSONNow(api.STORAGE_KEYS.budgets, { "2026-10": 250 });
    await api.disk.removeItem(api.STORAGE_KEYS.profile);
    const financialKeys = [api.STORAGE_KEYS.transactions, api.STORAGE_KEYS.budgets];
    const financialBefore = await api.disk.multiGet(financialKeys);
    const ownerBefore = await api.disk.getItem(ownerKey), savedBefore = await snapshots(api);
    const requested = scenario.startsWith("B") ? "B" : "A";
    api.auth.currentUser = account(requested); api.setAccountStorageAvailable(false);
    let rejection = null;
    try { await api.prepareLocalAccount(requested, `${requested.toLowerCase()}@example.test`); }
    catch (error) { rejection = error; }
    // Comprobar el dinero ANTES del rechazo: la versión anterior falla aquí
    // porque borra el bloque o lo sustituye por su snapshot viejo/por B.
    assert.deepEqual(await api.disk.multiGet(financialKeys), financialBefore,
      "un perfil ausente no borra ni sustituye los bloques financieros activos");
    assert.equal(await api.disk.getItem(ownerKey), ownerBefore, "no cambia/adjudica el dueño ni los restos activos");
    assert.deepEqual(await snapshots(api), savedBefore, "copias y manifiestos se conservan exactamente");
    assert.equal(rejection?.name, "LocalAccountVaultError", "la apertura incompleta se rechaza sin borrar");
    assert.equal(rejection?.reason, "read", "perfil perdido pide revisión, no inventa otra cuenta");
    await blocked(api);
  });
}

test("perfil ausente: primera cuenta sin bloques todavía puede configurarse", async () => {
  const api = await environment(); api.auth.currentUser = account("A");
  assert.equal(await api.prepareLocalAccount("A", "a@example.test"), false);
  assert.equal(await api.prepareLocalAccount("A", "a@example.test"), false);
  assert.deepEqual(await owner(api), { uid: "A", mode: "active" });
  assert.notEqual(api.getAccountStorageSession(), null, "sin restos financieros se permite continuar el registro");
  assert.deepEqual(await api.loadJSON(api.STORAGE_KEYS.transactions, []), []);
});

test("cuenta sin terminar y vacía no bloquea ingreso de otra cuenta", async () => {
  const api = await environment(); api.auth.currentUser = account("A");
  assert.equal(await api.prepareLocalAccount("A", "a@example.test"), false);
  const previousOwner = await api.disk.getItem(ownerKey);
  assert.equal(await api.disk.getItem(api.STORAGE_KEYS.profile), null);
  api.auth.currentUser = account("B"); api.setAccountStorageAvailable(false);
  assert.equal(await api.prepareLocalAccount("B", "b@example.test"), false,
    "la cuenta activa A sin perfil ni datos puede archivarse antes de configurar B");
  assert.notEqual(await api.disk.getItem(ownerKey), previousOwner);
  assert.deepEqual(await owner(api), { uid: "B", mode: "active" });
  const manifest = JSON.parse(await api.decryptText(await api.disk.getItem(`${prefix}A:manifest`)));
  const snapshot = JSON.parse(await api.decryptText(await api.disk.getItem(manifest.current)));
  assert.equal(snapshot.uid, "A");
  assert.ok(snapshot.entries.every(([, raw]) => raw === null), "la cuenta vacía se conserva con inventario comprobado");
  api.auth.currentUser = account("A"); api.setAccountStorageAvailable(false);
  assert.equal(await api.prepareLocalAccount("A", "a@example.test"), false,
    "también se puede volver a A sin heredar B ni perder su identificación");
});

test("cuenta vacía no se sustituye si no puede confirmar su archivo", async () => {
  const api = await environment(); api.auth.currentUser = account("A");
  await api.prepareLocalAccount("A", "a@example.test");
  const originalOwner = await api.disk.getItem(ownerKey);
  const set = api.disk.setItem;
  let attempted = false;
  api.disk.setItem = async (key, raw) => {
    if (key === `${prefix}A:manifest`) { attempted = true; throw new Error("synthetic-manifest-write-failure"); }
    return set(key, raw);
  };
  api.auth.currentUser = account("B"); api.setAccountStorageAvailable(false);
  await assert.rejects(api.prepareLocalAccount("B", "b@example.test"));
  assert.equal(attempted, true, "se intentó confirmar la copia original antes de cambiar el dueño");
  assert.equal(await api.disk.getItem(ownerKey), originalOwner);
  assert.equal(api.getAccountStorageSession(), null);
  api.disk.setItem = set;
  assert.equal(await api.prepareLocalAccount("B", "b@example.test"), false, "reintento confirma la copia y continúa");
});

test("archivo ausente de una cuenta cerrada sigue bloqueado y conservado", async () => {
  const api = await seed(); api.auth.currentUser = account("A");
  await api.archiveLocalAccount("A", "a@example.test"); await api.clearAccountData();
  await api.disk.removeItem(`${prefix}A:manifest`);
  const original = await api.disk.multiGet(await api.disk.getAllKeys());
  api.auth.currentUser = account("B"); api.setAccountStorageAvailable(false);
  await assert.rejects(api.prepareLocalAccount("B", "b@example.test"),
    error => error?.name === "LocalAccountVaultError" && error.reason === "read");
  assert.deepEqual(await api.disk.multiGet(original.map(([key]) => key)), original,
    "un archivo perdido no se trata como una cuenta vacía ni se reemplaza");
  await blocked(api);
});

let failures = 0;
const selectedCases = process.env.FINO_VAULT_SESSION_CASE_FILTER
  ? cases.filter(({ name }) => name.includes(process.env.FINO_VAULT_SESSION_CASE_FILTER)) : cases;
assert.ok(selectedCases.length, "el filtro explícito debe ejecutar al menos un caso");
for (const { name, run } of selectedCases) {
  try { await run(); console.log(`OK ${name}`); }
  catch (error) { failures++; console.error(`FALLO ${name}: ${error.message}`); }
}
if (failures) throw new Error(`${failures}/${selectedCases.length} casos fallidos de sesión/restauración de bóveda original`);
console.log(`Bóveda/almacén/cifrado originales: ${selectedCases.length} casos verdes de cola/restauración, cuenta distinta/misma UID, snapshots/owner y bloques sin perfil preservados, primera configuración y reintento. Android y SDK reales pendientes.`);
