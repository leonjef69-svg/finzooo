// CAPTURA AUTOMÁTICA
//
// Junta las dos mitades de la función: lo que el celular capturó
// (modules/notification-reader) y lo que Finzo sabe interpretar
// (utils/notificationParser), y decide qué se guarda de verdad.
//
// Está aparte del contexto de la app para poder probarlo entero sin celular:
// se le pasan las notificaciones y los movimientos que ya existen, y
// devuelve lo que habría que agregar. No toca el estado ni guarda nada.

import { matchMethod } from "@/utils/importEngine";
import { findBestMatch } from "@/utils/duplicates";
import { parseNotification, type ParseFailure } from "@/utils/notificationParser";
import { suggestCategory } from "@/utils/classifier";
import { nextId } from "@/utils/id";
import type { CapturedNotification } from "@/modules/notification-reader";
import type { Transaction } from "@/types";

// Qué pasó con cada notificación. Se guarda para la pantalla de diagnóstico:
// si Yape cambia el texto de sus avisos, ahí se ve exactamente qué llegó y
// por qué no se entendió, sin tener que adivinar.
export type CaptureLogEntry = {
  at: number; // cuándo llegó la notificación
  text: string; // el aviso tal como llegó (recortado)
  result: "added" | "duplicate" | ParseFailure;
  amount?: number;
};

export type CaptureResult = {
  toAdd: Transaction[];
  log: CaptureLogEntry[];
};

// Cuántas notificaciones recordamos en el diagnóstico.
const MAX_LOG = 40;

// Un aviso más viejo que esto no se registra. Protege el caso de alguien que
// enciende la función y tiene el buzón lleno de avisos de hace semanas: es
// mejor no registrarlos que meter de golpe gastos viejos en el presupuesto
// del mes sin que nadie lo pida.
const MAX_AGE_DAYS = 7;

export function processCaptured(
  notifications: CapturedNotification[],
  existing: Transaction[],
  merchantLearned: Record<string, string>,
  t: (k: string) => string,
  now: number = Date.now()
): CaptureResult {
  const toAdd: Transaction[] = [];
  const log: CaptureLogEntry[] = [];

  // Un movimiento tuyo no puede ser el "ya registrado" de dos avisos a la
  // vez; si no, dos Yapes iguales el mismo día se descartarían los dos.
  const matchedIds = new Set<number>();

  // Las más viejas primero, para que queden en la lista en el mismo orden
  // en que ocurrieron.
  const ordered = [...notifications].sort((a, b) => a.postedAt - b.postedAt);

  for (const n of ordered) {
    const preview = `${n.title ?? ""} ${n.text ?? ""}`.trim().slice(0, 160);
    const parsed = parseNotification(n);

    if (!parsed.ok) {
      log.push({ at: n.postedAt, text: preview, result: parsed.reason });
      continue;
    }

    const raw = parsed.row;

    const ageDays = (now - n.postedAt) / 86400000;
    if (ageDays > MAX_AGE_DAYS) {
      log.push({ at: n.postedAt, text: preview, result: "notMoney", amount: raw.amount });
      continue;
    }

    // ¿Ya está registrado? Puede pasar si lo escribiste a mano al instante,
    // o si además importaste el estado de cuenta. Solo se descarta cuando el
    // parecido es alto: ante una coincidencia dudosa preferimos registrarlo
    // (un repetido se ve en la lista y se borra; un gasto que nunca se
    // registró no se nota).
    const match = findBestMatch(existing, raw, matchedIds);
    if (match && match.level === "high") {
      matchedIds.add(match.existing.id);
      log.push({ at: n.postedAt, text: preview, result: "duplicate", amount: raw.amount });
      continue;
    }

    toAdd.push({
      id: nextId(),
      type: raw.type,
      amount: raw.amount,
      category: suggestCategory(raw.merchant || raw.description, raw.type, merchantLearned),
      date: raw.date,
      method: matchMethod(raw.methodRaw, t),
      description: raw.description,
      notes: "",
      merchant: raw.merchant || undefined,
      account: raw.account,
      origin: "auto",
    });
    log.push({ at: n.postedAt, text: preview, result: "added", amount: raw.amount });
  }

  return { toAdd, log: log.slice(-MAX_LOG) };
}
