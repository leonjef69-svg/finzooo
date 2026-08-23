type GoogleErrorLike = {
  code?: unknown;
  message?: unknown;
};

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = (error as GoogleErrorLike).code;
  return typeof code === "string" || typeof code === "number" ? String(code).trim() : "";
}

// Los fallos de Google vienen de dos sitios distintos: Android y Firebase.
// Antes todos terminaban como "Ocurrió un error" debajo de Contraseña, por
// lo que era imposible saber qué arreglar. Estos códigos son cortos para que
// una captura del tester alcance y no muestran ningún dato de su cuenta.
export function googleSignInErrorMessage(error: unknown): string {
  const code = errorCode(error);
  const upper = code.toUpperCase();

  if (code === "10" || upper.includes("DEVELOPER_ERROR")) {
    return "Google no pudo validar esta instalación de Fino. Código G10.";
  }
  if (
    code === "7" ||
    upper.includes("NETWORK_ERROR") ||
    code === "auth/network-request-failed"
  ) {
    return "No se pudo conectar con Google. Revisa Internet y vuelve a intentarlo. Código G7.";
  }
  if (upper.includes("PLAY_SERVICES_NOT_AVAILABLE")) {
    return "Actualiza Servicios de Google Play y vuelve a intentarlo. Código GPS.";
  }
  if (upper.includes("IN_PROGRESS") || upper.includes("ASYNC_OP_IN_PROGRESS")) {
    return "El acceso con Google ya está abierto. Espera un momento y vuelve a intentarlo.";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "Este correo ya tiene una cuenta. Entra con correo y contraseña. Código GAC.";
  }
  if (code === "auth/operation-not-allowed") {
    return "El acceso con Google no está disponible en este momento. Código GON.";
  }
  if (code === "auth/too-many-requests") {
    return "Hubo demasiados intentos. Espera un momento y vuelve a intentarlo. Código GLIM.";
  }

  // El código desconocido queda visible para que un solo intento del tester
  // sirva para encontrar la causa. Se limita a letras, números y signos
  // comunes para no enseñar mensajes internos ni datos de la cuenta.
  const safeCode = code.replace(/[^a-zA-Z0-9_./-]/g, "").slice(0, 40);
  return `No se pudo entrar con Google. Código ${safeCode || "GSIN"}.`;
}
