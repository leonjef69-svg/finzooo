import { Alert } from "react-native";
import { useRef } from "react";
import { router } from "expo-router";
import Onboarding from "@/screens/Onboarding";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { GoogleSignInCancelled, signInWithGoogle } from "@/utils/googleAuth";
import { googleSignInErrorMessage } from "@/utils/googleSignInError";
import { irUnaVez } from "@/utils/nav";
import { hasAcceptedLegalDocuments, recordLegalAcceptanceForCurrentAccount } from "@/utils/legalAcceptance";
import { withTimeout } from "@/utils/withTimeout";
import { type EntryOperationGuard } from "@/utils/entryOperation";

export default function OnboardingRoute() {
  const { t, openLocalAccount, hydrateFromCloud, setUserName, setUserEmail } = useAppData();
  const pendingGoogleUser = useRef<typeof auth.currentUser>(null);

  async function continueWithGoogle(operationCurrent: EntryOperationGuard = () => true, legalAccepted = false) {
    let authenticated = false;
    let authenticatedUser: typeof auth.currentUser = null;
    let checkingLegalAcceptance = false;
    try {
      if (!operationCurrent()) return;
      const user = pendingGoogleUser.current && auth.currentUser === pendingGoogleUser.current ? pendingGoogleUser.current : await signInWithGoogle();
      authenticatedUser = user;
      if (!operationCurrent()) return;
      authenticated = true;
      if (!user) throw new Error("Google no devolvió una cuenta.");
      if (auth.currentUser !== user) return;
      const current = () => operationCurrent() && auth.currentUser === user;
      checkingLegalAcceptance = true;
      let accepted = false;
      try { accepted = await withTimeout(hasAcceptedLegalDocuments(user.uid)); }
      catch (error) { if (!(error instanceof Error) || error.message !== "legal-receipt-invalid") throw error; }
      if (!current()) return;
      if (!accepted && !legalAccepted) {
        pendingGoogleUser.current = user;
        const required = new Error(t("auth.legalRequired"));
        required.name = "GoogleLegalAcceptanceRequired";
        throw required;
      }
      if (!accepted) await withTimeout(recordLegalAcceptanceForCurrentAccount());
      if (!current()) return;
      checkingLegalAcceptance = false;
      pendingGoogleUser.current = null;

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
      if (!operationCurrent() || (authenticatedUser && auth.currentUser !== authenticatedUser)) return;
      if (error instanceof GoogleSignInCancelled) return;
      if (error instanceof Error && error.name === "GoogleLegalAcceptanceRequired") throw error;
      if (error instanceof Error && error.name === "LocalAccountAccessError") throw error;
      if (checkingLegalAcceptance) throw new Error(t("legal.saveFailed"));
      if (authenticated && (error as { code?: string })?.code !== "cloud/history-format-unsupported") throw new Error(t("login.accountOpenFailed"));
      throw new Error(googleSignInErrorMessage(error));
    }
  }

  return (
    <Onboarding
      onGoogle={continueWithGoogle}
      onCreateAccount={() => irUnaVez("/login?mode=register")}
      onLogin={() => irUnaVez("/login")}
    />
  );
}
