import { TouchableOpacity, View } from "react-native";

export default function Toggle({ on, onChange, label, disabled = false }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      hitSlop={{ top: 12, bottom: 12, left: 3, right: 3 }}
      onPress={() => { if (!disabled) onChange(!on); }}
      className={`w-11 h-6 rounded-full justify-center px-0.5 ${on ? "bg-emerald-600" : "bg-slate-200 dark:bg-noche-3"}`}
    >
      <View className="w-5 h-5 bg-white rounded-full" style={{ transform: [{ translateX: on ? 20 : 0 }] }} />
    </TouchableOpacity>
  );
}
