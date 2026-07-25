// Sombra suave reutilizable para tarjetas, filas y hojas — se pasa por
// "style" (no por className) porque las utilidades de sombra de Tailwind
// no se ven igual de bien en Android e iOS.
export const CARD_SHADOW = {
  shadowColor: "#0f172a",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};
