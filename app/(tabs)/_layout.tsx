import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useEffect, useState, type ReactNode } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { irUnaVez } from "@/utils/nav";
import { NOCHE } from "@/constants/style";
import { accentForVisualStyle } from "@/constants/visualTheme";
import {
  Home as HomeIcon,
  History as HistoryIcon,
  PieChart as PieChartIcon,
  Plus,
  Settings as SettingsIcon,
  X,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "@/contexts/AppDataContext";
import { loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";

export default function TabsLayout() {
  const { t, visualStyle } = useAppData();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const accentColor = accentForVisualStyle(visualStyle);
  const surfaceColor = isDark ? NOCHE.fondo : visualStyle === "peachOlive" ? "#fff8ef" : "#ffffff";
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      tabBar={(props) => (
        <FinoTabBar
          {...props}
          isDark={isDark}
          accentColor={accentColor}
          surfaceColor={surfaceColor}
          bottomInset={insets.bottom}
          onAdd={() => irUnaVez("/transaction/choose")}
        />
      )}
      screenOptions={{
        headerShown: false,
        // El fondo de la pestaña, por debajo de lo que pinta cada pantalla. Sin esto es el
        // blanco de fábrica de React Navigation, y se veía como un destello al volver aquí
        // desde "Nuevo movimiento" — el instante entre que la hoja se cierra e Inicio pinta.
        // Ver la explicación entera en app/_layout.
        // Ver NOCHE en constants/style: el color NO se escribe aqui a mano.
        sceneStyle: { backgroundColor: surfaceColor },
        tabBarActiveTintColor: accentColor,
        tabBarInactiveTintColor: isDark ? NOCHE.textoSuave : "#475569",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.home"),
          tabBarIcon: ({ color, focused }) => (
            <HomeIcon size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("tab.history"),
          tabBarIcon: ({ color, focused }) => (
            <HistoryIcon size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("tab.reports"),
          tabBarIcon: ({ color, focused }) => (
            <PieChartIcon size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tab.settings"),
          tabBarIcon: ({ color, focused }) => (
            <SettingsIcon size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
          ),
        }}
      />
    </Tabs>
  );
}

function FinoTabBar({
  state,
  descriptors,
  navigation,
  isDark,
  accentColor,
  surfaceColor,
  bottomInset,
  onAdd,
}: BottomTabBarProps & {
  isDark: boolean;
  accentColor: string;
  surfaceColor: string;
  bottomInset: number;
  onAdd: () => void;
}) {
  const { t, ready } = useAppData();
  const routes = state.routes;
  const { width, fontScale } = useWindowDimensions();
  const barHeight = fontScale > 1.3 ? 78 : 68;
  const centerWidth = width < 350 ? 62 : 70;
  const centerMargin = width < 350 ? 2 : 5;
  const [plusHint, setPlusHint] = useState(false);
  const [hintReady, setHintReady] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void loadJSON<boolean>(STORAGE_KEYS.plusHint, false).then(seen => {
      if (active) { setPlusHint(!seen); setHintReady(true); }
    });
    return () => { active = false; };
  }, [ready]);
  const hidePlusHint = () => {
    setPlusHint(false);
    void saveJSON(STORAGE_KEYS.plusHint, true);
  };
  const renderTab = (route: (typeof routes)[number], index: number) => {
    const focused = state.index === index;
    const options = descriptors[route.key].options;
    const color = focused
      ? accentColor
      : isDark
        ? NOCHE.textoSuave
        : "#475569";
    const label =
      typeof options.tabBarLabel === "string"
        ? options.tabBarLabel
        : typeof options.title === "string"
          ? options.title
          : route.name;

    return (
      <AnimatedNavPress
        key={route.key}
        containerStyle={{ flex: 1 }}
        style={{
          height: barHeight - 4,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 5,
        }}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        onPress={() => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }}
        onLongPress={() =>
          navigation.emit({ type: "tabLongPress", target: route.key })
        }
      >
        {options.tabBarIcon?.({ focused, color, size: 22 })}
        <Text
          numberOfLines={1}
          style={{
            color,
            fontSize: 10.5,
            fontWeight: focused ? "800" : "700",
            marginTop: 4,
          }}
        >
          {label}
        </Text>
      </AnimatedNavPress>
    );
  };

  return (
    <View
      style={{
        position: "relative",
          height: barHeight + bottomInset,
        paddingBottom: bottomInset,
        backgroundColor: surfaceColor,
        borderTopColor: isDark ? NOCHE.borde : surfaceColor === "#fff8ef" ? "#eee3d5" : "#cbd5e1",
        borderTopWidth: 1,
      }}
    >
      <View
        style={{
          height: barHeight,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 5,
        }}
      >
        {routes.slice(0, 2).map((route, index) => renderTab(route, index))}
        <AnimatedNavPress
          accessibilityRole="button"
          accessibilityLabel={t("common.addMovement")}
          onPress={() => { hidePlusHint(); onAdd(); }}
          containerStyle={{ width: centerWidth, marginHorizontal: centerMargin, marginTop: -7 }}
          style={{
            width: "100%",
            height: 54,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: accentColor,
            borderWidth: 2,
            borderColor: isDark ? NOCHE.fondo : "#ffffff",
            shadowColor: isDark ? accentColor : surfaceColor === "#fff8ef" ? "#526b43" : "#047857",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 7,
            elevation: 9,
          }}
        >
          <Plus size={31} color="#ffffff" strokeWidth={3} />
        </AnimatedNavPress>
        {routes
          .slice(2)
          .map((route, offset) => renderTab(route, offset + 2))}
      </View>
      {hintReady && plusHint ? <View style={{ position: "absolute", left: 0, right: 0, bottom: barHeight + bottomInset + 4, alignItems: "center", zIndex: 10 }}>
        <View className="flex-row items-center gap-2 rounded-full bg-slate-900 px-3 py-2 shadow-lg dark:bg-white">
          <Text className="text-xs font-bold text-white dark:text-slate-900">{t("tab.addMovementHint")}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("tab.dismissAddHint")} onPress={hidePlusHint} hitSlop={8}>
            <X size={15} color={isDark ? "#0f172a" : "#ffffff"} />
          </TouchableOpacity>
        </View>
      </View> : null}
    </View>
  );
}

function AnimatedNavPress({
  children,
  onPress,
  onLongPress,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  containerStyle,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityRole?: "button";
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  containerStyle?: object;
  style?: object;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[containerStyle, animatedStyle]}>
    <TouchableOpacity
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => { scale.value = withSpring(0.92, { damping: 14, stiffness: 320 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 13, stiffness: 260 }); }}
      style={style}
    >{children}</TouchableOpacity>
  </Animated.View>;
}
