import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const root = process.cwd();
const require = createRequire(import.meta.url);
async function scenario(body) {
  const source = `
    import assert from "node:assert/strict";
    import AsyncStorage, { failNextStorageOperation } from "@react-native-async-storage/async-storage";
    import { decryptText, encryptText } from "@/utils/encryption";
    import { ACCOUNT_STORAGE_KEYS, clearAccountData, loadJSON, saveJSON, saveJSONNow, setAccountStorageAvailable, STORAGE_KEYS } from "@/utils/storage";
    import { allowBackgroundAccount, allowPreAccountPreferences, archiveLocalAccount, deleteLocalAccountVault, prepareLocalAccount, resumeLocalAccount } from "@/utils/localAccountVault";
    async function seed(uid, email, amount) {
      setAccountStorageAvailable(true);
      await saveJSONNow(STORAGE_KEYS.profile, { userEmail: email, userName: uid, hasOnboarded: true });
      await saveJSONNow(STORAGE_KEYS.transactions, [{ id: amount, amount }]);
      await saveJSONNow(STORAGE_KEYS.categoryCustom, { photo: "foto-privada-" + uid });
    }
    export async function run() { ${body} }
  `;
  const result = esbuild.buildSync({
    stdin: { contents: source, resolveDir: root, sourcefile: "account-scenario.ts", loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    alias: {
      "@": root,
      "@react-native-async-storage/async-storage": path.join(root, "pruebas/stubs/async-storage.ts"),
      "expo-secure-store": path.join(root, "pruebas/stubs/secure-store.ts"),
      "expo-crypto": path.join(root, "pruebas/stubs/crypto.ts"),
    },
  });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, require);
  await loaded.exports.run();
}

await scenario(`
  await seed("A", "a@example.com", 50);
  setAccountStorageAvailable(false);
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [], "arranque no expone datos antes de identificar cuenta");
  assert.equal(await prepareLocalAccount("A", "a@example.com"), true);
  await AsyncStorage.setItem("@fino/credit-v1", JSON.stringify({ cards: [{ id: "legacy-A" }] }));
  const pendingReturn = { uid: "A", payload: { kind: "family", spaceId: "f", amount: 40, personalTransactionId: 100 } };
  await saveJSONNow(STORAGE_KEYS.personalReturnPending, pendingReturn);
  const businessDeleted = { negocios: ["n-A"], productos: [], ventas: ["v-A"], movimientos: [] };
  await saveJSONNow(STORAGE_KEYS.businessDeleted, businessDeleted);
  const name = { id: "name-A", uid: "A", boxId: "box-A", local: { id: "box-A", nombre: "Viaje", creadaEn: 1, updatedAt: 10 }, remoto: { id: "box-A", nombre: "Vacaciones", creadaEn: 1, updatedAt: 10 }, elegido: { id: "box-A", nombre: "Viaje", creadaEn: 1, updatedAt: 20 }, creadoEn: 20, estado: "pendiente" };
  const privateBoxes = { cajas: [name.local], movimientos: [], cajasBorradas: [], movimientosBorrados: [], revisionesNombre: [name] };
  await saveJSONNow(STORAGE_KEYS.cajasDinero, privateBoxes);
  saveJSON(STORAGE_KEYS.transactions, [{ id: 60, amount: 60 }]);
  await archiveLocalAccount("A", "a@example.com");
  assert.equal(await allowBackgroundAccount("A", "a@example.com"), false, "sin sesión no se ejecuta el registro de fondo");
  await clearAccountData();
  assert.equal(await prepareLocalAccount("B", "b@example.com"), false);
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [], "B nunca recibe gastos de A");
  assert.equal(await loadJSON(STORAGE_KEYS.personalReturnPending, null), null, "B nunca recibe la orden de devolución de A");
  assert.equal(await loadJSON(STORAGE_KEYS.businessDeleted, null), null, "B no recibe marcas de Negocio de A");
  assert.equal(await loadJSON(STORAGE_KEYS.cajasDinero, null), null, "B nunca recibe los nombres de Cajas conservados de A");
  await seed("B", "b@example.com", 90);
  await archiveLocalAccount("B", "b@example.com");
  await clearAccountData();
  assert.equal(await prepareLocalAccount("A", "a@example.com"), true);
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [{ id: 60, amount: 60 }], "A recupera también el último guardado pendiente");
  assert.deepEqual(await loadJSON(STORAGE_KEYS.personalReturnPending, null), pendingReturn, "A recupera su devolución interrumpida al volver a entrar");
  assert.deepEqual(await loadJSON(STORAGE_KEYS.businessDeleted, null), businessDeleted, "A recupera sus marcas de Negocio sin reabrir borrados");
  assert.deepEqual(await loadJSON(STORAGE_KEYS.cajasDinero, null), privateBoxes, "A recupera los dos nombres y la elección pendiente al iniciar sesión de nuevo");
  assert.deepEqual(await loadJSON(STORAGE_KEYS.categoryCustom, {}), { photo: "foto-privada-A" });
  assert.deepEqual(JSON.parse(await AsyncStorage.getItem("@fino/credit-v1")), { cards: [{ id: "legacy-A" }] }, "el formato de migración antiguo también se conserva");
  const vaultKeys = (await AsyncStorage.getAllKeys()).filter(k => k.includes("localAccountVault"));
  for (const key of vaultKeys.filter(k => !k.endsWith("manifest"))) {
    const raw = await AsyncStorage.getItem(key);
    assert.ok(raw.startsWith("v2:"));
    assert.ok(!raw.includes("foto-privada"));
    const copy = JSON.parse(await decryptText(raw));
    if (copy.version === 3 && copy.entries) assert.equal(copy.entries.length, new Set(ACCOUNT_STORAGE_KEYS).size, "inventario completo");
  }
  await deleteLocalAccountVault("B");
  assert.ok(!(await AsyncStorage.getAllKeys()).some(k => k.includes("localAccountVault:v1:B:")));
  assert.ok((await AsyncStorage.getAllKeys()).some(k => k.includes("localAccountVault:v1:A:")));
`);

