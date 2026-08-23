import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "@firebase/auth";
import { auth } from "@/utils/firebase";

// "ID de cliente web" del proyecto de Firebase (Authentication > Google >
// Configuración del SDK web). No es un secreto: identifica a la app ante
// Google, igual que las demás claves de firebaseConfig. Lo que de verdad
// protege el acceso es la huella SHA-1 registrada en Firebase, que Google
// verifica contra la firma real del APK instalado.
const WEB_CLIENT_ID = "133168544890-ron5kg6fllq20rrnqil0t2hbqguu54p1.apps.googleusercontent.com";

// Se configura una sola vez al cargar el módulo. configure() no hace
// llamadas de red ni pide permisos: solo deja anotado con qué proyecto
// hablar cuando más tarde se pulse el botón.
//
// Ojo: aquí NO se pide el permiso de Drive. Se pide recién la primera vez
// que alguien manda un reporte a Drive (ver utils/googleDrive.ts). Si
// estuviera aquí, a todo el mundo le saldría una ventana pidiendo acceso a
// su Drive solo por entrar con Google, incluso a quien nunca vaya a
// exportar nada — y eso espanta con razón.
GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

// La persona canceló (cerró la ventana de Google o tocó "atrás"). No es un
// error: no hay que mostrarle ningún aviso, solo dejar la pantalla como
// estaba.
export class GoogleSignInCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "GoogleSignInCancelled";
  }
}

// Abre el selector de cuentas de Google y, con el resultado, inicia sesión
// en Firebase. Al terminar, `auth.currentUser` queda igual que si se
// hubiera entrado con correo y contraseña — el resto de la app no necesita
// distinguir cómo se entró.
//
// Nota: las cuentas de Google llegan con el correo ya verificado, así que
// estos usuarios se saltan la pantalla de "verifica tu correo".
export async function signInWithGoogle(): Promise<void> {
  // Comprueba que el celular tenga los servicios de Google al día. Sin
  // esto, en un celular sin Play Services el fallo sería un error nativo
  // poco claro en vez de un mensaje entendible.
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  let response;
  try {
    response = await GoogleSignin.signIn();
    if (response.type === "cancelled") {
      throw new GoogleSignInCancelled();
    }
  } catch (error) {
    // La versión nueva devuelve "cancelled", pero algunos celulares todavía
    // lo arrojan como código nativo. Los dos caminos deben comportarse igual.
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new GoogleSignInCancelled();
    }
    throw error;
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    // No debería pasar con webClientId configurado, pero si pasara, sin
    // este aviso el fallo sería un "null" silencioso más adelante.
    throw new Error("Google no devolvió el identificador de la cuenta.");
  }

  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

// Cierra también la sesión del lado de Google. Sin esto, la próxima vez
// que alguien pulse "Continuar con Google" entraría directo con la última
// cuenta usada, sin poder elegir otra — molesto en un celular compartido.
export async function signOutFromGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Si falla (por ejemplo, nunca se entró con Google), no importa: el
    // cierre de sesión de Firebase es el que manda.
  }
}
