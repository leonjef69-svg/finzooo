import { View } from "react-native";
import { router } from "expo-router";
import { useAppData } from "@/contexts/AppDataContext";
import { useNavigateWhenReady } from "@/utils/nav";

export default function Index() {
  const { ready, hasOnboarded } = useAppData();
  useNavigateWhenReady(
    ready ? () => router.dismissTo(hasOnboarded ? "/(tabs)" : "/onboarding") : null,
    [ready, hasOnboarded]
  );

  return <View className="flex-1 bg-[#f8f3e9]" />;
}
