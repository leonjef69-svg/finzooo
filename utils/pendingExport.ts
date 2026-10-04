import * as Crypto from "expo-crypto";
import type { ExportDestination } from "@/utils/scheduledExport";

/** Opciones de exportación nacidas dentro de Fino, nunca de un enlace externo. */
export type PendingExport = {
  month?: string;
  format?: "pdf" | "xlsx" | "csv";
  type?: "all" | "expense" | "income";
  auto?: boolean;
  destination?: ExportDestination;
  silent?: boolean;
  fileName?: string;
  recipientName?: string;
  charts?: boolean;
  spaceId?: string;
  runKey?: string;
};

const MAX_AGE_MS = 60_000;
const pending = new Map<string, { value: PendingExport; createdAt: number; claimedAt?: number }>();

function discardExpired(now: number): void {
  for (const [token, entry] of pending) {
    if (now - entry.createdAt > MAX_AGE_MS) pending.delete(token);
  }
}

export function queueExport(value: PendingExport): string {
  const now = Date.now();
  discardExpired(now);
  // Solo se agrupan dos toques que piden exactamente la misma exportación.
  // Una notificación manual y una tarea automática no deben pisarse.
  for (const [token, entry] of pending) {
    if (!entry.claimedAt && now - entry.createdAt < 1_500 && JSON.stringify(entry.value) === JSON.stringify(value)) {
      return token;
    }
  }
  const token = Crypto.randomUUID();
  pending.set(token, { value: { ...value }, createdAt: now });
  return token;
}

export function takeQueuedExport(token: string | undefined): PendingExport | null {
  if (!token) return null;
  const entry = pending.get(token);
  if (!entry) return null;
  const now = Date.now();
  if (now - entry.createdAt > MAX_AGE_MS) {
    pending.delete(token);
    return null;
  }
  // React puede montar dos veces una ruta en modo de desarrollo. Se permite
  // esa repetición inmediata, pero un enlace reutilizado después no ejecuta
  // otra exportación.
  if (entry.claimedAt && now - entry.claimedAt > 1_000) return null;
  entry.claimedAt ??= now;
  return { ...entry.value };
}
