import { currencySymbolFor } from "@/constants/currencies";
import { auth } from "@/utils/firebase";
import { type DatosCajas, CAJAS_VACIAS, type MovimientoCaja } from "@/utils/cajas";
import {
  cargarFamiliaActiva,
  listarMovimientosFamilia,
  type MovimientoFamilia,
} from "@/utils/cloudFamilia";
import {
  listarCajasCompartidas,
  listarMovimientosCajaCompartida,
  type MovimientoCajaCompartida,
} from "@/utils/cloudCajasCompartidas";
import { availablePersonalBalance } from "@/utils/finances";
import { saldoLibre, totalApartado } from "@/utils/ahorro";
import { fmtExact as formatAmount, horaDe } from "@/utils/format";
import { saldoAnteriorDe } from "@/utils/saldoAnterior";
import { moneyFromUnits, moneyUnits } from "@/utils/moneyPrecision";
import { getAccountStorageSession, loadJSON, STORAGE_KEYS } from "@/utils/storage";
import type { Goal, Transaction } from "@/types";

export type ExportSpaceKind = "personal" | "family" | "box" | "sharedBox";

export type ExportSpace = {
  id: string;
  kind: ExportSpaceKind;
  name: string;
  currency: string;
  transactions: Transaction[];
  /** false identifica un nombre del selector cuyo historial aún no se pidió. */
  transactionsLoaded?: boolean;
};

export type ExportFinancialSummary = {
  available: number;
  income: number;
  expenses: number;
  result: number;
  budget?: number;
  previousBalance?: number;
};

const numeroEstable = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

function movimientoCompartido(
  prefijo: string,
  item: MovimientoFamilia | MovimientoCajaCompartida,
  kind: "family" | "box",
): Transaction {
  const transferencia = item.personalTransactionId != null || item.personalReturnAmount != null;
  return {
    id: numeroEstable(`${prefijo}:${item.id}`),
    type: item.tipo === "ingreso" ? "income" : "expense",
    amount: item.monto,
    category: item.category || "otros",
    date: item.fecha,
    time: Number.isFinite(item.creadoEn) ? horaDe(item.creadoEn) : undefined,
    method: item.method || "",
    description: item.descripcion,
    notes: item.notes || "",
    origin: "manual",
    ...(transferencia ? { internalTransfer: kind, internalTransferLink: item.id } : {}),
  };
}

function movimientoCajaPrivada(item: MovimientoCaja): Transaction {
  const transferencia = item.personalTransactionId != null || item.personalReturnAmount != null;
  return {
    id: numeroEstable(`box:${item.id}`),
    type: item.tipo === "ingreso" ? "income" : "expense",
    amount: item.monto,
    category: item.category || "otros",
    date: item.fecha,
    time: Number.isFinite(item.creadoEn) ? horaDe(item.creadoEn) : undefined,
    method: item.method || "",
    description: item.descripcion,
    notes: item.notes || "",
    origin: "manual",
    ...(transferencia ? { internalTransfer: "box", internalTransferLink: item.id } : {}),
  };
}

/**
 * El selector necesita nombres, no todos los historiales. Solo se lee el
 * dinero del espacio elegido; una exportación sin pantalla tampoco necesita
 * cargar el catálogo de los demás. Un fallo remoto nunca usa Personal como
 * sustituto ni se interpreta como un historial vacío confirmado.
 */
