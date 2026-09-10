import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";

export default function Toast({ text }: { text: string }) {
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View
      className="absolute left-0 right-0 items-center z-50 px-4"
      style={{ bottom: 96 + insets.bottom }}
      pointerEvents="none"
    >
      <View className="bg-slate-900 flex-row items-center gap-2 px-4 py-3 rounded-2xl max-w-full">
        <Check size={16} color="#34d399" />
        <Text className="text-white text-sm font-medium flex-shrink">{text}</Text>
      </View>
    </View>
  );
}
