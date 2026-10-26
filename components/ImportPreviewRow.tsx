import { Text, TouchableOpacity, View } from "react-native";
import type { RawRow } from "@/utils/importEngine";

type Props = {
  raw: RawRow;
  title: string;
  date: string;
  category: string;
  amount: string;
  duplicate?: string;
  saving: boolean;
  primaryText: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onChoose: (sourceRow: number, type: "expense" | "income") => void;
};

/** El monto dudoso es neutro hasta elegir su dirección, sin categoría supuesta. */
export default function ImportPreviewRow({ raw, title, date, category, amount, duplicate, saving, primaryText, t, onChoose }: Props) {
  const pending = Boolean(raw.typePending);
  return (
    <View className="px-3 py-2.5 border-b border-slate-200 dark:border-noche-borde">
      <View className="flex-row items-center gap-3">
        <View className="flex-1 min-w-0">
          <Text className="text-xs font-bold" style={{ color: primaryText }} numberOfLines={2}>{title}</Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5" numberOfLines={1}>
            {date}{pending ? "" : ` · ${category}`}
          </Text>
        </View>
        <Text className={`text-xs font-extrabold flex-shrink ${pending ? "text-slate-700 dark:text-slate-100" : raw.type === "expense" ? "text-rose-600" : "text-emerald-600"}`}>
          {pending ? "" : raw.type === "expense" ? "−" : "+"}{amount}
        </Text>
      </View>
      {raw.typeUncertain ? (
        <View className="flex-row gap-2 mt-2">
          {(["income", "expense"] as const).map(type => {
            const selected = !pending && raw.type === type;
            const label = t(type === "income" ? "addSheet.income" : "addSheet.expense");
            return (
              <TouchableOpacity key={type} accessibilityRole="radio"
                accessibilityLabel={t("importSheet.rowTypeChoice", { row: raw.sourceRow ?? "", description: title, type: label })}
                accessibilityState={{ checked: selected, disabled: saving }}
                disabled={saving || raw.sourceRow === undefined}
                onPress={() => onChoose(raw.sourceRow!, type)}
                className={`flex-1 flex-row items-center justify-center rounded-xl border px-2 py-2.5 ${selected
                  ? type === "income" ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-600" : "bg-rose-50 dark:bg-noche-3 border-rose-500"
                  : "bg-slate-50 dark:bg-noche-2 border-slate-300 dark:border-noche-borde"}`}>
                <Text className={`text-xs font-bold ${selected ? type === "income" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300" : "text-slate-600 dark:text-slate-200"}`}>
                  {selected ? "✓ " : ""}{label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <Text className="text-[10px] text-slate-500 dark:text-slate-300 mt-1">{t(raw.type === "expense" ? "addSheet.expense" : "addSheet.income")}</Text>
      )}
      {duplicate && <Text className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-1">{duplicate}</Text>}
    </View>
  );
}
