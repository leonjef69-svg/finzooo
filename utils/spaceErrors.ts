/** Traduce errores de Familia/Caja sin esconder los permisos o la conexión. */
export function spaceErrorKey(error: unknown, invalidCode = false): string {
  const value = error as { code?: unknown; message?: unknown; details?: { reason?: unknown } } | null;
  const code = typeof value?.code === "string" ? value.code.toLowerCase() : "";
  const message = typeof value?.message === "string" ? value.message.toLowerCase() : "";
  const detail = `${code} ${message}`;
  const reason = value?.details?.reason;
  if (typeof reason === "string" && reason.startsWith("migration-")) return "boxes.syncConflict";
  if (reason === "return-changed") return "spaces.returnChanged";
  if (reason === "return-currency-mismatch") return "spaces.currencyMismatch";
  if (reason === "return-space-closed") return "spaces.returnClosed";
  if (reason === "return-cancelled") return "spaces.returnCancelled";
  if (detail.includes("return-account-changed")) return "family.loginRequired";
  if (detail.includes("return-busy")) return "spaces.returnBusy";
  if (detail.includes("return-local-save-failed")) return "toast.localSaveFailed";
  if (reason === "return-invalid-data" || reason === "return-too-large" || reason === "return-conflict"
    || detail.includes("return-pending-invalid") || detail.includes("return-invalid-response")) return "spaces.returnInvalid";

  if (detail.includes("permission-denied") || detail.includes("permission denied")) {
    return "spaces.permissionDenied";
  }
  if (detail.includes("unauthenticated") || detail.includes("not-authenticated")) {
    return "family.loginRequired";
  }
  // A missing callable is a pending server deployment, not an invalid invite.
  // Firestore also uses `not-found` for documents unrelated to invitations.
  if (code === "functions/not-found" || code === "functions/unimplemented") {
    return "spaces.backendNotUpdated";
  }
  if (detail.includes("invalid-code") || detail.includes("expired-code")) {
    return "family.invalidCode";
  }
  if (invalidCode && (detail.includes("invalid") || detail.includes("expired"))) {
    return "family.invalidCode";
  }
  return "family.connectionError";
}
