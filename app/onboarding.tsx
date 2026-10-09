import { Alert } from "react-native";
import { router } from "expo-router";
import Onboarding from "@/screens/Onboarding";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { GoogleSignInCancelled, signInWithGoogle } from "@/utils/googleAuth";
import { googleSignInErrorMessage } from "@/utils/googleSignInError";
import { irUnaVez } from "@/utils/nav";
import { recordLegalAcceptanceForCurrentAccount } from "@/utils/legalAcceptance";
import { withTimeout } from "@/utils/withTimeout";

export default function OnboardingRoute() {
  const { t, showToast, openLocalAccount, hydrateFromCloud, setUserName, setUserEmail } = useAppData();

  async function continueWithGoogle() {
    let authenticated = false;
    try {
      await signInWithGoogle();
      authenticated = true;
      await withTimeout(recordLegalAcceptanceForCurrentAccount()).catch(() => showToast(t("legal.saveFailed")));
      const user = auth.currentUser;
      if (!user) throw new Error("Google no devolvió una cuenta.");

      const restoredLocal = await openLocalAccount(user.uid, user.email);
      if (restoredLocal) { router.replace("/(tabs)"); return; }
      setUserName(user.displayName || "");
      setUserEmail(user.email || "");
      const cloudResult = await hydrateFromCloud(user.uid);
      if (cloudResult === "premium-required") {
        Alert.alert(t("login.cloudRequiresPremiumTitle"), t("login.cloudRequiresPremiumText"));
      }
      router.replace(cloudResult === "restored" ? "/(tabs)" : "/setup");
    } catch (error) {
      if (error instanceof GoogleSignInCancelled) return;
      if (error instanceof Error && error.name === "LocalAccountAccessError") throw error;
      if (authenticated && (error as { code?: string })?.code !== "cloud/history-format-unsupported") throw new Error(t("login.accountOpenFailed"));
      throw new Error(googleSignInErrorMessage(error));
    }
  }

  return (
    <Onboarding
      onGoogle={continueWithGoogle}
      onCreateAccount={() => irUnaVez("/register")}
      onLogin={() => irUnaVez("/login")}
    />
  );
}
