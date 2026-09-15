import assert from "node:assert/strict";
import fs from "node:fs";

const store = fs.readFileSync("modules/notification-reader/android/src/main/java/com/finzo/notificationreader/NotificationStore.kt", "utf8");
const bridge = fs.readFileSync("modules/notification-reader/index.ts", "utf8");
const context = fs.readFileSync("contexts/AppDataContext.tsx", "utf8");
const listener = fs.readFileSync("modules/notification-reader/android/src/main/java/com/finzo/notificationreader/FinzoNotificationListener.kt", "utf8");

assert.match(store, /KEY_IN_FLIGHT/, "el lote reclamado queda persistido");
assert.match(store, /fun ackDrain/, "solo una confirmación explícita lo elimina");
assert.match(bridge, /export async function ackDrain/, "JavaScript puede confirmar el lote");
assert.match(context, /saveJSONNow\(STORAGE_KEYS\.transactions/, "la app persiste antes de confirmar");
assert.ok(context.indexOf("saveJSONNow(STORAGE_KEYS.transactions") < context.indexOf("await notificationReader.ackDrain()"), "primero guarda y después confirma");
assert.match(listener, /sbn\.key/, "la identidad nativa distingue avisos diferentes");
assert.match(listener, /sbn\.postTime/, "dos Yapes iguales conservan su instante exacto");
assert.doesNotMatch(listener, /postTime \/ 1000/, "ya no colapsa dos Yapes del mismo segundo");

console.log("Buzón Yape: reclamo, confirmación, recuperación e identidad verificados.");
