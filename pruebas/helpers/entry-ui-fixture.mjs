// Adaptación de nodos visuales para suites que ejecutan manejadores/JSX.
// No sustituye guardias ni acciones; las medidas nativas se prueban en Android.
const motion = duration => ({ duration, reduceMotion: setting => ({ duration, reduceMotion: setting }) });
export const entryUIFixture = {
  Animated: { View: "AnimatedView" }, LinearTransition: { duration: motion }, FadeIn: { duration: motion }, FadeOut: { duration: motion }, ReduceMotion: { System: "system" }, useMemo: factory => factory(),
  ENTRY_COLORS: { background: "#f7f5ee", paper: "#fffdf8", ink: "#28352a", muted: "#73786b", line: "#e4e5da", olive: "#506946", soft: "#edf1e4", peach: "#f5e9dc", brown: "#8a613c" },
  ENTRY_FONT: { regular: "FinoEntryRegular", medium: "FinoEntryMedium", bold: "FinoEntryBold" },
  EntryScreen: "EntryScreen", EntryHeading: "EntryHeading", EntryButton: "EntryButton", EntryLink: "EntryLink", EntryPanel: "EntryPanel",
  entryStyles: Object.fromEntries(["text", "muted", "error", "card", "title", "subtitle"].map(key => [key, {}])),
};
entryUIFixture.useEntryTheme = () => ({ dark: false, colors: entryUIFixture.ENTRY_COLORS, styles: entryUIFixture.entryStyles });
