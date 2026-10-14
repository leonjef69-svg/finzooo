import { useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Mail } from "lucide-react-native";
import { reemplazarUnaVez } from "@/utils/nav";
import { ENTRY_COLORS, EntryButton, EntryHeading, EntryLink, EntryScreen, entryStyles } from "@/components/EntryUI";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import AuthField from "@/components/AuthField";
import AuthLegalAcceptance from "@/components/AuthLegalAcceptance";
import GoogleButton from "@/components/GoogleButton";
import { auth } from "@/utils/firebase";
import { recordLegalAcceptanceForCurrentAccount } from "@/utils/legalAcceptance";
import { withTimeout } from "@/utils/withTimeout";
import { firebaseErrorMessage } from "@/utils/firebaseErrors";
import { GoogleSignInCancelled, signInWithGoogle } from "@/utils/googleAuth";
import { googleSignInErrorMessage } from "@/utils/googleSignInError";
import { useAppData } from "@/contexts/AppDataContext";
import { useEntryOperation, type EntryOperationGuard } from "@/utils/entryOperation";

type Errors = { name?: string; email?: string; pass?: string; general?: string };

export default function Register({
  onRegistered,
  onGoogleSignedIn,
  onGoLogin,
}: {
  onRegistered: (name: string, email: string, current?: EntryOperationGuard) => void | Promise<void>;
  // Con Google no hay diferencia entre "crear cuenta" y "entrar": Google
  // crea la cuenta si no existía. Por eso este camino termina igual que el
  // de la pantalla de Login, sin pasar por verificar el correo (las
  // cuentas de Google ya vienen verificadas).
  onGoogleSignedIn: (current?: EntryOperationGuard) => void | Promise<void>;
  onGoLogin: () => void;
}) {
  const { t, showToast } = useAppData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const authBusy = useRef(false);
  const beginEntryOperation = useEntryOperation(() => {
    authBusy.current = false;
    setLoading(false);
    setGoogleLoading(false);
  });
  const createdUser = useRef<typeof auth.currentUser>(null);
  const verificationSent = useRef(false);


  async function registerWithGoogle() {
    if (authBusy.current) return;
    if (!legalAccepted) {
      setGoogleError(t("auth.legalRequired"));
      return;
    }
    const operationCurrent = beginEntryOperation();
    if (!operationCurrent()) return;
    authBusy.current = true;
    setErrors({});
    setGoogleError("");
    setGoogleLoading(true);
    let authenticated = false;
    let authenticatedUser: typeof auth.currentUser = null;
    try {
      const user = await signInWithGoogle();
      authenticatedUser = user;
      if (!operationCurrent()) return;
      if (!user) throw new Error(t("settings.noActiveSession"));
      if (auth.currentUser !== user) return;
      const current = () => operationCurrent() && auth.currentUser === user;
      authenticated = true;
      await withTimeout(recordLegalAcceptanceForCurrentAccount()).catch(() => { if (current()) showToast(t("legal.saveFailed")); });
      if (!current()) return;
      await onGoogleSignedIn(current);
    } catch (err) {
      if (!operationCurrent() || (authenticatedUser && auth.currentUser !== authenticatedUser)) return;
      if (err instanceof GoogleSignInCancelled) return;
      if (err instanceof Error && err.name === "LocalAccountAccessError") setGoogleError(err.message);
      else if (authenticated && (err as { code?: string })?.code !== "cloud/history-format-unsupported") setGoogleError(t("login.accountOpenFailed"));
      else setGoogleError(googleSignInErrorMessage(err));
    } finally {
      if (operationCurrent()) {
        authBusy.current = false;
        setGoogleLoading(false);
      }
    }
  }

  async function submit() {
    if (authBusy.current) return;
    if (!legalAccepted) {
      setErrors({ general: t("auth.legalRequired") });
      return;
    }
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
      // Firebase puede haber creado la cuenta antes de que falle perfil,
      // correo o apertura local. Reintentar termina esa cuenta, no crea otra.
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
      await withTimeout(recordLegalAcceptanceForCurrentAccount()).catch(() => { if (operationCurrent() && auth.currentUser === user) showToast(t("legal.saveFailed")); });
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
      if (operationCurrent()) {
        authBusy.current = false;
        setLoading(false);
      }
    }
  }

  return (
    <EntryScreen onBack={() => { if (!authBusy.current) reemplazarUnaVez("/onboarding"); }} disabled={loading || googleLoading} center>
      <EntryHeading title={t("register.title")} subtitle={t("register.subtitle")} icon={<Mail size={22} color={ENTRY_COLORS.brown} />} />
      <View style={{ gap: 12 }}>
        <AuthField label={t("register.nameLabel")} value={name} onChange={setName} placeholder={t("register.namePlaceholder")} error={errors.name} editable={!loading && !googleLoading} warm light />
        <AuthField label={t("auth.emailLabel")} value={email} onChange={setEmail} placeholder={t("auth.emailPlaceholder")} error={errors.email} keyboardType="email-address" editable={!loading && !googleLoading && !createdUser.current} warm light />
        <AuthField label={t("auth.passwordLabel")} type="password" value={pass} onChange={setPass} placeholder="••••••••" error={errors.pass} editable={!loading && !googleLoading && !createdUser.current} warm light />
        {errors.general ? <Text accessibilityRole="alert" style={entryStyles.error}>{errors.general}</Text> : null}
      </View>
      <View style={{ marginTop: 17 }}>
        <AuthLegalAcceptance accepted={legalAccepted} onChange={setLegalAccepted} disabled={loading || googleLoading} t={t} warm />
        <EntryButton label={t(createdUser.current ? "register.finishAccount" : "register.submit")} onPress={submit} loading={loading} disabled={googleLoading || !legalAccepted} />
        {Platform.OS === "android" ? <>
          <GoogleButton label={t("login.withGoogle")} onPress={registerWithGoogle} loading={googleLoading} disabled={loading || !legalAccepted} warm light />
          {googleError ? <Text accessibilityRole="alert" style={entryStyles.error}>{googleError}</Text> : null}
        </> : null}
        <EntryLink label={t("register.haveAccount") + " " + t("register.login")} onPress={() => { if (!authBusy.current) onGoLogin(); }} disabled={loading || googleLoading} />
      </View>
    </EntryScreen>
  );
}
