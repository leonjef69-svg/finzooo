import type { ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, X } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";

export const ENTRY_COLORS = {
  background: "#f7f5ee", paper: "#fffdf8", ink: "#28352a", muted: "#73786b",
  line: "#e4e5da", olive: "#506946", soft: "#edf1e4", peach: "#f5e9dc",
  brown: "#8a613c", error: "#a74436", scrim: "rgba(37,50,37,0.4)",
};
export const ENTRY_FONT = { regular: "FinoEntryRegular", medium: "FinoEntryMedium", bold: "FinoEntryBold" };
export const ENTRY_FONTS = {
  FinoEntryRegular: require("../assets/fonts/NunitoSans_400Regular.ttf"),
  FinoEntryMedium: require("../assets/fonts/NunitoSans_600SemiBold.ttf"),
  FinoEntryBold: require("../assets/fonts/NunitoSans_800ExtraBold.ttf"),
};

/** Una sola superficie para las rutas de acceso: no monta otra navegación. */
export function EntryScreen({ children, onBack, disabled = false, center = false, contentStyle }: {
  children: ReactNode; onBack?: () => void; disabled?: boolean; center?: boolean; contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useAppData();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={entryStyles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={ENTRY_COLORS.background} />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" bounces={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 20 }}>
        <View style={entryStyles.header}>
          {onBack ? <TouchableOpacity onPress={onBack} disabled={disabled} accessibilityRole="button" accessibilityLabel={t("common.back")} style={entryStyles.back}><ArrowLeft size={20} color={ENTRY_COLORS.ink} /></TouchableOpacity> : <View style={entryStyles.headerSpacer} />}
          <Text style={entryStyles.wordmark}>Fino</Text><View style={entryStyles.headerSpacer} />
        </View>
        <View style={[entryStyles.content, center && { justifyContent: "center" }, contentStyle]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function EntryHeading({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: ReactNode }) {
  return <View style={{ marginBottom: 20 }}><View style={entryStyles.headingRow}>{icon ? <View style={entryStyles.headingIcon}>{icon}</View> : null}<Text style={[entryStyles.title, { flex: 1 }]}>{title}</Text></View>{subtitle ? <Text style={entryStyles.subtitle}>{subtitle}</Text> : null}</View>;
}

export function EntryButton({ label, onPress, disabled = false, loading = false, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; secondary?: boolean;
}) {
  return <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={disabled || loading}
    accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || loading, busy: loading }}
    style={[entryStyles.button, secondary && entryStyles.secondaryButton, (disabled || loading) && { opacity: 0.65 }]}>
    {loading ? <ActivityIndicator color={secondary ? ENTRY_COLORS.olive : ENTRY_COLORS.paper} /> : <Text style={[entryStyles.buttonText, secondary && { color: ENTRY_COLORS.ink }]}>{label}</Text>}
  </TouchableOpacity>;
}

export function EntryLink({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="button" style={entryStyles.link}><Text style={entryStyles.linkText}>{label}</Text></TouchableOpacity>;
}

/** El navegador presenta este contenido como panel; no añade un segundo Modal. */
export function EntryPanel({ title, onBack, closeLabel, children, large = false }: {
  title: string; onBack: () => void; closeLabel: string; children: ReactNode; large?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return <View style={[entryStyles.panelOverlay, { paddingTop: insets.top + 24 }]}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onBack} activeOpacity={1} style={StyleSheet.absoluteFill} />
    <View style={[entryStyles.panel, { paddingBottom: insets.bottom + 18, maxHeight: height - insets.top - 24 }, large && { height: Math.min(height * 0.82, height - insets.top - 24) }]}>
      <View style={entryStyles.handle} /><View style={entryStyles.panelHeader}><Text style={entryStyles.panelTitle}>{title}</Text><TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel={closeLabel} style={entryStyles.close}><X size={19} color={ENTRY_COLORS.ink} /></TouchableOpacity></View>
      {children}
    </View>
  </View>;
}

export const entryStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ENTRY_COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, minHeight: 52, width: "100%", maxWidth: 460, alignSelf: "center" },
  headerSpacer: { width: 42 }, back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: ENTRY_COLORS.line, backgroundColor: ENTRY_COLORS.paper, alignItems: "center", justifyContent: "center" },
  wordmark: { fontFamily: ENTRY_FONT.bold, fontSize: 24, color: ENTRY_COLORS.olive },
  content: { flexGrow: 1, flexShrink: 0, width: "100%", maxWidth: 460, alignSelf: "center", paddingHorizontal: 23, paddingTop: 16 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  headingIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: ENTRY_COLORS.peach },
  title: { fontFamily: ENTRY_FONT.bold, fontSize: 28, lineHeight: 33, color: ENTRY_COLORS.ink },
  subtitle: { fontFamily: ENTRY_FONT.regular, fontSize: 14, lineHeight: 21, marginTop: 8, color: ENTRY_COLORS.muted },
  text: { fontFamily: ENTRY_FONT.regular, fontSize: 14, lineHeight: 21, color: ENTRY_COLORS.ink },
  muted: { fontFamily: ENTRY_FONT.regular, fontSize: 12, lineHeight: 18, color: ENTRY_COLORS.muted },
  error: { fontFamily: ENTRY_FONT.medium, color: ENTRY_COLORS.error, fontSize: 12, lineHeight: 18, marginVertical: 8 },
  button: { width: "100%", minHeight: 51, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: ENTRY_COLORS.olive, marginBottom: 9 },
  buttonText: { fontFamily: ENTRY_FONT.bold, color: ENTRY_COLORS.paper, fontSize: 15 },
  secondaryButton: { backgroundColor: ENTRY_COLORS.paper, borderWidth: 1, borderColor: ENTRY_COLORS.line },
  link: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  linkText: { fontFamily: ENTRY_FONT.bold, fontSize: 13, color: ENTRY_COLORS.olive },
  card: { padding: 13, borderWidth: 1, borderColor: ENTRY_COLORS.line, borderRadius: 16, backgroundColor: ENTRY_COLORS.paper },
  panelOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: ENTRY_COLORS.scrim },
  panel: { width: "100%", paddingHorizontal: 21, paddingTop: 10, borderTopLeftRadius: 25, borderTopRightRadius: 25, backgroundColor: ENTRY_COLORS.paper },
  handle: { width: 34, height: 4, borderRadius: 4, alignSelf: "center", backgroundColor: ENTRY_COLORS.line, marginBottom: 10 },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  panelTitle: { fontFamily: ENTRY_FONT.bold, fontSize: 21, color: ENTRY_COLORS.ink, flex: 1 },
  close: { width: 42, height: 42, borderRadius: 12, backgroundColor: ENTRY_COLORS.background, alignItems: "center", justifyContent: "center" },
});
