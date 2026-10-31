import { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronLeft, ChevronRight, Fingerprint, Info, Lock, ScanFace, X } from "lucide-react-native";
import PinPad from "@/components/PinPad";
import Toggle from "@/components/Toggle";
import { useAppData } from "@/contexts/AppDataContext";
import {
  PIN_LENGTH,
  biometricKind,
  disableLock,
  enableLock,
  isLockEnabled,
  usaHuella,
  guardarUsaHuella,
  verifyPin,
  type BiometricKind,
} from "@/utils/appLock";

type Step =
  | "idle" // viendo el interruptor
  | "create" // eligiendo un PIN nuevo
  | "confirm" // repitiéndolo
  | "verify"; // comprobando el actual para poder apagarlo

export default function AppLockSettings({ onBack, allowEnable = true }: { onBack: () => void; allowEnable?: boolean }) {
  const { t, isCloudSynced } = useAppData();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [enabled, setEnabled] = useState(false);
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
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const leaving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [on, biometric, huella] = await Promise.all([
        isLockEnabled(),
        biometricKind(),
        usaHuella(),
      ]);
      if (!alive) return;
      setEnabled(on);
      setKind(biometric);
      setConHuella(huella);
      setLoaded(true);
    })().catch(() => {
      if (alive) setMessage(t("lock.readError"));
    });
    return () => {
      alive = false;
    };
    // Solo lectura al abrir; cambiar de idioma no vuelve a pedir el PIN.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    if (saving.current) return;
    setStep("idle");
    setPin("");
    setFirstPin("");
    setError(false);
    setMessage("");
  }

  function closePanel() {
    if (saving.current || leaving.current) return;
    leaving.current = true;
    setPin("");
    setFirstPin("");
    try { onBack(); } catch { leaving.current = false; }
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (saving.current) return true;
      if (step !== "idle") { reset(); return true; }
      closePanel();
      return true;
    });
    return () => subscription.remove();
    // El cierre siempre vuelve al mismo Ajustes que abrió el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, onBack]);

  // Todo el flujo pasa por aquí: se dispara al completar las cuatro cifras.
  useEffect(() => {
    if (pin.length !== PIN_LENGTH || step === "idle" || saving.current) return;
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
        saving.current = true;
        setBusy(true);
        let ok = false;
        try { ok = await enableLock(pin); }
        finally { saving.current = false; if (alive) setBusy(false); }
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

      if (step === "verify") {
        saving.current = true;
        setBusy(true);
        let ok;
        try { ok = await verifyPin(pin); }
        catch { ok = null; }
        if (!alive) return;
        if (ok === "real") {
          let disabled = false;
          try { disabled = await disableLock(); }
          finally { saving.current = false; if (alive) setBusy(false); }
          if (!alive) return;
          if (disabled) {
            setEnabled(false);
            setMessage("");
            reset();
          } else {
            setError(true);
            setMessage(t("lock.saveFailed"));
            setPin("");
          }
        } else {
          saving.current = false;
          setBusy(false);
          setError(true);
          setTimeout(() => {
            if (!alive) return;
            setPin("");
            setError(false);
          }, 500);
        }
      }
    })().catch(() => {
      saving.current = false;
      if (alive) { setBusy(false); setError(true); setMessage(t("lock.saveFailed")); setPin(""); }
    });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, step, firstPin]);

  function toggle(next: boolean) {
    if (!loaded || saving.current || leaving.current) return;
    setMessage("");
    if (next && !allowEnable) return;
    // Para apagarlo hay que saber el PIN. Si no, cualquiera que agarre el
    // teléfono desbloqueado podría quitar el candado desde aquí, y el
    // candado no habría servido de nada.
    setStep(next ? "create" : "verify");
    setPin("");
    setFirstPin("");
  }

  const title =
    step === "create"
      ? t(conHuella && kind !== "none" ? "lock.backupCreate" : "lock.stepCreate")
      : step === "confirm"
        ? t("lock.stepConfirm")
        : step === "verify"
          ? t("lock.stepVerify")
          : "";

  return (
    <View className="flex-1 justify-end bg-black/45" style={{ paddingTop: insets.top + 24 }} accessibilityViewIsModal>
      <Pressable testID="app-lock-settings-backdrop" accessibilityRole="button" accessibilityLabel={t("common.close")}
        disabled={busy} onPress={closePanel} className="absolute inset-0" />
      <View testID="app-lock-settings-sheet" className="rounded-t-[28px] bg-white dark:bg-noche-panel px-5 pt-2"
        style={{ maxHeight: height - insets.top - 24, paddingBottom: Math.max(insets.bottom, 12) + 8 }}>
      <View className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600 self-center my-2" />
      <View className="pb-2 flex-row items-center justify-between gap-2">
        <Text accessibilityRole="header" className="flex-1 text-lg font-extrabold text-slate-900 dark:text-slate-100">
          {t("lock.settingsTitle")}
        </Text>
        <TouchableOpacity testID="app-lock-settings-close" accessibilityRole="button" accessibilityLabel={t("common.close")}
          disabled={busy} onPress={closePanel} className="h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-noche-2">
          <X size={19} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 4 }}>
        {step !== "idle" && <TouchableOpacity testID="app-lock-settings-cancel" accessibilityRole="button" accessibilityLabel={t("common.cancel")}
          disabled={busy} onPress={reset} className="min-h-11 self-start flex-row items-center gap-1 mb-2">
          <ChevronLeft size={17} color="#059669" /><Text className="text-sm font-bold text-emerald-600 dark:text-emerald-300">{t("common.cancel")}</Text>
        </TouchableOpacity>}
        {step !== "idle" ? (
          <View className="items-center pb-3">
            <Text className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{title}</Text>
            <Text className="text-xs text-slate-500 dark:text-slate-300 mb-5">
              {t(conHuella && kind !== "none" && step !== "verify" ? "lock.backupHint" : "lock.stepHint", { count: PIN_LENGTH })}
            </Text>
            <PinPad value={pin} onChange={(value) => { if (!saving.current) setPin(value); }} disabled={busy} error={error} deleteLabel={t("lock.eraseDigit")} biometricLabel={t(kind === "face" ? "lock.retryFace" : "lock.retryFingerprint")} />
            {busy && <Text accessibilityLiveRegion="polite" className="text-xs text-slate-500 mt-3 dark:text-slate-300">{t("common.loading")}</Text>}
            {message !== "" && (
              <Text className="text-xs text-rose-500 mt-6 text-center dark:text-rose-300">{message}</Text>
            )}
          </View>
        ) : (
          <>
            <View
              className="rounded-2xl p-3 bg-slate-50 dark:bg-noche-2"
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
                    {!loaded ? t("common.loading") : enabled ? t(conHuella && kind !== "none" ? kind === "face" ? "lock.primaryFace" : "lock.primaryBiometric" : "lock.primaryPin") : t("lock.stateOff")}
                  </Text>
                </View>
                <Toggle label={t("lock.rowLabel")} on={enabled} onChange={toggle} disabled={!loaded || busy} />
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
                    label={t(kind === "face" ? "lock.usarCara" : "lock.usarHuella")}
                    on={conHuella}
                    disabled={busy}
                    onChange={async (v) => {
                      if (saving.current || leaving.current) return;
                      saving.current = true;
                      setBusy(true);
                      try { await guardarUsaHuella(v); if (mounted.current) setConHuella(v); }
                      catch { if (mounted.current) setMessage(t("lock.saveFailed")); }
                      finally { saving.current = false; if (mounted.current) setBusy(false); }
                    }}
                  />
                </View>
              )}
          </View>
          {loaded && kind === "none" && <Text className="mt-3 px-1 text-[11px] text-slate-500 dark:text-slate-300">
            {t("lock.biometricUnavailable")}
          </Text>}
          {message !== "" && <Text className="mt-3 text-xs text-rose-500 dark:text-rose-300">{message}</Text>}

          {/* LOS CINCO PÁRRAFOS, DETRÁS DE UN TOQUE (19/08/2026)
              La pantalla tenía varios bloques de texto sobre el método, la recuperación
              del PIN y cuándo se bloquea la app. Todo cierto y todo de leer una vez.

              Él lo cortó: *"mucho texto, no quiero que haya cosas innecesarias"*. Y uno de
              esos párrafos además se contradecía con el interruptor de arriba — decía "este
              celular desbloqueará con tu huella" con la huella apagada.

              La explicación completa se conserva dentro de esta ayuda. */}
          <TouchableOpacity
            onPress={() => setVerAyuda((v) => !v)}
            accessibilityRole="button" accessibilityLabel={t("lock.comoFunciona")} accessibilityState={{ expanded: verAyuda }}
            className="flex-row items-center gap-2.5 min-h-11 py-3 mt-1"
          >
            <Info size={17} color="#64748b" />
            <Text className="flex-1 text-[13px] text-slate-500 dark:text-slate-300">
              {t("lock.comoFunciona")}
            </Text>
            {verAyuda ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronRight size={16} color="#94a3b8" />}
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
            </View>
          )}
          </>
        )}
      </ScrollView>
      </View>
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
