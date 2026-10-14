import { useMemo, useRef, useState } from "react";
import { Alert, Keyboard, Platform, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, ReduceMotion } from "react-native-reanimated";
import { KeyRound, Mail, Smile } from "lucide-react-native";
import { reemplazarUnaVez } from "@/utils/nav";
import { ENTRY_COLORS, ENTRY_FONT, EntryButton, EntryHeading, EntryLink, EntryScreen, entryStyles } from "@/components/EntryUI";
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
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

type EntryMode = "login" | "register";
type Errors = { name?: string; email?: string; pass?: string; general?: string };

export default function Login({
  onLoggedIn,
  onRegistered,
  initialMode = "login",
}: {
  onLoggedIn: (current?: EntryOperationGuard) => void | Promise<void>;
  onRegistered: (name: string, email: string, current?: EntryOperationGuard) => void | Promise<void>;
  initialMode?: EntryMode;
}) {
  const { t, showToast } = useAppData();
  const [mode, setMode] = useState<EntryMode>(initialMode);
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
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const createdUser = useRef<typeof auth.currentUser>(null);
  const verificationSent = useRef(false);
  const authBusy = useRef(false);
  const pendingGoogleUser = useRef<typeof auth.currentUser>(null);
  const beginEntryOperation = useEntryOperation(() => {
    authBusy.current = false;
    setLoading(false);
    setGoogleLoading(false);
    setResetLoading(false);
  });
  const motion = useMemo(() => ({
    layout: LinearTransition.duration(180).reduceMotion(ReduceMotion.System),
    enter: FadeIn.duration(160).reduceMotion(ReduceMotion.System),
    exit: FadeOut.duration(120).reduceMotion(ReduceMotion.System),
  }), []);

  function changeMode(next: EntryMode) {
    // No intercambiar cuentas mientras un envío está pendiente ni perder
    // la referencia de una cuenta creada que aún debe terminarse.
    if (authBusy.current || createdUser.current || (next === mode && !recovering)) return;
    Keyboard.dismiss();
    setMode(next);
    setRecovering(false);
    setError("");
    setErrors({});
    setGoogleError("");
    setLegalAccepted(false);
    setGoogleLegalPending(false);
    pendingGoogleUser.current = null;
  }

  async function registerSubmit() {
    if (authBusy.current) return;
    if (!legalAccepted) { setErrors({ general: t("auth.legalRequired") }); return; }
    setGoogleError("");
    const e: Errors = {};
    if (name.trim().length < 2) e.name = t("register.nameError");
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) e.email = t("register.emailError");
    if (pass.length < 8) e.pass = t("register.passwordError");
    setErrors(e);
    if (Object.keys(e).length) return;
    const operationCurrent = beginEntryOperation();
    if (!operationCurrent()) return;
    authBusy.current = true;
    setLoading(true);
    try {
      if (!createdUser.current) {
        const result = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);
        if (!operationCurrent()) return;
        createdUser.current = result.user;
        verificationSent.current = false;
      }
      const user = createdUser.current;
      function requireSameAccount() {
        if (auth.currentUser !== user) {
          const failure = new Error(t("settings.noActiveSession"));
          failure.name = "LocalAccountAccessError";
          throw failure;
        }
      }
      requireSameAccount();
      // Si falla el recibo, reintentar termina ESTA cuenta; no abre sus datos
      // sin guardar la aceptación ni vuelve a crearla.
      await withTimeout(recordLegalAcceptanceForCurrentAccount());
      if (!operationCurrent()) return;
      requireSameAccount();
      await withTimeout(updateProfile(user, { displayName: name.trim() }));
      if (!operationCurrent()) return;
      requireSameAccount();
      if (!verificationSent.current) {
        try {
          await withTimeout(sendEmailVerification(user));
          if (!operationCurrent()) return;
          verificationSent.current = true;
        } catch { if (operationCurrent() && auth.currentUser === user) showToast(t("register.verificationRetry")); }
      }
      if (!operationCurrent()) return;
      requireSameAccount();
      await onRegistered(name.trim(), normalizedEmail, () => operationCurrent() && auth.currentUser === user);
    } catch (err) {
      if (!operationCurrent()) return;
      const code = (err as { code?: string })?.code || "";
      setErrors({ general: err instanceof Error && err.name === "LocalAccountAccessError" ? err.message : createdUser.current ? t("register.accountCreatedRetry") : firebaseErrorMessage(code) });
    } finally {
      if (operationCurrent()) { authBusy.current = false; setLoading(false); }
    }
  }

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
    setErrors({});
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
    <EntryScreen onBack={() => { if (authBusy.current) return; if (recovering) setRecovering(false); else reemplazarUnaVez("/onboarding"); }} disabled={loading || googleLoading || resetLoading}>
      {!recovering ? <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 5, padding: 5, backgroundColor: ENTRY_COLORS.soft, borderRadius: 16, marginBottom: 22 }}>
        {(["login", "register"] as const).map(option => <TouchableOpacity key={option} accessibilityRole="tab" accessibilityState={{ selected: mode === option, disabled: loading || googleLoading || !!createdUser.current }} disabled={loading || googleLoading || !!createdUser.current} onPress={() => changeMode(option)} style={{ flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: mode === option ? ENTRY_COLORS.olive : "transparent" }}>
          <Text style={{ fontFamily: ENTRY_FONT.bold, fontSize: 14, color: mode === option ? ENTRY_COLORS.paper : ENTRY_COLORS.olive }}>{t(option === "login" ? "login.submit" : "register.submit")}</Text>
        </TouchableOpacity>)}
      </View> : null}
      <EntryHeading title={t(recovering ? "entry.recoverTitle" : mode === "register" ? "register.title" : "login.welcomeBack")} subtitle={t(recovering ? "entry.recoverSubtitle" : mode === "register" ? "register.subtitle" : "login.subtitle")} icon={recovering ? <KeyRound size={21} color={ENTRY_COLORS.brown} /> : mode === "register" ? <Mail size={22} color={ENTRY_COLORS.brown} /> : <Smile size={23} color={ENTRY_COLORS.brown} />} />
      <Animated.View layout={motion.layout} style={{ gap: 13 }}>
        {mode === "register" && !recovering ? <Animated.View key="name" entering={motion.enter} exiting={motion.exit} layout={motion.layout}><AuthField label={t("register.nameLabel")} value={name} onChange={setName} placeholder={t("register.namePlaceholder")} error={errors.name} editable={!loading && !googleLoading} warm light /></Animated.View> : null}
        <Animated.View key="email" layout={motion.layout}><AuthField label={t("auth.emailLabel")} value={email} onChange={setEmail} placeholder={t("auth.emailPlaceholder")} error={mode === "register" ? errors.email : undefined} keyboardType="email-address" editable={!loading && !googleLoading && !resetLoading && !createdUser.current} warm light /></Animated.View>
        {!recovering ? <Animated.View key="password" layout={motion.layout}><AuthField label={t("auth.passwordLabel")} type="password" value={pass} onChange={setPass} placeholder="••••••••" error={mode === "register" ? errors.pass : undefined} editable={!loading && !googleLoading && !createdUser.current} warm light /></Animated.View> : null}
      </Animated.View>
      {(mode === "register" ? errors.general : error) && !recovering ? <Text accessibilityRole="alert" style={entryStyles.error}>{mode === "register" ? errors.general : error}</Text> : null}
      {mode === "login" && !recovering ? <EntryLink label={t("login.forgotPassword")} onPress={() => { if (!authBusy.current) setRecovering(true); }} disabled={loading || googleLoading} /> : null}
      <Animated.View layout={motion.layout} style={{ marginTop: 16 }}>
        {!recovering && (mode === "register" || googleLegalPending) ? <Animated.View key="terms" entering={motion.enter} exiting={motion.exit} layout={motion.layout}>
          {googleLegalPending ? <Text style={entryStyles.muted}>{t("auth.legalRequiredForAccount")}</Text> : null}
          <AuthLegalAcceptance accepted={legalAccepted} onChange={setLegalAccepted} disabled={loading || googleLoading} t={t} warm />
        </Animated.View> : null}
        <EntryButton label={t(recovering ? "entry.sendReset" : mode === "register" ? createdUser.current ? "register.finishAccount" : "register.submit" : "login.submit")} onPress={recovering ? forgotPassword : mode === "register" ? () => { if (authBusy.current) return; pendingGoogleUser.current = null; setGoogleLegalPending(false); void registerSubmit(); } : submit} loading={loading || resetLoading} disabled={googleLoading || (!recovering && mode === "register" && !legalAccepted)} />
        {recovering ? <EntryLink label={t("entry.backLogin")} onPress={() => { if (!authBusy.current) setRecovering(false); }} disabled={resetLoading} /> : Platform.OS === "android" ? <>
          <GoogleButton label={t(googleLegalPending ? "auth.acceptAndContinue" : "login.withGoogle")} onPress={loginWithGoogle} loading={googleLoading} disabled={loading || !!createdUser.current || (googleLegalPending && !legalAccepted)} warm light />
          {googleError ? <Text accessibilityRole="alert" style={entryStyles.error}>{googleError}</Text> : null}
        </> : null}
      </Animated.View>
    </EntryScreen>
  );
}
