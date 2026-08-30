import { TouchableOpacity } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Plus } from "lucide-react-native";

export default function FAB({ onPress }: { onPress: () => void }) {
  return (
    <Animated.View
      entering={ZoomIn.duration(400).springify()}
      className="z-20"
      pointerEvents="box-none"
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        className="w-14 h-14 rounded-full bg-emerald-600 items-center justify-center border-2 border-white"
        style={{
          shadowColor: "#059669",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.65,
          shadowRadius: 8,
          elevation: 12,
        }}
      >
        <Plus size={30} color="#ffffff" strokeWidth={3.2} />
      </TouchableOpacity>
    </Animated.View>
  );
}
