import { TouchableOpacity } from "react-native";
import { Sun, Moon } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useAppData } from "@/contexts/AppDataContext";

/**
 * El botón de apariencia. Va en la esquina de Inicio, Historial, Reportes y
 * Ajustes.
 *
 * SOLO DOS MODOS: CLARO Y OSCURO
 *
 * Hubo un tercero, "automático", que seguía al celular. Se quitó a petición.
 *
 * Y el modo "automático" tampoco se puede borrar del todo del código: es el
 * que trae la app de fábrica y el que puede haber guardado quien la venía
 * usando. Lo que se hace es sacar de él a la primera: si está en automático,
 * el toque mira de qué color se está pintando la app AHORA y elige el
 * contrario. Así el botón hace lo que se espera —cambiar— en vez de parecer
 * que no responde.
 *
 * El icono dice a qué se va a cambiar, no en qué modo está. Con solo dos
 * modos es lo natural: se ve una luna y se entiende "ponlo oscuro".
 */
export default function ThemeToggleButton() {
  const { updateThemeMode } = useAppData();
  const { colorScheme } = useColorScheme();

  // Qué se está viendo ahora mismo. En automático no basta con mirar
  // themeMode, porque ese dice "automático" y no si salió claro u oscuro.
  const enOscuro = colorScheme === "dark";

  return (
    <TouchableOpacity
      onPress={() => updateThemeMode(enOscuro ? "light" : "dark")}
      className="w-10 h-10 rounded-full bg-slate-100 dark:bg-noche-2 items-center justify-center"
    >
      {enOscuro ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color="#475569" />}
    </TouchableOpacity>
  );
}
