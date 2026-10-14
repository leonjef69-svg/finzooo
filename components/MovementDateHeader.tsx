import { Text } from "react-native";
import { movementDayLabel } from "@/utils/movementDates";

/** Fuera de la tarjeta: una fecha legible para todos los movimientos de ese día. */
export default function MovementDateHeader({ date, monthNames, inset = false }: {
  date: string; monthNames: readonly string[]; inset?: boolean;
}) {
  return <Text accessibilityRole="header"
    className="mb-2 mt-3 text-[13px] font-bold text-slate-600 dark:text-slate-300"
    style={inset ? { marginHorizontal: 20 } : undefined}>
    {movementDayLabel(date, monthNames)}
  </Text>;
}
