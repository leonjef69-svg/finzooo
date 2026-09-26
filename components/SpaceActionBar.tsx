import { Plus } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";

export default function SpaceActionBar({ onAdd }: { onAdd: () => void }) {
  return <View className="items-center border-t border-slate-200 bg-white pb-2 pt-2 dark:border-noche-borde dark:bg-noche">
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Agregar movimiento" onPress={onAdd} className="h-14 w-16 items-center justify-center rounded-[26px] bg-emerald-600" style={{ transform: [{ translateY: -10 }] }}><Plus size={28} color="#fff" strokeWidth={3} /></TouchableOpacity>
  </View>;
}
