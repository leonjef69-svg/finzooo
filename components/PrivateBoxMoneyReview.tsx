import type { DatosCajas, MovimientoCaja, RevisionImporteCaja } from "@/utils/cajas";
import type { PrivateBoxMoneyComparison } from "@/utils/privateBoxMoneyFlow";
import { currencySymbolFor } from "@/constants/currencies";
import { fmt } from "@/utils/format";
import type { MoneySource } from "../functions/src/private-box-money-shared.js";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export const MONEY_SOURCE_LABELS: Record<MoneySource, string> = {
  "local-personal": "boxes.moneyLocalPersonal", "local-box": "boxes.moneyLocalBox",
  "remote-personal": "boxes.moneyRemotePersonal", "remote-box": "boxes.moneyRemoteBox",
};
export function originalesImporte(entry: RevisionImporteCaja) {
  return [
    { source: "local-personal" as const, amount: entry.local.personal.amount, date: entry.local.personal.date },
    { source: "local-box" as const, amount: entry.local.movement.monto, date: entry.local.movement.fecha },
    { source: "remote-personal" as const, amount: entry.remote.personal.amount, date: entry.remote.personal.date },
    { source: "remote-box" as const, amount: entry.remote.movement.monto, date: entry.remote.movement.fecha },
  ];
}
type Props = {
  comparison: PrivateBoxMoneyComparison | null; reviews: RevisionImporteCaja[]; candidates: MovimientoCaja[];
  message: string | null; busy: boolean; premium: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  compare: (id: string) => void; choose: (source: MoneySource) => void; retry: (entry: RevisionImporteCaja) => void;
  reviewAgain: (entry: RevisionImporteCaja) => void; retire: (entry: RevisionImporteCaja) => void; cancel: () => void;
};
const nombre = (data: DatosCajas, id: string) => data.cajas.find(row => row.id === id)?.nombre || "";

/** Mantiene visibles las cuatro fuentes, incluso cuando tienen cifras iguales. */
export default function PrivateBoxMoneyReview({ comparison, reviews, candidates, message, busy, premium, t, compare, choose, retry, reviewAgain, retire, cancel }: Props) {
  const [history, setHistory] = useState(false);
  const pending = reviews.filter(entry => entry.estado === "pendiente");
  const amount = (value: number, currency: string) => fmt(value, currencySymbolFor(currency), currency);
  return <>
    {message ? <Text accessibilityLiveRegion="polite" className="mb-3 text-xs leading-5 text-amber-800 dark:text-amber-200">{message}</Text> : null}
    {candidates.map(move => <TouchableOpacity key={move.id} accessibilityRole="button" disabled={busy} onPress={() => compare(move.id)} className="mb-3 min-h-11 rounded-xl bg-amber-50 p-3 dark:bg-amber-950">
      <Text className="text-sm font-bold text-amber-800 dark:text-amber-200">{t("boxes.moneyReview")}</Text>
      <Text className="mt-1 text-xs text-slate-600 dark:text-slate-300">{move.descripcion} · {move.fecha}</Text>
    </TouchableOpacity>)}
    {comparison ? <View className="mb-3 rounded-xl border border-amber-200 p-3 dark:border-amber-800">
      <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{t("boxes.moneyReview")} · {nombre(comparison.before, comparison.before.movimientos.find(row => row.id === comparison.movementId)!.cajaId)}</Text>
      <Text className="my-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{t("boxes.moneyHelp")}</Text>
      {comparison.replaces ? <Text className="mb-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{t("boxes.moneyReviewAgainHelp")}</Text> : null}
      {comparison.choices.map(choice => <TouchableOpacity key={choice.source} accessibilityRole="button" accessibilityState={{ disabled: busy || !premium || !choice.usable }} disabled={busy || !premium || !choice.usable} onPress={() => choose(choice.source)} className={`mb-2 min-h-12 rounded-lg bg-amber-50 p-3 dark:bg-amber-950 ${!choice.usable ? "opacity-50" : ""}`}>
        <Text className="text-sm font-bold text-amber-800 dark:text-amber-200">{t(MONEY_SOURCE_LABELS[choice.source])}</Text>
        <Text className="mt-1 text-xs text-slate-900 dark:text-slate-100">{amount(choice.amount, comparison.local.currency)} · {choice.date}</Text>
        {!choice.usable ? <Text className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t("boxes.moneyUnsafeOption")}</Text> : null}
      </TouchableOpacity>)}
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={cancel} className="min-h-11 justify-center"><Text className="font-bold text-slate-600 dark:text-slate-300">{t("common.cancel")}</Text></TouchableOpacity>
    </View> : null}
    {pending.map(entry => <View key={entry.id} className="mb-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950">
      <Text className="text-sm font-bold text-amber-800 dark:text-amber-200">{entry.box.nombre}</Text>
      <Text className="my-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{t(premium ? "boxes.moneyPending" : "boxes.moneyRecoveryHelp")}</Text>
      {originalesImporte(entry).map(copy => <Text key={copy.source} className="mb-1 text-xs leading-5 text-slate-900 dark:text-slate-100">{t(MONEY_SOURCE_LABELS[copy.source])}: {amount(copy.amount, entry.currency)} · {copy.date}{copy.source === entry.chosen ? ` · ${t("boxes.moneyChosen")}` : ""}</Text>)}
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => retry(entry)} className="min-h-11 justify-center"><Text className="font-bold text-amber-800 dark:text-amber-200">{t(premium ? "boxes.moneyRetry" : "boxes.moneyRecover")}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy || !premium} onPress={() => reviewAgain(entry)} className={`min-h-11 justify-center ${!premium ? "opacity-50" : ""}`}><Text className="font-bold text-amber-800 dark:text-amber-200">{t("boxes.moneyReviewAgain")}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => retire(entry)} className="min-h-11 justify-center"><Text className="font-bold text-amber-800 dark:text-amber-200">{t("boxes.moneyRetireAction")}</Text></TouchableOpacity>
    </View>)}
    {reviews.length > 0 ? <View className="mb-3">
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: history }} onPress={() => setHistory(value => !value)} className="min-h-11 justify-center"><Text className="font-bold text-slate-600 dark:text-slate-300">{t("boxes.moneyHistory")}</Text></TouchableOpacity>
      {history ? reviews.filter(entry => entry.estado !== "pendiente").map(entry => <View key={entry.id} className="mb-2">
        <Text className="text-xs font-bold text-slate-900 dark:text-slate-100">{entry.box.nombre} · {t(entry.estado === "sustituido" ? "boxes.moneySuperseded" : entry.estado === "retirado" ? "boxes.moneyRetiredHistory" : "boxes.moneyConfirmed")}</Text>
        {originalesImporte(entry).map(copy => <Text key={copy.source} className="text-xs leading-5 text-slate-600 dark:text-slate-300">{t(MONEY_SOURCE_LABELS[copy.source])}: {amount(copy.amount, entry.currency)} · {copy.date}{copy.source === entry.chosen ? ` · ${t("boxes.moneyChosen")}` : ""}</Text>)}
      </View>) : null}
    </View> : null}
  </>;
}
