import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
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
import { useAppData } from "@/contexts/AppDataContext";

export default function Login({
  onLoggedIn,
  onGoRegister,
}: {
  onLoggedIn: () => void;
  onGoRegister: () => void;
}) {
  const { t } = useAppData();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const insets = useSafeAreaInsets();

  async function submit() {
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
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      onLoggedIn();
    } catch (err) {
      // Cancelar no es un fallo: si la persona cerró la ventana de Google
      // a propósito, mostrarle un error rojo sería confuso.
      if (err instanceof GoogleSignInCancelled) return;
      const code = (err as { code?: string })?.code || "";
      setError(code ? firebaseErrorMessage(code) : t("login.googleError"));
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
      className="flex-1 bg-white dark:bg-slate-900"
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <View className="w-14 h-14 rounded-2xl bg-emerald-600 items-center justify-center mb-6">
            <Wallet size={26} color="#ffffff" />
          </View>
          <Text className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{t("login.welcomeBack")}</Text>
          <Text className="text-sm text-slate-500 dark:text-slate-300 mt-1 mb-7">{t("login.subtitle")}</Text>
        </View>

        <View className="gap-4">
          <AuthField
            label={t("auth.emailLabel")}
            value={email}
            onChange={setEmail}
            placeholder={t("auth.emailPlaceholder")}
            keyboardType="email-address"
          />
          <AuthField
            label={t("auth.passwordLabel")}
            type="password"
            value={pass}
            onChange={setPass}
            placeholder="••••••••"
          />
          {error ? <Text className="text-rose-500 text-xs font-medium -mt-2">{error}</Text> : null}
          <TouchableOpacity onPress={forgotPassword}>
            <Text className="text-right text-xs font-semibold text-emerald-600">
              {t("login.forgotPassword")}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={submit}
          disabled={loading}
          className={`w-full mt-7 bg-emerald-600 py-4 rounded-2xl items-center justify-center ${
            loading ? "opacity-70" : ""
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-bold">{t("login.submit")}</Text>
          )}
        </TouchableOpacity>

        <OrDivider label={t("login.or")} />

        <GoogleButton
          label={t("login.withGoogle")}
          onPress={loginWithGoogle}
          loading={googleLoading}
          disabled={loading}
        />

        <View className="flex-row justify-center mt-6 pb-6">
          <Text className="text-sm text-slate-500 dark:text-slate-300">{t("login.noAccount")}</Text>
          <TouchableOpacity onPress={onGoRegister}>
            <Text className="text-sm text-emerald-600 font-bold">{t("login.register")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
