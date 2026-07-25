import { Text, View } from "react-native";
import { Check } from "lucide-react-native";

export default function Toast({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View className="absolute left-0 right-0 bottom-24 items-center z-50" pointerEvents="none">
      <View className="bg-slate-900 flex-row items-center gap-2 px-4 py-3 rounded-2xl">
        <Check size={16} color="#34d399" />
        <Text className="text-white text-sm font-medium">{text}</Text>
      </View>
    </View>
  );
}
