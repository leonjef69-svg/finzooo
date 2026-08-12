import { useEffect } from "react";
import { Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { Wallet } from "lucide-react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useAppData } from "@/contexts/AppDataContext";

export default function Splash({ onDone }: { onDone: () => void }) {
  const { t } = useAppData();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    const timer = setTimeout(onDone, 1600);
    return () => clearTimeout(timer);
  }, [onDone, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <LinearGradient
      colors={["#059669", "#0f766e"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="flex-1 items-center justify-center"
    >
      <StatusBar style="light" />
      <Animated.View
        style={pulseStyle}
        className="w-20 h-20 rounded-3xl bg-white/15 items-center justify-center mb-5"
      >
        <Wallet size={38} color="#ffffff" strokeWidth={2.2} />
      </Animated.View>
      <Text className="text-white text-2xl font-extrabold tracking-tight">Fino</Text>
      <Text className="text-emerald-100 text-xs mt-1 font-medium">{t("splash.tagline")}</Text>
    </LinearGradient>
  );
}
