import { router } from "expo-router";
import { reload, sendEmailVerification } from "firebase/auth";
import VerifyEmail from "@/screens/VerifyEmail";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { withTimeout } from "@/utils/withTimeout";

export default function VerifyEmailRoute() {
  const { t, openLocalAccount, hydrateFromCloud, logout } = useAppData();

  return (
    <VerifyEmail
      email={auth.currentUser?.email || ""}
      onCheckAgain={async () => {
        const user = auth.currentUser;
        if (!user) return false;
        await withTimeout(reload(user));
        if (auth.currentUser !== user) {
          const failure = new Error(t("settings.noActiveSession"));
          failure.name = "LocalAccountAccessError";
          throw failure;
        }
        if (!user.emailVerified) return false;
        const localRestored = await withTimeout(openLocalAccount(user.uid, user.email));
        if (localRestored) {
          router.replace("/(tabs)");
          return true;
        }

        const cloudResult = await withTimeout(hydrateFromCloud(user.uid));
        if (cloudResult === "restored") {
          router.replace("/(tabs)");
          return true;
        }
        router.replace("/setup");
        return true;
      }}
      onResend={async () => {
        const user = auth.currentUser;
        if (!user) throw new Error(t("settings.noActiveSession"));
        await withTimeout(sendEmailVerification(user));
        if (auth.currentUser !== user) throw new Error(t("settings.noActiveSession"));
      }}
      onLogout={async () => {
        await logout();
        router.replace("/login");
      }}
    />
  );
}
