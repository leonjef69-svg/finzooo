export function firebaseErrorMessage(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "Ya existe una cuenta con este correo.";
    case "auth/invalid-email":
      return "Correo inválido.";
    case "auth/weak-password":
      return "La contraseña es muy débil (mínimo 6 caracteres).";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Correo o contraseña incorrectos.";
    case "auth/requires-recent-login":
      return "Por seguridad, vuelve a ingresar tu contraseña actual.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    case "auth/network-request-failed":
      return "No hay conexión a internet.";
    default:
      return "Ocurrió un error. Inténtalo de nuevo.";
  }
}
