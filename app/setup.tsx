import { router } from "expo-router";
import SetupBudget from "@/screens/SetupBudget";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";

export default function SetupRoute() {
  const { completeOnboarding } = useAppData();
  return (
    <SetupBudget
      onSaved={(amount) => {
        completeOnboarding(amount);
        router.replace(auth.currentUser && !auth.currentUser.emailVerified ? "/verify-email" : "/(tabs)");
      }}
    />
  );
}
