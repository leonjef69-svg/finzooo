export type TesterPremiumState = {
  active: boolean;
  grantedAt: number | null;
  grantedBy: string | null;
};

export const TESTER_PREMIUM_INACTIVE: TesterPremiumState = {
  active: false,
  grantedAt: null,
  grantedBy: null,
};

function millis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (value && typeof value === "object" && "toMillis" in value) {
    const toMillis = (value as { toMillis?: unknown }).toMillis;
    if (typeof toMillis === "function") {
      const result = toMillis.call(value);
      return typeof result === "number" && Number.isFinite(result) && result > 0 ? result : null;
    }
  }
  return null;
}

/** Una copia de caché nunca concede Premium: un permiso retirado no queda activo sin red. */
export function testerPremiumFromData(data: unknown, fromCache = false): TesterPremiumState {
  if (!data || typeof data !== "object") return TESTER_PREMIUM_INACTIVE;
  const record = data as Record<string, unknown>;
  const grantedAt = millis(record.grantedAt);
  const grantedBy = typeof record.grantedBy === "string" && record.grantedBy.trim()
    ? record.grantedBy.trim().slice(0, 120)
    : null;
  return {
    active: !fromCache && record.active === true && grantedAt !== null,
    grantedAt,
    grantedBy,
  };
}
