import { nuevoIdCaja, type DatosCajas, type RevisionImporteCaja } from "@/utils/cajas";
import { loadPrivateBoxMoneySources, requestPrivateBoxMoneyReview, recoverPrivateBoxMoneyReview, type PrivateBoxMoneyLocal, type PrivateBoxMoneySources } from "@/utils/cloudPrivateBoxMoney";
import { prepararRevisionImporte, conservarOriginalesImporte } from "@/utils/privateBoxMoneyReview";
import { withPrivateBoxMoneyReview, type PrivateBoxCloudLease } from "@/utils/privateBoxSync";
import { canonical, type MoneyAck, type MoneySource } from "../functions/src/private-box-money-shared.js";

export type PrivateBoxMoneyPort = {
  current: () => boolean;
  premium: () => boolean;
  boxes: () => DatosCajas;
  local: () => PrivateBoxMoneyLocal;
  stage: (before: DatosCajas, entry: RevisionImporteCaja, lease: PrivateBoxCloudLease, current: () => boolean) => Promise<boolean>;
  commit: (before: DatosCajas, entry: RevisionImporteCaja, ack: MoneyAck, lease: PrivateBoxCloudLease, current: () => boolean) => Promise<boolean>;
};
export type PrivateBoxMoneyComparison = {
  uid: string; movementId: string; before: DatosCajas; local: PrivateBoxMoneyLocal; remote: PrivateBoxMoneySources;
  fingerprint: string;
  choices: { source: MoneySource; amount: number; date: string; usable: boolean }[];
  replaces?: string;
};

function allowed(port: PrivateBoxMoneyPort): void {
  if (!port.current()) throw new Error("account-task-obsolete");
  if (!port.premium()) throw new Error("cajas-money-needs-pro");
}
function fingerprint(before: DatosCajas, local: PrivateBoxMoneyLocal, remote: PrivateBoxMoneySources,
  choices: PrivateBoxMoneyComparison["choices"], replaces?: string): string {
  return canonical({ before, local, remote, choices, replaces });
}

/** Consulta sin corregir, sin guardar diarios y sin mantener un candado abierto en el formulario. */
export async function compararImporteCaja(uid: string, movementId: string, port: PrivateBoxMoneyPort, replaces?: string): Promise<PrivateBoxMoneyComparison> {
  allowed(port);
  const before = port.boxes(), local = port.local(), source = canonical({ before, local });
  const movement = before.movimientos.find(row => row.id === movementId);
  if (!movement?.personalTransactionId) throw new Error("cajas-money-changed");
  return withPrivateBoxMoneyReview(uid, async lease => {
    allowed(port);
    const remote = await loadPrivateBoxMoneySources(uid, movementId, movement.personalTransactionId!, local.currency, lease);
    allowed(port);
    if (canonical({ before: port.boxes(), local: port.local() }) !== source || canonical({ before, local }) !== source) throw new Error("cajas-money-changed");
    const personal = local.transactions.find(row => row.id === movement.personalTransactionId);
    const other = remote.data.movimientos.find(row => row.id === movementId), cloudPersonal = remote.transactions[0];
    if (!personal || !other || !cloudPersonal) throw new Error("cajas-money-changed");
    const values: { source: MoneySource; amount: number; date: string }[] = [
      { source: "local-personal", amount: personal.amount, date: personal.date },
      { source: "local-box", amount: movement.monto, date: movement.fecha },
      { source: "remote-personal", amount: cloudPersonal.amount, date: cloudPersonal.date },
      { source: "remote-box", amount: other.monto, date: other.fecha },
    ];
    let lastError: unknown;
    const choices = values.map(value => {
      try {
        const entry = prepararRevisionImporte(before, local.transactions, local.deletedIds, remote.data, remote.transactions, remote.deletedIds,
          uid, local.currency, nuevoIdCaja("importe"), movementId, value.source, Date.now(), replaces);
        conservarOriginalesImporte(before, local.transactions, local.deletedIds, entry, uid, local.currency);
        return { ...value, usable: true };
      } catch (error) { lastError = error; return { ...value, usable: false }; }
    });
    if (!choices.some(value => value.usable)) throw lastError;
    return { uid, movementId, before, local, remote, choices, ...(replaces ? { replaces } : {}), fingerprint: fingerprint(before, local, remote, choices, replaces) };
  });
}

