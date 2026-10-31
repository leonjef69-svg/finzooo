import { View } from "react-native";

/** Separador compartido para las listas de movimientos de toda la app. */
export default function MovementDivider() {
  return <View accessible={false} className="h-px bg-slate-300 dark:bg-[#625e56]" />;
}
