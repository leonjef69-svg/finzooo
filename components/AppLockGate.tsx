import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Lock } from "lucide-react-native";
import PinPad from "@/components/PinPad";
import { useAppData } from "@/contexts/AppDataContext";
import { setAppLocked } from "@/utils/lockState";
import { applyLockScreenPrivacy } from "@/utils/screenPrivacy";
import {
  GRACE_MS,
  PIN_LENGTH,
  biometricKind,
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

  useEffect(() => {
    if (!locked) return;
    const refresh = () =>
      pinRetryAfterMs().then((value) =>
        setRetrySeconds(Math.ceil(value / 1000)),
      );
    void refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [locked]);

  // Mientras el cuadro de la huella está abierto, Android manda la app a
  // "inactive". Sin esta marca, el propio cuadro contaría como "se fue de la
  // app" y volvería a bloquear en cuanto se cerrara: un bucle del que no se
  // sale.
  const prompting = useRef(false);
  const leftAt = useRef<number | null>(null);
  const lockErrorRef = useRef(false);

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
        setLocked(!reciente);
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
  useEffect(() => subscribeLockConfiguration(() => {
    // Se cierran también los paneles nativos; al volver a crearlos React
    // Native copia FLAG_SECURE de la ventana principal. Una comprobación
    // anterior se cancela en la limpieza del efecto, no pisa la nueva.
    setAppLocked(true);
    setChecked(false);
    setCheckVersion((value) => value + 1);
  }), []);

  const offerBiometrics = !lockError && kind !== "none";

  const askBiometrics = useCallback(async () => {
    if (!offerBiometrics || prompting.current || lockErrorRef.current) return;
    prompting.current = true;
    const ok = await promptBiometrics(t("lock.prompt"), t("lock.usePin"));
    prompting.current = false;
    if (ok && !lockErrorRef.current) {
      setLocked(false);
      setPin("");
      setFailures(0);
    }
  }, [offerBiometrics, t]);

  // Se pide la huella sola en cuanto aparece la pantalla: lo normal es no
  // tener que tocar nada.
  useEffect(() => {
    if (locked && offerBiometrics) void askBiometrics();
  }, [locked, offerBiometrics, askBiometrics]);

  // Entrar y salir de la app
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (next) => {
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
    if (lockError || pin.length !== PIN_LENGTH || retrySeconds > 0) return;
    let alive = true;
    (async () => {
      const match = await verifyPin(pin);
      if (!alive) return;

      if (match === "real") {
        setLocked(false);
        setPin("");
        setError(false);
        setFailures(0);
      } else if (match === "locked") {
        setError(true);
        setFailures((n) => Math.max(5, n + 1));
        setRetrySeconds(Math.ceil((await pinRetryAfterMs()) / 1000));
        setTimeout(() => {
          if (!alive) return;
          setPin("");
          setError(false);
        }, 500);
      } else {
        setError(true);
        setFailures((n) => n + 1);
        // Se borra solo tras el temblor, para que dé tiempo a verlo.
        setTimeout(() => {
          if (!alive) return;
          setPin("");
          setError(false);
        }, 500);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pin, retrySeconds, lockError]);

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

  return (
    <Modal visible key={`${checkVersion}-${checked ? "checked" : "checking"}`} animationType="fade" onRequestClose={() => undefined} statusBarTranslucent>
    <View className="flex-1 bg-white dark:bg-noche" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}>
      {(!ready || !checked) ? (
        <View className="flex-1 items-center justify-center px-6">
          <Lock size={28} color="#059669" />
          <Text className="mt-4 text-center text-base font-bold text-slate-900 dark:text-slate-100">
            {t("lock.checking")}
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
      <Text className="text-xs text-slate-500 dark:text-slate-300 mb-10 text-center">
        {t(offerBiometrics ? "lock.subtitleBiometric" : "lock.subtitlePin")}
      </Text>

      <PinPad
        deleteLabel={t("lock.eraseDigit")}
        biometricLabel={t(kind === "face" ? "lock.retryFace" : "lock.retryFingerprint")}
        value={pin}
        onChange={(value) => retrySeconds === 0 && setPin(value)}
        error={error}
        biometric={offerBiometrics ? kind : "none"}
        onBiometric={() => void askBiometrics()}
      />

      {retrySeconds > 0 && (
        <Text className="mt-4 text-center text-xs font-bold text-rose-500">
          {t("lock.retryIn", { seconds: retrySeconds })}
        </Text>
      )}

      {/* Solo después de varios intentos. Antes de eso, sugerir que se
          reinstale la app asusta más de lo que ayuda: lo normal es haberse
          equivocado al teclear. */}
      {failures >= 3 && (
        <Text className="text-[11px] text-slate-400 text-center mt-6 leading-4 px-4">
          {t("lock.forgot")}
        </Text>
      )}

      {offerBiometrics && (
        <TouchableOpacity onPress={() => void askBiometrics()} className="mt-6 px-4 py-2">
          <Text className="text-xs font-bold text-emerald-600">
            {t(kind === "face" ? "lock.retryFace" : "lock.retryFingerprint")}
          </Text>
        </TouchableOpacity>
      )}
      </ScrollView>
      )}
    </View>
    </Modal>
  );
}
