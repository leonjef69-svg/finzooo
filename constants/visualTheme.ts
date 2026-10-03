export type VisualStyle = "classic" | "peachOlive";

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const CLASSIC = {
  slate: ["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#020617"],
  emerald: ["#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#047857", "#065f46", "#064e3b", "#022c22"],
  rose: ["#fff1f2", "#ffe4e6", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c", "#9f1239", "#881337", "#4c0519"],
} as const;

const PEACH_OLIVE = {
  slate: ["#faf8f2", "#f3efe5", "#e7e0d1", "#d7ccb7", "#aa9d86", "#756a56", "#594f3f", "#453f33", "#36372d", "#292d25", "#191f19"],
  emerald: ["#f6f7ed", "#e7eddc", "#dbe4cb", "#c6d1ae", "#9fae7d", "#829461", "#65764a", "#526b43", "#43573a", "#34442e", "#29382a"],
  rose: ["#fdf1ed", "#fbe5dc", "#f4cdbf", "#e8a18c", "#de8069", "#cd674f", "#b8583e", "#9c4935", "#7c3f31", "#65372e", "#45241f"],
} as const;

function rgbTriplet(hex: string): string {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)).join(" ");
}

/** CSS variables consumed by NativeWind color utilities throughout the app. */
export function nativewindThemeVariables(style: VisualStyle, isDark: boolean): Record<string, string> {
  const palette = style === "peachOlive" && !isDark ? PEACH_OLIVE : CLASSIC;
  const variables: Record<string, string> = {
    "--fino-white": rgbTriplet(style === "peachOlive" && !isDark ? "#fffdf8" : "#ffffff"),
  };

  for (const color of ["slate", "emerald", "rose"] as const) {
    const shades = palette[color];
    SHADES.forEach((shade, index) => {
      variables[`--fino-${color}-${shade}`] = rgbTriplet(shades[index]);
    });
  }

  return variables;
}

export function accentForVisualStyle(style: VisualStyle): string {
  return style === "peachOlive" ? "#65764a" : "#059669";
}

export function balanceGradientForVisualStyle(style: VisualStyle): readonly [string, string] {
  return style === "peachOlive" ? ["#f4d9c4", "#efd1b7"] : ["#059669", "#0f766e"];
}
