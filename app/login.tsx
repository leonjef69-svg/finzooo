import { Alert } from "react-native";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import Login from "@/screens/Login";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";

export default function AccessRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const pathname = usePathname();
  return <LoginRoute initialMode={mode === "register" || pathname === "/register" ? "register" : "login"} />;
}

export function LoginRoute({ initialMode = "login" }: { initialMode?: "login" | "register" } = {}) {
  const { t, openLocalAccount, hydrateFromCloud, setUserName, setUserEmail } =
    useAppData();
  return (
    <Login
      initialMode={initialMode}
      onLoggedIn={async (operationCurrent = () => true) => {
        if (!operationCurrent()) return;
        const user = auth.currentUser;
        if (!user) return;
        const current = () => operationCurrent() && auth.currentUser === user;
        if (!user.emailVerified) {
          router.replace("/verify-email");
          return;
        }
        const localRestored = await openLocalAccount(user.uid, user.email);
        if (!current()) return;
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
          if (!current()) return;
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
      onRegistered={async (name, email, operationCurrent = () => true) => {
        if (!operationCurrent()) return;
        const user = auth.currentUser;
        if (!user) return;
        const current = () => operationCurrent() && auth.currentUser === user;
        // Registro por correo: verificar antes de abrir cualquier copia.
        if (!user.emailVerified) { router.replace("/verify-email"); return; }
        const localRestored = await openLocalAccount(user.uid, user.email);
        if (!current()) return;
        if (!localRestored) { setUserName(name); setUserEmail(email); }
        router.replace(localRestored ? "/(tabs)" : "/setup");
      }}
    />
  );
}
