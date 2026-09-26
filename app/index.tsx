import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useAppData } from "@/contexts/AppDataContext";
import { useNavigateWhenReady } from "@/utils/nav";

export default function Index() {
  const { ready, authReady, hasOnboarded, needsEmailVerification } = useAppData();
  useNavigateWhenReady(
    ready && authReady
      ? () => router.dismissTo(
          needsEmailVerification
            ? "/verify-email"
            : hasOnboarded
              ? "/(tabs)"
              : "/onboarding"
        )
      : null,
    [ready, authReady, hasOnboarded, needsEmailVerification]
  );

  return <View className="flex-1 items-center justify-center bg-[#f8f3e9]"><ActivityIndicator color="#059669" /></View>;
}
