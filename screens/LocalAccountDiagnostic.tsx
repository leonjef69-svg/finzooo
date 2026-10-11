import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth } from "@/utils/firebase";
import { GoogleSignInCancelled, signInWithGoogle } from "@/utils/googleAuth";
import { readLocalAccountDiagnostic, type LocalAccountDiagnostic, type LocalAccountDiagnosticReason } from "@/utils/localAccountDiagnostic";
import { isLocalAccountDiagnosticMode } from "@/utils/localAccountDiagnosticMode";

// Herramienta de desarrollo en español para esta comprobación acompañada.
// No usa AppDataContext, bóveda, restauración, archivos financieros ni nube.
const labels = {
  marker: "diagnóstico11oct1", title: "Comprobar acceso sin abrir tus datos",
  explanation: "Solo compara la cuenta elegida con la identificación guardada. No abre movimientos, no cambia su dueño ni borra copias. Google sí inicia su sesión normal.",
  google: "Elegir mi cuenta Google", read: "Leer identificación local", busy: "Comprobando…",
  ready: "Puedes elegir tu misma cuenta Google.", waiting: "Esperando la sesión del teléfono…",
  authFailed: "No se pudo completar Google. No se abrió ni borró tu información.",
  readFailed: "No se pudo consultar la sesión. Conserva la app y sus datos.",
  safety: "Envía una captura de este resultado. No borres datos ni reinstales la app.",
};
const reasons: Record<LocalAccountDiagnosticReason, string> = {
  disabled: "Diagnóstico no disponible fuera de desarrollo local Android.",
  "no-session": "Todavía no se ha elegido una cuenta.",
  "session-changed": "La sesión cambió durante la lectura. Repite la comprobación.",
  "read-failed": "No se pudieron leer los metadatos locales.",
  "owner-unreadable": "No se pudo descifrar o validar el identificador guardado.",
  "profile-unreadable": "No se pudo descifrar o validar el perfil guardado.",
  "owner-same-active": "El identificador guardado coincide con esta cuenta y está activo.",
  "owner-same-archived": "El identificador guardado coincide con esta cuenta y está archivado.",
  "owner-different": "El identificador guardado y el de Google no coinciden.",
  "legacy-matching-email": "No hay identificador antiguo; el correo guardado sí coincide con Google.",
  "legacy-different-email": "No hay identificador antiguo; los correos local y Google no coinciden.",
  "legacy-missing-email": "No hay identificador antiguo ni un correo suficiente para comparar.",
  "no-owner-incomplete-profile": "No hay identificador y el perfil no consta como configurado.",
  "no-owner-no-profile": "No hay identificador ni perfil. No se han revisado tus otras copias.",
};

export default function LocalAccountDiagnosticScreen() {
  const [status, setStatus] = useState(labels.waiting);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LocalAccountDiagnostic | null>(null);
  const pending = useRef(false), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!isLocalAccountDiagnosticMode()) { setStatus(reasons.disabled); return; }
    void auth.authStateReady().then(() => { if (alive.current) setStatus(labels.ready); })
      .catch(() => { if (alive.current) setStatus(labels.readFailed); });
    return () => { alive.current = false; };
  }, []);
  async function check(chooseGoogle: boolean) {
    if (!isLocalAccountDiagnosticMode() || pending.current) return;
    pending.current = true; setBusy(true); setResult(null); setStatus(labels.busy);
    try {
      await auth.authStateReady();
      if (!alive.current) return;
      if (chooseGoogle) {
        const selected = await signInWithGoogle();
        if (!alive.current) return;
        if (auth.currentUser !== selected) { setStatus(reasons["session-changed"]); return; }
      }
      if (!alive.current) return;
      const checked = await readLocalAccountDiagnostic();
      if (alive.current) { setResult(checked); setStatus(reasons[checked.reason]); }
    } catch (error) {
      if (alive.current) setStatus(error instanceof GoogleSignInCancelled ? labels.ready : labels.authFailed);
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.marker}>{labels.marker}</Text>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.body}>{labels.explanation}</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={labels.google} disabled={busy} onPress={() => void check(true)} style={styles.button}>
          <Text style={styles.buttonText}>{labels.google}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={labels.read} disabled={busy} onPress={() => void check(false)} style={styles.button}>
          <Text style={styles.buttonText}>{labels.read}</Text>
        </TouchableOpacity>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{status}</Text>
        {result && <Text selectable style={styles.result}>{JSON.stringify(result, null, 2)}</Text>}
        <Text style={styles.body}>{labels.safety}</Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" }, content: { padding: 24, paddingTop: 54, paddingBottom: 40 },
  marker: { color: "#047857", fontWeight: "700", marginBottom: 12 },
  title: { color: "#0f172a", fontSize: 21, fontWeight: "700", marginBottom: 14 },
  body: { color: "#334155", fontSize: 15, lineHeight: 23, marginBottom: 18 },
  button: { backgroundColor: "#047857", padding: 16, borderRadius: 12, marginBottom: 14 },
  buttonText: { color: "#fff", textAlign: "center", fontSize: 15, fontWeight: "700" },
  result: { color: "#0f172a", fontSize: 13, lineHeight: 19, marginBottom: 20 },
});
