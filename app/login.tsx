import { Alert } from "react-native";
import { router } from "expo-router";
import Login from "@/screens/Login";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";
import { switchEntryRoute } from "@/utils/entryNavigation";

export default function LoginRoute() {
  const { t, openLocalAccount, hydrateFromCloud, setUserName, setUserEmail } =
    useAppData();
  return (
    <Login
      onLoggedIn={async () => {
        const user = auth.currentUser;
        if (!user) return;
        if (!user.emailVerified) {
          router.replace("/verify-email");
          return;
        }
        const localRestored = await openLocalAccount(user.uid, user.email);
        if (user) {
          if (!localRestored) setUserName(user.displayName || "");
          setUserEmail(user.email || "");
        }
        // La copia del teléfono es de esta cuenta y se conserva incluso Gratis.
        // No reemplazarla por una copia antigua de la nube al volver a entrar.
        if (localRestored) {
          router.replace("/(tabs)");
          return;
        }
        // Sin copia local, intenta recuperar la de esta cuenta desde la nube.
        if (user) {
          const cloudResult = await hydrateFromCloud(user.uid);
          if (cloudResult === "restored") {
            router.replace("/(tabs)");
            return;
          }
          if (cloudResult === "premium-required") {
            Alert.alert(t("login.cloudRequiresPremiumTitle"), t("login.cloudRequiresPremiumText"));
            router.replace("/setup");
            return;
          }
          Alert.alert(t("login.sinCopiaTitulo"), t("login.sinCopiaTexto"));
        }
        router.replace("/setup");
      }}
      onGoRegister={() => switchEntryRoute("/register")}
    />
  );
}
