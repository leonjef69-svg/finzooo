import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PiggyBank, Plus, MoreHorizontal, CheckCircle2, CircleHelp, ArrowUpRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "nativewind";
import { useAppData } from "@/contexts/AppDataContext";
import type { Goal } from "@/types";
import AvisoSoloLectura from "@/components/AvisoSoloLectura";
import BackButton from "@/components/BackButton";
import ConfirmDialog from "@/components/ConfirmDialog";
import GoalFormSheet from "@/screens/GoalFormSheet";
import MoveMoneySheet from "@/screens/MoveMoneySheet";
import UseSavingsSheet from "@/screens/UseSavingsSheet";
import SavingsFlowSummaryCard from "@/components/SavingsFlowSummaryCard";
import MovementDivider from "@/components/MovementDivider";
import { summarizeGoalFunding } from "@/utils/savingsSummary";

export default function SavingsList({ goals, onBack, disponible, apartado, libre, descuadre, monthLabel, soloLectura = false }: {
  goals: Goal[]; onBack: () => void; onAdd?: () => void; onOpen?: (id: number) => void;
  disponible: number; apartado: number; libre: number; descuadre: boolean; monthLabel: string;
  onAllocate?: () => void; soloLectura?: boolean;
}) {
  const { fmt, t, commitSavingsAction, visualStyle, transactions } = useAppData();
  const { colorScheme } = useColorScheme();
  const peach = visualStyle === "peachOlive" && colorScheme !== "dark";
  const [help, setHelp] = useState(false);
  const [activeView, setActiveView] = useState<"goals" | "movements">("goals");
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState<{ kind: "create" } | { kind: "edit" | "add" | "withdraw" | "use"; id: number } | null>(null);
  const [menu, setMenu] = useState<number | null>(null), [deleting, setDeleting] = useState<Goal | null>(null);
  const [goalLimit, setGoalLimit] = useState(40);
  const fundingSummaries = useMemo(() => summarizeGoalFunding(goals, transactions), [goals, transactions]);
  const movementGoals = goals.filter(goal => {
    const summary = fundingSummaries.get(goal.id);
    return (summary?.received ?? 0) > 0 || (summary?.returned ?? 0) > 0;
  });
  const lock = useRef(false);
  const closePanel = () => { if (!lock.current) setPanel(null); };
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (lock.current) return true;
      if (panel) { setPanel(null); return true; }
      if (menu !== null) { setMenu(null); return true; }
      return false;
    });
    return () => handler.remove();
  }, [panel, menu]);
  useEffect(() => { if (panel && "id" in panel && !goals.some(goal => goal.id === panel.id)) setPanel(null); }, [goals, panel]);
  // El panel usa la meta vigente, no una copia vieja de cuando se abrió.
  const selected = panel && "id" in panel ? goals.find(goal => goal.id === panel.id) : undefined;
  async function commit(action: Parameters<typeof commitSavingsAction>[0]) {
    if (lock.current || soloLectura) return false;
    lock.current = true;
    try {
      const saved = await commitSavingsAction(action);
      if (saved) { setPanel(null); setDeleting(null); setMenu(null); }
      return saved;
    } finally { lock.current = false; }
  }
  return <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
    <View className="flex-row items-center gap-2 px-5 pt-2 pb-3">
      <BackButton onPress={onBack} />
      <Text className="flex-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">{t("savingsList.title")}</Text>
      {!soloLectura && <TouchableOpacity accessibilityRole="button" onPress={() => setPanel({ kind: "create" })} className="min-w-[152px] flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3">
        <Plus size={19} color="white" /><Text className="text-sm font-extrabold text-white">{t("savings.newGoal")}</Text>
      </TouchableOpacity>}
    </View>
    <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      onScroll={({ nativeEvent: e }) => { if (e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 200) setGoalLimit(n => Math.min(n + 40, goals.length)); }} scrollEventThrottle={160}>
      {soloLectura && <AvisoSoloLectura />}
      <LinearGradient colors={colorScheme === "dark" ? ["#1b1b1b", "#272727"] : peach ? ["#fae2cf", "#f2cbb0"] : ["#047857", "#0f766e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 16, borderWidth: colorScheme === "dark" ? 1 : 0, borderColor: "#3a3a3a" }}>
        <View className="flex-row items-center justify-between gap-2">
          <Text className={`flex-1 text-[11px] ${colorScheme === "dark" ? "text-slate-300" : peach ? "text-slate-700" : "text-emerald-100"}`}>{t("savings.personalMoney", { month: monthLabel })}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("savings.help")} onPress={() => setHelp(value => !value)} className="h-8 w-8 items-center justify-center"><CircleHelp size={16} color={colorScheme === "dark" ? "#d4d4d4" : peach ? "#526b43" : "#d1fae5"} /></TouchableOpacity>
        </View>
        <Text className={`text-sm font-semibold ${colorScheme === "dark" ? "text-slate-200" : peach ? "text-slate-800" : "text-emerald-100"}`}>{t("savings.personalAvailable")}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} className={`mt-1 text-3xl font-extrabold ${libre < 0 ? peach || colorScheme === "dark" ? "text-rose-300" : "text-rose-200" : peach || colorScheme === "dark" ? "text-slate-100" : "text-white"}`}>{fmt(libre)}</Text>
        <View className={`mt-3 flex-row items-center justify-between gap-3 border-t pt-3 ${colorScheme === "dark" ? "border-white/15" : peach ? "border-slate-700/15" : "border-white/20"}`}>
          <Text className={`flex-1 text-xs font-semibold ${colorScheme === "dark" ? "text-slate-300" : peach ? "text-slate-600" : "text-emerald-100"}`}>{t("savings.inGoals")}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} className={`max-w-[60%] text-lg font-bold ${peach ? "text-slate-900" : "text-white"}`}>{fmt(apartado)}</Text>
        </View>
      </LinearGradient>
      {help && <View className="mt-2 rounded-xl bg-slate-50 p-3 dark:bg-noche-2"><Text className="text-xs leading-5 text-slate-600 dark:text-slate-200">{t("savings.explain")}</Text><Text className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-300">{t("savings.older")}</Text></View>}
      {descuadre && <View className="mt-3 rounded-2xl bg-amber-50 p-3 dark:bg-amber-950">
        <Text className="text-xs font-bold text-amber-800 dark:text-amber-200">{t("savingsList.mismatchTitle")}</Text>
        <Text className="mt-1 text-xs text-amber-800 dark:text-amber-200">{t("savingsList.mismatchBody", { apartado: fmt(apartado), disponible: fmt(disponible) })}</Text>
      </View>}
      <View className="mt-4 flex-row rounded-xl bg-slate-100 p-1 dark:bg-noche-2">
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: activeView === "goals" }} onPress={() => setActiveView("goals")}
          className={`min-h-10 flex-1 items-center justify-center rounded-lg px-3 py-2 ${activeView === "goals" ? "bg-emerald-600" : ""}`}>
          <Text className={`text-sm font-bold ${activeView === "goals" ? "text-white" : "text-slate-600 dark:text-slate-200"}`}>{t("savings.tabGoals")}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: activeView === "movements" }} onPress={() => setActiveView("movements")}
          className={`min-h-10 flex-1 items-center justify-center rounded-lg px-3 py-2 ${activeView === "movements" ? "bg-emerald-600" : ""}`}>
          <Text className={`text-sm font-bold ${activeView === "movements" ? "text-white" : "text-slate-600 dark:text-slate-200"}`}>{t("savings.tabMovements")}</Text>
        </TouchableOpacity>
      </View>
      {activeView === "goals" ? <>
      <View className="mt-5 mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{t("savings.myGoals")}</Text>
        <Text className="text-xs text-slate-500 dark:text-slate-300">{goals.length === 1 ? t("savings.oneGoal") : t("savings.count", { count: goals.length })}</Text>
      </View>
      {goals.length === 0 && <View className="items-center rounded-2xl bg-slate-50 p-6 dark:bg-noche-2"><PiggyBank size={30} color="#7c3aed" /><Text className="mt-3 text-center text-sm text-slate-500 dark:text-slate-300">{t("savingsList.noGoals")}</Text></View>}
      {goals.slice(0, goalLimit).map(goal => {
        const pct = Math.min(100, Math.max(0, goal.target > 0 ? goal.saved / goal.target * 100 : 0));
        return <View key={goal.id} className="mb-3 rounded-2xl border-[1.5px] border-slate-200 bg-white p-3.5 dark:border-noche-borde dark:bg-noche-2">
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950"><PiggyBank size={19} color="#65764a" /></View>
            <View className="min-w-0 flex-1"><Text className="text-sm font-bold text-slate-900 dark:text-slate-100" numberOfLines={2}>{goal.name}</Text><Text className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-300">{goal.completed ? t("savingsDetail.completed") : goal.saved === 0 ? t("savings.notStarted") : t("savings.goalSubtitle")}</Text></View>
            {goal.completed && <CheckCircle2 size={17} color="#059669" />}
            {!soloLectura && <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("savings.options", { name: goal.name })} onPress={() => setMenu(menu === goal.id ? null : goal.id)} className="h-10 w-10 items-center justify-center"><MoreHorizontal size={21} color="#64748b" /></TouchableOpacity>}
          </View>
          <View className="mt-3 mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-noche-3"><View className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} /></View>
          <View className="mb-3 flex-row items-start justify-between gap-2">
            <View className="min-w-0 flex-1"><Text className="text-[11px] text-slate-500 dark:text-slate-300">{t("savingsDetail.saved")}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} className="mt-0.5 text-sm font-bold text-slate-800 dark:text-slate-100">{fmt(goal.saved)}</Text></View>
            <View className="min-w-0 flex-1 items-end"><Text className="text-[11px] text-slate-500 dark:text-slate-300">{t("goalForm.targetLabel")}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} className="mt-0.5 text-sm font-bold text-slate-800 dark:text-slate-100">{fmt(goal.target)}</Text></View>
          </View>
          {!soloLectura && <View className="flex-row gap-2">
            <TouchableOpacity accessibilityRole="button" onPress={() => setPanel({ kind: "add", id: goal.id })} className="flex-1 flex-row items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2.5"><Plus size={15} color="white" /><Text className="text-sm font-bold text-white">{t("savings.save")}</Text></TouchableOpacity>
            {goal.saved > 0 && <TouchableOpacity accessibilityRole="button" onPress={() => setPanel({ kind: "use", id: goal.id })} className="flex-1 flex-row items-center justify-center gap-1 rounded-xl bg-slate-50 py-2.5 dark:bg-noche-3"><ArrowUpRight size={15} color="#65764a" /><Text className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("savings.use")}</Text></TouchableOpacity>}
          </View>}
          {menu === goal.id && !soloLectura && <View className="mt-2 flex-row gap-2 border-t border-slate-100 pt-2 dark:border-noche-borde">
            <TouchableOpacity onPress={() => { setPanel({ kind: "edit", id: goal.id }); setMenu(null); }} className="flex-1 items-center py-2"><Text className="text-sm font-bold text-slate-600 dark:text-slate-200">{t("common.edit")}</Text></TouchableOpacity>
            {goal.saved > 0 && <TouchableOpacity onPress={() => { setPanel({ kind: "withdraw", id: goal.id }); setMenu(null); }} className="flex-1 items-center py-2"><Text className="text-center text-xs font-bold text-violet-700 dark:text-violet-300">{t("savings.returnPersonal")}</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setDeleting(goal)} className="flex-1 items-center py-2"><Text className="text-sm font-bold text-rose-500">{t("common.delete")}</Text></TouchableOpacity>
          </View>}
        </View>;
      })}
      </> : <>
        <View className="mt-5 mb-3">
          <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{t("savings.tabMovements")}</Text>
          <Text className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">{t("savings.movementSummary")}</Text>
        </View>
        {movementGoals.length === 0 && <View className="items-center rounded-2xl bg-slate-50 p-6 dark:bg-noche-2"><PiggyBank size={30} color="#7c3aed" /><Text className="mt-3 text-center text-sm text-slate-500 dark:text-slate-300">{t("savings.noMovements")}</Text></View>}
        {movementGoals.slice(0, goalLimit).map((goal, index) => <View key={`movement-${goal.id}`}>
          {index > 0 ? <MovementDivider /> : null}
          <SavingsFlowSummaryCard testID={`savings-movement-summary-${goal.id}`}
            goal={goal} summary={fundingSummaries.get(goal.id) ?? { received: 0, returned: 0 }} view="savings" fmt={fmt} t={t} />
        </View>)}
      </>}
    </ScrollView>
    {panel?.kind === "create" || panel?.kind === "edit" && selected ? <GoalFormSheet goal={selected} onClose={closePanel} onSave={(goal, initial, expectedSaved) => commit({ kind: panel.kind === "edit" ? "edit" : "create", goal, initial, ...(panel.kind === "edit" ? { saved: goal.saved, expectedSaved } : {}) })} /> : null}
    {(panel?.kind === "add" || panel?.kind === "withdraw") && selected && <MoveMoneySheet mode={panel.kind} goal={selected} onClose={closePanel} onConfirm={amount => commit({ kind: panel.kind === "add" ? "add" : "withdraw", goalId: selected.id, amount })} />}
    {panel?.kind === "use" && selected && <UseSavingsSheet goal={selected} onClose={closePanel} onSave={transaction => commit({ kind: "use", goalId: selected.id, transaction })} />}
    <ConfirmDialog visible={Boolean(deleting)} title={t("savingsDetail.confirmDeleteTitle")} message={t("savings.deleteBody", { amount: fmt(goals.find(goal => goal.id === deleting?.id)?.saved ?? 0) })}
      confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} onCancel={() => { if (!lock.current) setDeleting(null); }} onConfirm={() => { if (deleting) void commit({ kind: "delete", goalId: deleting.id }); }} />
  </View>;
}
