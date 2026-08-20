import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, EyeOff, Fingerprint, Info, Lock, ScanFace } from "lucide-react-native";
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
  usaHuella,
  guardarUsaHuella,
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
  /**
   * ¿SE USA LA HUELLA, O SE ENTRA SIEMPRE CON EL PIN? (19/08/2026)
   *
   * Antes no se preguntaba: si el celular tenía huella, se usaba, y la pantalla se llamaba
   * "Bloqueo con huella" aunque lo primero que hacía era pedir un PIN. Él lo cortó: *"te
   * falta la opción PIN, tienes que agregarle un botón; no es que automáticamente seleccione
   * huella y a fuerza tenga que poner un código PIN"*.
   *
   * **El PIN se sigue creando siempre, y hay que decir por qué**: una huella falla —dedo
   * mojado, funda, sensor rayado— y sin nada detrás uno se queda fuera de su propio dinero.
   * Lo que sí se elige es si además se usa la huella. Eso es este interruptor.
   */
  const [conHuella, setConHuella] = useState(true);
  const [verAyuda, setVerAyuda] = useState(false);
  const [kind, setKind] = useState<BiometricKind>("none");
  const [step, setStep] = useState<Step>("idle");
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [on, biometric, decoy, huella] = await Promise.all([
        isLockEnabled(),
        biometricKind(),
        hasDecoyPin(),
        usaHuella(),
      ]);
      if (!alive) return;
      setEnabled(on);
      setKind(biometric);
      setHasDecoy(decoy);
      setConHuella(huella);
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
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top }}>
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
              className="rounded-3xl p-5 bg-white dark:bg-noche border-[1.5px] border-slate-200 dark:border-noche-borde"
              style={CARD_SHADOW}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-noche-2 items-center justify-center">
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

              {/* LA HUELLA, COMO UNA ELECCIÓN Y NO COMO UN HECHO.
                  Solo aparece con el candado puesto y en un celular que la tenga: en uno que
                  no, sería un interruptor que no puede hacer nada. */}
              {enabled && kind !== "none" && (
                <View className="flex-row items-center gap-3 mt-4 pt-4 border-t-[1.5px] border-slate-100 dark:border-noche-borde">
                  <View className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-noche-2 items-center justify-center">
                    {kind === "face" ? (
                      <ScanFace size={20} color="#64748b" />
                    ) : (
                      <Fingerprint size={20} color="#64748b" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {t(kind === "face" ? "lock.usarCara" : "lock.usarHuella")}
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-300">
                      {t(conHuella ? "lock.huellaOn" : "lock.huellaOff")}
                    </Text>
                  </View>
                  <Toggle
                    on={conHuella}
                    onChange={(v) => {
                      setConHuella(v);
                      guardarUsaHuella(v);
                    }}
                  />
                </View>
              )}

            {/* EL PIN SEÑUELO, EN LA MISMA TARJETA. Solo con el bloqueo puesto: sin un PIN
                de verdad no hay nada de lo que ser el señuelo. */}
            {enabled && (
              <View className="flex-row items-center gap-3 mt-4 pt-4 border-t-[1.5px] border-slate-100 dark:border-noche-borde">
                <View className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-noche-2 items-center justify-center">
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
            )}
          </View>

          {/* LOS CINCO PÁRRAFOS, DETRÁS DE UN TOQUE (19/08/2026)
              La pantalla tenía tres interruptores y **cinco bloques de texto**: qué método
              usa el celular, qué pasa si se olvida el PIN, cuándo se bloquea la app, qué es
              el señuelo y qué no cubre. Todo cierto y todo de leer una vez.

              Él lo cortó: *"mucho texto, no quiero que haya cosas innecesarias"*. Y uno de
              esos párrafos además se contradecía con el interruptor de arriba — decía "este
              celular desbloqueará con tu huella" con la huella apagada.

              No se borra ninguno: un candado que promete más de lo que da es peor que no
              tenerlo, y los límites del señuelo hay que decirlos. Se leen aquí dentro. */}
          <TouchableOpacity
            onPress={() => setVerAyuda((v) => !v)}
            className="flex-row items-center gap-2.5 py-4 mt-1"
          >
            <Info size={17} color="#64748b" />
            <Text className="flex-1 text-[13px] text-slate-500 dark:text-slate-300">
              {t("lock.comoFunciona")}
            </Text>
            <ChevronRight size={16} color="#94a3b8" />
          </TouchableOpacity>

          {verAyuda && (
            <View className="rounded-2xl p-4 bg-slate-50 dark:bg-noche-2">
              <Ayuda texto={t(isCloudSynced ? "lock.warnWithCloud" : "lock.warnNoCloud")} />
              <Ayuda texto={t("lock.graceNote")} />
              <Ayuda
                texto={t(
                  kind === "none"
                    ? "lock.noBiometric"
                    : kind === "face"
                      ? "lock.hasFace"
                      : "lock.hasFingerprint"
                )}
              />
              {enabled && <Ayuda texto={t("lock.decoyExplain")} />}
              {enabled && <Ayuda texto={t("lock.decoyLimits")} />}
            </View>
          )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Un párrafo de la ayuda. Uno solo para que los cinco midan y separen igual. */
function Ayuda({ texto }: { texto: string }) {
  return (
    <Text className="text-[12px] leading-5 text-slate-600 dark:text-slate-300 mb-3 last:mb-0">
      {texto}
    </Text>
  );
}
