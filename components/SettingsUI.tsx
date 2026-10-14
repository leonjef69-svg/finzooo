import { Children, type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import type { IconComponent } from "@/constants/categories";
import { nativewindThemeVariables, type VisualStyle } from "@/constants/visualTheme";
import { NOCHE } from "@/constants/style";
import { ENTRY_FONT } from "@/components/EntryUI";
import { useAppData } from "@/contexts/AppDataContext";

/** Solo Ajustes; los colores salen de la misma apariencia que el resto de Fino. */
export function settingsColors(style: VisualStyle, dark: boolean) {
  const variables = nativewindThemeVariables(style, dark);
  const shade = (name: string) => `rgb(${variables[`--fino-${name}`].split(" ").join(", ")})`;
  const warm = style === "peachOlive";
  return {
    text: dark ? NOCHE.texto : shade("slate-900"), muted: dark ? NOCHE.textoSuave : shade("slate-500"),
    border: dark ? NOCHE.borde : shade("slate-200"), surface: dark ? NOCHE.tarjeta : shade("white"),
    soft: dark ? NOCHE.encima : shade("slate-50"),
    accent: shade(dark ? "emerald-400" : "emerald-700"),
    iconBackground: dark ? "#28352a" : shade("emerald-100"),
    iconDetail: dark ? "#d3b785" : warm ? "#d9ae83" : "#f2c96e",
    danger: dark ? "#fda4af" : shade("rose-600"), dangerBackground: dark ? "#3c252a" : shade("rose-50"),
    proGradient: (dark ? ["#403727", "#302b23"] : warm ? ["#f4d9c4", "#edd0af"] : ["#fcd576", "#f9bd48"]) as [string, string],
    proText: dark ? "#f8e7c9" : warm ? "#43573a" : "#553b12",
    proBorder: dark ? "#645337" : warm ? "#ddbea0" : "#e8b653",
    proIconBackground: dark ? "#5a4930" : "rgba(255,255,255,0.48)",
    proFill: dark ? "#c89e58" : "#e7b65c",
  };
}

function useSettingsColors() {
  const { visualStyle } = useAppData();
  const { colorScheme } = useColorScheme();
  return settingsColors(visualStyle, colorScheme === "dark");
}

export function SettingsIcon({ Icon, danger = false }: { Icon: IconComponent; danger?: boolean }) {
  const colors = useSettingsColors();
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: 42, height: 42, borderRadius: 14, flexShrink: 0, alignItems: "center", justifyContent: "center", backgroundColor: danger ? colors.dangerBackground : colors.iconBackground }}>
    <View style={{ position: "absolute", top: 4, right: 4, width: 9, height: 9, borderRadius: 5, backgroundColor: danger ? colors.danger : colors.iconDetail, opacity: 0.55 }} />
    <Icon size={26} strokeWidth={2.1} color={danger ? colors.danger : colors.accent} />
  </View>;
}

export function SettingsRow({ Icon, label, hint, right, onPress, danger = false, premium = false }: {
  Icon: IconComponent; label: string; hint?: string; right?: ReactNode;
  onPress?: () => void; danger?: boolean; premium?: boolean;
}) {
  const colors = useSettingsColors();
  return <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.65}
    accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={label}
    accessibilityHint={hint} style={{ flexDirection: "row", alignItems: "center", minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, gap: 12 }}>
    <SettingsIcon Icon={Icon} danger={danger} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 16, lineHeight: 22, color: danger ? colors.danger : colors.text }}>{label}</Text>
      {hint ? <Text style={{ fontFamily: ENTRY_FONT.regular, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 }}>{hint}</Text> : null}
    </View>
    {premium ? <View style={{ borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: colors.soft }}><Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 10, color: colors.accent }}>PRO</Text></View> : null}
    {right}
    {onPress && !right ? <ChevronRight size={19} color={danger ? colors.danger : colors.muted} /> : null}
  </TouchableOpacity>;
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const colors = useSettingsColors();
  const rows = Children.toArray(children);
  return <View style={{ marginHorizontal: 16, marginTop: 22 }}>
    <Text accessibilityRole="header" style={{ fontFamily: ENTRY_FONT.bold, fontSize: 16, lineHeight: 22, color: colors.text, marginLeft: 4, marginBottom: 9 }}>{title}</Text>
    <View style={{ borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      {rows.map((row, index) => <View key={index}>
        {row}
        {index < rows.length - 1 ? <View style={{ height: 1, marginLeft: 68, marginRight: 14, backgroundColor: colors.border }} /> : null}
      </View>)}
    </View>
  </View>;
}
