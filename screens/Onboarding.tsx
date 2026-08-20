import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, ChevronRight, ShieldCheck, Target } from "lucide-react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useAppData } from "@/contexts/AppDataContext";

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { t } = useAppData();
  const SLIDES = [
    { Icon: Target, title: t("onboarding.slide1Title"), body: t("onboarding.slide1Body") },
    { Icon: BarChart3, title: t("onboarding.slide2Title"), body: t("onboarding.slide2Body") },
    { Icon: ShieldCheck, title: t("onboarding.slide3Title"), body: t("onboarding.slide3Body") },
  ];
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const isLast = i === SLIDES.length - 1;
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row justify-end px-5 pt-3">
        <TouchableOpacity activeOpacity={0.6} onPress={onFinish}>
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-300">{t("onboarding.skip")}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        key={i}
        entering={FadeIn.duration(350)}
        className="flex-1 items-center justify-center px-8"
      >
        <View className="w-28 h-28 rounded-full bg-emerald-50 items-center justify-center mb-8">
          <slide.Icon size={48} color="#059669" strokeWidth={1.8} />
        </View>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-3 text-center">
          {slide.title}
        </Text>
        <Text className="text-sm text-slate-600 dark:text-slate-200 leading-relaxed text-center">{slide.body}</Text>
      </Animated.View>

      <View className="flex-row items-center justify-center gap-2 mb-6">
        {SLIDES.map((_, idx) => (
          <View
            key={idx}
            className={`h-1.5 rounded-full ${idx === i ? "w-6 bg-emerald-600" : "w-1.5 bg-slate-200 dark:bg-noche-3"}`}
          />
        ))}
      </View>

      <View className="px-6 pb-8">
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => (isLast ? onFinish() : setI(i + 1))}
          className="w-full bg-emerald-600 py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg"
        >
          <Text className="text-white font-bold">{isLast ? t("setup.start") : t("onboarding.next")}</Text>
          <ChevronRight size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
