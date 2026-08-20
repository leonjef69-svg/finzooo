import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Lock } from "lucide-react-native";
import PinPad from "@/components/PinPad";
import { useAppData } from "@/contexts/AppDataContext";
import { isDecoyActive } from "@/utils/decoyMode";
import { setAppLocked } from "@/utils/lockState";
import {
  GRACE_MS,
  PIN_LENGTH,
  biometricKind,
  isLockEnabled,
  olvidarSalida,
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
 * Va DENTRO de la vista raíz y encima de todo (incluidos los paneles
 * modales), no como una pantalla más de navegación. Si fuera una pantalla,
 * bastaría con el botón de "atrás" de Android para saltársela.
 */
export default function AppLockGate() {
  const { t, ready, enterDecoyMode, leaveDecoyMode } = useAppData();
  const insets = useSafeAreaInsets();

  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [kind, setKind] = useState<BiometricKind>("none");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [failures, setFailures] = useState(0);

  // Mientras el cuadro de la huella está abierto, Android manda la app a
  // "inactive". Sin esta marca, el propio cuadro contaría como "se fue de la
  // app" y volvería a bloquear en cuanto se cerrara: un bucle del que no se
  // sale.
  const prompting = useRef(false);
  const leftAt = useRef<number | null>(null);

  // ¿Está el candado puesto AHORA MISMO? En una "caja" porque lo mira el
  // escuchador de abajo, que se registra una sola vez y si no vería siempre
  // el valor del primer dibujado.
  //
  // Es lo que cierra este agujero: con la app YA bloqueada, salir no debe
  // apuntar nada. Si lo apuntara, cerrar la app desde la pantalla del PIN y
  // volver a abrirla dentro del margen la dejaría entrar sin PIN — justo al
  // revés de para lo que sirve.
  const lockedRef = useRef(false);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

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
    (async () => {
      const on = await isLockEnabled();
      if (!alive) return;
      setEnabled(on);
      if (on) {
        const reciente = await salioHaceNada();
        if (!alive) return;
        setLocked(!reciente);
        // Si ya no vale, se borra: una marca vieja no tiene por qué quedarse
        // ahí esperando.
        if (!reciente) void olvidarSalida();
        setKind(await biometricKind());
      } else {
        setLocked(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ESTANDO EN EL SEÑUELO NO SE OFRECE LA HUELLA.
  //
  // El caso: alguien obliga a abrir la app, se escribe el PIN señuelo, y
  // deja el teléfono un rato. La app se rebloquea. Si entonces apareciera el
  // cuadro de la huella, bastaría con "pon el dedo" para que se abriera la
  // cuenta DE VERDAD delante de quien esté mirando — y toda esta función no
  // habría servido de nada.
  //
  // Dentro del señuelo solo se puede entrar con PIN. Y no se nota, porque en
  // un celular sin huella registrada la pantalla se ve exactamente así.
  const inDecoy = isDecoyActive();
  const offerBiometrics = kind !== "none" && !inDecoy;

  const askBiometrics = useCallback(async () => {
    if (!offerBiometrics || prompting.current) return;
    prompting.current = true;
    const ok = await promptBiometrics(t("lock.prompt"), t("lock.usePin"));
    prompting.current = false;
    if (ok) {
      // La huella es del dueño, así que abre la cuenta real.
      await leaveDecoyMode();
      setLocked(false);
      setPin("");
      setFailures(0);
    }
  }, [offerBiometrics, t, leaveDecoyMode]);

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
    if (pin.length !== PIN_LENGTH) return;
    let alive = true;
    (async () => {
      const match = await verifyPin(pin);
      if (!alive) return;

      // El PIN señuelo abre la cuenta falsa. Desde fuera se ve EXACTAMENTE
      // igual que abrir la de verdad: mismo tiempo, misma animación, ningún
      // aviso. Cualquier diferencia —un parpadeo distinto, un mensaje, un
      // segundo de más— delataría que este PIN no es el bueno.
      if (match === "decoy") {
        await enterDecoyMode();
        if (!alive) return;
        setLocked(false);
        setPin("");
        setError(false);
        setFailures(0);
        return;
      }

      if (match === "real") {
        // Si se venía del señuelo (la app se bloqueó estando dentro), hay
        // que volver a la cuenta real antes de destapar la pantalla.
        await leaveDecoyMode();
        if (!alive) return;
        setLocked(false);
        setPin("");
        setError(false);
        setFailures(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // Se avisa al resto de la app de si el candado está puesto. Lo usa la
  // apertura de un estado de cuenta compartido: mientras esto sea cierto no
  // se navega a ningún sitio, porque abrir Importar por debajo del candado
  // solo consigue que la app se lo lleve por delante al desbloquear. Ver
  // utils/lockState.ts.
  setAppLocked(ready && locked);

  // Mientras se cargan los datos guardados no se dibuja nada: si se pintara
  // la app antes de saber si hay bloqueo, se vería el saldo un instante
  // ANTES de pedir la huella, que es justo lo que hay que evitar.
  if (!ready || !locked) return null;

  return (
    <View
      className="absolute inset-0 z-50 bg-white dark:bg-noche items-center justify-center px-6"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}
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
        value={pin}
        onChange={setPin}
        error={error}
        biometric={offerBiometrics ? kind : "none"}
        onBiometric={() => void askBiometrics()}
      />

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
    </View>
  );
}
