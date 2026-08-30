import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wallet } from "lucide-react-native";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "@firebase/auth";
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
  const insets = useSafeAreaInsets();

  async function registerWithGoogle() {
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
      setGoogleLoading(false);
    }
  }

  async function submit() {
    setGoogleError("");
    const e: Errors = {};
    if (name.trim().length < 2) e.name = t("register.nameError");
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = t("register.emailError");
    if (pass.length < 8) e.pass = t("register.passwordError");
    setErrors(e);
    if (Object.keys(e).length) return;

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
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-[#17100c]"
    >
      <Image source={require("../assets/images/onboarding/fino-sunset-background.png")} resizeMode="cover" className="absolute inset-0 h-full w-full" />
      <View className="absolute inset-0 bg-black/40" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 32 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-4 my-6 rounded-[28px] bg-white/95 pb-8">
        <View className="px-6 pt-8 pb-4">
          <View className="w-12 h-12 rounded-2xl bg-emerald-600 items-center justify-center mb-5">
            <Wallet size={22} color="#ffffff" />
          </View>
          <Text className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{t("register.title")}</Text>
          <Text className="text-sm text-slate-500 dark:text-slate-300 mt-1">{t("register.subtitle")}</Text>
        </View>

        <View className="px-6 gap-4 mt-2">
          <AuthField
            label={t("register.nameLabel")}
            value={name}
            onChange={setName}
            placeholder={t("register.namePlaceholder")}
            error={errors.name}
          />
          <AuthField
            label={t("auth.emailLabel")}
            value={email}
            onChange={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            error={errors.email}
            keyboardType="email-address"
          />
          <AuthField
            label={t("auth.passwordLabel")}
            type="password"
            value={pass}
            onChange={setPass}
            placeholder="••••••••"
            error={errors.pass}
          />
          {errors.general ? (
            <Text className="text-rose-500 text-xs font-medium text-center">{errors.general}</Text>
          ) : null}
        </View>

        <View className="px-6 mt-8">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={submit}
            disabled={loading}
            className={`w-full bg-emerald-600 py-4 rounded-2xl items-center justify-center ${
              loading ? "opacity-70" : ""
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold">{t("register.submit")}</Text>
            )}
          </TouchableOpacity>

          <OrDivider label={t("login.or")} />

          <GoogleButton
            label={t("login.withGoogle")}
            onPress={registerWithGoogle}
            loading={googleLoading}
            disabled={loading}
          />
          {googleError ? (
            <Text className="text-rose-500 text-xs font-medium text-center mt-3">
              {googleError}
            </Text>
          ) : null}

          {/* gap-1: ver la nota del mismo bloque en Login.tsx. */}
          <View className="flex-row justify-center gap-1 mt-5">
            <Text className="text-sm text-slate-500 dark:text-slate-300">{t("register.haveAccount")}</Text>
            <TouchableOpacity onPress={onGoLogin}>
              <Text className="text-sm text-emerald-600 font-bold">{t("register.login")}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