async function enviarConservada(uid: string, entry: RevisionImporteCaja, port: PrivateBoxMoneyPort, lease: PrivateBoxCloudLease): Promise<boolean> {
  allowed(port);
  const before = port.boxes(), source = canonical(before);
  const current = () => port.current() && canonical(port.boxes()) === source;
  const ack = await requestPrivateBoxMoneyReview(uid, entry, lease, port.local, current);
  // Si Pro vence DESPUÉS de recibir la confirmación genuina, se termina el
  // lote local: no deja una copia vieja cuando el servidor ya confirmó.
  return port.commit(before, entry, ack, lease, current);
}

/** Reconsulta tras el Sí del usuario. Nunca aplica una elección a fuentes distintas. */
export async function confirmarImporteCaja(comparison: PrivateBoxMoneyComparison, chosen: MoneySource, port: PrivateBoxMoneyPort): Promise<boolean> {
  allowed(port);
  const original = comparison.fingerprint;
  const current = () => port.current() && fingerprint(comparison.before, comparison.local, comparison.remote, comparison.choices, comparison.replaces) === original
    && fingerprint(port.boxes(), port.local(), comparison.remote, comparison.choices, comparison.replaces) === original;
  if (!current() || !comparison.choices.some(value => value.source === chosen && value.usable)) throw new Error("cajas-money-changed");
  return withPrivateBoxMoneyReview(comparison.uid, async lease => {
    allowed(port);
    if (!current()) throw new Error("cajas-money-changed");
    const movement = comparison.before.movimientos.find(row => row.id === comparison.movementId)!;
    const fresh = await loadPrivateBoxMoneySources(comparison.uid, comparison.movementId, movement.personalTransactionId!, comparison.local.currency, lease);
    allowed(port);
    if (!current() || canonical(fresh) !== canonical(comparison.remote)) throw new Error("cajas-money-changed");
    const entry = prepararRevisionImporte(comparison.before, comparison.local.transactions, comparison.local.deletedIds,
      fresh.data, fresh.transactions, fresh.deletedIds, comparison.uid, comparison.local.currency,
      nuevoIdCaja("importe"), comparison.movementId, chosen, Date.now(), comparison.replaces);
    // También comprueba capacidad/cadena antes de entrar al almacén, para
    // explicar el límite sin presentarlo como un fallo genérico del disco.
    conservarOriginalesImporte(comparison.before, comparison.local.transactions, comparison.local.deletedIds, entry, comparison.uid, comparison.local.currency);
    if (!await port.stage(comparison.before, entry, lease, current)) return false;
    return enviarConservada(comparison.uid, entry, port, lease);
  });
}

/** Tras reiniciar se usa el mismo ID, elección y versión; el servidor comprueba/repite sin duplicar. */
export async function reintentarImporteCaja(uid: string, entry: RevisionImporteCaja, port: PrivateBoxMoneyPort): Promise<boolean> {
  if (!port.current()) throw new Error("account-task-obsolete");
  const retained = port.boxes().revisionesImporte?.find(value => value.id === entry.id);
  if (entry.uid !== uid || entry.estado !== "pendiente" || !retained || canonical(retained) !== canonical(entry)) throw new Error("cajas-money-changed");
  return withPrivateBoxMoneyReview(uid, async lease => {
    const before = port.boxes(), source = canonical(before);
    const current = () => port.current() && canonical(port.boxes()) === source;
    let ack: MoneyAck;
    try { ack = await recoverPrivateBoxMoneyReview(uid, entry, lease, port.local, current); }
    catch (error) {
      // Solo un rechazo definitivo de «todavía no confirmado» permite el
      // camino de escritura. Red, fuente distinta o respuesta dudosa no.
      const reason = (error as { details?: { reason?: string } })?.details?.reason;
      if (reason !== "money-not-confirmed") throw error;
      allowed(port);
      ack = await requestPrivateBoxMoneyReview(uid, entry, lease, port.local, current);
    }
    return port.commit(before, entry, ack, lease, current);
  });
}
