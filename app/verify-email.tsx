import { router } from "expo-router";
import { reload, sendEmailVerification } from "@firebase/auth";
import VerifyEmail from "@/screens/VerifyEmail";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { withTimeout } from "@/utils/withTimeout";

export default function VerifyEmailRoute() {
  const { hasOnboarded, reloadPersistedData, hydrateFromCloud, logout } = useAppData();

  return (
    <VerifyEmail
      email={auth.currentUser?.email || ""}
      onCheckAgain={async () => {
        const user = auth.currentUser;
        if (!user) return false;
        await withTimeout(reload(user));
        if (!user.emailVerified) return false;

        const gotCloudData = await withTimeout(hydrateFromCloud(user.uid));
        if (gotCloudData) {
          router.replace("/(tabs)");
          return true;
        }
        if (hasOnboarded) {
          await withTimeout(reloadPersistedData());
          router.replace("/(tabs)");
        } else {
          router.replace("/setup");
        }
        return true;
      }}
      onResend={async () => {
        if (auth.currentUser) {
          await withTimeout(sendEmailVerification(auth.currentUser));
        }
      }}
      onLogout={async () => {
        await logout();
        router.replace("/login");
      }}
    />
  );
}
