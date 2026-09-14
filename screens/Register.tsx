import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
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
import GoogleButton, { OrDivider } from "@/components/GoogleButton";
import { auth } from "@/utils/firebase";
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
  onRegistered: (name: string, email: string) => void;
  // Con Google no hay diferencia entre "crear cuenta" y "entrar": Google
  // crea la cuenta si no existía. Por eso este camino termina igual que el
  // de la pantalla de Login, sin pasar por verificar el correo (las
  // cuentas de Google ya vienen verificadas).
  onGoogleSignedIn: () => void | Promise<void>;
  onGoLogin: () => void;
}) {
  const { t } = useAppData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const authBusy = useRef(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  async function registerWithGoogle() {
    if (authBusy.current) return;
    authBusy.current = true;
    setErrors({});
    setGoogleError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      await onGoogleSignedIn();
    } catch (err) {
      if (err instanceof GoogleSignInCancelled) return;
      setGoogleError(googleSignInErrorMessage(err));
    } finally {
      authBusy.current = false;
      setGoogleLoading(false);
    }
  }

  async function submit() {
    if (authBusy.current) return;
    setGoogleError("");
    const e: Errors = {};
    if (name.trim().length < 2) e.name = t("register.nameError");
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = t("register.emailError");
    if (pass.length < 8) e.pass = t("register.passwordError");
    setErrors(e);
    if (Object.keys(e).length) return;

    authBusy.current = true;
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      await updateProfile(credential.user, { displayName: name.trim() });
      await sendEmailVerification(credential.user);
      onRegistered(name.trim(), email.trim());
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      setErrors({ general: firebaseErrorMessage(code) });
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
        style={{ transform: [{ scale: 1.08 }, { translateY: -120 }] }}
      />
      <View className="absolute inset-0 bg-black/40" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 215, paddingBottom: insets.bottom }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={height < 700 || keyboardVisible}
        bounces={false}
      >
        <View className="rounded-t-[30px] bg-white/95 pb-4" style={{ minHeight: Math.max(600, height - insets.top - 215) }}>
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
            light
          />
          <AuthField
            label={t("auth.emailLabel")}
            value={email}
            onChange={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            error={errors.email}
            keyboardType="email-address"
            light
          />
          <AuthField
            label={t("auth.passwordLabel")}
            type="password"
            value={pass}
            onChange={setPass}
            placeholder="••••••••"
            error={errors.pass}
            light
          />
          {errors.general ? (
            <Text className="text-rose-500 text-xs font-medium text-center">{errors.general}</Text>
          ) : null}
        </View>

        <View className="px-6 mt-5">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={submit}
            disabled={loading}
            className={`w-full bg-amber-500 py-4 rounded-2xl items-center justify-center ${
              loading ? "opacity-70" : ""
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold">{t("register.submit")}</Text>
            )}
          </TouchableOpacity>

          {Platform.OS === "android" ? <>
            <OrDivider label={t("login.or")} />
            <GoogleButton
              label={t("login.withGoogle")}
              onPress={registerWithGoogle}
              loading={googleLoading}
              disabled={loading}
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
            <TouchableOpacity onPress={onGoLogin}>
              <Text className="text-sm text-amber-600 font-bold">{t("register.login")}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
