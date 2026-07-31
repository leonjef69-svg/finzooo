import { TouchableOpacity } from "react-native";
import { Sun, Moon, SunMoon } from "lucide-react-native";
import { useAppData, type ThemeMode } from "@/contexts/AppDataContext";

/**
 * El botón de apariencia. Va en la esquina de Inicio, Historial, Reportes y
 * Ajustes.
 *
 * Recorre los TRES modos: claro → oscuro → automático → claro.
 *
 * Antes solo saltaba entre claro y oscuro, y el tercero —seguir al celular—
 * vivía en su propia pantalla dentro de Ajustes. Esa pantalla sobraba
 * teniendo el botón aquí arriba, pero quitarla sin más habría dejado el
 * automático fuera de alcance: es el modo de fábrica, así que al primer toque
 * se perdía para siempre y no había forma de volver a él.
 *
 * Cada modo tiene su icono, y el icono dice EN QUÉ MODO ESTÁ, no a cuál se
 * irá al tocarlo. Lo segundo es lo que confunde: un sol cuando la app ya está
 * clara deja sin saber si el botón informa o propone.
 *
 * Y se lee themeMode, no el color que se está pintando. Son distintos: en
 * automático el color puede ser oscuro, pero el modo sigue siendo
 * automático, y antes eso hacía que el botón se saltara un paso.
 */
const SIGUIENTE: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
};

export default function ThemeToggleButton() {
  const { themeMode, updateThemeMode } = useAppData();

  const Icon = themeMode === "dark" ? Moon : themeMode === "light" ? Sun : SunMoon;
  const color = themeMode === "dark" ? "#94a3b8" : themeMode === "light" ? "#f59e0b" : "#64748b";

  return (
    <TouchableOpacity
      onPress={() => updateThemeMode(SIGUIENTE[themeMode])}
      className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
    >
      <Icon size={18} color={color} />
    </TouchableOpacity>
  );
}
