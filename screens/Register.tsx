import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import AuthField from "@/components/AuthField";
import AuthLegalAcceptance from "@/components/AuthLegalAcceptance";
import GoogleButton, { OrDivider } from "@/components/GoogleButton";
import { auth } from "@/utils/firebase";
import { recordLegalAcceptanceForCurrentAccount } from "@/utils/legalAcceptance";
import { withTimeout } from "@/utils/withTimeout";
import { firebaseErrorMessage } from "@/utils/firebaseErrors";
import { GoogleSignInCancelled, signInWithGoogle } from "@/utils/googleAuth";
import { googleSignInErrorMessage } from "@/utils/googleSignInError";
import { useAppData } from "@/contexts/AppDataContext";

type Errors = { name?: string; email?: string; pass?: string; general?: string };

export default function Register({
  onRegistered,
  onGoogleSignedIn,
  onGoLogin,
}: {
  onRegistered: (name: string, email: string) => void | Promise<void>;
  // Con Google no hay diferencia entre "crear cuenta" y "entrar": Google
  // crea la cuenta si no existía. Por eso este camino termina igual que el
  // de la pantalla de Login, sin pasar por verificar el correo (las
  // cuentas de Google ya vienen verificadas).
  onGoogleSignedIn: () => void | Promise<void>;
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
  const createdUser = useRef<typeof auth.currentUser>(null);
  const verificationSent = useRef(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();


  async function registerWithGoogle() {
    if (authBusy.current) return;
    if (!legalAccepted) {
      setGoogleError(t("auth.legalRequired"));
      return;
    }
    authBusy.current = true;
    setErrors({});
    setGoogleError("");
    setGoogleLoading(true);
    let authenticated = false;
    try {
      await signInWithGoogle();
      authenticated = true;
      await withTimeout(recordLegalAcceptanceForCurrentAccount()).catch(() => showToast(t("legal.saveFailed")));
      await onGoogleSignedIn();
    } catch (err) {
      if (err instanceof GoogleSignInCancelled) return;
      if (err instanceof Error && err.name === "LocalAccountAccessError") setGoogleError(err.message);
      else if (authenticated && (err as { code?: string })?.code !== "cloud/history-format-unsupported") setGoogleError(t("login.accountOpenFailed"));
      else setGoogleError(googleSignInErrorMessage(err));
    } finally {
      authBusy.current = false;
      setGoogleLoading(false);
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

    authBusy.current = true;
    setLoading(true);
    try {
      // Firebase puede haber creado la cuenta antes de que falle perfil,
      // correo o apertura local. Reintentar termina esa cuenta, no crea otra.
      if (!createdUser.current) {
        createdUser.current = (await createUserWithEmailAndPassword(auth, normalizedEmail, pass)).user;
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
      await withTimeout(recordLegalAcceptanceForCurrentAccount()).catch(() => showToast(t("legal.saveFailed")));
      requireSameAccount();
      await withTimeout(updateProfile(user, { displayName: name.trim() }));
      requireSameAccount();
      if (!verificationSent.current) {
        try {
          await withTimeout(sendEmailVerification(user));
          verificationSent.current = true;
        } catch { showToast(t("register.verificationRetry")); }
      }
      requireSameAccount();
      await onRegistered(name.trim(), normalizedEmail);
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      setErrors({ general: err instanceof Error && err.name === "LocalAccountAccessError" ? err.message : createdUser.current ? t("register.accountCreatedRetry") : firebaseErrorMessage(code) });
    } finally {
      authBusy.current = false;
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-[#17100c]"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Image
        source={require("../assets/images/onboarding/fino-sunset-background.png")}
        resizeMode="cover"
        className="absolute inset-0 h-full w-full"
        style={{ transform: [{ scale: 1.08 }] }}
      />
      <View className="absolute inset-0 bg-black/40" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 215, paddingBottom: 0 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View className="rounded-t-[30px] bg-white/95 pb-4" style={{ minHeight: Math.max(0, height - insets.top - 215), paddingBottom: insets.bottom + 16 }}>
        <View className="px-6 pt-7 pb-3">
          <Text className="text-2xl font-extrabold text-slate-900">{t("register.title")}</Text>
          <Text className="text-sm text-slate-500 mt-1">{t("register.subtitle")}</Text>
        </View>

        <View className="px-6 gap-3 mt-1">
          <AuthField
            label={t("register.nameLabel")}
            value={name}
            onChange={setName}
            placeholder={t("register.namePlaceholder")}
            error={errors.name}
            editable={!loading && !googleLoading}
            light
          />
          <AuthField
            label={t("auth.emailLabel")}
            value={email}
            onChange={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            error={errors.email}
            keyboardType="email-address"
            editable={!loading && !googleLoading && !createdUser.current}
            light
          />
          <AuthField
            label={t("auth.passwordLabel")}
            type="password"
            value={pass}
            onChange={setPass}
            placeholder="••••••••"
            error={errors.pass}
            editable={!loading && !googleLoading && !createdUser.current}
            light
          />
          {errors.general ? (
            <Text className="text-rose-500 text-xs font-medium text-center">{errors.general}</Text>
          ) : null}
        </View>

        <View className="px-6 mt-5">
          <AuthLegalAcceptance accepted={legalAccepted} onChange={setLegalAccepted} disabled={loading || googleLoading} t={t} />
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={submit}
            disabled={loading || googleLoading || !legalAccepted}
            className={`w-full bg-amber-500 py-4 rounded-2xl items-center justify-center ${
              loading ? "opacity-70" : ""
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold">{t(createdUser.current ? "register.finishAccount" : "register.submit")}</Text>
            )}
          </TouchableOpacity>

          {Platform.OS === "android" ? <>
            <OrDivider label={t("login.or")} />
            <GoogleButton
              label={t("login.withGoogle")}
              onPress={registerWithGoogle}
              loading={googleLoading}
              disabled={loading || !legalAccepted}
              light
            />
            {googleError ? (
              <Text className="text-rose-500 text-xs font-medium text-center mt-3">
                {googleError}
              </Text>
            ) : null}
          </> : null}

          {/* gap-1: ver la nota del mismo bloque en Login.tsx. */}
          <View className="flex-row justify-center gap-1 mt-4">
            <Text className="text-sm text-slate-500">{t("register.haveAccount")}</Text>
            <TouchableOpacity disabled={loading || googleLoading} onPress={() => { if (!authBusy.current) onGoLogin(); }}>
              <Text className="text-sm text-amber-600 font-bold">{t("register.login")}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
