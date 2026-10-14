import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { createSourceReader } from "./helpers/source-reader.mjs";

// Configuración original y logger RN original del SDK instalado. Auth/IO se
// adaptan: no sesión, red, emulador ni contenido real de una cuenta.
const read = createSourceReader({ revision: process.env.FINO_FIREBASE_LOG_BASELINE ?? "" });
const sdk = await import(pathToFileURL(path.join(process.cwd(), "node_modules/@firebase/firestore/dist/index.rn.js")).href);
const code = ts.transpileModule(read("utils/firebase.ts"), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText;
const calls = [], printed = [], encrypted = {}, memory = {};
const oldWarn = console.warn, oldError = console.error, oldLog = console.log;
try {
  // Es el nivel ordinario anterior del SDK; simular un rechazo con datos
  // ficticios usando SU logger, no una copia del filtro.
  sdk.setLogLevel("warn");
  console.warn = (...args) => printed.push(args);
  console.error = (...args) => printed.push(args);
  console.log = (...args) => printed.push(args);
  const dependency = name => {
    if (name === "firebase/app") return { getApps: () => [], initializeApp: () => ({}) };
    if (name === "firebase/auth") return { inMemoryPersistence: memory,
      getReactNativePersistence: storage => { assert.equal(storage, encrypted); return storage; },
      initializeAuth: (_app, options) => { assert.equal(options.persistence, encrypted); return {}; } };
    if (name === "firebase/firestore") return {
      setLogLevel: level => { calls.push(["level", level]); sdk.setLogLevel(level); },
      getFirestore: () => {
        calls.push(["firestore"]);
        sdk._logWarn("synthetic-denied-request", { writes: [{ privateSyntheticData: "DO-NOT-PRINT" }] });
        return {};
      },
    };
    if (name === "firebase/functions") return { getFunctions: () => ({}) };
    if (name === "@/utils/encryptedAsyncStorage") return { encryptedAsyncStorage: encrypted };
    if (name === "@/utils/localAccountDiagnosticMode") return { isLocalAccountDiagnosticMode: () => false };
    throw new Error(`Dependencia inesperada: ${name}`);
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(dependency, module, module.exports);
  assert.deepEqual(printed, [], "un aviso RPC del SDK no expone la petición privada en consola");
  assert.deepEqual(calls, [["level", "silent"], ["firestore"]], "protección configurada antes de abrir Firestore");
  assert.ok(module.exports.auth && module.exports.db && module.exports.functions);
} finally {
  console.warn = oldWarn; console.error = oldError; console.log = oldLog;
  sdk.setLogLevel("warn");
}
console.log("Firebase original + logger RN original: sin petición privada en consola; Auth cifrado y servicios conservados. No prueba permisos remotos.");
