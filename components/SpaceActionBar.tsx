import { ArrowDown, ArrowUp, Plus } from "lucide-react-native";
import { Text, TouchableOpacity, View } from "react-native";
import type { MovementFilter } from "@/components/SpaceMovementControls";

export default function SpaceActionBar({ filter, onFilter, onAdd }: {
  filter: MovementFilter;
  onFilter: (filter: MovementFilter) => void;
  onAdd: () => void;
}) {
  return <View className="flex-row items-end border-t border-slate-200 bg-white px-5 pb-2 pt-2 dark:border-noche-borde dark:bg-noche">
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: filter === "ingreso" }} accessibilityLabel="Ver ingresos" onPress={() => onFilter("ingreso")} className="min-h-12 flex-1 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950" style={{ transform: [{ translateY: filter === "ingreso" ? -10 : 0 }], borderTopLeftRadius: filter === "ingreso" ? 25 : 16, borderTopRightRadius: filter === "ingreso" ? 25 : 16 }}><ArrowUp size={20} color="#047857" /><Text className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Ingreso</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Agregar movimiento" onPress={onAdd} className="mx-3 h-14 w-16 items-center justify-center rounded-[26px] bg-emerald-600" style={{ transform: [{ translateY: filter === null || filter === "transferencia" ? -10 : 0 }] }}><Plus size={28} color="#fff" strokeWidth={3} /></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: filter === "gasto" }} accessibilityLabel="Ver gastos" onPress={() => onFilter("gasto")} className="min-h-12 flex-1 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950" style={{ transform: [{ translateY: filter === "gasto" ? -10 : 0 }], borderTopLeftRadius: filter === "gasto" ? 25 : 16, borderTopRightRadius: filter === "gasto" ? 25 : 16 }}><ArrowDown size={20} color="#be123c" /><Text className="text-xs font-bold text-rose-700 dark:text-rose-300">Gasto</Text></TouchableOpacity>
  </View>;
}
