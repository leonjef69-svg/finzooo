import { router } from "expo-router";
import Login from "@/screens/Login";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";

export default function LoginRoute() {
  const { hasOnboarded, reloadPersistedData, hydrateFromCloud, setUserName, setUserEmail } =
    useAppData();
  return (
    <Login
      onLoggedIn={async () => {
        const user = auth.currentUser;
        if (user) {
          setUserName(user.displayName || "");
          setUserEmail(user.email || "");
        }
        if (user && !user.emailVerified) {
          router.replace("/verify-email");
          return;
        }
        // Primero intenta traer los datos de esta cuenta desde la nube
        // (por si inició sesión antes en otro celular).
        if (user) {
          const gotCloudData = await hydrateFromCloud(user.uid);
          if (gotCloudData) {
            router.replace("/(tabs)");
            return;
          }
        }
        if (hasOnboarded) {
          // Vuelve a leer lo guardado en este celular, por si algo cambió
          // desde el último "Cerrar sesión" dentro de esta misma vez que
          // la app estuvo abierta.
          await reloadPersistedData();
          router.replace("/(tabs)");
        } else {
          router.replace("/setup");
        }
      }}
      onGoRegister={() => router.replace("/register")}
    />
  );
}
