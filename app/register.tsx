import { router } from "expo-router";
import Register from "@/screens/Register";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";

export default function RegisterRoute() {
  const { hasOnboarded, hydrateFromCloud, setUserName, setUserEmail } = useAppData();
  return (
    <Register
      onRegistered={(name, email) => {
        setUserName(name);
        setUserEmail(email);
        // Antes de dejarla usar la app, tiene que confirmar su correo
        // (le acabamos de mandar el enlace de verificación).
        router.replace("/verify-email");
      }}
      // Con Google la cuenta ya viene con el correo verificado, así que no
      // pasa por /verify-email: sigue el mismo camino que un inicio de
      // sesión normal. Si ya tenía datos en la nube (por ejemplo, porque
      // entró antes desde otro celular), se recuperan aquí.
      onGoogleSignedIn={async () => {
        const user = auth.currentUser;
        if (user) {
          setUserName(user.displayName || "");
          setUserEmail(user.email || "");
          const gotCloudData = await hydrateFromCloud(user.uid);
          if (gotCloudData) {
            router.replace("/(tabs)");
            return;
          }
        }
        router.replace(hasOnboarded ? "/(tabs)" : "/setup");
      }}
      onGoLogin={() => router.replace("/login")}
    />
  );
}
