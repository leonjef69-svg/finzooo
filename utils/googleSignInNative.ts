type GoogleSignInNative = typeof import("@react-native-google-signin/google-signin");

let cachedModule: GoogleSignInNative | null | undefined;
let configuredClientId: string | null = null;

/**
 * Expo Go no incluye el módulo nativo de Google Sign-In. Cargarlo al abrir la
 * app provocaba una pantalla roja incluso cuando el botón de Google estaba
 * oculto. La compilación instalada sí lo incluye; aquí se carga solo cuando
 * una función de Google realmente se usa.
 */
export function getGoogleSignInNative(): GoogleSignInNative {
  if (cachedModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedModule = require("@react-native-google-signin/google-signin") as GoogleSignInNative;
    } catch {
      cachedModule = null;
    }
  }

  if (!cachedModule) {
    throw new Error("Google no está disponible en esta versión de la app.");
  }
  return cachedModule;
}

export function configureGoogleSignIn(webClientId: string): GoogleSignInNative {
  const native = getGoogleSignInNative();
  if (configuredClientId !== webClientId) {
    native.GoogleSignin.configure({ webClientId });
    configuredClientId = webClientId;
  }
  return native;
}
