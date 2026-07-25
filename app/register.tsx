import { router } from "expo-router";
import Register from "@/screens/Register";
import { useAppData } from "@/contexts/AppDataContext";

export default function RegisterRoute() {
  const { setUserName, setUserEmail } = useAppData();
  return (
    <Register
      onRegistered={(name, email) => {
        setUserName(name);
        setUserEmail(email);
        // Antes de dejarla usar la app, tiene que confirmar su correo
        // (le acabamos de mandar el enlace de verificación).
        router.replace("/verify-email");
      }}
      onGoLogin={() => router.replace("/login")}
    />
  );
}
