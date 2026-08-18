import { Alert } from "react-native";
import { router } from "expo-router";
import Login from "@/screens/Login";
import { useAppData } from "@/contexts/AppDataContext";
import { auth } from "@/utils/firebase";

export default function LoginRoute() {
  const { t, hasOnboarded, reloadPersistedData, hydrateFromCloud, setUserName, setUserEmail } =
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
          /**
           * ESTA CUENTA NO TIENE NINGUNA COPIA, Y HAY QUE DECIRLO (18/08/2026)
           *
           * Hasta hoy esto se pasaba en silencio: se entraba, la pantalla salía vacía, y
           * desde fuera eso se ve **exactamente igual** que "la app perdió mis datos".
           *
           * Le pasó a él con tres cuentas suyas —dos de Google y una de Hotmail—: sus
           * movimientos estaban a salvo en la nube de una, entró con otra, y dio por hecho
           * que se habían borrado. Media tarde en descubrir que la app no tenía nada roto.
           *
           * **No se borra nada ni se toca la nube**: si el celular ya traía datos, siguen
           * ahí abajo (`reloadPersistedData`). Lo único que se añade es decir lo que pasó y
           * cuál es la salida, que es el patrón de toda esta app —un fallo que no avisa
           * cuesta días—.
           *
           * Solo se avisa a quien YA usaba la app (`hasOnboarded`). A quien acaba de
           * instalarla, "no hay copia" es lo normal y el aviso solo asustaría.
           */
          if (hasOnboarded) {
            Alert.alert(t("login.sinCopiaTitulo"), t("login.sinCopiaTexto"));
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
