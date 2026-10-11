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
import { type EntryOperationGuard } from "@/utils/entryOperation";

export default function OnboardingRoute() {
  const { t, showToast, openLocalAccount, hydrateFromCloud, setUserName, setUserEmail } = useAppData();

  async function continueWithGoogle(operationCurrent: EntryOperationGuard = () => true) {
    let authenticated = false;
    try {
      if (!operationCurrent()) return;
      await signInWithGoogle();
      if (!operationCurrent()) return;
      authenticated = true;
      const user = auth.currentUser;
      if (!user) throw new Error("Google no devolvió una cuenta.");
      const current = () => operationCurrent() && auth.currentUser === user;
      await withTimeout(recordLegalAcceptanceForCurrentAccount()).catch(() => { if (current()) showToast(t("legal.saveFailed")); });
      if (!current()) return;

      const restoredLocal = await openLocalAccount(user.uid, user.email);
      if (!current()) return;
      if (restoredLocal) { router.replace("/(tabs)"); return; }
      setUserName(user.displayName || "");
      setUserEmail(user.email || "");
      const cloudResult = await hydrateFromCloud(user.uid);
      if (!current()) return;
      if (cloudResult === "premium-required") {
        Alert.alert(t("login.cloudRequiresPremiumTitle"), t("login.cloudRequiresPremiumText"));
      }
      router.replace(cloudResult === "restored" ? "/(tabs)" : "/setup");
    } catch (error) {
      if (!operationCurrent()) return;
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
