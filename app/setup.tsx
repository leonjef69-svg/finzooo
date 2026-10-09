import { router } from "expo-router";
import SetupBudget from "@/screens/SetupBudget";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";

export default function SetupRoute() {
  const { t, completeOnboarding } = useAppData();
  return (
    <SetupBudget
      onSaved={async (amount) => {
        const user = auth.currentUser;
        if (!user) throw new Error(t("settings.noActiveSession"));
        await completeOnboarding(amount);
        if (auth.currentUser !== user) throw new Error(t("settings.noActiveSession"));
        router.replace(auth.currentUser && !auth.currentUser.emailVerified ? "/verify-email" : "/(tabs)");
      }}
    />
  );
}
