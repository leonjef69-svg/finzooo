import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { cbc } from "@noble/ciphers/aes.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { base64 } from "@scure/base";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const file = "utils/encryption.ts", revision = process.env.FINO_READ_ONLY_CRYPTO_BASELINE;
if (revision && !/^[a-f\d]{7,40}$/i.test(revision)) throw new Error("Revisión inválida");
const source = revision ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const bytesToHex = bytes => Buffer.from(bytes).toString("hex");
const key = "12".repeat(32), iv = "34".repeat(16), text = '{"synthetic":true}';
const cipher = base64.encode(cbc(hexToBytes(key), hexToBytes(iv)).encrypt(new TextEncoder().encode(text)));
const mac = bytesToHex(hmac(sha256, hexToBytes(key), new TextEncoder().encode(`${iv}:${cipher}`)));
const raw = `v2:${iv}:${cipher}:${mac}`;
for (const existing of [null, "invalid-test", key]) {
  let createsOrScans = 0, secureReads = 0;
  const decrypt = handlerOriginal(file, "decryptText", {
    SecureStore: { getItemAsync: async name => { assert.equal(name, "finzo_encryption_key_v1"); secureReads++; return existing; } },
    KEY_STORAGE_NAME: "finzo_encryption_key_v1", getOrCreateKey: async () => { createsOrScans++; return existing ?? key; },
    bytesToHex, cbc, hmac, sha256, hexToBytes, base64, constantTimeEqual: (a, b) => a === b,
  }, source);
  assert.equal(await decrypt(raw, { readOnly: true }), existing === key ? text : null);
  assert.equal(createsOrScans, 0, "solo lectura no invoca generación/caché/recorrido de historial");
  assert.equal(secureReads, 1, "consulta solo la llave existente");
  assert.equal(await decrypt(raw), existing === "invalid-test" ? null : text, "modo ordinario mantiene contrato anterior");
  assert.equal(createsOrScans, 1);
}
console.log("Descifrado original/AES real: diagnóstico sin generación, caché ni escaneo de datos; llave ausente/inválida/existente y contrato normal conservados. Keystore Android pendiente.");
