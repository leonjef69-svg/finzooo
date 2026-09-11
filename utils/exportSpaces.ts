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
import { fmt as formatAmount, horaDe } from "@/utils/format";
import { saldoAnteriorDe } from "@/utils/saldoAnterior";
import { loadJSON, STORAGE_KEYS } from "@/utils/storage";
import type { Transaction } from "@/types";

export type ExportSpaceKind = "personal" | "family" | "box" | "sharedBox";

export type ExportSpace = {
  id: string;
  kind: ExportSpaceKind;
  name: string;
  currency: string;
  transactions: Transaction[];
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
    category: "otros",
    date: item.fecha,
    time: Number.isFinite(item.creadoEn) ? horaDe(item.creadoEn) : undefined,
    method: item.method || "",
    description: item.descripcion,
    notes: "",
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
    category: "otros",
    date: item.fecha,
    time: Number.isFinite(item.creadoEn) ? horaDe(item.creadoEn) : undefined,
    method: item.method || "",
    description: item.descripcion,
    notes: "",
    origin: "manual",
    ...(transferencia ? { internalTransfer: "box", internalTransferLink: item.id } : {}),
  };
}

/**
 * Carga cada bolsillo por separado. Si un espacio remoto no está disponible,
 * no se mezcla ni se reemplaza por Personal: simplemente no se ofrece.
 */
export async function cargarEspaciosExportables(
  personal: Transaction[],
  userCurrency: string,
  personalLabel: string,
  familyLabel: string,
  boxLabel: string,
): Promise<ExportSpace[]> {
  const espacios: ExportSpace[] = [{
    id: "personal",
    kind: "personal",
    name: personalLabel,
    currency: userCurrency,
    transactions: personal,
  }];

  const local = await loadJSON<DatosCajas>(STORAGE_KEYS.cajasDinero, CAJAS_VACIAS);
  for (const caja of local.cajas) {
    espacios.push({
      id: `box:${caja.id}`,
      kind: "box",
      name: caja.nombre || boxLabel,
      currency: userCurrency,
      transactions: local.movimientos
        .filter((item) => item.cajaId === caja.id)
        .map(movimientoCajaPrivada),
    });
  }

  const uid = auth.currentUser?.uid;
  if (!uid) return espacios;

  const [familia, cajasCompartidas] = await Promise.all([
    cargarFamiliaActiva(uid).catch(() => null),
    listarCajasCompartidas(uid).catch(() => []),
  ]);

  if (familia) {
    const movimientos = await listarMovimientosFamilia(familia.id).catch(() => null);
    if (movimientos) {
      espacios.push({
        id: `family:${familia.id}`,
        kind: "family",
        name: familia.nombre || familyLabel,
        currency: userCurrency,
        transactions: movimientos.map((item) => movimientoCompartido("family", item, "family")),
      });
    }
  }

  const compartidas = await Promise.all(cajasCompartidas.map(async (caja) => {
    const movimientos = await listarMovimientosCajaCompartida(caja.id).catch(() => null);
    if (!movimientos) return null;
    return {
      id: `sharedBox:${caja.id}`,
      kind: "sharedBox" as const,
      name: caja.nombre || boxLabel,
      currency: caja.currency || userCurrency,
      transactions: movimientos.map((item) => movimientoCompartido("sharedBox", item, "box")),
    };
  }));
  espacios.push(...compartidas.filter((item) => item !== null));
  return espacios;
}

export function resumenFinanciero(
  espacio: ExportSpace,
  mes: string,
  budgets: Record<string, number>,
  carryoverCleared: string[],
): ExportFinancialSummary {
  const delMes = espacio.transactions.filter((item) => item.date.startsWith(mes));
  if (espacio.kind === "personal") {
    const expenses = delMes
      .filter((item) => item.type === "expense" && !item.internalTransfer)
      .reduce((sum, item) => sum + item.amount, 0);
    const income = delMes
      .filter((item) => item.type === "income" && !item.internalTransfer)
      .reduce((sum, item) => sum + item.amount, 0);
    const transfersOut = delMes
      .filter((item) => item.type === "expense" && item.internalTransfer)
      .reduce((sum, item) => sum + item.amount, 0);
    const transfersIn = delMes
      .filter((item) => item.type === "income" && item.internalTransfer)
      .reduce((sum, item) => sum + item.amount, 0);
    const budget = budgets[mes] ?? 0;
    const previousBalance = saldoAnteriorDe(mes, budgets, espacio.transactions, carryoverCleared);
    return {
      available: availablePersonalBalance({ budget, prevBalance: previousBalance, income, spent: expenses, transfersOut, transfersIn }),
      income,
      expenses,
      result: income - expenses,
      budget,
      previousBalance,
    };
  }

  const income = delMes.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = delMes.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const finDeMes = `${mes}-31`;
  const available = espacio.transactions
    .filter((item) => item.date <= finDeMes)
    .reduce((sum, item) => sum + (item.type === "income" ? item.amount : -item.amount), 0);
  return { available, income, expenses, result: income - expenses };
}

export function formateadorDelEspacio(espacio: ExportSpace): (value: number) => string {
  return (value) => formatAmount(value, currencySymbolFor(espacio.currency), espacio.currency);
}
