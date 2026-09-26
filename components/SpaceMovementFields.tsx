import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { EXPENSE_CATS, INCOME_CATS } from "@/constants/categories";
import { useAppData } from "@/contexts/AppDataContext";

export function validSpaceDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function SpaceMovementFields({ type, category, onCategory, date, onDate, notes, onNotes }: {
  type: "ingreso" | "gasto" | null;
  category: string;
  onCategory: (value: string) => void;
  date: string;
  onDate: (value: string) => void;
  notes: string;
  onNotes: (value: string) => void;
}) {
  const { t } = useAppData();
  const [open, setOpen] = useState(false);
  const categories = type === "ingreso" ? INCOME_CATS : EXPENSE_CATS;
  const selected = categories.find(item => item.id === category) ?? categories[0];
  return <View className="mt-2 gap-2">
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} className="min-h-11 flex-row items-center justify-between rounded-xl border border-slate-200 px-3 dark:border-noche-borde"><Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">Categoría</Text><Text className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{t(selected.label)} ▾</Text></TouchableOpacity>
    {open ? <View className="gap-1 rounded-xl border border-slate-200 p-1 dark:border-noche-borde">{categories.map(item => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityState={{ selected: selected.id === item.id }} onPress={() => { onCategory(item.id); setOpen(false); }} className={`min-h-10 justify-center rounded-lg px-3 ${selected.id === item.id ? "bg-emerald-100 dark:bg-emerald-950" : "bg-slate-50 dark:bg-noche-2"}`}><Text className="text-sm text-slate-800 dark:text-slate-100">{t(item.label)}</Text></TouchableOpacity>)}</View> : null}
    <View className="flex-row gap-2"><View className="flex-1"><Text className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Fecha</Text><TextInput disableFullscreenUI accessibilityLabel="Fecha, año mes día" value={date} onChangeText={onDate} maxLength={10} keyboardType="numbers-and-punctuation" placeholder="AAAA-MM-DD" placeholderTextColor="#94a3b8" className="h-11 rounded-xl border border-slate-200 px-3 text-slate-900 dark:border-noche-borde dark:text-slate-100" /></View><View className="flex-1"><Text className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Nota</Text><TextInput disableFullscreenUI accessibilityLabel="Nota opcional" value={notes} onChangeText={onNotes} maxLength={300} placeholder="Opcional" placeholderTextColor="#94a3b8" className="h-11 rounded-xl border border-slate-200 px-3 text-slate-900 dark:border-noche-borde dark:text-slate-100" /></View></View>
  </View>;
}
