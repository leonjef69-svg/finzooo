import { router } from "expo-router";
import SetupBudget from "@/screens/SetupBudget";
import { useAppData } from "@/contexts/AppDataContext";

export default function SetupRoute() {
  const { completeOnboarding } = useAppData();
  return (
    <SetupBudget
      onSaved={(amount) => {
        completeOnboarding(amount);
        router.replace("/(tabs)");
      }}
    />
  );
}
