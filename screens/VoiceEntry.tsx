import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Mic, MicOff, Check, RotateCcw, X, ArrowUpRight, ArrowDownRight } from "lucide-react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useAppData } from "@/contexts/AppDataContext";
import { type VoiceFailure } from "@/utils/voiceParser";
import { parseVoiceCommand } from "@/utils/voiceCommand";
import { suggestCategory } from "@/utils/classifier";
import CategoryAvatar from "@/components/CategoryAvatar";
import { catInfo } from "@/constants/categories";
import { nextId } from "@/utils/id";
import { horaDe } from "@/utils/format";
import { CARD_SHADOW } from "@/constants/style";
import type { RawRow } from "@/utils/importEngine";
import type { Transaction } from "@/types";

// El idioma que se le pide al reconocedor. Si se le pasa el idioma
// equivocado entiende cualquier cosa, así que sigue al de la app.
const LOCALES: Record<string, string> = {
  es: "es-PE",
  en: "en-US",
  pt: "pt-BR",
};

// Si el celular no tiene instalado el idioma exacto, se prueban estos por
// orden. "es-PE" no viene de fábrica en todos los celulares; "es-ES" y "es"
// sí, y entienden igual de bien para lo que hace falta aquí.
const LOCALE_FALLBACKS: Record<string, string[]> = {
  "es-PE": ["es-PE", "es-ES", "es-419", "es"],
  "en-US": ["en-US", "en"],
  "pt-BR": ["pt-BR", "pt-PT", "pt"],
};

/**
 * CUÁNTO SILENCIO SE ESPERA ANTES DE DAR EL DICTADO POR TERMINADO.
 *
 * Ahora el micrófono no se cierra solo (ver ESCUCHA_SEGUIDA), así que este reloj es
 * quien lo cierra. Se rearma con cada palabra que llega, o sea que solo salta cuando
 * de verdad se dejó de hablar.
 *
 * Cuatro segundos porque entre "10 de mandarina" y lo siguiente uno piensa, y eso es
 * lo normal cuando se dictan varias compras, no la excepción. Con 2,5 se quedaba corto
 * (ya se probó). Y quien no quiera esperar tiene el botón de "Listo".
 */
const SILENCIO_MS = 4000;

/**
 * Cuánto se espera al principio si no se oye ABSOLUTAMENTE nada.
 *
 * Sin este, un micrófono abierto en el que nadie habla se quedaría abierto para
 * siempre: el reloj de arriba solo se arma cuando llega la primera palabra.
 */
const ESPERA_PRIMERA_PALABRA_MS = 8000;

type Stage =
  | "listening" // el micrófono está abierto
  | "confirm" // se entendió: falta que la persona apruebe
  | "summary" // se pidió un resumen del mes
  | "topMonth" // "¿en qué mes gasté más?"
  | "compare" // "compara junio con mayo"
  | "failed" // se escuchó algo pero no se entendió
  | "denied"; // no dio permiso al micrófono

type Kind = "expense" | "income";