export async function cargarEspaciosExportables(
  personal: Transaction[],
  userCurrency: string,
  personalLabel: string,
  familyLabel: string,
  boxLabel: string,
  selectedSpaceId = "personal",
  incluirCatalogo = true,
): Promise<ExportSpace[]> {
  const session = getAccountStorageSession();
  const uid = auth.currentUser?.uid;
  const comprobarSesion = () => {
    if (getAccountStorageSession() !== session || auth.currentUser?.uid !== uid) throw new Error("export-session-changed");
  };
  const espacios: ExportSpace[] = [{
    id: "personal",
    kind: "personal",
    name: personalLabel,
    currency: userCurrency,
    transactions: personal,
    transactionsLoaded: true,
  }];

  if (!incluirCatalogo && selectedSpaceId === "personal") return espacios;

  const local = incluirCatalogo || selectedSpaceId.startsWith("box:")
    ? await loadJSON<DatosCajas>(STORAGE_KEYS.cajasDinero, CAJAS_VACIAS) : CAJAS_VACIAS;
  comprobarSesion();
  for (const caja of local.cajas) {
    const elegida = selectedSpaceId === `box:${caja.id}`;
    if (!incluirCatalogo && !elegida) continue;
    espacios.push({
      id: `box:${caja.id}`,
      kind: "box",
      name: caja.nombre || boxLabel,
      currency: userCurrency,
      transactions: elegida ? local.movimientos
        .filter((item) => item.cajaId === caja.id)
        .map(movimientoCajaPrivada) : [],
      transactionsLoaded: elegida,
    });
  }

  if (!uid) return espacios;

  const [familia, cajasCompartidas] = await Promise.all([
    incluirCatalogo || selectedSpaceId.startsWith("family:") ? cargarFamiliaActiva(uid).catch(() => null) : null,
    incluirCatalogo || selectedSpaceId.startsWith("sharedBox:") ? listarCajasCompartidas(uid).catch(() => []) : [],
  ]);
  comprobarSesion();

  if (familia) {
    const elegida = selectedSpaceId === `family:${familia.id}`;
    const movimientos = elegida ? await listarMovimientosFamilia(familia.id).catch(() => null) : [];
    comprobarSesion();
    if (movimientos && (incluirCatalogo || elegida)) {
      espacios.push({
        id: `family:${familia.id}`,
        kind: "family",
        name: familia.nombre || familyLabel,
        currency: familia.currency,
        transactions: movimientos.map((item) => movimientoCompartido("family", item, "family")),
        transactionsLoaded: elegida,
      });
    }
  }

  const compartidas = await Promise.all(cajasCompartidas.map(async (caja) => {
    const elegida = selectedSpaceId === `sharedBox:${caja.id}`;
    if (!incluirCatalogo && !elegida) return null;
    const movimientos = elegida ? await listarMovimientosCajaCompartida(caja.id).catch(() => null) : [];
    comprobarSesion();
    if (!movimientos) return null;
    return {
      id: `sharedBox:${caja.id}`,
      kind: "sharedBox" as const,
      name: caja.nombre || boxLabel,
      currency: caja.currency || userCurrency,
      transactions: movimientos.map((item) => movimientoCompartido("sharedBox", item, "box")),
      transactionsLoaded: elegida,
    };
  }));
  comprobarSesion();
  espacios.push(...compartidas.filter((item) => item !== null));
  return espacios;
}

export function resumenFinanciero(
  espacio: ExportSpace,
  mes: string,
  budgets: Record<string, number>,
  carryoverCleared: string[],
  goals: Goal[] = [],
): ExportFinancialSummary {
  if (espacio.transactionsLoaded === false) throw new Error("export-space-not-loaded");
  const delMes = espacio.transactions.filter((item) => item.date.startsWith(mes));
  if (espacio.kind === "personal") {
    const expenses = sumAmounts(delMes.filter((item) => item.type === "expense" && !item.internalTransfer));
    const income = sumAmounts(delMes.filter((item) => item.type === "income" && !item.internalTransfer));
    const transfersOut = sumAmounts(delMes.filter((item) => item.type === "expense" && item.internalTransfer && item.internalTransfer !== "goal"));
    const transfersIn = sumAmounts(delMes.filter((item) => item.type === "income" && item.internalTransfer && item.internalTransfer !== "goal"));
    const budget = budgets[mes] ?? 0;
    const previousBalance = saldoAnteriorDe(mes, budgets, espacio.transactions, carryoverCleared);
    return {
      available: saldoLibre(availablePersonalBalance({ budget, prevBalance: previousBalance, income, spent: expenses, transfersOut, transfersIn }), totalApartado(goals)),
      income,
      expenses,
      result: moneyFromUnits(moneyUnits(income) - moneyUnits(expenses)),
      budget,
      previousBalance,
    };
  }

  const income = sumAmounts(delMes.filter((item) => item.type === "income" && !item.internalTransfer));
  const expenses = sumAmounts(delMes.filter((item) => item.type === "expense" && !item.internalTransfer));
  const finDeMes = `${mes}-31`;
  const available = espacio.transactions
    .filter((item) => item.date <= finDeMes)
    .reduce((sum, item) => sum + moneyUnits(item.type === "income" ? item.amount : -item.amount), 0n);
  return { available: moneyFromUnits(available), income, expenses, result: moneyFromUnits(moneyUnits(income) - moneyUnits(expenses)) };
}

function sumAmounts(items: Transaction[]): number {
  return moneyFromUnits(items.reduce((sum, item) => sum + moneyUnits(item.amount), 0n));
}

export function formateadorDelEspacio(espacio: ExportSpace): (value: number) => string {
  return (value) => formatAmount(value, currencySymbolFor(espacio.currency), espacio.currency);
}
