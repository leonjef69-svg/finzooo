import { Tabs } from "expo-router";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { View } from "react-native";
import FAB from "@/components/FAB";
import { irUnaVez } from "@/utils/nav";
import { NOCHE } from "@/constants/style";
import {
  Home as HomeIcon,
  History as HistoryIcon,
  PieChart as PieChartIcon,
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
        <View style={{ position: "relative" }}>
          <BottomTabBar {...props} />
          <View style={{ position: "absolute", left: "50%", marginLeft: -28, top: 1, zIndex: 50 }}>
            <FAB onPress={() => irUnaVez("/transaction/choose")} />
          </View>
        </View>
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
        tabBarStyle: {
          backgroundColor: isDark ? NOCHE.fondo : "#ffffff",
          borderTopColor: isDark ? NOCHE.borde : "#cbd5e1",
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          zIndex: 0,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
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
