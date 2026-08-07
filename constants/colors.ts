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

/**
 * Los tonos "100" y "500", para pintar SIN clases.
 *
 * POR QUÉ HACEN FALTA
 *
 * La cuadrícula de dibujos son 236 casillas, y cada una llevaba su aspecto en
 * clases (`bg-${color}-100 border-${color}-500`). Cada componente con clases se
 * apunta al sistema de estilos para enterarse de los cambios de tema: 236 apuntes
 * solo para abrir una pantalla, y otros tantos comparados en cada toque. El usuario
 * lo midió con el celular en la mano el 07/08/2026: 2 a 3 segundos en entrar y 1 a
 * 2 en marcar un dibujo.
 *
 * Con los colores en número, esa cuadrícula no usa clases: el aspecto se calcula
 * UNA vez para toda la pantalla y las 236 casillas comparten el mismo objeto.
 *
 * Son los mismos valores de Tailwind que estaban saliendo por las clases, así que
 * no cambia nada de lo que se ve. Hay una prueba que comprueba que ningún color de
 * la app se quede sin su tono aquí.
 */
export const COLOR_HEX_100: Record<string, string> = {
  rose: "#ffe4e6",
  red: "#fee2e2",
  orange: "#ffedd5",
  amber: "#fef3c7",
  yellow: "#fef9c3",
  lime: "#ecfccb",
  green: "#dcfce7",
  emerald: "#d1fae5",
  teal: "#ccfbf1",
  cyan: "#cffafe",
  sky: "#e0f2fe",
  blue: "#dbeafe",
  indigo: "#e0e7ff",
  violet: "#ede9fe",
  fuchsia: "#fae8ff",
  pink: "#fce7f3",
  stone: "#f5f5f4",
  slate: "#f1f5f9",
};

export const COLOR_HEX_500: Record<string, string> = {
  rose: "#f43f5e",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  fuchsia: "#d946ef",
  pink: "#ec4899",
  stone: "#78716c",
  slate: "#64748b",
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
