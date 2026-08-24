import { router } from "expo-router";
import Onboarding from "@/screens/Onboarding";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { GoogleSignInCancelled, signInWithGoogle } from "@/utils/googleAuth";
import { googleSignInErrorMessage } from "@/utils/googleSignInError";
import { irUnaVez } from "@/utils/nav";

export default function OnboardingRoute() {
  const { hasOnboarded, hydrateFromCloud, setUserName, setUserEmail } = useAppData();

  async function continueWithGoogle() {
    try {
      await signInWithGoogle();
      const user = auth.currentUser;
      if (!user) throw new Error("Google no devolvió una cuenta.");

      setUserName(user.displayName || "");
      setUserEmail(user.email || "");
      const gotCloudData = await hydrateFromCloud(user.uid);
      router.replace((gotCloudData || hasOnboarded) ? "/(tabs)" : "/setup");
    } catch (error) {
      if (error instanceof GoogleSignInCancelled) return;
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