await scenario(`
  await seed("A", "a@example.com", 50);
  const original = await AsyncStorage.getItem(STORAGE_KEYS.transactions);
  setAccountStorageAvailable(false);
  await assert.rejects(prepareLocalAccount("B", "b@example.com"), /local-account-owner/);
  assert.equal(await AsyncStorage.getItem(STORAGE_KEYS.transactions), original, "datos antiguos ambiguos se conservan");
`);

await scenario(`
  await seed("A", "a@example.com", 50);
  await prepareLocalAccount("A", "a@example.com");
  failNextStorageOperation("set", "manifest");
  await assert.rejects(archiveLocalAccount("A", "a@example.com"));
  await resumeLocalAccount("A");
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [{ id: 50, amount: 50 }], "fallo al confirmar copia deja sesión y datos activos");
  await archiveLocalAccount("A", "a@example.com");
  await clearAccountData();
  failNextStorageOperation("set", STORAGE_KEYS.transactions);
  await assert.rejects(prepareLocalAccount("A", "a@example.com"));
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [], "restauración parcial no habilita acceso");
  assert.equal(await prepareLocalAccount("A", "a@example.com"), true, "reiniciar operación repara una interrupción");
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [{ id: 50, amount: 50 }]);
`);

await scenario(`
  await seed("A", "a@example.com", 50);
  await prepareLocalAccount("A", "a@example.com");
  await archiveLocalAccount("A", "a@example.com");
  await clearAccountData();
  const key = (await AsyncStorage.getAllKeys()).find(k => k.includes("localAccountVault:v1:A:") && !k.endsWith("manifest"));
  await AsyncStorage.setItem(key, "v2:dañado");
  await assert.rejects(prepareLocalAccount("A", "a@example.com"), /local-account-read/);
  assert.equal(await AsyncStorage.getItem(key), "v2:dañado", "copia dañada no se reemplaza por vacío");
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), []);
`);

