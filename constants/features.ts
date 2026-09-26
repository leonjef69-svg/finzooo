/**
 * Integraciones que necesitan un servicio externo desplegado se habilitan en
 * la compilación, no desde el teléfono. Así una versión pública nunca ofrece
 * un botón que depende de un servidor inexistente.
 */
export const TELEGRAM_ENABLED = process.env.EXPO_PUBLIC_TELEGRAM_ENABLED === "true";
