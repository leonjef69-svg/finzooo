import * as Crypto from "expo-crypto";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/utils/firebase";
import { captureAccountTask } from "@/utils/accountTask";
import { privateBoxSourceString } from "@/functions/src/private-box-source";
import { validarCajas, type Caja, type MovimientoCaja, type ConversionCaja, type DatosCajas } from "@/utils/cajas";
import type { Transaction } from "@/types";

export function nuevoIntentoCaja(): string { return Crypto.randomUUID(); }

export async function huellaCaja(caja: Caja, rows: MovimientoCaja[], currency: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, privateBoxSourceString(caja, rows, currency));
}

export async function confirmarConversionCaja(uid: string, sourceId: string, digest: string, currency: string,
  action: "status" | "finish" | "reset" | "begin", attemptId?: string, memberName?: string): Promise<ConversionCaja | null> {
  const task = captureAccountTask(uid);
  const call = httpsCallable(functions, "privateBoxMigration", { timeout: 120_000 });
  const { data } = await task.wait(() => call({ action, sourceId, digest, currency, ...(attemptId ? { attemptId } : {}), ...(memberName ? { memberName } : {}) }));
  const value = data as { complete?: unknown; receipt?: ConversionCaja };
  if (value?.complete === false && action !== "finish") return null;
  if (value?.complete !== true || !value.receipt || value.receipt.uid !== uid || value.receipt.sourceId !== sourceId
    || value.receipt.digest !== digest || value.receipt.currency !== currency) throw new Error("cajas-sync-conflict");
  validarCajas({ cajas: [], movimientos: [], syncFormat: 3, conversiones: { [sourceId]: value.receipt } });
  return value.receipt;
}

/** Ausencia de confirmación NO equivale a cancelación: exige una barrera. */
export async function cancelarConversionCaja(uid: string, caja: Caja, rows: MovimientoCaja[], currency: string): Promise<ConversionCaja | null> {
  const task = captureAccountTask(uid);
  const digest = await task.wait(() => huellaCaja(caja, rows, currency));
  const call = httpsCallable(functions, "privateBoxMigration", { timeout: 120_000 });
  const { data } = await task.wait(() => call({ action: "cancel", sourceId: caja.id, digest, currency,
    ...(caja.sharingAttempt ? { attemptId: caja.sharingAttempt } : {}) }));
  const value = data as { complete?: unknown; cancelled?: unknown; uid?: unknown; sourceId?: unknown; digest?: unknown; currency?: unknown; attemptId?: unknown; receipt?: ConversionCaja };
  if (value?.complete === true && value.receipt?.uid === uid && value.receipt.sourceId === caja.id
    && value.receipt.digest === digest && value.receipt.currency === currency) {
    validarCajas({ cajas: [], movimientos: [], syncFormat: 3, conversiones: { [caja.id]: value.receipt } });
    return value.receipt;
  }
  if (value?.complete !== false || value.cancelled !== true || value.uid !== uid || value.sourceId !== caja.id
    || value.digest !== digest || value.currency !== currency || value.attemptId !== (caja.sharingAttempt || null)) throw new Error("cajas-sync-conflict");
  return null;
}

/** Se usa únicamente después de la confirmación exacta del servidor. */
export function retirarCajaConvertida(data: DatosCajas, receipt: ConversionCaja): DatosCajas {
  const ids = data.movimientos.filter(row => row.cajaId === receipt.sourceId).map(row => row.id);
  return { ...data, syncFormat: 3, conversiones: { ...data.conversiones, [receipt.sourceId]: receipt },
    cajas: data.cajas.filter(box => box.id !== receipt.sourceId),
    movimientos: data.movimientos.filter(row => row.cajaId !== receipt.sourceId),
    cajasBorradas: [...new Set([...data.cajasBorradas, receipt.sourceId])],
    movimientosBorrados: [...new Set([...data.movimientosBorrados, ...ids])],
  };
}

/** No cambia montos ni inventa contrapartes; conserva también lo consumido. */
export function enlacesCajaConvertida(rows: Transaction[], receipt: ConversionCaja): Transaction[] {
  const links = new Map(receipt.links.map(link => [link.personalId, link.movementId]));
  return rows.filter(row => row.internalTransfer === "box" && row.internalTransferSpaceId === receipt.sourceId
    && links.get(row.id) === row.internalTransferLink)
    .map(row => ({ ...row, internalTransferSpaceId: receipt.targetId, internalTransferSpaceName: receipt.name }));
}
