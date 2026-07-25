// Valor hexadecimal del tono "600" de cada color de Tailwind, para pintar
// los íconos (en el celular no se puede usar className para colorear un
// ícono SVG, así que se le pasa el color exacto).
export const COLOR_HEX_600: Record<string, string> = {
  rose: "#e11d48",
  amber: "#d97706",
  violet: "#7c3aed",
  pink: "#db2777",
  indigo: "#4f46e5",
  red: "#dc2626",
  sky: "#0284c7",
  slate: "#475569",
  emerald: "#059669",
  teal: "#0d9488",
  fuchsia: "#c026d3",
  cyan: "#0891b2",
  lime: "#65a30d",
  orange: "#ea580c",
  green: "#16a34a",
  stone: "#57534e",
  yellow: "#ca8a04",
  blue: "#2563eb",
};

// Colores rotativos para las tarjetas de metas de ahorro (fondo claro + color fuerte).
export const GOAL_COLOR_HEX: { bg: string; fg: string }[] = [
  { bg: "#d1fae5", fg: "#059669" }, // emerald
  { bg: "#ede9fe", fg: "#7c3aed" }, // violet
  { bg: "#e0f2fe", fg: "#0284c7" }, // sky
  { bg: "#fef3c7", fg: "#d97706" }, // amber
  { bg: "#ffe4e6", fg: "#e11d48" }, // rose
  { bg: "#ccfbf1", fg: "#0d9488" }, // teal
];
