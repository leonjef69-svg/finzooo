import { router } from "expo-router";
import Onboarding from "@/screens/Onboarding";

export default function OnboardingRoute() {
  return <Onboarding onFinish={() => router.replace("/register")} />;
}
