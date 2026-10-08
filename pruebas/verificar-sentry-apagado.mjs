import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
globalThis.__sentryCalls = 0;
const source = process.env.FINO_TEST_REVISION
  ? execFileSync("git", ["show", `${process.env.FINO_TEST_REVISION}:utils/sentry.ts`], { encoding: "utf8" })
  : undefined;
const result = await build({
  ...(source ? { stdin: { contents: source, loader: "ts", resolveDir: process.cwd() } } : { entryPoints: ["utils/sentry.ts"] }),
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", define: { __DEV__: "false" },
  plugins: [{ name: "sdk-spy", setup(b) {
    b.onResolve({ filter: /^(@sentry\/react-native|expo-constants)$/ }, args => ({ path: args.path, namespace: "spy" }));
    b.onLoad({ filter: /.*/, namespace: "spy" }, args => ({ loader: "js", contents: args.path === "expo-constants"
      ? "export default {expoConfig:{extra:{sentryDsn:'https://public@example.com/1'}}};"
      : `export function init(){globalThis.__sentryCalls++;}
         export function captureException(){globalThis.__sentryCalls++;}
         export function wrap(component){globalThis.__sentryCalls++;return component;}` }));
  } }],
});
const module = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, require);
const { Sentry } = module.exports;
const root = () => "App";
assert.equal(Sentry.wrap(root), root, "La app conserva su componente raíz");
Sentry.captureException(new Error("ficticio"));
assert.equal(globalThis.__sentryCalls, 0, "No inicializar ni llamar al SDK cuando está fuera de uso");
delete globalThis.__sentryCalls;
console.log("Sentry apagado: la app y tareas de fondo funcionan sin iniciar ni enviar diagnósticos al SDK.");
