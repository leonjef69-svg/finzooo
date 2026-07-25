import { View } from "react-native";
import { COLOR_HEX_600 } from "@/constants/colors";
import type { IconComponent } from "@/constants/categories";

export default function IconBadge({
  Icon,
  color,
  size = 44,
}: {
  Icon: IconComponent;
  color: string;
  size?: number;
}) {
  return (
    <View
      className={`bg-${color}-100 rounded-2xl items-center justify-center shrink-0`}
      style={{ width: size, height: size }}
    >
      <Icon size={size * 0.45} color={COLOR_HEX_600[color] || "#475569"} strokeWidth={2.2} />
    </View>
  );
}
