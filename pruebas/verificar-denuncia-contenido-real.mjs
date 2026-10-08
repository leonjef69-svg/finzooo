import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { handlerOriginal } from "./helpers/handler-original.mjs";
import ts from "typescript";

const auth = { currentUser: { uid: "A", emailVerified: true } };
let session = 1, calls = 0, reply;
// Compilar .ts como TS (no TSX): su async <T> no es una etiqueta JSX.
const accountModule = { exports: {} };
new Function("module", "exports", "require", ts.transpileModule(readFileSync("utils/accountTask.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: "accountTask.ts",
}).outputText)(accountModule, accountModule.exports, name => {
  if (name === "@/utils/firebase") return { auth };
  if (name === "@/utils/storage") return { getAccountStorageSession: () => session };
  throw new Error(`Dependencia inesperada: ${name}`);
});
const { captureAccountTask } = accountModule.exports;
const api = handlerOriginal("utils/contentReports.ts", "submitContentReport", {
  auth, functions: {}, captureAccountTask,
  httpsCallable: (_fn, name, options) => {
    assert.equal(name, "submitContentReport"); assert.equal(options.timeout, 30_000);
    return async input => { calls++; return typeof reply === "function" ? reply(input) : { data: { id: input.id, saved: true, emailConfirmed: false } }; };
  },
});
const input = { id: randomUUID(), kind: "family", spaceId: "F", targetType: "movement", targetId: "M", reason: "abuse", details: "", expectedText: "Texto", expectedUid: "B", processingAccepted: true, policyVersion: "2026-10-08" };
await api(input); assert.equal(calls, 1);
auth.currentUser.emailVerified = false;
await assert.rejects(api(input), /report-auth/); assert.equal(calls, 1);
auth.currentUser.emailVerified = true;
reply = () => ({ data: { id: input.id, saved: false, emailConfirmed: false } });
await assert.rejects(api(input), /report-response-invalid/);
reply = () => ({ data: { id: input.id, saved: true, emailConfirmed: true } });
await assert.rejects(api(input), /report-response-invalid/, "no convertir un ACK distinto en correo recibido");
reply = async () => { session++; return { data: { id: input.id, saved: true, emailConfirmed: false } }; };
await assert.rejects(api(input), /account-task-obsolete/);

const lock = { current: false }, mounted = { current: true }, attempt = { current: null };
const writes = [], messages = [], sent = [];
let release, fail = false;
const deps = { lock, mounted, attempt, target: { kind: "family", spaceId: "F", targetType: "movement", targetId: "M", expectedText: "Texto", expectedUid: "B" },
  randomUUID, reason: "abuse", details: "Explicación original", t: key => key,
  setBusy: value => writes.push(["busy", value]), setOpen: value => writes.push(["open", value]),
  setDetails: value => writes.push(["details", value]), setReason: value => writes.push(["reason", value]), showToast: key => messages.push(key),
  submitContentReport: async value => { sent.push(structuredClone(value)); if (fail) throw new Error("respuesta perdida"); await new Promise(resolve => { release = resolve; }); },
};
const send = handlerOriginal("components/ContentReportButton.tsx", "send", deps);
const pending = send(); await send(); assert.equal(sent.length, 1, "doble toque no genera dos avisos");
release(); await pending;
assert.equal(attempt.current, null); assert.deepEqual(messages, ["report.saved"]);
assert.ok(writes.some(([field, value]) => field === "open" && value === false));
fail = true; await send(); const uncertain = sent.at(-1);
assert.equal(messages.at(-1), "report.failed"); assert.equal(attempt.current.id, uncertain.id);
await send(); assert.deepEqual(sent.at(-1), uncertain, "un reintento conserva cuerpo e ID, no duplica ni altera el aviso incierto");
mounted.current = false; const count = messages.length; await send(); assert.equal(messages.length, count, "respuesta atrasada de ficha desmontada no anuncia éxito en otra cuenta");
mounted.current = true;
deps.submitContentReport = async () => { throw { details: { reason: "report-source-changed" } }; };
const sendChanged = handlerOriginal("components/ContentReportButton.tsx", "send", deps);
await sendChanged();
assert.equal(attempt.current, null, "un texto/autor cambiado exige una nueva revisión, no perpetúa un aviso viejo");
assert.equal(messages.at(-1), "report.changed");
assert.ok(writes.some(([field, value]) => field === "reason" && value === "abuse"));
// Conexiones/atributos son contratos estáticos, NO UI Android ni envío SMTP.
for (const file of ["screens/Family.tsx", "screens/SharedBoxes.tsx"]) assert.ok(readFileSync(file, "utf8").includes("ContentReportButton"));
assert.ok(readFileSync("components/SpaceMembersSheet.tsx", "utf8").includes("reportSpace"));
console.log("Originales/IO adaptado: cuenta/ACK correctos, doble toque, respuesta perdida/reintento y desmontaje; enlaces UI estáticos. SMTP, Android y moderación efectiva pendientes.");
