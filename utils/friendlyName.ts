/** Nombre corto para el saludo. Nunca muestra un correo completo. */
export function friendlyName(value: string) {
  const clean = String(value ?? "").trim();
  if (!clean) return "";
  const first = (clean.includes("@") ? clean.split("@")[0] : clean.split(/\s+/)[0])
    .replace(/[._-]+/g, " ")
    .trim();
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1);
}
