import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, EyeOff, Fingerprint, Info, Lock, ScanFace, ShieldAlert } from "lucide-react-native";
import PinPad from "@/components/PinPad";
import Toggle from "@/components/Toggle";
import { CARD_SHADOW } from "@/constants/style";
import { useAppData } from "@/contexts/AppDataContext";
import {
  PIN_LENGTH,
  biometricKind,
  clearDecoyPin,
  disableLock,
  enableLock,
  hasDecoyPin,
  isLockEnabled,
  setDecoyPin,
  verifyPin,
  type BiometricKind,
} from "@/utils/appLock";

type Step =
  | "idle" // viendo el interruptor
  | "create" // eligiendo un PIN nuevo
  | "confirm" // repitiéndolo
  | "verify" // comprobando el actual para poder apagarlo
  | "decoyCreate" // eligiendo el PIN señuelo
  | "decoyConfirm"; // repitiéndolo

export default function AppLockSettings({ onBack }: { onBack: () => void }) {
  const { t, isCloudSynced } = useAppData();
  const insets = useSafeAreaInsets();

  const [enabled, setEnabled] = useState(false);
  const [hasDecoy, setHasDecoy] = useState(false);
  const [kind, setKind] = useState<BiometricKind>("none");
  const [step, setStep] = useState<Step>("idle");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [on, biometric, decoy] = await Promise.all([
        isLockEnabled(),
        biometricKind(),
        hasDecoyPin(),
      ]);
      if (!alive) return;
      setEnabled(on);
      setKind(biometric);
      setHasDecoy(decoy);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function reset() {
    setStep("idle");
    setPin("");
    setFirstPin("");
    setError(false);
  }

  // Todo el flujo pasa por aquí: se dispara al completar las cuatro cifras.
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || step === "idle") return;
    let alive = true;

    (async () => {
      if (step === "create") {
        setFirstPin(pin);
        setPin("");
        setStep("confirm");
        return;
      }

      if (step === "confirm") {
        if (pin !== firstPin) {
          // No coinciden: se vuelve al principio en vez de dejar seguir.
          // Guardar un PIN que se tecleó mal dos veces distintas es la
          // forma más fácil de quedarse fuera.
          setError(true);
          setMessage(t("lock.mismatch"));
          setTimeout(() => {
            if (!alive) return;
            setPin("");
            setFirstPin("");
            setError(false);
            setStep("create");
          }, 700);
          return;
        }
        const ok = await enableLock(pin);
        if (!alive) return;
        if (ok) {
          setEnabled(true);
          setMessage("");
          reset();
        } else {
          setError(true);
          setMessage(t("lock.saveFailed"));
          setTimeout(() => alive && reset(), 900);
        }
        return;
      }

      if (step === "decoyCreate") {
        setFirstPin(pin);
        setPin("");
        setStep("decoyConfirm");
        return;
      }

      if (step === "decoyConfirm") {
        if (pin !== firstPin) {
          setError(true);
          setMessage(t("lock.mismatch"));
          setTimeout(() => {
            if (!alive) return;
            setPin("");
            setFirstPin("");
            setError(false);
            setStep("decoyCreate");
          }, 700);
          return;
        }
        const ok = await setDecoyPin(pin);
        if (!alive) return;
        if (ok) {
          setHasDecoy(true);
          setMessage("");
          reset();
        } else {
          // El único motivo real: es el mismo PIN que el de verdad. Entonces
          // no habría señuelo, solo la falsa sensación de tenerlo.
          setError(true);
          setMessage(t("lock.decoySame"));
          setTimeout(() => {
            if (!alive) return;
            setPin("");
            setFirstPin("");
            setError(false);
            setStep("decoyCreate");
          }, 900);
        }
        return;
      }

      if (step === "verify") {
        const ok = await verifyPin(pin);
        if (!alive) return;
        if (ok === "real") {
          await disableLock();
          setEnabled(false);
          setHasDecoy(false);
          setMessage("");
          reset();
        } else {
          setError(true);
          setTimeout(() => {
            if (!alive) return;
            setPin("");
            setError(false);
          }, 500);
        }
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, step, firstPin]);

  function toggle(next: boolean) {
    setMessage("");
    // Para apagarlo hay que saber el PIN. Si no, cualquiera que agarre el
    // teléfono desbloqueado podría quitar el candado desde aquí, y el
    // candado no habría servido de nada.
    setStep(next ? "create" : "verify");
    setPin("");
    setFirstPin("");
  }

  const title =
    step === "create"
      ? t("lock.stepCreate")
      : step === "confirm"
        ? t("lock.stepConfirm")
        : step === "verify"
          ? t("lock.stepVerify")
          : step === "decoyCreate"
            ? t("lock.stepDecoyCreate")
            : step === "decoyConfirm"
              ? t("lock.stepDecoyConfirm")
              : "";

  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-3 pb-2 flex-row items-center gap-2">
        <TouchableOpacity
          onPress={step === "idle" ? onBack : reset}
          className="w-9 h-9 items-center justify-center -ml-2"
        >
          <ChevronLeft size={24} color="#94a3b8" />
        </TouchableOpacity>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          {t("lock.settingsTitle")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {step !== "idle" ? (
          <View className="items-center pt-6">
            <Text className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{title}</Text>
            <Text className="text-xs text-slate-500 dark:text-slate-300 mb-10">
              {t("lock.stepHint", { count: PIN_LENGTH })}
            </Text>
            <PinPad value={pin} onChange={setPin} error={error} />
            {message !== "" && (
              <Text className="text-xs text-rose-500 mt-6 text-center">{message}</Text>
            )}
          </View>
        ) : (
          <>
            <View
              className="rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
              style={CARD_SHADOW}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-slate-800 items-center justify-center">
                  <Lock size={20} color="#059669" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {t("lock.rowLabel")}
                  </Text>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-300">
                    {enabled ? t("lock.stateOn") : t("lock.stateOff")}
                  </Text>
                </View>
                <Toggle on={enabled} onChange={toggle} />
              </View>
            </View>

            {/* Qué método va a pedir este celular en concreto. Decir
                "huella" en un teléfono que solo tiene reconocimiento facial
                sería mentir. */}
            <View className="flex-row items-center gap-2 mt-5 px-1">
              {kind === "face" ? (
                <ScanFace size={16} color="#64748b" />
              ) : (
                <Fingerprint size={16} color="#64748b" />
              )}
              <Text className="text-xs text-slate-500 dark:text-slate-300 flex-1">
                {kind === "none"
                  ? t("lock.noBiometric")
                  : t(kind === "face" ? "lock.hasFace" : "lock.hasFingerprint")}
              </Text>
            </View>

            {/* El aviso que de verdad importa: qué pasa si se olvida el PIN.
                Cambia según haya copia en la nube o no, porque las
                consecuencias son muy distintas. */}
            <View className="flex-row gap-2 mt-5 rounded-2xl p-3.5 bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700">
              <ShieldAlert size={16} color="#b45309" />
              <Text className="flex-1 text-[11px] text-amber-800 dark:text-amber-300 leading-4">
                {t(isCloudSynced ? "lock.warnWithCloud" : "lock.warnNoCloud")}
              </Text>
            </View>

            <Text className="text-[11px] text-slate-400 mt-5 leading-4">{t("lock.graceNote")}</Text>

            {/* EL PIN SEÑUELO. Solo aparece con el bloqueo ya puesto: sin
                un PIN de verdad no hay nada de lo que ser el señuelo. */}
            {enabled && (
              <>
                <View
                  className="rounded-3xl p-5 mt-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                  style={CARD_SHADOW}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 items-center justify-center">
                      <EyeOff size={20} color="#64748b" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {t("lock.decoyLabel")}
                      </Text>
                      <Text className="text-[11px] text-slate-500 dark:text-slate-300">
                        {hasDecoy ? t("lock.decoyOn") : t("lock.decoyOff")}
                      </Text>
                    </View>
                    <Toggle
                      on={hasDecoy}
                      onChange={(next) => {
                        setMessage("");
                        if (next) {
                          setPin("");
                          setFirstPin("");
                          setStep("decoyCreate");
                        } else {
                          void clearDecoyPin().then(() => setHasDecoy(false));
                        }
                      }}
                    />
                  </View>
                  <Text className="text-[11px] text-slate-500 dark:text-slate-300 leading-4 mt-4">
                    {t("lock.decoyExplain")}
                  </Text>
                </View>

                {/* Los límites, dichos claro. Una función de seguridad que
                    promete más de lo que da es peor que no tenerla: lleva a
                    confiarse justo cuando no hay que confiarse. */}
                <View className="flex-row gap-2 mt-4 rounded-2xl p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <Info size={16} color="#64748b" />
                  <Text className="flex-1 text-[11px] text-slate-600 dark:text-slate-300 leading-4">
                    {t("lock.decoyLimits")}
                  </Text>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
