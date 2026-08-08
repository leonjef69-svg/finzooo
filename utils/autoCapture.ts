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
import {
  parseNotification,
  esAppVigilada,
  esAvisoDeSeguridad,
  type ParseFailure,
} from "@/utils/notificationParser";
import { suggestCategory } from "@/utils/classifier";
import { nextId } from "@/utils/id";
import { horaDe } from "@/utils/format";
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
  /**
   * DE QUÉ AVISO VINO CADA MOVIMIENTO: su identificador, y la hora exacta del aviso.
   *
   * Se añadió para el Modo Negocio (paso 5): un yapeo que entra a la caja de un negocio se
   * marca con su aviso para no registrarlo dos veces, y esa marca solo se puede sacar aquí,
   * que es donde todavía se tiene la notificación delante.
   *
   * Va como un dato aparte y NO como un campo del movimiento: el movimiento personal no sabe
   * que existen los negocios, y esa es la decisión de arquitectura de toda la función.
   */
  avisoDe: Record<number, number>;
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
  // De qué aviso salió cada movimiento. Ver CaptureResult.
  const avisoDe: Record<number, number> = {};

  // Un movimiento tuyo no puede ser el "ya registrado" de dos avisos a la
  // vez; si no, dos Yapes iguales el mismo día se descartarían los dos.
  const matchedIds = new Set<number>();

  // Las más viejas primero, para que queden en la lista en el mismo orden
  // en que ocurrieron.
  const ordered = [...notifications].sort((a, b) => a.postedAt - b.postedAt);

  for (const n of ordered) {
    // DE OTRA APP: NI SE ANOTA.
    //
    // Va antes que nada, y sin dejar entrada en el registro. Un aviso de Yape
    // que no se entendió SÍ tiene que salir en la pantalla —es lo que permite
    // ver qué texto falta reconocer—, pero uno de otra app solo ensucia la
    // lista. Y con los de clave es peor: dejaba escrito en el celular
    // "Operación en curso. Hemos generado y autocompletado la clave", de un
    // banco que Finzo ya ni mira.
    if (!esAppVigilada(n.package)) continue;

    const preview = `${n.title ?? ""} ${n.text ?? ""}`.trim().slice(0, 160);
    const parsed = parseNotification(n);

    if (!parsed.ok) {
      // DE UN AVISO DE CLAVE NO SE GUARDA EL TEXTO.
      //
      // Sigue apareciendo en la pantalla —si un yapeo dejara de entrar por
      // confundirse con uno de estos, hay que poder verlo— pero sin la frase.
      // "Tu código de verificación es 4821" quedaba escrito en el celular y a
      // la vista de cualquiera que lo agarrara desbloqueado.
      const delicado = esAvisoDeSeguridad(n.title, n.text);
      log.push({ at: n.postedAt, text: delicado ? "" : preview, result: parsed.reason });
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
    // SOLO se compara contra lo que NO vino de una notificacion.
    //
    // Esta regla existe para no duplicar lo que ya escribiste a mano, o lo
    // que entro al importar el estado de cuenta. Para eso mira si hay un
    // movimiento parecido y descarta el aviso.
    //
    // Contra otro movimiento que vino de una notificacion no sirve, y hace
    // dano: tres yapes de S/ 1 de la misma persona el mismo dia son TRES
    // movimientos, y el primero se comia a los otros dos. Los avisos ya
    // vienen sin repetir del servicio de Android, que descarta el mismo aviso
    // reenviado usando su hora al segundo; si uno llega hasta aqui es porque
    // es distinto.
    const escritosPorMano = existing.filter((tx) => tx.origin !== "auto");
    const match = findBestMatch(escritosPorMano, raw, matchedIds);
    if (match && match.level === "high") {
      matchedIds.add(match.existing.id);
      log.push({ at: n.postedAt, text: preview, result: "duplicate", amount: raw.amount });
      continue;
    }

    const id = nextId();
    avisoDe[id] = n.postedAt;
    toAdd.push({
      id,
      type: raw.type,
      amount: raw.amount,
      category: suggestCategory(raw.merchant || raw.description, raw.type, merchantLearned),
      date: raw.date,
      method: matchMethod(raw.methodRaw, t),
      description: raw.description,
      notes: "",
      // La hora del AVISO, no la de ahora. Si el trabajo de fondo corre horas
      // después —o si la app estuvo cerrada dos días— la hora buena es la del
      // yapeo, no la de cuando la app se enteró.
      time: horaDe(n.postedAt),
      merchant: raw.merchant || undefined,
      account: raw.account,
      origin: "auto",
    });
    log.push({ at: n.postedAt, text: preview, result: "added", amount: raw.amount });
  }

  return { toAdd, log: log.slice(-MAX_LOG), avisoDe };
}
