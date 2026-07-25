import { TouchableOpacity } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Plus } from "lucide-react-native";

export default function FAB({ onPress }: { onPress: () => void }) {
  return (
    <Animated.View
      entering={ZoomIn.duration(400).springify()}
      className="absolute bottom-20 right-5 z-20"
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        className="w-14 h-14 rounded-full bg-emerald-600 items-center justify-center"
        style={{
          shadowColor: "#059669",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.5,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <Plus size={26} color="#ffffff" strokeWidth={2.6} />
      </TouchableOpacity>
    </Animated.View>
  );
}