export default function VoiceEntry({ onClose }: { onClose: () => void }) {
  const { t, fmt, userLanguage, monthNames, transactions, merchantLearned, addOrUpdateTransaction, showToast } =
    useAppData();
  const insets = useSafeAreaInsets();

  const [stage, setStage] = useState<Stage>("listening");
  // Mes del que se pidió el resumen ("AAAA-MM") y si se pidió de lo que
  // salió, de lo que entró, o de todo.
  const [summaryMk, setSummaryMk] = useState("");
  const [summaryFocus, setSummaryFocus] = useState<"expense" | "income" | "all">("all");
  // Categoría pedida ("solo comida"), o vacío para todas.
  const [summaryCategory, setSummaryCategory] = useState("");
  // Día concreto si se preguntó por uno ("gastos de 28 de julio"), o 0 para
  // el mes entero.
  const [summaryDay, setSummaryDay] = useState(0);
  // Si la persona dijo si era gasto o ingreso, no se le vuelve a preguntar.
  const [typeSaid, setTypeSaid] = useState(false);
  // "¿En qué mes gasté más?": de qué se pregunta y si se quiere el mayor o
  // el menor.
  const [topFocus, setTopFocus] = useState<"expense" | "income">("expense");
  const [topDirection, setTopDirection] = useState<"most" | "least">("most");
  // "Compara junio con mayo": los dos meses, en el orden en que se dijeron.
  const [compareMonths, setCompareMonths] = useState<[string, string]>(["", ""]);
  const [compareFocus, setCompareFocus] = useState<"expense" | "income" | "all">("all");
  const [heard, setHeard] = useState("");
  const [failure, setFailure] = useState<VoiceFailure>("empty");
  // Lo que dijo Android cuando falló. Antes se tiraba y todo se mostraba
  // como "no escuché nada", que es justo lo que impedía saber si el
  // problema era el idioma, la red, el permiso o de verdad el silencio.
  const [errorCode, setErrorCode] = useState("");

  // Idiomas a probar, en orden. Si el reconocedor del celular no tiene el
  // primero instalado, cae al siguiente en vez de fallar sin más.
  const langs = LOCALES[userLanguage] ?? "es-PE";
  const langChain = useRef<string[]>([]);
  // Una frase puede traer varios movimientos ("10 en hamburguesa y 20 en
  // gaseosa"), así que siempre se trabaja con una lista, aunque casi
  // siempre tenga uno solo.
  const [rows, setRows] = useState<RawRow[]>([]);
  const [kinds, setKinds] = useState<Kind[]>([]);

  // Marca que esta escucha ya terminó de procesarse. Hace falta porque
  // Android manda el resultado final y DESPUÉS el aviso de "terminé": sin
  // esto, la frase se procesaría dos veces.
  const settled = useRef(false);
  // Lo último que se alcanzó a escuchar. Va en una "caja" además del estado
  // porque el aviso de "terminé" de Android puede llegar con la copia vieja
  // del texto, y entonces se perdería justo la frase que la persona dijo.
  const heardRef = useRef("");

  /**
   * LO DICHO, POR TROZOS. AQUÍ ESTABA EL FALLO GORDO DEL MICRÓFONO.
   *
   * Pedido el 07/08/2026: *"no está registrando correctamente los ingresos y gastos
   * cuando hablo rápido... le digo varias cosas, por ejemplo gasté 10 salchipapa, 10
   * mandarina, 10 tenedor, 10 papel, 10 cuchara"*.
   *
   * El intérprete de texto entiende esa frase perfectamente y saca los cinco
   * movimientos. El problema era que **esa frase nunca le llegaba completa**.
   *
   * Android no manda lo dicho de una sola vez: lo va cerrando POR TROZOS. Cuando
   * decide que un trozo terminó, lo manda con la marca de "final" y **empieza el
   * siguiente desde cero**. Se leyó su código para confirmarlo
   * (ExpoSpeechService.kt, onSegmentResults: manda "isFinal: true" y NO se detiene).
   *
   * Y esta pantalla hacía dos cosas que juntas tiraban casi todo:
   *
   *  1. Cada trozo nuevo **reemplazaba** al anterior en vez de sumarse. De "gasté 10
   *     salchipapa / 10 mandarina / 10 tenedor" solo quedaba el último.
   *  2. Al primer trozo marcado como "final" se cerraba la escucha y se procesaba.
   *     O sea que lo demás no solo se perdía: ni se llegaba a escuchar.
   *
   * Eso explica exactamente los dos síntomas. Hablando rápido, Android corta el primer
   * trozo antes de que uno acabe la lista; y al dictar varias cosas, cada una tapaba a
   * la anterior.
   *
   * Ahora se guardan TODOS los trozos cerrados aquí, y aparte lo que se está diciendo
   * en este momento. Lo que se muestra en pantalla y lo que se interpreta es la suma.
   */
  const trozos = useRef<string[]>([]);
  const enCurso = useRef("");

  /** Todo lo dicho hasta ahora: los trozos cerrados más lo que va en curso. */
  function todoLoDicho(): string {
    return [...trozos.current, enCurso.current].join(" ").replace(/\s+/g, " ").trim();
  }

  // El reloj que cierra el dictado cuando se dejó de hablar. Ver SILENCIO_MS.
  const relojCierre = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * ¿Se está usando la escucha seguida?
   *
   * Es la que no se cierra en el primer trozo, y sin ella nada de lo de arriba sirve.
   * Se guarda en una caja porque si el celular no puede con ella —hay formas de fallar
   * que no se pueden prever desde acá— se vuelve a intentar a la antigua, y así el
   * micrófono nunca queda peor que antes de este cambio. Ver el manejo de errores.
   */
  const escuchaSeguida = useRef(true);

  // Número de la escucha actual.
  //
  // Android avisa de que una escucha terminó CON RETRASO. Al abrir una
  // nueva se cierra la anterior, y ese aviso tardío llegaba cuando la nueva
  // ya había empezado — matándola al instante, con la persona hablando.
  // Ahora cada escucha lleva su número y los avisos que traen uno viejo se
  // ignoran.
  const runId = useRef(0);
  const activeRun = useRef(-1);
  // ¿Hay una escucha abierta AHORA?
  //
  // Sin esto se cerraba "por si acaso" antes de cada apertura, incluso la
  // primera, cuando no había nada que cerrar. Android respondía a ese
  // cierre inútil con un error, ese error llegaba un instante después y la
  // pantalla lo tomaba por un fallo del micrófono — mostrando "no escuché
  // nada" mientras el micrófono, de hecho, acababa de abrirse.
  //
  // Por eso al tocar "Repetir" sí funcionaba: ahí sí había una escucha
  // viva, el cierre era legítimo y no generaba ese error.
  const running = useRef(false);

  // ---- Animaciones ----
  //
  // Entrada del panel: crece desde un poco más chico hasta su tamaño, con
  // un rebote suave. Es la diferencia entre "apareció algo de golpe" y
  // "se abrió algo" — la segunda se siente como parte de un gesto y no
  // como un salto de pantalla.
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  // El micrófono entra aparte y con más rebote, un pelín después que el
  // panel. Así el ojo va primero al panel y después al micrófono, que es
  // lo que hay que mirar.
  const micPop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== "listening") return;
    micPop.setValue(0);
    Animated.spring(micPop, {
      toValue: 1,
      friction: 5,
      tension: 140,
      delay: 60,
      useNativeDriver: true,
    }).start();
  }, [stage, micPop]);

  // Qué tan fuerte se está hablando AHORA (0 = silencio, 1 = fuerte).
  //
  // Esto es lo que de verdad hacía falta: sin ver nada moverse al hablar,
  // no hay forma de saber si el micrófono te está oyendo o si estás
  // hablándole a una pantalla muerta. El latido de abajo se mueve solo
  // aunque nadie diga nada; este solo se mueve con tu voz.
  const level = useRef(new Animated.Value(0)).current;

  // Latido continuo mientras escucha.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stage !== "listening") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [stage, pulse]);

  // ---- Arranque ----
  // Se abre el micrófono solo, sin que haya que tocar nada más: la persona
  // ya tocó una vez para llegar hasta aquí.
  useEffect(() => {
    start();
    return () => {
      // Al salir de la pantalla sí hay que cerrar siempre: si quedara
      // abierta, el micrófono seguiría encendido con la app en otra parte.
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Si ya estaba cerrado no hay nada que cancelar.
      }
      running.current = false;
      // Y el reloj del silencio, que si no intentaría cerrar una escucha que ya no
      // existe con la pantalla cerrada.
      if (relojCierre.current) {
        clearTimeout(relojCierre.current);
        relojCierre.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    langChain.current = [...(LOCALE_FALLBACKS[langs] ?? [langs])];
    escuchaSeguida.current = true;
    setErrorCode("");
    await listen();
  }

  /**
   * Arma —o rearma— el reloj que cierra el dictado. Ver SILENCIO_MS.
   *
   * Rearmar en vez de dejar uno fijo es lo que hace que las pausas para pensar no
   * corten nada: mientras sigan llegando palabras, el cierre se va posponiendo.
   */
  function armarCierre(ms: number) {
    if (relojCierre.current) clearTimeout(relojCierre.current);
    relojCierre.current = setTimeout(() => {
      relojCierre.current = null;
      terminarDeEscuchar();
    }, ms);
  }

  /**
   * Cierra el micrófono y procesa lo dicho. La usan el reloj del silencio y el botón
   * de "Listo".
   *
   * Se pide a Android que se detenga en vez de procesar aquí mismo, porque al detenerse
   * manda el último trozo — el que la persona acababa de decir. Procesar sin esperarlo
   * perdería justo la última compra de la lista.
   */
  function terminarDeEscuchar() {
    if (relojCierre.current) {
      clearTimeout(relojCierre.current);
      relojCierre.current = null;
    }
    if (settled.current) return;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // Si ni detenerse se puede, al menos se aprovecha lo que se oyó.
      settle(heardRef.current);
    }
  }

  // Abre el micrófono con el primer idioma de la lista que quede por
  // probar. Separado de start() porque un fallo de idioma vuelve a entrar
  // aquí con el siguiente, sin reiniciar el resto.
  async function listen() {
    runId.current += 1;

    // Cierra la escucha anterior SOLO si de verdad hay una abierta.
    if (running.current) {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Si ya se había cerrado sola, no hay nada que hacer.
      }
      running.current = false;
    }

    settled.current = false;
    heardRef.current = "";
    trozos.current = [];
    enCurso.current = "";
    if (relojCierre.current) {
      clearTimeout(relojCierre.current);
      relojCierre.current = null;
    }
    // Se baja a cero por si venía movido de la escucha anterior: si no, el
    // aro arrancaría abierto y parecería que ya te está oyendo.
    level.setValue(0);
    setHeard("");
    setRows([]);
    setKinds([]);
    setSummaryMk("");
    setSummaryCategory("");
    setStage("listening");
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setStage("denied");
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: langChain.current[0] ?? langs,
        interimResults: true,
        // LA ESCUCHA SEGUIDA. ES EL ARREGLO DEL 07/08/2026, NO TOCAR SIN LEER ESTO.
        //
        // Estaba en false, y la propia documentación de la librería dice qué significa
        // eso en Android: *"recognition will run until a result with isFinal: true is
        // received"*. O sea que el micrófono se cerraba en el PRIMER trozo que Android
        // diera por cerrado — y dictando una lista, el primer trozo es la primera
        // compra. Lo demás no se perdía: no se llegaba a escuchar.
        //
        // En true, Android 13 o más usa una sesión por trozos y sigue escuchando; en
        // Android 12 o menos la librería consigue lo mismo poniéndole al reconocedor
        // esperas larguísimas. En los dos casos el micrófono ya no se cierra solo, y
        // quien lo cierra es el reloj del silencio o el botón de "Listo".
        continuous: true,
        maxAlternatives: 1,
        // AQUÍ IBAN NUESTRAS ESPERAS DE SILENCIO, Y HABÍA QUE QUITARLAS.
        //
        // Es un detalle que no se ve y que habría dejado el arreglo a medias, andando
        // en el celular nuevo y no en uno viejo. Se leyó el código de la librería
        // (ExpoSpeechService.kt): las opciones que le pasamos se aplican DESPUÉS de las
        // suyas, así que las pisan. Y para la escucha seguida en Android 12 o menos su
        // truco es justamente poner esas esperas en diez minutos. Nuestros 5 segundos
        // las habrían borrado y el micrófono se habría cerrado igual que antes.
        //
        // Ya no hacen falta: el que decide cuándo se terminó es SILENCIO_MS, de este
        // lado, donde se puede rearmar con cada palabra.
        // Android va avisando del volumen del micrófono. Es lo que permite
        // que el círculo crezca cuando hablas, y así se vea que te oye.
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      });
      running.current = true;

      // Respaldo por si Android no manda el aviso de arranque (hay
      // celulares que se lo saltan). Sin esto, esta escucha nunca se daría
      // por válida y la pantalla se quedaría escuchando sin procesar nada.
      // El segundo y medio es de sobra: ningún resultado real llega antes.
      const mine = runId.current;
      setTimeout(() => {
        if (runId.current === mine && activeRun.current !== mine) {
          activeRun.current = mine;
        }
      }, 1500);
    } catch {
      setFailure("empty");
      setStage("failed");
    }
  }

  function settle(text: string) {
    if (settled.current) return;
    settled.current = true;
    // El reloj del silencio ya no tiene nada que cerrar.
    if (relojCierre.current) {
      clearTimeout(relojCierre.current);
      relojCierre.current = null;
    }

    const command = parseVoiceCommand(text);

    // Exportar: el archivo se genera solo y se abre el menú de compartir,
    // sin tocar nada más. Antes solo dejaba la pantalla lista, por si el
    // micrófono oía mal el mes; se cambió porque así se pidió. La red de
    // seguridad quedó del otro lado: si el mes que se entendió no tiene
    // movimientos, no se exporta nada y se avisa cuál era.
    if (command.kind === "export") {
      router.replace({
        pathname: "/export-pdf",
        params: {
          month: command.monthKey,
          format: command.format,
          dest: command.destination,
          // Todo, solo gastos o solo ingresos. Sin esto, decir "ingresos"
          // salía entendido en todo menos en lo único que hacía distinto al
          // documento: llegaba el mes entero.
          type: command.type,
          // Los graficos solo si se pidieron: "exportar julio pdf con
          // graficos". Sin decirlo llega la lista sola, que es lo normal.
          charts: command.charts ? "1" : "0",
          // A quien, tal como se dijo. La pantalla de exportar lo busca entre
          // los contactos guardados; si no lo encuentra, abre la app y se
          // elige alli, que es lo que pasaba antes de esto.
          to: command.recipient,
          auto: "1",
        },
      });
      return;
    }

    if (command.kind === "topMonth") {
      setTopFocus(command.focus);
      setTopDirection(command.direction);
      setStage("topMonth");
      return;
    }

    if (command.kind === "compare") {
      setCompareMonths(command.months);
      setCompareFocus(command.focus);
      setStage("compare");
      return;
    }

    if (command.kind === "summary") {
      setSummaryMk(command.monthKey);
      setSummaryFocus(command.focus);
      setSummaryCategory(command.category ?? "");
      setSummaryDay(command.day ?? 0);
      setStage("summary");
      return;
    }

    const parsed = command.parsed;
    if (!parsed.ok) {
      setFailure(parsed.reason);
      setStage("failed");
      return;
    }
    setRows(parsed.rows);
    setKinds(parsed.rows.map((r) => r.type));
    setTypeSaid(parsed.typeSaid);
    setStage("confirm");
  }

  // Android confirma aquí que la escucha arrancó de verdad. Desde este
  // momento, sus avisos pertenecen a ESTA escucha y no a una anterior.
  useSpeechRecognitionEvent("start", () => {
    activeRun.current = runId.current;
    running.current = true;
    // Con la escucha seguida el micrófono ya no se cierra por su cuenta, así que si
    // nadie habla hay que cerrarlo nosotros. Ver ESPERA_PRIMERA_PALABRA_MS.
    if (escuchaSeguida.current) armarCierre(ESPERA_PRIMERA_PALABRA_MS);
  });

  useSpeechRecognitionEvent("volumechange", (event) => {
    if (activeRun.current !== runId.current) return;
    // Android manda un número entre -2 y 10; por debajo de 0 es silencio.
    // Se reparte hasta 6 porque una voz normal a un palmo del micrófono
    // llega ahí — dejarlo hasta 10 haría falta gritar para verlo crecer.
    const normalized = Math.max(0, Math.min(1, event.value / 6));
    Animated.timing(level, {
      toValue: normalized,
      duration: 120,
      useNativeDriver: true,
    }).start();
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (activeRun.current !== runId.current) return;
    const text = event.results[0]?.transcript ?? "";

    // UN TROZO CERRADO SE SUMA; EL QUE VA EN CURSO SE REEMPLAZA.
    //
    // La diferencia es todo el arreglo. Antes cualquiera de los dos reemplazaba lo
    // anterior, y en un dictado de cinco compras quedaba una. Ver la nota de "trozos".
    if (event.isFinal) {
      if (text.trim()) trozos.current.push(text.trim());
      enCurso.current = "";
    } else {
      enCurso.current = text;
    }

    const todo = todoLoDicho();
    if (todo) {
      heardRef.current = todo;
      setHeard(todo);
    }

    // Y NO SE CIERRA EN EL PRIMER TROZO FINAL. Eso es lo que cortaba la lista a la
    // primera compra. Se espera a que de verdad se deje de hablar.
    if (escuchaSeguida.current) armarCierre(SILENCIO_MS);
    else if (event.isFinal) settle(heardRef.current);
  });

  // Los errores NO se filtran por número de escucha a propósito: si algo
  // falla antes de que Android confirme el arranque, sin esto la pantalla
  // se quedaría escuchando para siempre. El cierre que hacemos nosotros
  // llega como "aborted", que ya se ignora aquí.
  useSpeechRecognitionEvent("error", (event) => {
    if (event.error === "aborted" || settled.current) return;

    // Si el celular no tiene ese idioma instalado, se prueba el siguiente
    // de la lista antes de darse por vencido. Es de las causas más comunes
    // de que el micrófono "no oiga nada": no es que no oiga, es que no
    // sabe reconocer ese idioma concreto.
    const languageProblem =
      event.error === "language-not-supported" || event.error === "service-not-allowed";
    if (languageProblem && langChain.current.length > 1) {
      langChain.current = langChain.current.slice(1);
      listen();
      return;
    }

    // LA RED DE SEGURIDAD DE LA ESCUCHA SEGUIDA.
    //
    // En Android 13 o más, la escucha seguida hace que la librería grabe el micrófono
    // ella misma para poder ir cerrando trozos. Eso funciona en la mayoría de celulares
    // pero depende de cosas que no se pueden comprobar desde acá.
    //
    // Si falla ANTES de oír nada, se vuelve a abrir el micrófono a la antigua. Se pierde
    // el dictado largo, sí, pero el micrófono sigue sirviendo para una frase: nunca
    // queda peor que antes de este cambio. Y solo se prueba si no se oyó nada, porque si
    // ya había palabras esas valen más que el error (ver justo abajo).
    if (escuchaSeguida.current && !heardRef.current.trim()) {
      escuchaSeguida.current = false;
      listen();
      return;
    }

    // Si se alcanzó a oír algo, eso vale más que el error. Android manda
    // "no encontré coincidencia" con muchísima frecuencia aunque haya
    // reconocido las palabras perfectamente — y hasta ahora esas palabras
    // se tiraban para mostrar "no escuché nada" con la frase ya escrita en
    // la pantalla un segundo antes.
    if (heardRef.current.trim()) {
      settle(heardRef.current);
      return;
    }

    settled.current = true;
    setErrorCode(`${event.error}${event.message ? ` · ${event.message}` : ""}`);
    setFailure("empty");
    setStage("failed");
  });

  // Android a veces cierra el micrófono sin mandar un resultado final
  // (por ejemplo si la persona se queda callada). Lo que se alcanzó a
  // escuchar igual sirve.
  useSpeechRecognitionEvent("end", () => {
    running.current = false;
    // Este es el aviso que llegaba tarde y mataba la escucha nueva.
    if (activeRun.current !== runId.current) return;
    if (settled.current) return;
    settle(heardRef.current);
  });

  // La categoría se vuelve a adivinar según el tipo elegido, porque un
  // ingreso nunca va en una categoría de gasto.
  function categoryOf(row: RawRow, kind: Kind) {
    return suggestCategory(row.merchant || row.description, kind, merchantLearned);
  }

  function toggleKind(index: number) {
    setKinds((prev) => prev.map((k, i) => (i === index ? (k === "expense" ? "income" : "expense") : k)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setKinds((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    if (rows.length === 0) return;
    rows.forEach((row, i) => {
      const kind = kinds[i];
      const category = categoryOf(row, kind);
      const transaction: Transaction = {
        id: nextId(),
        type: kind,
        amount: row.amount,
        category,
        date: row.date,
        method: "cash",
        description: row.description || t(catInfo(category).label),
        notes: "",
        // La hora de ahora: es cuando se dicta.
        time: horaDe(Date.now()),
        merchant: row.merchant || undefined,
        origin: "manual",
      };
      addOrUpdateTransaction(transaction);
    });
    // El aviso de addOrUpdateTransaction habla de un solo movimiento; si
    // fueron varios, este lo reemplaza (el último gana).
    if (rows.length > 1) showToast(t("voice.savedPlural", { count: rows.length }));
    onClose();
  }

  // Cuentas del mes pedido: cuánto salió, cuánto entró y en qué se fue más.
  // Se calcula aquí y no en un archivo aparte porque son cuatro líneas y
  // solo las usa esta pantalla.
  const summary = (() => {
    if (!summaryMk) return null;
    // Si se preguntó por un día, el filtro es la fecha completa. Funciona
    // igual porque una fecha guardada es "2026-07-28": el mes es su
    // principio y el día es la fecha entera.
    const prefix = summaryDay > 0 ? `${summaryMk}-${String(summaryDay).padStart(2, "0")}` : summaryMk;
    const monthTx = transactions.filter((tx) => tx.date.startsWith(prefix));

    // El "protagonista" es lo que se pidió; el otro lado va como línea
    // pequeña debajo. Antes el protagonista era SIEMPRE el gasto, así que
    // pedir un resumen de ingresos mostraba gastos.
    const wantsIncome = summaryFocus === "income";
    const all = monthTx.filter((tx) => (wantsIncome ? tx.type === "income" : tx.type === "expense"));
    const other = monthTx.filter((tx) => (wantsIncome ? tx.type === "expense" : tx.type === "income"));

    // Si se pidió una categoría, el resumen es SOLO de esa.
    const main = summaryCategory ? all.filter((tx) => tx.category === summaryCategory) : all;

    const byCategory = new Map<string, number>();
    for (const tx of main) byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
    const [y, m] = summaryMk.split("-").map(Number);

    return {
      label: summaryDay > 0
        ? t("voice.summaryDayLabel", { day: summaryDay, month: monthNames[m - 1], year: y })
        : `${monthNames[m - 1]} ${y}`,
      isIncome: wantsIncome,
      isDay: summaryDay > 0,
      category: summaryCategory,
      // Qué decir cuando no hay nada. Con un día pedido, "en ese mes" sería
      // mentira: se buscó en un solo día. Se elige aquí y no en el dibujo
      // porque son seis casos y en medio del JSX no se leían.
      emptyKey: summaryCategory
        ? summaryDay > 0
          ? "voice.summaryEmptyCategoryDay"
          : "voice.summaryEmptyCategory"
        : summaryDay > 0
          ? wantsIncome
            ? "voice.summaryEmptyIncomeDay"
            : "voice.summaryEmptyDay"
          : wantsIncome
            ? "voice.summaryEmptyIncome"
            : "voice.summaryEmpty",
      total: main.reduce((s, tx) => s + tx.amount, 0),
      otherTotal: other.reduce((s, tx) => s + tx.amount, 0),
      count: main.length,
      // Sin categoría pedida se enseña en qué se fue más (las categorías);
      // con una categoría, esa lista sería una sola fila repitiendo el
      // total, así que se enseñan los movimientos concretos, que es lo que
      // de verdad se quiere ver.
      top: Array.from(byCategory.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4),
      // De un día se enseñan más: son pocos y caben. De un mes entero, seis
      // ya llenan la pantalla y el resto se resume en "y N más".
      items: [...main].sort((a, b) => b.amount - a.amount).slice(0, summaryDay > 0 ? 10 : 6),
    };
  })();

  /** Nombre legible de un mes guardado como "2026-05". */
  function monthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return `${monthNames[m - 1]} ${y}`;
  }

  /** Lo que salió y lo que entró en cada mes que tenga algo. */
  function totalsByMonth(): Map<string, { expense: number; income: number }> {
    const map = new Map<string, { expense: number; income: number }>();
    for (const tx of transactions) {
      const key = tx.date.slice(0, 7);
      const acc = map.get(key) ?? { expense: 0, income: 0 };
      if (tx.type === "income") acc.income += tx.amount;
      else acc.expense += tx.amount;
      map.set(key, acc);
    }
    return map;
  }

  // "¿En qué mes gasté más?" — el ranking de todos los meses guardados.
  const topMonth = (() => {
    if (stage !== "topMonth") return null;
    const totals = totalsByMonth();

    // Un mes sin nada de lo que se pregunta no entra en la carrera: si se
    // pregunta por ingresos, un mes solo con gastos no es "el que menos
    // ingresos tuvo", es un mes que no cuenta.
    const lista = [...totals.entries()]
      .map(([key, t]) => ({ key, value: topFocus === "income" ? t.income : t.expense }))
      .filter((m) => m.value > 0)
      .sort((a, b) => (topDirection === "least" ? a.value - b.value : b.value - a.value));

    if (lista.length === 0) return { empty: true, winner: null, others: [], max: 0 };
    return {
      empty: false,
      winner: lista[0],
      others: lista.slice(1, 6),
      // Para las barritas: se miden todas contra la más grande de la lista,
      // no contra la ganadora, que al pedir "el que menos" es la más chica.
      max: Math.max(...lista.map((m) => m.value)),
    };
  })();

  // "Compara junio con mayo" — los dos meses, uno al lado del otro.
  const compare = (() => {
    if (stage !== "compare" || !compareMonths[0]) return null;
    const totals = totalsByMonth();
    const vacio = { expense: 0, income: 0 };
    const a = { key: compareMonths[0], ...(totals.get(compareMonths[0]) ?? vacio) };
    const b = { key: compareMonths[1], ...(totals.get(compareMonths[1]) ?? vacio) };

    // La frase de abajo habla de lo que se preguntó. Sin decir nada, de los
    // gastos: es de lo que uno quiere enterarse al comparar dos meses.
    const porIngresos = compareFocus === "income";
    const va = porIngresos ? a.income : a.expense;
    const vb = porIngresos ? b.income : b.expense;
    const diff = va - vb;

    // "Casi lo mismo" cuando la diferencia no llega al 5% del mayor: decir
    // "gastaste S/ 2 más" en dos meses de mil soles no informa de nada.
    const mayor = Math.max(va, vb);
    const casiIgual = mayor === 0 || Math.abs(diff) / mayor < 0.05;

    return {
      a,
      b,
      empty: a.expense + a.income + b.expense + b.income === 0,
      casiIgual,
      diff: Math.abs(diff),
      // De qué mes se habla en la frase: del que tenga más.
      mesConMas: diff >= 0 ? a.key : b.key,
      subeLaFrase: diff >= 0,
      porIngresos,
    };
  })();

  // Latido de fondo: existe siempre, para que se vea que está esperando.
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  // Aro que se abre con la voz. Este SOLO se mueve si estás hablando.
  const voiceScale = level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const voiceOpacity = level.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] });

  // El micrófono en sí: entra creciendo y luego late con la voz. Se
  // multiplican las dos cosas para que la entrada no se pierda si en ese
  // momento ya se está hablando.
  const micScale = Animated.multiply(
    micPop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
    level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] })
  );
  const single = rows.length === 1;

  return (
    // Panel flotante, no pantalla completa.
    //
    // Antes esto ocupaba toda la pantalla con el fondo de la app, y se
    // sentía como "me sacó de lo que estaba haciendo y me metió en Finzo".
    // Ahora se ve un panel encima de lo que había, con el resto oscurecido:
    // la misma app, el mismo código, pero se percibe como algo que se abre
    // un momento y se va. Tocar fuera lo cierra.
    <View className="absolute inset-0 z-50 items-center justify-center px-5">
      <TouchableOpacity
        className="absolute inset-0 bg-black/70"
        activeOpacity={1}
        onPress={onClose}
      />

      {/* En modo oscuro el panel va en slate-800 y NO en slate-900: el
          fondo oscurecido de detrás es casi ese mismo color, así que un
          panel slate-900 se fundía con él y todo parecía una pantalla
          entera en vez de algo flotando encima. */}
      <Animated.View
        className="w-full rounded-3xl bg-white dark:bg-slate-800 px-5 pt-3 pb-6"
        style={[
          CARD_SHADOW,
          // Tope de alto para que la lista de 30 movimientos no se salga de
          // la pantalla en celulares chicos.
          { maxHeight: "88%", marginTop: insets.top, marginBottom: insets.bottom },
          {
            opacity: entrance,
            transform: [
              { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            ],
          },
        ]}
      >
        <View className="flex-row justify-end">
          <TouchableOpacity
            onPress={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
          >
            <X size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View className="items-center justify-center px-2 pb-1">
        {stage === "listening" && (
          <>
            <View className="w-32 h-32 items-center justify-center mb-8">
              <Animated.View
                className="absolute w-24 h-24 rounded-full bg-violet-500"
                style={{ transform: [{ scale }], opacity }}
              />
              <Animated.View
                className="absolute w-24 h-24 rounded-full bg-violet-400"
                style={{ transform: [{ scale: voiceScale }], opacity: voiceOpacity }}
              />
              <Animated.View
                className="w-20 h-20 rounded-full bg-violet-500 items-center justify-center"
                style={{ transform: [{ scale: micScale }] }}
              >
                <Mic size={32} color="#ffffff" />
              </Animated.View>
            </View>
            <Text className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              {t("voice.listening")}
            </Text>
            <Text className="text-xs text-center text-slate-500 dark:text-slate-300 leading-5">
              {heard || t("voice.example")}
            </Text>
            {!heard && (
              <Text className="text-[11px] text-center text-slate-400 leading-4 mt-2">
                {t("voice.example2")}
              </Text>
            )}
            {/* "LISTO", PARA NO TENER QUE ESPERAR EL SILENCIO.
                Aparece solo cuando ya se oyó algo: antes de eso no hay nada que dar por
                terminado, y la ✕ de arriba ya sirve para irse.
                Es además la salida segura de todo lo demás: si el reloj del silencio
                fallara en algún celular, esto cierra el dictado a mano. */}
            {heard.length > 0 && (
              <TouchableOpacity
                onPress={terminarDeEscuchar}
                className="mt-6 px-7 py-2.5 rounded-full bg-violet-500 flex-row items-center gap-2"
              >
                <Check size={16} color="#ffffff" />
                <Text className="text-sm font-bold text-white">{t("voice.listo")}</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {stage === "confirm" && rows.length > 0 && (
          <View className="w-full">
            <Text className="text-xs text-center text-slate-400 mb-4">{`"${heard}"`}</Text>

            {single ? (
              <SingleCard
                row={rows[0]}
                kind={kinds[0]}
                category={categoryOf(rows[0], kinds[0])}
                fmt={fmt}
                t={t}
                typeSaid={typeSaid}
                onKind={(k) => setKinds([k])}
              />
            ) : (
              <>
                {/* Con muchos movimientos, revisar uno por uno es imposible.
                    Esta línea deja comprobar de un vistazo lo único que de
                    verdad importa: cuántos son y cuánto suman. */}
                <View className="flex-row items-center justify-between px-1 mb-2">
                  <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-300">
                    {t("voice.manyCount", { count: rows.length })}
                  </Text>
                  <Text className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                    {fmt(rows.reduce((s, r, i) => s + (kinds[i] === "expense" ? r.amount : -r.amount), 0))}
                  </Text>
                </View>
                <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingVertical: 2 }}>
                <View className="gap-2">
                  {rows.map((row, i) => {
                    const kind = kinds[i];
                    const cat = catInfo(categoryOf(row, kind));
                    return (
                      <View
                        key={`${row.amount}-${i}`}
                        className="flex-row items-center gap-3 rounded-2xl p-3.5 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
                        style={CARD_SHADOW}
                      >
                        <CategoryAvatar id={cat.id} size={20} />
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {row.description || t(cat.label)}
                          </Text>
                          <Text className="text-[11px] text-slate-500 dark:text-slate-300">{t(cat.label)}</Text>
                        </View>
                        {/* Tocar el monto cambia entre gasto e ingreso. */}
                        <TouchableOpacity onPress={() => toggleKind(i)}>
                          <Text
                            className={`text-sm font-extrabold ${
                              kind === "expense" ? "text-rose-500" : "text-emerald-600"
                            }`}
                          >
                            {kind === "expense" ? "-" : "+"}
                            {fmt(row.amount)}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => removeRow(i)}
                          className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
                        >
                          <X size={13} color="#94a3b8" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              onPress={save}
              className="w-full flex-row items-center justify-center gap-2 py-4 rounded-2xl bg-violet-500 mt-4"
            >
              <Check size={18} color="#ffffff" />
              <Text className="text-white font-bold">
                {single ? t("voice.save") : t("voice.saveMany", { count: rows.length })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={start}
              className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-2"
            >
              <RotateCcw size={16} color="#64748b" />
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("voice.retry")}</Text>
            </TouchableOpacity>
            <Text className="text-[10px] text-center text-slate-400 mt-3 leading-4">
              {t(single ? "voice.editHint" : "voice.manyHint")}
            </Text>
          </View>
        )}

        {stage === "summary" && summary && (
          <View className="w-full">
            <Text className="text-xs text-center text-slate-400 mb-4">{`"${heard}"`}</Text>

            <View
              className="w-full rounded-3xl p-5 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
              style={CARD_SHADOW}
            >
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 text-center">
                {summary.category
                  ? `${catInfo(summary.category).emoji} ${t(catInfo(summary.category).label)} · ${summary.label}`
                  : summary.label}
              </Text>

              {summary.count === 0 ? (
                <Text className="text-xs text-center text-slate-500 dark:text-slate-300 leading-5 mt-3">
                  {t(summary.emptyKey, {
                    cat: summary.category ? t(catInfo(summary.category).label) : "",
                  })}
                </Text>
              ) : (
                <>
                  <Text
                    className={`text-3xl font-extrabold text-center mt-1 ${
                      summary.isIncome ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    {fmt(summary.total)}
                  </Text>
                  <Text className="text-[11px] text-center text-slate-500 dark:text-slate-300">
                    {t(summary.isIncome ? "voice.summaryEarned" : "voice.summarySpent", {
                      count: summary.count,
                    })}
                  </Text>
                  {summary.otherTotal > 0 && !summary.category && (
                    <Text
                      className={`text-[11px] text-center mt-0.5 ${
                        summary.isIncome ? "text-rose-500" : "text-emerald-600"
                      }`}
                    >
                      {t(summary.isIncome ? "voice.summaryOutLine" : "voice.summaryIncome", {
                        amount: fmt(summary.otherTotal),
                      })}
                    </Text>
                  )}

                  {summary.category || summary.isDay ? (
                    // Con una categoría pedida se listan los movimientos. Y
                    // con un día también: en un solo día son pocos, y
                    // "Otros S/ 36" no dice en qué se fue. Se ven las cosas.
                    <View className="mt-4 gap-2">
                      {summary.items.map((tx) => (
                        <View key={tx.id} className="flex-row items-center gap-2.5">
                          <Text className="flex-1 text-xs text-slate-900 dark:text-slate-100" numberOfLines={1}>
                            {tx.description || t(catInfo(tx.category).label)}
                          </Text>
                          <Text className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {fmt(tx.amount)}
                          </Text>
                        </View>
                      ))}
                      {summary.count > summary.items.length && (
                        <Text className="text-[10px] text-slate-400 text-center mt-1">
                          {t("voice.summaryMore", { count: summary.count - summary.items.length })}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View className="mt-4 gap-2">
                      {summary.top.map(([category, amount]) => {
                        const cat = catInfo(category);
                        const share = Math.round((amount / summary.total) * 100);
                        return (
                          <View key={category} className="flex-row items-center gap-2.5">
                            <CategoryAvatar id={cat.id} size={16} />
                            <Text className="flex-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                              {t(cat.label)}
                            </Text>
                            <Text className="text-[11px] text-slate-400">{share}%</Text>
                            <Text className="text-xs font-bold text-slate-900 dark:text-slate-100 w-20 text-right">
                              {fmt(amount)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </View>

            <TouchableOpacity
              onPress={() =>
                router.replace({
                  pathname: "/export-pdf",
                  params: { month: summaryMk, format: "pdf", auto: "1" },
                })
              }
              className="w-full flex-row items-center justify-center gap-2 py-4 rounded-2xl bg-violet-500 mt-4"
            >
              <Check size={18} color="#ffffff" />
              <Text className="text-white font-bold">{t("voice.summaryExport")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={start}
              className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-2"
            >
              <RotateCcw size={16} color="#64748b" />
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("voice.retry")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* "¿En qué mes gasté más?" */}
        {stage === "topMonth" && topMonth && (
          <View className="w-full">
            <Text className="text-xs text-center text-slate-400 mb-4">{`"${heard}"`}</Text>

            <View
              className="w-full rounded-3xl p-5 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
              style={CARD_SHADOW}
            >
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 text-center">
                {t(
                  topFocus === "income"
                    ? topDirection === "least"
                      ? "voice.topMonthLeastIncome"
                      : "voice.topMonthMostIncome"
                    : topDirection === "least"
                      ? "voice.topMonthLeastExpense"
                      : "voice.topMonthMostExpense"
                )}
              </Text>

              {topMonth.empty || !topMonth.winner ? (
                <Text className="text-xs text-center text-slate-500 dark:text-slate-300 leading-5 mt-3">
                  {t("voice.topMonthEmpty")}
                </Text>
              ) : (
                <>
                  <Text className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 text-center mt-2">
                    {monthLabel(topMonth.winner.key)}
                  </Text>
                  <Text
                    className={`text-3xl font-extrabold text-center mt-1 ${
                      topFocus === "income" ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    {fmt(topMonth.winner.value)}
                  </Text>

                  {topMonth.others.length > 0 && (
                    <>
                      <Text className="text-[11px] font-bold text-slate-400 mt-5 mb-2">
                        {t("voice.topMonthOthers")}
                      </Text>
                      <View className="gap-2.5">
                        {topMonth.others.map((m) => (
                          <View key={m.key}>
                            <View className="flex-row items-center justify-between mb-1">
                              <Text className="text-xs font-medium text-slate-600 dark:text-slate-200" numberOfLines={1}>
                                {monthLabel(m.key)}
                              </Text>
                              <Text className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {fmt(m.value)}
                              </Text>
                            </View>
                            <View className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <View
                                className={`h-1.5 rounded-full ${
                                  topFocus === "income" ? "bg-emerald-500" : "bg-rose-400"
                                }`}
                                style={{ width: `${Math.max(4, (m.value / topMonth.max) * 100)}%` }}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </>
              )}
            </View>

            <TouchableOpacity
              onPress={start}
              className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-4"
            >
              <RotateCcw size={16} color="#64748b" />
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("voice.retry")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* "Compara junio con mayo" */}
        {stage === "compare" && compare && (
          <View className="w-full">
            <Text className="text-xs text-center text-slate-400 mb-4">{`"${heard}"`}</Text>

            <View
              className="w-full rounded-3xl p-5 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700"
              style={CARD_SHADOW}
            >
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 text-center mb-3">
                {t("voice.compareTitle")}
              </Text>

              {compare.empty ? (
                <Text className="text-xs text-center text-slate-500 dark:text-slate-300 leading-5">
                  {t("voice.compareEmpty")}
                </Text>
              ) : (
                <>
                  {/* Los dos meses, en el orden en que se dijeron */}
                  <View className="flex-row">
                    <View className="w-20" />
                    {[compare.a, compare.b].map((m) => (
                      <Text
                        key={m.key}
                        numberOfLines={1}
                        className="flex-1 text-[11px] font-extrabold text-slate-900 dark:text-slate-100 text-right"
                      >
                        {monthLabel(m.key)}
                      </Text>
                    ))}
                  </View>

                  {(
                    [
                      ["voice.compareExpense", "expense", "text-rose-500"],
                      ["voice.compareIncome", "income", "text-emerald-600"],
                    ] as const
                  ).map(([label, campo, color]) => (
                    <View key={campo} className="flex-row items-center mt-3">
                      <Text className="w-20 text-[11px] font-bold text-slate-500 dark:text-slate-300">
                        {t(label)}
                      </Text>
                      {[compare.a, compare.b].map((m) => (
                        <Text key={m.key} className={`flex-1 text-xs font-bold text-right ${color}`}>
                          {fmt(m[campo])}
                        </Text>
                      ))}
                    </View>
                  ))}

                  <View className="h-px bg-slate-100 dark:bg-slate-800 my-3" />

                  <View className="flex-row items-center">
                    <Text className="w-20 text-[11px] font-bold text-slate-500 dark:text-slate-300">
                      {t("voice.compareBalance")}
                    </Text>
                    {[compare.a, compare.b].map((m) => {
                      const queda = m.income - m.expense;
                      return (
                        <Text
                          key={m.key}
                          className={`flex-1 text-xs font-extrabold text-right ${
                            queda < 0 ? "text-rose-500" : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {fmt(queda)}
                        </Text>
                      );
                    })}
                  </View>

                  {/* La conclusión en una frase, que es lo que se preguntó */}
                  <Text className="text-xs font-bold text-slate-900 dark:text-slate-100 text-center mt-5 leading-5">
                    {compare.casiIgual
                      ? t(compare.porIngresos ? "voice.compareSameIncome" : "voice.compareSameExpense")
                      : t(
                          compare.porIngresos
                            ? compare.subeLaFrase
                              ? "voice.compareMoreIncome"
                              : "voice.compareLessIncome"
                            : compare.subeLaFrase
                              ? "voice.compareMoreExpense"
                              : "voice.compareLessExpense",
                          { amount: fmt(compare.diff), month: monthLabel(compare.a.key) }
                        )}
                  </Text>
                </>
              )}
            </View>

            <TouchableOpacity
              onPress={start}
              className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-4"
            >
              <RotateCcw size={16} color="#64748b" />
              <Text className="font-bold text-slate-600 dark:text-slate-200">{t("voice.retry")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {stage === "failed" && (
          <View className="w-full items-center">
            <View className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center mb-6">
              <MicOff size={28} color="#94a3b8" />
            </View>
            <Text className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 text-center">
              {t(failure === "noAmount" ? "voice.noAmountTitle" : "voice.emptyTitle")}
            </Text>
            {heard ? <Text className="text-xs text-center text-slate-400 mb-2">{`"${heard}"`}</Text> : null}
            <Text className="text-xs text-center text-slate-500 dark:text-slate-300 leading-5 mb-3">
              {t(failure === "noAmount" ? "voice.noAmountHint" : "voice.emptyHint")}
            </Text>
            {/* El motivo tal cual lo dio Android. Feo a propósito: no es
                para el uso diario, es para poder arreglarlo cuando algo
                falla y desde fuera todo se ve igual. */}
            {errorCode ? (
              <Text className="text-[10px] text-center text-slate-400 mb-3">{errorCode}</Text>
            ) : null}
            <View className="h-3" />
            <TouchableOpacity
              onPress={start}
              className="w-full flex-row items-center justify-center gap-2 py-4 rounded-2xl bg-violet-500"
            >
              <RotateCcw size={18} color="#ffffff" />
              <Text className="text-white font-bold">{t("voice.retry")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {stage === "denied" && (
          <View className="w-full items-center">
            <View className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center mb-6">
              <MicOff size={28} color="#94a3b8" />
            </View>
            <Text className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 text-center">
              {t("voice.deniedTitle")}
            </Text>
            <Text className="text-xs text-center text-slate-500 dark:text-slate-300 leading-5">
              {t("voice.deniedHint")}
            </Text>
          </View>
        )}
        </View>
      </Animated.View>
    </View>
  );
}

// Tarjeta grande para cuando la frase trae un solo movimiento, que es el
// caso normal. Cuando son varios se usa la lista compacta de arriba.
function SingleCard({
  row,
  kind,
  category,
  fmt,
  t,
  typeSaid,
  onKind,
}: {
  row: RawRow;
  kind: Kind;
  category: string;
  fmt: (n: number) => string;
  t: (k: string, vars?: Record<string, string | number>) => string;
  /** La persona dijo si era gasto o ingreso: no hay que volver a preguntar. */
  typeSaid: boolean;
  onKind: (k: Kind) => void;
}) {
  const cat = catInfo(category);
  return (
    <View
      className="w-full rounded-3xl p-5 bg-white dark:bg-slate-900 border-[1.5px] border-slate-200 dark:border-slate-700 items-center"
      style={CARD_SHADOW}
    >
      <View className="mb-1"><CategoryAvatar id={cat.id} size={36} /></View>
      <Text className={`text-3xl font-extrabold ${kind === "expense" ? "text-rose-500" : "text-emerald-600"}`}>
        {kind === "expense" ? "-" : "+"}
        {fmt(row.amount)}
      </Text>
      <Text className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
        {row.description || t(cat.label)}
      </Text>
      <Text className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">{t(cat.label)}</Text>

      {/* Cambiar gasto/ingreso de un toque. Es el dato que más daño hace si
          sale al revés y el más difícil de notar después.
          Solo aparece cuando la app lo SUPUSO. Si la persona lo dijo
          ("gasté 20 en pan"), volver a preguntar sobra, y poner "Ingreso" al
          lado como si fuera igual de probable solo invita a tocarlo por
          error. Si aun así saliera mal, se corrige desde la lista. */}
      {typeSaid ? null : (
      <View className="flex-row gap-2 mt-4">
        <TouchableOpacity
          onPress={() => onKind("expense")}
          className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border-[1.5px] ${
            kind === "expense"
              ? "bg-rose-50 dark:bg-slate-800 border-rose-300"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <ArrowUpRight size={13} color={kind === "expense" ? "#f43f5e" : "#94a3b8"} />
          <Text className={`text-[11px] font-bold ${kind === "expense" ? "text-rose-500" : "text-slate-400"}`}>
            {t("addSheet.expense")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onKind("income")}
          className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border-[1.5px] ${
            kind === "income"
              ? "bg-emerald-50 dark:bg-slate-800 border-emerald-300"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <ArrowDownRight size={13} color={kind === "income" ? "#059669" : "#94a3b8"} />
          <Text className={`text-[11px] font-bold ${kind === "income" ? "text-emerald-600" : "text-slate-400"}`}>
            {t("addSheet.income")}
          </Text>
        </TouchableOpacity>
      </View>
      )}
    </View>
  );
}
