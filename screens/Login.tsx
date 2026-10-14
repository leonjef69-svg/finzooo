import { useRef, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { KeyRound, Smile } from "lucide-react-native";
import { reemplazarUnaVez } from "@/utils/nav";
import { ENTRY_COLORS, EntryButton, EntryHeading, EntryLink, EntryScreen, entryStyles } from "@/components/EntryUI";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import AuthField from "@/components/AuthField";
import AuthLegalAcceptance from "@/components/AuthLegalAcceptance";
import GoogleButton from "@/components/GoogleButton";
import { auth } from "@/utils/firebase";
import { hasAcceptedLegalDocuments, recordLegalAcceptanceForCurrentAccount } from "@/utils/legalAcceptance";
import { withTimeout } from "@/utils/withTimeout";
import { firebaseErrorMessage } from "@/utils/firebaseErrors";
import { GoogleSignInCancelled, signInWithGoogle } from "@/utils/googleAuth";
import { googleSignInErrorMessage } from "@/utils/googleSignInError";
import { useAppData } from "@/contexts/AppDataContext";
import { useEntryOperation, type EntryOperationGuard } from "@/utils/entryOperation";

export default function Login({
  onLoggedIn,
  onGoRegister,
}: {
  onLoggedIn: (current?: EntryOperationGuard) => void | Promise<void>;
  onGoRegister: () => void;
}) {
  const { t } = useAppData();
  const [recovering, setRecovering] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [googleLegalPending, setGoogleLegalPending] = useState(false);
  const authBusy = useRef(false);
  const pendingGoogleUser = useRef<typeof auth.currentUser>(null);
  const beginEntryOperation = useEntryOperation(() => {
    authBusy.current = false;
    setLoading(false);
    setGoogleLoading(false);
    setResetLoading(false);
  });

  async function submit() {
    if (authBusy.current) return;
    pendingGoogleUser.current = null;
    setGoogleLegalPending(false);
    setLegalAccepted(false);
    setGoogleError("");
    if (!email || pass.length < 6) {
      setError(t("login.invalidCredentials"));
      return;
    }
    setError("");
    const operationCurrent = beginEntryOperation();
    if (!operationCurrent()) return;
    authBusy.current = true;
    setLoading(true);
    let authenticated = false;
    let authenticatedUser: typeof auth.currentUser = null;
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
      authenticatedUser = result.user;
      if (!operationCurrent() || auth.currentUser !== result.user) return;
      authenticated = true;
      await onLoggedIn(() => operationCurrent() && auth.currentUser === result.user);
    } catch (err) {
      if (!operationCurrent() || (authenticatedUser && auth.currentUser !== authenticatedUser)) return;
      const code = (err as { code?: string })?.code || "";
      setError(err instanceof Error && err.name === "LocalAccountAccessError" ? err.message : authenticated && code !== "cloud/history-format-unsupported" ? t("login.accountOpenFailed") : firebaseErrorMessage(code));
    } finally {
      if (operationCurrent()) {
        authBusy.current = false;
        setLoading(false);
      }
    }
  }

  async function loginWithGoogle() {
    if (authBusy.current) return;
    const operationCurrent = beginEntryOperation();
    if (!operationCurrent()) return;
    authBusy.current = true;
    setError("");
    setGoogleError("");
    setGoogleLoading(true);
    let authenticated = false;
    let authenticatedUser: typeof auth.currentUser = null;
    let checkingLegalAcceptance = false;
    try {
      // Si la cuenta ya inició sesión en el primer paso, conservarla mientras
      // la persona acepta explícitamente; no abrir Google otra vez.
      let user = pendingGoogleUser.current;
      if (!user || auth.currentUser !== user) {
        pendingGoogleUser.current = null;
        setGoogleLegalPending(false);
        user = await signInWithGoogle();
      }
      authenticatedUser = user;
      if (!operationCurrent()) return;
      if (!user) throw new Error(t("settings.noActiveSession"));
      if (auth.currentUser !== user) return;
      const current = () => operationCurrent() && auth.currentUser === user;
      authenticated = true;
      const isPendingAcceptance = pendingGoogleUser.current === user;
      let accepted = false;
      if (!isPendingAcceptance) {
        checkingLegalAcceptance = true;
        try { accepted = await withTimeout(hasAcceptedLegalDocuments(user.uid)); }
        catch (error) {
          // Un recibo legal dañado puede sustituirse con una elección nueva;
          // cualquier otro fallo de lectura debe detener el acceso.
          if (!(error instanceof Error) || error.message !== "legal-receipt-invalid") throw error;
        }
      }
      if (!current()) return;
      if (!accepted && !legalAccepted) {
        pendingGoogleUser.current = user;
        setGoogleLegalPending(true);
        setGoogleError(t("auth.legalRequired"));
        return;
      }
      // No reescribir ni volver a fechar una aceptación que ya está vigente.
      if (!accepted) {
        checkingLegalAcceptance = true;
        await withTimeout(recordLegalAcceptanceForCurrentAccount());
        if (!current()) return;
      }
      checkingLegalAcceptance = false;
      pendingGoogleUser.current = null;
      setGoogleLegalPending(false);
      if (!current()) return;
      await onLoggedIn(current);
    } catch (err) {
      if (!operationCurrent() || (authenticatedUser && auth.currentUser !== authenticatedUser)) return;
      // Cancelar no es un fallo: si la persona cerró la ventana de Google
      // a propósito, mostrarle un error rojo sería confuso.
      if (err instanceof GoogleSignInCancelled) return;
      if (err instanceof Error && err.name === "LocalAccountAccessError") setGoogleError(err.message);
      else if (checkingLegalAcceptance) setGoogleError(t("legal.saveFailed"));
      else if (authenticated && (err as { code?: string })?.code !== "cloud/history-format-unsupported") setGoogleError(t("login.accountOpenFailed"));
      else setGoogleError(googleSignInErrorMessage(err));
    } finally {
      if (operationCurrent()) {
        authBusy.current = false;
        setGoogleLoading(false);
      }
    }
  }

  async function forgotPassword() {
    if (authBusy.current) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert(t("login.writeEmailFirstTitle"), t("login.writeEmailFirstMessage"));
      return;
    }
    const operationCurrent = beginEntryOperation();
    if (!operationCurrent()) return;
    authBusy.current = true;
    setResetLoading(true);
    try {
      await withTimeout(sendPasswordResetEmail(auth, email.trim()));
      if (!operationCurrent()) return;
      Alert.alert(
        t("login.resetEmailSentTitle"),
        t("login.resetEmailSentMessage", { email: email.trim() })
      );
    } catch (err) {
      if (!operationCurrent()) return;
      const code = (err as { code?: string })?.code || "";
      Alert.alert(t("login.resetEmailFailedTitle"), firebaseErrorMessage(code));
    } finally {
      if (operationCurrent()) { authBusy.current = false; setResetLoading(false); }
    }
  }

  return (
    <EntryScreen center onBack={() => { if (authBusy.current) return; if (recovering) setRecovering(false); else reemplazarUnaVez("/onboarding"); }} disabled={loading || googleLoading || resetLoading}>
      <EntryHeading title={t(recovering ? "entry.recoverTitle" : "login.welcomeBack")} subtitle={t(recovering ? "entry.recoverSubtitle" : "login.subtitle")} icon={recovering ? <KeyRound size={21} color={ENTRY_COLORS.brown} /> : <Smile size={23} color={ENTRY_COLORS.brown} />} />
      <View style={{ gap: 13 }}>
        <AuthField label={t("auth.emailLabel")} value={email} onChange={setEmail} placeholder={t("auth.emailPlaceholder")} keyboardType="email-address" editable={!loading && !googleLoading && !resetLoading} warm light />
        {!recovering ? <AuthField label={t("auth.passwordLabel")} type="password" value={pass} onChange={setPass} placeholder="••••••••" editable={!loading && !googleLoading} warm light /> : null}
      </View>
      {error && !recovering ? <Text accessibilityRole="alert" style={entryStyles.error}>{error}</Text> : null}
      {!recovering ? <EntryLink label={t("login.forgotPassword")} onPress={() => { if (!authBusy.current) setRecovering(true); }} disabled={loading || googleLoading} /> : null}
      <View style={{ marginTop: 16 }}>
        <EntryButton label={t(recovering ? "entry.sendReset" : "login.submit")} onPress={recovering ? forgotPassword : submit} loading={loading || resetLoading} disabled={googleLoading} />
        {recovering ? <EntryLink label={t("entry.backLogin")} onPress={() => { if (!authBusy.current) setRecovering(false); }} disabled={resetLoading} /> : <>
          {Platform.OS === "android" ? <>
            {googleLegalPending ? <View style={entryStyles.card}><Text style={entryStyles.muted}>{t("auth.legalRequiredForAccount")}</Text><AuthLegalAcceptance accepted={legalAccepted} onChange={setLegalAccepted} disabled={loading || googleLoading} t={t} warm /></View> : null}
            <GoogleButton label={t(googleLegalPending ? "auth.acceptAndContinue" : "login.withGoogle")} onPress={loginWithGoogle} loading={googleLoading} disabled={loading || (googleLegalPending && !legalAccepted)} warm light />
            {googleError ? <Text accessibilityRole="alert" style={entryStyles.error}>{googleError}</Text> : null}
          </> : null}
          <EntryLink label={t("login.noAccount") + " " + t("login.register")} onPress={() => { if (!authBusy.current) onGoRegister(); }} disabled={loading || googleLoading} />
        </>}
      </View>
    </EntryScreen>
  );
}
