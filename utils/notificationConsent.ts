import { Alert } from "react-native";
import * as reader from "@/modules/notification-reader";

let asking = false;

/** Compartido por Dar acceso y Encender: cerrar/volver nunca significa aceptar. */
export function requestNotificationConsent(
  t: (key: string) => string,
  onAccepted: () => void,
  isCurrent: () => boolean,
): void {
  if (!isCurrent()) return;
  if (!reader.hasPrivacyProtection) {
    Alert.alert(t("autoCapture.updateTitle"), t("autoCapture.updateBody"));
    return;
  }
  if (reader.hasDisclosureConsent()) { onAccepted(); return; }
  if (asking) return;
  asking = true;
  const dismiss = () => { asking = false; };
  Alert.alert(t("autoCapture.consentTitle"), t("autoCapture.consentBody"), [
    { text: t("autoCapture.consentCancel"), style: "cancel", onPress: dismiss },
    { text: t("autoCapture.consentAccept"), onPress: () => {
      dismiss();
      if (!isCurrent()) return;
      if (!reader.acceptDisclosureConsent()) {
        Alert.alert(t("autoCapture.consentTitle"), t("autoCapture.consentError"));
        return;
      }
      if (isCurrent()) onAccepted();
    } },
  ], { cancelable: true, onDismiss: dismiss });
}
