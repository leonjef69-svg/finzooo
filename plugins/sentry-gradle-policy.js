const SENTRY_GRADLE = "sentry.gradle";

function configureSentryGradle(contents, env = process.env) {
  const uploadRequested = env.FINO_SENTRY_UPLOAD_SOURCE_MAPS === "YES";
  if (uploadRequested) {
    const missing = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"]
      .filter((name) => !String(env[name] ?? "").trim());
    if (missing.length > 0) {
      throw new Error(`No se puede subir el mapa de Sentry: falta ${missing.join(", ")}.`);
    }
    if (env.SENTRY_DISABLE_AUTO_UPLOAD === "true") {
      throw new Error("La subida de mapas está desactivada por SENTRY_DISABLE_AUTO_UPLOAD.");
    }
    if (!contents.includes(SENTRY_GRADLE)) {
      throw new Error("No se puede subir el mapa de Sentry: falta sentry.gradle en Android.");
    }
    return contents;
  }

  // Sin activación explícita se conserva el comportamiento anterior: el AAB
  // puede compilarse aunque las credenciales privadas aún no existan.
  return contents
    .split("\n")
    .filter((line) => !line.includes("@sentry/react-native") || !line.includes(SENTRY_GRADLE))
    .join("\n");
}

module.exports = { configureSentryGradle };
