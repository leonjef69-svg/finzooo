import { privateBoxSourceString } from "@/functions/src/private-box-source";
import { canonical } from "@/functions/src/private-box-money-shared";
import { enlacesCajaConvertida, huellaCaja, retirarCajaConvertida } from "@/utils/boxMigration";
import { validarCajas, type ConversionCaja, type DatosCajas } from "@/utils/cajas";
import { privateBoxLinksMatch } from "@/utils/privateBoxPersonal";
import type { Transaction } from "@/types";

/** Recibe exclusivamente un recibo confirmado por el servidor, nunca una
 * coincidencia de nombre/saldo. Retira la representación privada, no dinero. */
export async function prepararRetiroCajaConfirmada(receipt: ConversionCaja, uid: string, currency: string,
  leer: () => { data: DatosCajas; rows: Transaction[] }) {
  validarCajas({ cajas: [], movimientos: [], syncFormat: 3, conversiones: { [receipt.sourceId]: receipt } });
  if (receipt.uid !== uid || receipt.currency !== currency) throw new Error("cajas-sync-conflict");
  const source = leer();
  const box = source.data.cajas.find(item => item.id === receipt.sourceId);
  if (!box) {
    if (!source.data.conversiones?.[receipt.sourceId] || canonical(source.data.conversiones[receipt.sourceId]) !== canonical(receipt)) throw new Error("cajas-sync-conflict");
    return { before: source.data, personal: source.rows, data: source.data, upserts: [] as Transaction[] };
  }
  const rows = source.data.movimientos.filter(row => row.cajaId === box.id);
  const original = privateBoxSourceString(box, rows, currency);
  if (await huellaCaja(box, rows, currency) !== receipt.digest) throw new Error("cajas-sync-conflict");
  // Durante SHA puede actualizarse OTRA Caja. Conservar la copia más reciente
  // sin confundir una referencia nueva con un cambio del origen convertido.
  const latest = leer();
  const actual = latest.data.cajas.find(item => item.id === box.id);
  if (!actual || privateBoxSourceString(actual, latest.data.movimientos.filter(row => row.cajaId === box.id), currency) !== original
    || !privateBoxLinksMatch(latest.data, latest.rows, box.id)) throw new Error("cajas-sync-conflict");
  const links = rows.filter(row => row.personalTransactionId != null);
  if (receipt.links.length !== links.length || !links.every(row => receipt.links.some(link => link.personalId === row.personalTransactionId && link.movementId === row.id))) {
    throw new Error("cajas-sync-conflict");
  }
  return { before: latest.data, personal: latest.rows, data: retirarCajaConvertida(latest.data, receipt), upserts: enlacesCajaConvertida(latest.rows, receipt) };
}
