import type { ReactNode } from "react";
import { Pressable, type AccessibilityRole, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

// Un envoltorio reutilizable que le da a cualquier tarjeta o botón el
// mismo "efecto de presión" (se encoge un poco al tocarlo, con resorte)
// en vez de repetir esta animación en cada pantalla.
export default function PressableScale({
  onPress,
  disabled,
  children,
  style,
  containerStyle,
  className,
  accessibilityRole,
  accessibilityLabel,
}: {
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  className?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        }}
        style={style}
        className={className}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
