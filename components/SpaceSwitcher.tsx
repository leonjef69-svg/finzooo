import { Boxes, UserRound, UsersRound } from "lucide-react-native";
import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useAppData } from "@/contexts/AppDataContext";

export type FinoSpace = "personal" | "family" | "boxes";

const OPTIONS = [
  { id: "personal", label: "spaces.personal", Icon: UserRound },
  { id: "family", label: "spaces.family", Icon: UsersRound },
  { id: "boxes", label: "spaces.boxes", Icon: Boxes },
] as const;

/**
 * Selector central de espacios.
 *
 * Personal conserva la app financiera actual. Cajas abre el dinero separado de
 * los negocios que ya existe. Familia tiene una pantalla propia, pero todavía
 * no permite guardar ni compartir: primero deben existir permisos reales en la
 * nube para que nunca se enseñen datos privados a una persona equivocada.
 */
export default function SpaceSwitcher({ active }: { active: FinoSpace }) {
  const { t } = useAppData();

  function open(id: FinoSpace) {
    if (id === active) return;
    if (id === "personal") router.replace("/(tabs)");
    else if (id === "family") router.replace("/family");
    else router.replace("/negocio");
  }

  return (
    <View
      accessibilityRole="tablist"
      className="mx-5 mb-2 flex-row rounded-2xl border-[1.5px] border-slate-200 bg-slate-100 p-1 dark:border-noche-borde dark:bg-noche-2"
    >
      {OPTIONS.map(({ id, label, Icon }) => {
        const selected = id === active;
        return (
          <TouchableOpacity
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t(label)}
            onPress={() => open(id)}
            className={`min-h-9 flex-1 flex-row items-center justify-center gap-1 rounded-xl px-1 ${
              selected ? "bg-emerald-600" : "bg-transparent"
            }`}
          >
            <Icon size={14} color={selected ? "#ffffff" : "#64748b"} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              className={`text-xs font-extrabold ${selected ? "text-white" : "text-slate-600 dark:text-slate-200"}`}
            >
              {t(label)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
