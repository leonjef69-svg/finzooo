import { spaceErrorKey } from "@/utils/spaceErrors";

const cases: [unknown, string, boolean?][] = [
  [{ code: "permission-denied" }, "spaces.permissionDenied"],
  [new Error("invalid-code"), "family.invalidCode"],
  [new Error("expired-code"), "family.invalidCode"],
  [{ code: "unauthenticated" }, "family.loginRequired"],
  [{ code: "functions/not-found" }, "spaces.backendNotUpdated"],
  [{ code: "not-found" }, "family.connectionError"],
  [{ code: "unavailable" }, "family.connectionError"],
  [new Error("unexpected"), "family.connectionError"],
  [{ code: "functions/not-found" }, "spaces.backendNotUpdated", true],
];
for (const [error, expected, invalidCode] of cases) {
  if (spaceErrorKey(error, invalidCode) !== expected) {
    throw new Error(`Error de espacio ${String(error)}: se esperaba ${expected}, llegó ${spaceErrorKey(error, invalidCode)}`);
  }
}
console.log("Los errores de Familia/Caja diferencian permisos, código y conexión.");
