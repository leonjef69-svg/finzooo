import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Wallet } from "lucide-react-native";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "@firebase/auth";
import AuthField from "@/components/AuthField";
import GoogleButton, { OrDivider } from "@/components/GoogleButton";
import { auth } from "@/utils/firebase";
import { firebaseErrorMessage } from "@/utils/firebaseErrors";
import { GoogleSignInCancelled, signInWithGoogle } from "@/utils/googleAuth";
import { googleSignInErrorMessage } from "@/utils/googleSignInError";
import { useAppData } from "@/contexts/AppDataContext";

export default function Login({
  onLoggedIn,
  onGoRegister,
}: {
  onLoggedIn: () => void | Promise<void>;
  onGoRegister: () => void;
}) {
  const { t } = useAppData();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  async function submit() {
    setGoogleError("");
    if (!email || pass.length < 6) {
      setError(t("login.invalidCredentials"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      onLoggedIn();
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      setError(firebaseErrorMessage(code));
    } finally {
      setLoading(false);
    }
  }

  async function loginWithGoogle() {
    setError("");
    setGoogleError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      await onLoggedIn();
    } catch (err) {
      // Cancelar no es un fallo: si la persona cerró la ventana de Google
      // a propósito, mostrarle un error rojo sería confuso.
      if (err instanceof GoogleSignInCancelled) return;
      setGoogleError(googleSignInErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function forgotPassword() {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert(t("login.writeEmailFirstTitle"), t("login.writeEmailFirstMessage"));
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        t("login.resetEmailSentTitle"),
        t("login.resetEmailSentMessage", { email: email.trim() })
      );
    } catch (err) {
      const code = (err as { code?: string })?.code || "";
      Alert.alert(t("login.resetEmailFailedTitle"), firebaseErrorMessage(code));
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
      <View className="absolute inset-0 bg-black/45" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 0,
          paddingTop: insets.top + 245,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="rounded-t-[30px] bg-white/95 px-6 pt-8 pb-7" style={{ minHeight: Math.max(610, height - insets.top - 245) }}>
          <View className="w-12 h-12 rounded-2xl bg-amber-500 items-center justify-center mb-5">
            <Wallet size={22} color="#ffffff" />
          </View>
          <Text className="text-2xl font-extrabold text-slate-900">{t("login.welcomeBack")}</Text>
          <Text className="text-sm text-slate-500 mt-1 mb-7">{t("login.subtitle")}</Text>

          <View className="gap-4">
          <AuthField
            label={t("auth.emailLabel")}
            value={email}
            onChange={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            keyboardType="email-address"
            light
          />
          <AuthField
            label={t("auth.passwordLabel")}
            type="password"
            value={pass}
            onChange={setPass}
            placeholder="••••••••"
            light
          />
          {error ? <Text className="text-rose-500 text-xs font-medium -mt-2">{error}</Text> : null}
          <TouchableOpacity onPress={forgotPassword}>
            <Text className="text-right text-xs font-semibold text-amber-600">
              {t("login.forgotPassword")}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={submit}
          disabled={loading}
          className={`w-full mt-7 bg-amber-500 py-4 rounded-2xl items-center justify-center ${
            loading ? "opacity-70" : ""
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-bold">{t("login.submit")}</Text>
          )}
        </TouchableOpacity>

        {Platform.OS === "android" ? <>
          <OrDivider label={t("login.or")} />
          <GoogleButton
            label={t("login.withGoogle")}
            onPress={loginWithGoogle}
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

        {/* gap-1: la separación con "Regístrate" la pone el diseño. Antes
            venía de un espacio al final del propio texto traducido, donde
            no se ve y cualquiera lo borraría sin saber que hacía falta. */}
        <View className="flex-row justify-center gap-1 mt-6 pb-6">
          <Text className="text-sm text-slate-500">{t("login.noAccount")}</Text>
          <TouchableOpacity onPress={onGoRegister}>
            <Text className="text-sm text-amber-600 font-bold">{t("login.register")}</Text>
          </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
