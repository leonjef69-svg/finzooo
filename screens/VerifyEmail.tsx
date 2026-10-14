import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { MailCheck } from "lucide-react-native";
import { ENTRY_COLORS, EntryButton, EntryHeading, EntryLink, EntryScreen, entryStyles } from "@/components/EntryUI";
import { useAppData } from "@/contexts/AppDataContext";
import { firebaseErrorMessage } from "@/utils/firebaseErrors";

export default function VerifyEmail({
  email,
  onCheckAgain,
  onResend,
  onLogout,
}: {
  email: string;
  onCheckAgain: () => Promise<boolean>;
  onResend: () => Promise<void>;
  onLogout: () => void;
}) {
  const { t } = useAppData();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const verificationBusy = useRef(false);

  async function handleCheck() {
    if (verificationBusy.current || checking || resending) return;
    verificationBusy.current = true;
    setChecking(true);
    setMessage("");
    try {
      const verified = await onCheckAgain();
      if (!verified) {
        setMessage(t("verifyEmail.notDetected"));
      }
    } catch (error) {
      // Un fallo de red o de Firebase no puede dejar a la persona mirando
      // un círculo para siempre. El botón vuelve a estar disponible abajo.
      const code = (error as { code?: string })?.code;
      setMessage(error instanceof Error && error.name === "LocalAccountAccessError" ? error.message : code === "cloud/history-format-unsupported"
        ? firebaseErrorMessage(code)
        : t("verifyEmail.checkFailed"));
    } finally {
      verificationBusy.current = false;
      setChecking(false);
    }
  }

  async function handleResend() {
    if (verificationBusy.current || checking || resending) return;
    verificationBusy.current = true;
    setResending(true);
    setMessage("");
    try {
      await onResend();
      setMessage(t("verifyEmail.resent"));
    } catch {
      setMessage(t("verifyEmail.resendFailed"));
    } finally {
      verificationBusy.current = false;
      setResending(false);
    }
  }

  async function handleLogout() {
    if (verificationBusy.current) return;
    verificationBusy.current = true;
    setChecking(true);
    setMessage("");
    try { await onLogout(); }
    catch { setMessage(t("verifyEmail.logoutFailed")); }
    finally { verificationBusy.current = false; setChecking(false); }
  }

  return (
    <EntryScreen center>
      <EntryHeading title={t("verifyEmail.title")} subtitle={t("verifyEmail.linkSent")} icon={<MailCheck size={23} color={ENTRY_COLORS.brown} />} />
      <View style={[entryStyles.card, { marginBottom: 22 }]}>
        <Text style={entryStyles.muted}>{t("verifyEmail.sentTo")}</Text>
        <Text selectable style={[entryStyles.text, { marginVertical: 7 }]}>{email}</Text>
        <Text style={entryStyles.muted}>{t("verifyEmail.spamHint")}</Text>
      </View>
      {message ? <Text accessibilityRole="alert" style={[entryStyles.text, { marginBottom: 14 }]}>{message}</Text> : null}
      <EntryButton label={t("verifyEmail.checkButton")} onPress={handleCheck} loading={checking} disabled={resending} />
      <EntryButton label={t("verifyEmail.resendButton")} onPress={handleResend} loading={resending} disabled={checking} secondary />
      <EntryLink label={t("verifyEmail.useOtherAccount")} onPress={handleLogout} disabled={checking || resending} />
    </EntryScreen>
  );
}
