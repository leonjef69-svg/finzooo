import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Text, TouchableOpacity, View } from "react-native";
import { irUnaVez } from "@/utils/nav";
import { NOCHE } from "@/constants/style";
import {
  Home as HomeIcon,
  History as HistoryIcon,
  PieChart as PieChartIcon,
  Plus,
  Settings as SettingsIcon,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "@/contexts/AppDataContext";

export default function TabsLayout() {
  const { t } = useAppData();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      tabBar={(props) => (
        <FinoTabBar
          {...props}
          isDark={isDark}
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
        sceneStyle: { backgroundColor: isDark ? NOCHE.fondo : "#ffffff" },
        tabBarActiveTintColor: "#059669",
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
  bottomInset,
  onAdd,
}: BottomTabBarProps & {
  isDark: boolean;
  bottomInset: number;
  onAdd: () => void;
}) {
  const routes = state.routes;
  const renderTab = (route: (typeof routes)[number], index: number) => {
    const focused = state.index === index;
    const options = descriptors[route.key].options;
    const color = focused
      ? "#059669"
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
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        activeOpacity={0.7}
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
        style={{
          flex: 1,
          height: 64,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 5,
        }}
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
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        height: 68 + bottomInset,
        paddingBottom: bottomInset,
        backgroundColor: isDark ? NOCHE.fondo : "#ffffff",
        borderTopColor: isDark ? NOCHE.borde : "#cbd5e1",
        borderTopWidth: 1,
      }}
    >
      <View
        style={{
          height: 68,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 5,
        }}
      >
        {routes.slice(0, 2).map((route, index) => renderTab(route, index))}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Registrar gasto"
          activeOpacity={0.86}
          onPress={onAdd}
          style={{
            width: 62,
            height: 46,
            marginHorizontal: 7,
            marginTop: -7,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#059669",
            borderWidth: 2,
            borderColor: isDark ? NOCHE.fondo : "#ffffff",
            shadowColor: "#047857",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 7,
            elevation: 9,
          }}
        >
          <Plus size={27} color="#ffffff" strokeWidth={3} />
        </TouchableOpacity>
        {routes
          .slice(2)
          .map((route, offset) => renderTab(route, offset + 2))}
      </View>
    </View>
  );
}
