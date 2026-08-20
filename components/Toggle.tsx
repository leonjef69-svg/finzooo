import { TouchableOpacity, View } from "react-native";

export default function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!on)}
      className={`w-11 h-6 rounded-full justify-center px-0.5 ${on ? "bg-emerald-600" : "bg-slate-200 dark:bg-noche-3"}`}
    >
      <View className="w-5 h-5 bg-white rounded-full" style={{ transform: [{ translateX: on ? 20 : 0 }] }} />
    </TouchableOpacity>
  );
}
