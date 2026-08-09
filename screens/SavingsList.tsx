import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Plus, Sparkles, PiggyBank, CheckCircle2 } from "lucide-react-native";
import { GOAL_COLOR_HEX } from "@/constants/colors";
import { CARD_SHADOW } from "@/constants/style";
import { useAppData } from "@/contexts/AppDataContext";
import type { Goal } from "@/types";
import AvisoSoloLectura from "@/components/AvisoSoloLectura";
import BackButton from "@/components/BackButton";

export default function SavingsList({
  goals,
  onBack,
  onAdd,
  onOpen,
  disponible,
  apartado,
  libre,
  descuadre,
  monthLabel,
  onAllocate,
  soloLectura = false,
}: {
  goals: Goal[];
  onBack: () => void;
  onAdd: () => void;
  onOpen: (id: number) => void;
  disponible: number;
  apartado: number;
  libre: number;
  descuadre: boolean;
  monthLabel: string;
  onAllocate: () => void;
  /** Se acabó la prueba y ya había metas: se ven enteras, pero no se crea ni se mueve plata. */
  soloLectura?: boolean;
}) {
  const { fmt, t } = useAppData();
  const [tab, setTab] = useState<"resumen" | "metas">("resumen");
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">{t("savingsList.title")}</Text>
        {tab === "metas" && !soloLectura ? (
          <TouchableOpacity
            onPress={onAdd}
            className="w-10 h-10 rounded-full bg-emerald-600 items-center justify-center"
          >
            <Plus size={18} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <View className="w-10" />
        )}
      </View>

      <View className="px-5 mb-1">
        <View className="bg-slate-100 dark:bg-slate-800 rounded-xl p-1 flex-row">
          {(["resumen", "metas"] as const).map((id) => (
            <TouchableOpacity
              key={id}
              onPress={() => setTab(id)}
              className={`flex-1 py-2.5 rounded-xl items-center ${tab === id ? "bg-emerald-600" : ""}`}
            >
              <Text className={`text-sm font-bold ${tab === id ? "text-white" : "text-slate-600 dark:text-slate-200"}`}>
                {id === "resumen" ? t("savingsList.tabSummary") : t("savingsList.tabGoals")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="flex-1 px-5 pb-8">
        {/* POR QUÉ NO SE PUEDE TOCAR NADA, antes que los números: sin esto, los botones que
            faltan parecen un fallo de la app. */}
        {soloLectura && <AvisoSoloLectura />}
        {tab === "resumen" && (
          <View>
            <LinearGradient
              colors={["#059669", "#0f766e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="rounded-3xl p-5 mt-3"
            >
              {/* EL NÚMERO GRANDE ES LO LIBRE, NO "EL AHORRO DEL MES".
                  Antes enseñaba presupuesto + ingresos − gastos, que ni es
                  ahorro ni cuadra con Inicio: a Inicio se le suma el saldo
                  anterior y a esto no. Dos pantallas, dos números, el mismo
                  mes.

                  Lo libre es lo que de verdad hace falta saber aquí: cuánto
                  se puede gastar sin tocar las metas. */}
              <View className="flex-row items-center gap-1.5 mb-1">
                <Sparkles size={14} color="#a7f3d0" />
                <Text className="text-emerald-100 text-xs font-bold">
                  {t("savingsList.freeTitle", { month: monthLabel })}
                </Text>
              </View>
              <Text className={`text-3xl font-extrabold ${libre >= 0 ? "text-white" : "text-rose-200"}`}>
                {fmt(libre)}
              </Text>

              {/* De dónde sale ese número, con las dos piezas a la vista. Sin
                  esto es un número más que hay que creerse. */}
              <View className="flex-row gap-4 mt-3 pt-3 border-t border-emerald-400/30">
                <View>
                  <Text className="text-emerald-100 text-[10px]">{t("savingsList.availableLabel")}</Text>
                  <Text className="text-white text-sm font-bold">{fmt(disponible)}</Text>
                </View>
                <View>
                  <Text className="text-emerald-100 text-[10px]">{t("savingsList.setAsideLabel")}</Text>
                  <Text className="text-white text-sm font-bold">− {fmt(apartado)}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* HAY MÁS APARTADO QUE DINERO.
                Pasa por dos caminos legítimos —se gastó parte de lo apartado,
                o se puso el saldo anterior en cero— y ninguno es un fallo. La
                app NO baja la meta sola: que un número de dinero baje sin que
                nadie lo tocara es de las cosas que hacen desconfiar. Se avisa
                y se deja decidir. */}
            {descuadre && (
              <View className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-[1.5px] border-amber-200 dark:border-amber-800 p-4 mt-3">
                <Text className="text-xs font-extrabold text-amber-700 dark:text-amber-300 mb-1">
                  {t("savingsList.mismatchTitle")}
                </Text>
                <Text className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                  {t("savingsList.mismatchBody", {
                    apartado: fmt(apartado),
                    disponible: fmt(disponible),
                  })}
                </Text>
              </View>
            )}
            <Text className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed mt-4 px-1">
              {t("savingsList.explanation")}
            </Text>
            {libre > 0 && !soloLectura && (
              <TouchableOpacity
                onPress={onAllocate}
                className="mt-4 bg-emerald-50 rounded-2xl p-4 flex-row items-center gap-3"
              >
                <View className="w-9 h-9 rounded-xl bg-emerald-100 items-center justify-center">
                  <PiggyBank size={16} color="#059669" />
                </View>
                <Text className="text-sm font-bold text-emerald-700 flex-1">
                  {t("savingsList.moveToGoal", { amount: fmt(libre) })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {tab === "metas" && (
          <View className="mt-3">
            {goals.length === 0 && (
              <View className="items-center py-16 px-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-[1.5px] border-dashed border-slate-200 dark:border-slate-700">
                <Text className="text-slate-500 dark:text-slate-300 text-sm text-center">{t("savingsList.noGoals")}</Text>
              </View>
            )}
            <View className="gap-3">
              {goals.map((g, i) => {
                const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
                const color = GOAL_COLOR_HEX[i % GOAL_COLOR_HEX.length];
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => onOpen(g.id)}
                    className="bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700 rounded-2xl p-4"
                    style={CARD_SHADOW}
                  >
                    <View className="flex-row items-center gap-3 mb-3">
                      <View
                        className="w-11 h-11 rounded-2xl items-center justify-center"
                        style={{ backgroundColor: color.bg }}
                      >
                        <PiggyBank size={20} color={color.fg} />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text className="text-sm font-bold text-slate-900 dark:text-slate-100" numberOfLines={1}>
                          {g.name}
                        </Text>
                        <Text className="text-xs text-slate-500 dark:text-slate-300">
                          {g.completed ? t("savingsDetail.completed") : t("savingsDetail.inProgress")}
                        </Text>
                      </View>
                      {g.completed && <CheckCircle2 size={18} color="#10b981" />}
                    </View>
                    <View className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                      <View
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color.fg }}
                      />
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200">
                        {t("savingsList.savedOfTarget", { saved: fmt(g.saved), target: fmt(g.target) })}
                      </Text>
                      <Text className="text-xs font-extrabold" style={{ color: color.fg }}>
                        {Math.round(pct)}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