await scenario(`
  await seed("A", "a@example.com", 50);
  await prepareLocalAccount("A", "a@example.com");
  failNextStorageOperation("set", STORAGE_KEYS.transactions);
  assert.equal(await saveJSONNow(STORAGE_KEYS.transactions, [{ id: 70, amount: 70 }]), false);
  await assert.rejects(archiveLocalAccount("A", "a@example.com"), /local-account-write/);
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [{ id: 50, amount: 50 }]);
  await resumeLocalAccount("A");
  const inFlight = saveJSONNow(STORAGE_KEYS.transactions, [{ id: 70, amount: 70 }]);
  setAccountStorageAvailable(true);
  await archiveLocalAccount("A", "a@example.com");
  assert.equal(await inFlight, true);
  await clearAccountData();
  await prepareLocalAccount("A", "a@example.com");
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [{ id: 70, amount: 70 }], "copia espera también guardados que ya estaban en vuelo");
`);

const context = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
await scenario(`
  await seed("legacy", "legacy@example.com", 123);
  await prepareLocalAccount("legacy", "legacy@example.com");
  await archiveLocalAccount("legacy", "legacy@example.com");
  const manifestKey = "finzo:localAccountVault:v1:legacy:manifest";
  const manifest = JSON.parse(await decryptText(await AsyncStorage.getItem(manifestKey)));
  const snapshot = JSON.parse(await decryptText(await AsyncStorage.getItem(manifest.current)));
  snapshot.version = 1;
  snapshot.entries = snapshot.entries.filter(([key]) => key !== STORAGE_KEYS.personalReturnPending && key !== STORAGE_KEYS.businessDeleted);
  await AsyncStorage.setItem(manifest.current, await encryptText(JSON.stringify(snapshot)));
  await clearAccountData();
  await prepareLocalAccount("legacy", "legacy@example.com");
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [{ id: 123, amount: 123 }], "la copia antigua sigue abriendo al añadir la orden de devolución");
  assert.equal(await loadJSON(STORAGE_KEYS.personalReturnPending, null), null);
`);
await scenario(`
  await seed("v2", "v2@example.com", 456);
  await prepareLocalAccount("v2", "v2@example.com");
  await archiveLocalAccount("v2", "v2@example.com");
  const manifest = JSON.parse(await decryptText(await AsyncStorage.getItem("finzo:localAccountVault:v1:v2:manifest")));
  const snapshot = JSON.parse(await decryptText(await AsyncStorage.getItem(manifest.current)));
  snapshot.version = 2;
  snapshot.entries = snapshot.entries.filter(([key]) => key !== STORAGE_KEYS.businessDeleted);
  await AsyncStorage.setItem(manifest.current, await encryptText(JSON.stringify(snapshot)));
  await clearAccountData();
  await prepareLocalAccount("v2", "v2@example.com");
  assert.deepEqual(await loadJSON(STORAGE_KEYS.transactions, []), [{ id: 456, amount: 456 }], "copia v2 abre al añadir marcas de Negocio");
  assert.equal(await loadJSON(STORAGE_KEYS.businessDeleted, null), null);
`);
await scenario(`
  setAccountStorageAvailable(true);
  await saveJSONNow(STORAGE_KEYS.transactions, [{ id: 50, amount: 50 }]);
  assert.equal(await allowPreAccountPreferences(), false, "sin dueño ni perfil no se habilitan pantallas que puedan sobrescribir gastos");
  await assert.rejects(prepareLocalAccount("B", "b@example.com"), /local-account-owner/);
  const original = await AsyncStorage.getItem(STORAGE_KEYS.transactions);
  assert.deepEqual(JSON.parse(await decryptText(original)), [{ id: 50, amount: 50 }]);
`);
const login = fs.readFileSync("app/login.tsx", "utf8");
assert.match(context, /await archiveLocalAccount[\s\S]*?await signOut\(auth\)/);
assert.match(context, /await auth\.authStateReady\(\)/);
assert.match(login, /await openLocalAccount[\s\S]*?if \(localRestored\)/);
console.log("Gratis conserva datos cifrados A→B→A; fallos e interrupciones no exponen ni reemplazan copias.");
