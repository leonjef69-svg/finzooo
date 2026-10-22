import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Fingerprint, Lock, ScanFace } from "lucide-react-native";
import PinPad from "@/components/PinPad";
import { useAppData } from "@/contexts/AppDataContext";
import { setAppLocked } from "@/utils/lockState";
import { applyLockScreenPrivacy } from "@/utils/screenPrivacy";
import {
  GRACE_MS,
  PIN_LENGTH,
  biometricKind,
  cancelBiometrics,
  usaHuella,
  lockEnabledState,
  subscribeLockConfiguration,
  olvidarSalida,
  pinRetryAfterMs,
  promptBiometrics,
  recordarSalida,
  salioHaceNada,
  verifyPin,
  type BiometricKind,
} from "@/utils/appLock";

// El margen y las dos funciones que lo recuerdan viven en utils/appLock, al
// lado del resto del bloqueo. Aquí solo se usan.

/**
 * Tapa la app entera cuando está bloqueada.
 *
 * Usa un modal nativo sobre la navegación y sus paneles. Si fuera una
 * pantalla, bastaría con el botón de "atrás" de Android para saltársela.
 */
export default function AppLockGate() {
  const { t, ready } = useAppData();
  const insets = useSafeAreaInsets();

  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [lockError, setLockError] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const [locked, setLocked] = useState(false);
  const [kind, setKind] = useState<BiometricKind>("none");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [failures, setFailures] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [method, setMethod] = useState<"biometric" | "pin">("biometric");
  const [authenticating, setAuthenticating] = useState(false);
  const [checkingPin, setCheckingPin] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== "background");
  const offerBiometrics = !lockError && kind !== "none";
  const showPin = !offerBiometrics || method === "pin";

  useEffect(() => {
    if (!locked || !showPin) return;
    let alive = true;
    const refresh = () =>
      pinRetryAfterMs().then((value) =>
        alive && setRetrySeconds(Math.ceil(value / 1000)),
      );
    void refresh();
    const timer = setInterval(refresh, 1000);
    return () => { alive = false; clearInterval(timer); };
  }, [locked, showPin]);

  // Mientras el cuadro de la huella está abierto, Android manda la app a
  // "inactive". Sin esta marca, el propio cuadro contaría como "se fue de la
  // app" y volvería a bloquear en cuanto se cerrara: un bucle del que no se
  // sale.
  const prompting = useRef(false);
  const leftAt = useRef<number | null>(null);
  const lockErrorRef = useRef(false);
  const mounted = useRef(true);
  const authVersion = useRef(0);
  const autoPrompted = useRef(false);
  const verifyingPin = useRef(false);
  const appActive = useRef(AppState.currentState !== "background");
  // Solo en memoria: confirmar el PIN al activarlo ya autentica esta entrada.
  // No sirve al arrancar de nuevo, estando bloqueado o después de salir.
  const activation = useRef<{ at: number } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activation.current = null;
      authVersion.current += 1;
      if (prompting.current) void cancelBiometrics();
    };
  }, []);

  // ¿Está el candado puesto AHORA MISMO? En una "caja" porque lo mira el
  // escuchador de abajo, que se registra una sola vez y si no vería siempre
  // el valor del primer dibujado.
  //
  // Es lo que cierra este agujero: con la app YA bloqueada, salir no debe
  // apuntar nada. Si lo apuntara, cerrar la app desde la pantalla del PIN y
  // volver a abrirla dentro del margen la dejaría entrar sin PIN — justo al
  // revés de para lo que sirve.
  const lockedRef = useRef(false);

  // Al arrancar: si el bloqueo está puesto, se bloquea antes de enseñar nada.
  //
  // SALVO que se acabe de salir. Android mata la app en cuanto se va al fondo
  // en varias marcas —Honor, Huawei, Xiaomi— y entonces volver es abrir desde
  // cero. Sin esta comprobación, la app pedía la huella aunque hubieran pasado
  // veinte segundos, y ese era el motivo de verdad de que molestara cada vez.
  //
  // El margen es el mismo que estando viva: no se afloja nada, solo deja de
  // depender de si Android tuvo a bien no matarla.
  useEffect(() => {
    let alive = true;
    const activationProof = activation.current;
    authVersion.current += 1;
    autoPrompted.current = false;
    setMethod("biometric");
    setPin("");
    setChecked(false);
    (async () => {
      const status = await lockEnabledState();
      if (!alive) return;
      await applyLockScreenPrivacy(status);
      if (!alive) return;
      if (status === "unavailable") {
        lockErrorRef.current = true;
        setLockError(true);
        setEnabled(true);
        setLocked(true);
        setKind("none");
        setPin("");
        setChecked(true);
        return;
      }
      const hadReadError = lockErrorRef.current;
      lockErrorRef.current = false;
      setLockError(false);
      const on = status === "enabled";
      setEnabled(on);
      if (on) {
        const reciente = !hadReadError && await salioHaceNada();
        if (!alive) return;
        const confirmedActivation = !hadReadError && activationProof !== null
          && activation.current === activationProof && appActive.current
          && Date.now() >= activationProof.at && Date.now() - activationProof.at <= GRACE_MS;
        if (activation.current === activationProof) activation.current = null;
        setLocked(!reciente && !confirmedActivation);
        // Si ya no vale, se borra: una marca vieja no tiene por qué quedarse
        // ahí esperando.
        if (!reciente) void olvidarSalida();
        // Ver usaHuella: quien la apagó en Ajustes entra siempre con el PIN.
        const nextKind = (await usaHuella()) ? await biometricKind() : "none";
        if (!alive) return;
        setKind(nextKind);
      } else {
        setLocked(false);
      }
      if (alive) setChecked(true);
    })().catch(() => {
      if (!alive) return;
      lockErrorRef.current = true;
      setLockError(true);
      setEnabled(true);
      setLocked(true);
      setKind("none");
      setPin("");
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, [checkVersion]);

  // Encender o apagar el candado en Ajustes debe surtir efecto en esta misma
  // sesión. Antes se leía una sola vez al montar la app.
  useEffect(() => subscribeLockConfiguration((change) => {
    activation.current = change === "enabled" && !lockedRef.current && !lockErrorRef.current && appActive.current
      ? { at: Date.now() } : null;
    // Se cierran también los paneles nativos; al volver a crearlos React
    // Native copia FLAG_SECURE de la ventana principal. Una comprobación
    // anterior se cancela en la limpieza del efecto, no pisa la nueva.
    authVersion.current += 1;
    autoPrompted.current = false;
    if (prompting.current) void cancelBiometrics();
    setAppLocked(true);
    setChecked(false);
    setCheckVersion((value) => value + 1);
  }), []);

  const askBiometrics = useCallback(async () => {
    if (!ready || !checked || !lockedRef.current || !appActive.current || !offerBiometrics || prompting.current || verifyingPin.current || lockErrorRef.current) return;
    const version = authVersion.current;
    prompting.current = true;
    setAuthenticating(true);
    setMethod("biometric");
    setPin("");
    setError(false);
    try {
      const ok = await promptBiometrics(t("lock.prompt"), t("lock.usePin")).catch(() => false);
      if (!mounted.current || version !== authVersion.current || lockErrorRef.current) return;
      if (ok) {
        setLocked(false);
        setPin("");
        setFailures(0);
      } else {
        // Cancelar, elegir «Usar PIN» o un sensor no disponible muestra
        // directamente la alternativa; no se vuelve a abrir la huella sola.
        setMethod("pin");
      }
    } finally {
      prompting.current = false;
      if (mounted.current) setAuthenticating(false);
    }
  }, [ready, checked, offerBiometrics, t]);

  // Se pide la huella sola en cuanto aparece la pantalla: lo normal es no
  // tener que tocar nada.
  useEffect(() => {
    if (!locked) { autoPrompted.current = false; return; }
    if (ready && checked && foreground && offerBiometrics && !prompting.current && !verifyingPin.current && !autoPrompted.current) {
      autoPrompted.current = true;
      void askBiometrics();
    }
  }, [ready, checked, locked, foreground, offerBiometrics, authenticating, checkingPin, askBiometrics]);

  function usePin() {
    autoPrompted.current = true;
    authVersion.current += 1;
    if (prompting.current) void cancelBiometrics();
    setMethod("pin");
    setPin("");
    setError(false);
  }

  // Entrar y salir de la app
  useEffect(() => {
    // Se escucha también mientras se confirma la primera activación: salir
    // durante esa espera no debe conservar la confirmación de la sesión.
    appActive.current = AppState.currentState !== "background";
    setForeground(appActive.current);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        activation.current = null;
        appActive.current = false;
        setForeground(false);
        if (lockedRef.current && verifyingPin.current) {
          authVersion.current += 1;
          setPin("");
          setError(false);
        }
        if (prompting.current) {
          authVersion.current += 1;
          void cancelBiometrics();
          setMethod("pin");
        }
      } else if (next === "active") {
        appActive.current = true;
        setForeground(true);
      }
      if (!enabled) return;
      if (next === "background" || next === "inactive") {
        if (!lockedRef.current && !prompting.current && leftAt.current === null) {
          leftAt.current = Date.now();
          // Y también en disco, por si Android mata la app antes de volver.
          void recordarSalida();
        }
        return;
      }
      if (next === "active") {
        const since = leftAt.current;
        leftAt.current = null;
        if (!prompting.current && since !== null && Date.now() - since > GRACE_MS) {
          setLocked(true);
          autoPrompted.current = false;
          setMethod("biometric");
          setPin("");
          setError(false);
          // Pasado el margen ya no sirve de nada: borrarlo evita que un
          // arranque posterior lo encuentre y se salte el candado.
          void olvidarSalida();
        }
      }
    });
    return () => sub.remove();
  }, [enabled]);

  // Comprobar el PIN en cuanto se completa: no hace falta botón de aceptar.
  useEffect(() => {
    if (!ready || !checked || !locked || !showPin || authenticating || lockError || pin.length !== PIN_LENGTH || retrySeconds > 0 || verifyingPin.current) return;
    let alive = true;
    const version = authVersion.current;
    verifyingPin.current = true;
    setCheckingPin(true);
    (async () => {
      try {
        const match = await verifyPin(pin);
        const retryAfter = match === "locked" ? await pinRetryAfterMs() : 0;
        if (!alive || version !== authVersion.current) return;

        if (match === "real") {
          setLocked(false);
          setPin("");
          setError(false);
          setFailures(0);
        } else if (match === "locked") {
          setError(true);
          setPin("");
          setFailures((n) => Math.max(5, n + 1));
          setRetrySeconds(Math.ceil(retryAfter / 1000));
        } else {
          setError(true);
          setPin("");
          setFailures((n) => n + 1);
        }
      } catch {
        if (alive && version === authVersion.current) { setPin(""); setError(true); }
      } finally {
        verifyingPin.current = false;
        if (mounted.current) setCheckingPin(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, checked, locked, showPin, authenticating, pin, retrySeconds, lockError]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(false), 500);
    return () => clearTimeout(timer);
  }, [error]);

  // Se avisa al resto de la app de si el candado está puesto. Lo usa la
  // apertura de un estado de cuenta compartido: mientras esto sea cierto no
  // se navega a ningún sitio, porque abrir Importar por debajo del candado
  // solo consigue que la app se lo lleve por delante al desbloquear. Ver
  // utils/lockState.ts.
  useLayoutEffect(() => {
    lockedRef.current = !ready || !checked || locked;
    setAppLocked(!ready || !checked || locked);
  }, [ready, checked, locked]);

  // Mientras se cargan los datos guardados no se dibuja nada: si se pintara
  // la app antes de saber si hay bloqueo, se vería el saldo un instante
  // ANTES de pedir la huella, que es justo lo que hay que evitar.
  if (ready && checked && !locked) return null;

  // La cubierta de seguridad debe aparecer completa, no descubrir datos
  // durante un fundido al abrir/cambiar la cuenta o revisar el candado.
  return (
    <Modal visible key={`${checkVersion}-${checked ? "checked" : "checking"}`} animationType="none" onRequestClose={() => undefined} statusBarTranslucent>
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}>
      {(!ready || !checked) ? (
        <View className="flex-1 items-center justify-center px-6">
          <Lock size={28} color="#059669" />
          <Text className="mt-4 text-center text-base font-bold text-slate-900 dark:text-slate-100">
            {t(checked ? "common.loading" : "lock.checking")}
          </Text>
        </View>
      ) : lockError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Lock size={28} color="#059669" />
          <Text className="mt-4 text-center text-base font-bold text-slate-900 dark:text-slate-100">
            {t("lock.readError")}
          </Text>
          <TouchableOpacity onPress={() => setCheckVersion((value) => value + 1)} className="mt-5 px-5 py-3 rounded-2xl bg-emerald-600">
            <Text className="text-sm font-bold text-white">{t("lock.retryCheck")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 20,
        }}
      >
      <View className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-noche-2 items-center justify-center mb-4">
        <Lock size={28} color="#059669" />
      </View>
      <Text className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mb-1">
        {t("lock.title")}
      </Text>
      <Text className="text-xs text-slate-500 dark:text-slate-300 mb-6 text-center">
        {t(showPin ? "lock.subtitlePin" : kind === "face" ? "lock.subtitleFace" : "lock.subtitleBiometric")}
      </Text>

      {showPin ? (
      <PinPad
        deleteLabel={t("lock.eraseDigit")}
        biometricLabel={t(kind === "face" ? "lock.retryFace" : "lock.retryFingerprint")}
        value={pin}
        onChange={(value) => {
          if (retrySeconds === 0 && !verifyingPin.current && !prompting.current) { setError(false); setPin(value); }
        }}
        disabled={retrySeconds > 0 || checkingPin || authenticating}
        biometricDisabled={checkingPin || authenticating}
        error={error}
        biometric={offerBiometrics ? kind : "none"}
        onBiometric={() => void askBiometrics()}
      />
      ) : (
        <View className="w-full items-center" style={{ maxWidth: 300 }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t(kind === "face" ? "lock.retryFace" : "lock.retryFingerprint")} disabled={authenticating}
            onPress={() => void askBiometrics()}
            className="w-full rounded-2xl bg-emerald-600 py-5 items-center gap-2">
            {kind === "face" ? <ScanFace size={32} color="#ffffff" /> : <Fingerprint size={32} color="#ffffff" />}
            <Text className="text-sm font-bold text-white">{t(kind === "face" ? "lock.retryFace" : "lock.retryFingerprint")}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={usePin} className="mt-3 px-6 py-3">
            <Text className="text-sm font-bold text-emerald-600">{t("lock.usePin")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showPin && retrySeconds > 0 && (
        <Text className="mt-4 text-center text-xs font-bold text-rose-500">
          {t("lock.retryIn", { seconds: retrySeconds })}
        </Text>
      )}

      {/* Solo después de varios intentos. Antes de eso, sugerir que se
          reinstale la app asusta más de lo que ayuda: lo normal es haberse
          equivocado al teclear. */}
      {showPin && failures >= 3 && (
        <Text className="text-[11px] text-slate-400 text-center mt-6 leading-4 px-4">
          {t("lock.forgot")}
        </Text>
      )}

      </ScrollView>
      )}
    </View>
    </Modal>
  );
}
