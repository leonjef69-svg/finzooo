import { useState } from "react";
import { router } from "expo-router";
import Splash from "@/screens/Splash";
import { useAppData } from "@/contexts/AppDataContext";
import { useNavigateWhenReady } from "@/utils/nav";

export default function Index() {
  const { ready, hasOnboarded } = useAppData();
  const [timerDone, setTimerDone] = useState(false);

  useNavigateWhenReady(
    timerDone && ready ? () => router.dismissTo(hasOnboarded ? "/(tabs)" : "/onboarding") : null,
    [timerDone, ready, hasOnboarded]
  );

  return <Splash onDone={() => setTimerDone(true)} />;
}
