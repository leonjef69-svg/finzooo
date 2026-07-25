import { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Copy, GitMerge, Layers, ArrowRight, ChevronLeft } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useAppData } from "@/contexts/AppDataContext";
import { fmtDate } from "@/utils/format";
import { catInfo } from "@/constants/categories";
import type { DuplicateMatch } from "@/utils/duplicates";
import type { RawRow } from "@/utils/importEngine";
import type { Transaction } from "@/types";
import type { Resolution } from "@/screens/ImportSheet";

type Candidate = {
  tx: Transaction;
  raw: RawRow;
  match: DuplicateMatch | null;
};

// PANTALLA DE REVISIÓN DE MOVIMIENTOS PARECIDOS (Fase 5)
//
// Muestra, uno por uno, cada posible duplicado: a la izquierda lo que ya
// tienes, a la derecha lo que trae el banco, con el nivel de coincidencia.
// La persona elige: Fusionar, Mantener ambos, u Omitir el del banco.
export default function DuplicateReview({
  dupes,
  newCount,
  onFinish,
  onCancel,
  onLearn,
}: {
  dupes: Candidate[];
  newCount: number;
  onFinish: (resolutions: Map<number, Resolution>) => void;
  onCancel: () => void;
  onLearn: (merchantText: string, category: string) => void;
}) {
  const { t, fmt, monthNames } = useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const primaryText = colorScheme === "dark" ? "#f1f5f9" : "#0f172a";

  const [index, setIndex] = useState(0);
  const [resolutions] = useState<Map<number, Resolution>>(new Map());

  const current = dupes[index];
  const isLast = index >= dupes.length - 1;

  function decide(decision: Resolution) {
    resolutions.set(current.tx.id, decision);
    // Si fusiona o mantiene, aprovechamos para "enseñarle" al clasificador
    // que ese comercio va en la categoría que la persona ya tenía elegida
    // (solo si fusiona: ahí confirma que es el mismo gasto).
    if (decision === "merge" && current.match) {
      onLearn(current.raw.merchant || current.raw.description, current.match.existing.category);
    }
    if (isLast) {
      onFinish(resolutions);
    } else {
      setIndex((i) => i + 1);
    }
  }

  const existing = current.match!.existing;
  const raw = current.raw;
  const score = current.match!.score;
  const level = current.match!.level;

  const existingCat = catInfo(existing.category);
  const importedCat = catInfo(current.tx.category);

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <TouchableOpacity
          onPress={onCancel}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
        >
          <ChevronLeft size={20} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
        </TouchableOpacity>
        <Text className="text-xs font-bold text-slate-500 dark:text-slate-300">
          {t("dupes.progress", { current: index + 1, total: dupes.length })}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-4">
        <View className="items-center mb-4 mt-2">
          <View className="w-14 h-14 rounded-3xl bg-amber-50 dark:bg-slate-800 items-center justify-center mb-3">
            <Copy size={24} color="#f59e0b" />
          </View>
          <Text className="font-extrabold text-lg text-center" style={{ color: primaryText }}>
            {t("dupes.title")}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-2 bg-amber-50 dark:bg-slate-800 px-3 py-1.5 rounded-full">
            <Text className="text-xs font-bold text-amber-600 dark:text-amber-400">
              {t("dupes.matchLevel", { score })}
            </Text>
            <Text className="text-[11px] text-amber-500 dark:text-amber-400">
              · {level === "high" ? t("dupes.levelHigh") : t("dupes.levelReview")}
            </Text>
          </View>
        </View>

        {/* Movimiento existente (el tuyo) */}
        <View className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-3">
          <Text className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase mb-2">
            {t("dupes.existing")}
          </Text>
          <Row label={existing.description || existingCat?.id || ""} value={fmt(existing.amount)} primary={primaryText} />
          <Text className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            {fmtDate(existing.date, monthNames)} · {existingCat ? t(existingCat.label) : existing.category}
          </Text>
        </View>

        <View className="items-center mb-3">
          <ArrowRight size={18} color="#94a3b8" style={{ transform: [{ rotate: "90deg" }] }} />
        </View>

        {/* Movimiento importado (del banco) */}
        <View className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 p-4 mb-5">
          <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-2">
            {t("dupes.imported")}
          </Text>
          <Row label={raw.merchant || raw.description} value={fmt(current.tx.amount)} primary={primaryText} />
          <Text className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            {fmtDate(current.tx.date, monthNames)} · {importedCat ? t(importedCat.label) : current.tx.category}
          </Text>
        </View>

        {/* Opciones */}
        <View className="gap-2.5">
          <TouchableOpacity
            onPress={() => decide("merge")}
            className="flex-row items-center gap-3 bg-emerald-600 rounded-2xl p-4"
          >
            <GitMerge size={18} color="#ffffff" />
            <Text className="font-bold text-white flex-1">{t("dupes.merge")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => decide("keepBoth")}
            className="flex-row items-center gap-3 bg-slate-100 dark:bg-slate-800 rounded-2xl p-4"
          >
            <Layers size={18} color={colorScheme === "dark" ? "#94a3b8" : "#475569"} />
            <Text className="font-bold text-slate-700 dark:text-slate-200 flex-1">{t("dupes.keepBoth")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => decide("skip")} className="items-center py-3">
            <Text className="font-semibold text-slate-400 dark:text-slate-400 text-sm">{t("dupes.skip")}</Text>
          </TouchableOpacity>
        </View>

        {newCount > 0 && (
          <Text className="text-center text-[11px] text-slate-400 dark:text-slate-400 mt-4">
            + {t("importSheet.summaryNew", { count: newCount })}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ label, value, primary }: { label: string; value: string; primary: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-bold text-sm flex-1 mr-2" numberOfLines={1} style={{ color: primary }}>
        {label}
      </Text>
      <Text className="font-extrabold text-sm" style={{ color: primary }}>
        {value}
      </Text>
    </View>
  );
}
