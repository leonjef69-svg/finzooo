import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from "@firebase/auth";
import { AppState } from "react-native";
import { colorScheme } from "nativewind";
import { seedTransactions, seedGoals } from "@/constants/seed";
import { currencySymbolFor } from "@/constants/currencies";
import { monthNamesFor, translations } from "@/constants/i18n";
import {
  clearAccountData,
  flushPendingSaves,
  loadJSON,
  saveJSON,
  STORAGE_KEYS,
} from "@/utils/storage";
import {
  borrarNegocio as borrarNegocioYLoSuyo,
  borrarProducto as quitarProductoDeLaLista,
  cargarNegocio,
  guardarMovimientosNegocio,
  guardarNegocios,
  guardarProductos,
  guardarVentas,
  NEGOCIO_VACIO,
  type DatosDelNegocio,
  type MovimientoNegocio,
  type Negocio,
  type Producto,
  type Venta,
} from "@/utils/negocio";
import { bajarNegocio, subirNegocio } from "@/utils/cloudNegocio";
import {
  fusionarMovimientosNegocio,
  mandarYapesA,
  negocioQueRecibeYapes,
  separarLoDelNegocio,
} from "@/utils/negocioCaptura";
import { activate as activateDecoy, deactivate as deactivateDecoy } from "@/utils/decoyMode";
// setOverrides y setPropias ya no se usan aqui: al traer los datos de la nube se
// llama a saveOverrides y savePropias, que ponen la variable de modulo Y escriben
// el disco. Con las versiones "set" se quedaban solo en memoria y al reabrir la app
// volvia el disco vacio — la personalizacion y las categorias propias desaparecian
// otra vez.
import { loadOverrides, saveOverrides, type CategoryOverrides } from "@/utils/categoryCustom";
import {
  borrar as borrarPropia,
  crear as crearPropia,
  editar as editarPropia,
  loadPropias,
  savePropias,
  type CategoriaPropia,
} from "@/utils/categoriasPropias";
import {
  getFavoritos,
  loadFavoritos,
  paraLaNube,
  saveFavoritos,
} from "@/utils/iconosFavoritos";
import {
  loadPrueba,
  pruebaHorasRestantes,
  pruebaVigente,
  pruebaYaUsada,
  savePrueba,
} from "@/utils/pruebaPremium";
import { DECOY_BUDGET, buildDecoyTransactions } from "@/utils/decoySeed";
import { fmt as formatAmount, monthKey } from "@/utils/format";
import { reserveIdsAbove } from "@/utils/id";
import { learnCategory } from "@/utils/classifier";
import { auth } from "@/utils/firebase";
import { signOutFromGoogle } from "@/utils/googleAuth";
import {
  deleteCloudAccount,
  loadCloudData,
  saveCloudData,
  type CloudData,
} from "@/utils/cloudSync";
import { processCaptured, type CaptureLogEntry } from "@/utils/autoCapture";
import { limpiarPendientes, pendientesDeCaptura } from "@/utils/capturaEnFondo";
import { mergeTransactions, hayNovedades, mergeCaptureLog } from "@/utils/mergeTransactions";
import { presupuestoDelMes } from "@/utils/presupuestoMensual";
import { hayDescuadre, maximoAApartar, saldoLibre, totalApartado } from "@/utils/ahorro";
import { availableBalance } from "@/utils/finances";
import { saldoAnteriorDe } from "@/utils/saldoAnterior";
import * as notificationReader from "@/modules/notification-reader";
import type { Goal, Month, Profile, Transaction } from "@/types";

export type ThemeMode = "light" | "dark" | "system";

type AppDataContextValue = {
  ready: boolean;
  hasOnboarded: boolean;
  completeOnboarding: (budgetAmount: number) => void;
  reloadPersistedData: () => Promise<void>;
  hydrateFromCloud: (uid: string) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (currentPassword: string) => Promise<void>;

  userName: string;
  setUserName: (name: string) => void;
  userEmail: string;
  setUserEmail: (email: string) => void;
  userPhoto: string | null;
  updateProfileInfo: (name: string, photo: string | null) => void;
  userCurrency: string;
  updateCurrency: (id: string) => void;
  fmt: (n: number) => string;
  userLanguage: string;
  updateLanguage: (id: string) => void;
  updateCountry: (language: string, currency: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  monthNames: string[];
  themeMode: ThemeMode;
  updateThemeMode: (mode: ThemeMode) => void;

  month: Month;
  setMonth: (m: Month) => void;
  budgets: Record<string, number>;
  budget: number;
  spent: number;
  income: number;
  prevBalance: number;
  // ¿El mes que se está viendo tiene su Saldo anterior puesto en cero? La
  // pantalla lo usa para decidir si ofrecer "poner en cero" o "restaurar".
  // Cada mes es independiente: esto es cierto o falso mes por mes.
  carryoverActive: boolean;
  resetCarryover: () => void;
  restoreCarryover: () => void;
  autoSavings: number;
  /** Lo mismo que enseña Inicio como Disponible. */
  disponible: number;
  /** Lo que suman las metas sin cumplir. */
  apartado: number;
  /** Lo que se puede gastar sin tocar las metas. */
  libre: number;
  /** Hay mas apartado que dinero: se avisa, no se corrige solo. */
  descuadre: boolean;
  /** Cuanto mas se puede apartar sin pasarse. */
  maximoAApartar: number;
  monthLabel: string;
  setBudgetForCurrentMonth: (amount: number) => void;
  categoryBudgets: Record<string, number>;
  categorySpent: Record<string, number>;
  updateCategoryBudgets: (newBudgets: Record<string, number>) => void;
  // Nombre, color e imagen propios de cada categoria. Ver utils/categoryCustom.
  categoryOverrides: CategoryOverrides;
  updateCategoryOverrides: (next: CategoryOverrides) => void;
  /** Las categorias que creo la persona. */
  categoriasPropias: CategoriaPropia[];
  /**
   * Guarda los dibujos favoritos: en el celular Y en la copia de la cuenta.
   *
   * La pantalla de categorias llamaba directamente a saveFavoritos, que escribe el
   * disco pero no avisa al contexto. Con eso, marcar un favorito NO disparaba la
   * subida a la nube y se quedaba en este celular hasta que cambiara cualquier
   * otra cosa. Es el mismo fallo que ya tuvieron la personalizacion y las
   * categorias propias.
   */
  guardarFavoritos: (lista: string[]) => void;
  crearCategoria: (datos: {
    nombre: string;
    tipo: "expense" | "income";
    color: string;
    icono: string;
    image?: string;
  }) => string;
  /** La recien creada, para que la pantalla de agregar la deje elegida. */
  categoriaRecienCreada: string | null;
  olvidarCategoriaRecienCreada: () => void;
  /**
   * Deja una categoria elegida en la pantalla de agregar movimiento.
   *
   * Lo usa la pantalla de "Elegir categoria", que es otra pantalla: no puede
   * pasarle el dato de vuelta por una propiedad. Va por el mismo canal que la
   * recien creada —el significado es identico, "adopta esta categoria"— pero con
   * su propio nombre, para que en el sitio donde se llama se lea lo que hace.
   */
  elegirCategoriaEnMovimiento: (id: string) => void;
  editarCategoria: (
    id: string,
    // image en null es "quitar la foto". Sin ese null no habria forma de
    // distinguir "no la toques" de "borrala".
    cambios: { nombre?: string; color?: string; icono?: string; image?: string | null }
  ) => void;
  borrarCategoria: (id: string) => void;
  /** Cuantos movimientos quedarian en "Otros" al borrarla. */
  movimientosDeCategoria: (id: string) => number;

  transactions: Transaction[];
  addOrUpdateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: number) => void;
  deleteTransactions: (ids: number[]) => void;
  commitImport: (toAdd: Transaction[], toReplace: Transaction[]) => void;

  merchantLearned: Record<string, string>;
  learnMerchantCategory: (merchantText: string, category: string) => void;

  // ---- Captura automática desde notificaciones (solo Android) ----
  // ¿Existe siquiera en este celular? En iPhone y en versiones viejas de la
  // app es false, y la pantalla de ajustes lo explica en vez de mostrar un
  // interruptor que no haría nada.
  autoCaptureSupported: boolean;
  // ¿Android le dio a Finzo acceso a las notificaciones?
  autoCapturePermission: boolean;
  // Interruptor propio de Finzo, aparte del permiso de Android.
  autoCaptureOn: boolean;
  setAutoCaptureOn: (value: boolean) => void;
  openAutoCaptureSettings: () => void;
  refreshAutoCapture: () => void;
  // Últimas notificaciones vistas y qué se hizo con cada una.
  autoCaptureLog: CaptureLogEntry[];
  clearAutoCaptureLog: () => void;

  goals: Goal[];
  addOrUpdateGoal: (g: Goal) => void;
  deleteGoal: (id: number) => void;
  addMoneyToGoal: (amount: number, goalId: number) => void;
  withdrawMoneyFromGoal: (goalId: number, amount: number) => void;

  /**
   * ¿Tiene Premium AHORA MISMO? Es el de la cuenta O la prueba gratuita corriendo.
   *
   * Las pantallas solo necesitan esta respuesta, y por eso la suma se hace en un
   * unico sitio: si cada pantalla tuviera que acordarse de mirar tambien la prueba,
   * alguna se quedaria sin hacerlo y ahi la prueba no serviria de nada.
   */
  isPremium: boolean;
  /** Cuando empezo la prueba gratuita, o null si no se ha usado. */
  pruebaInicio: number | null;
  /** Cuantas horas le quedan a la prueba. Cero si no hay ninguna corriendo. */
  pruebaHoras: number;
  /** Enciende la prueba gratuita. Devuelve false si ya se habia usado. */
  activarPruebaPremium: () => boolean;
  /**
   * MODO NEGOCIO (V1). Los negocios de esta cuenta, y cómo cambiarlos.
   *
   * Se expone la lista y no los datos enteros: los productos y las ventas los pedirá cada
   * pantalla suya cuando toque, y sacarlos todos por aquí haría que cualquier pantalla que
   * lea el contexto se redibuje al vender.
   */
  negocios: Negocio[];
  /** Crea uno nuevo o reemplaza el que tenga ese id. Devuelve el negocio guardado. */
  guardarNegocio: (negocio: Negocio) => void;
  /** Borra el negocio Y TODO LO SUYO: sus productos y sus ventas. */
  quitarNegocio: (id: string) => void;
  /**
   * Manda los yapeos que ENTREN a la caja de este negocio, o los devuelve a lo personal.
   *
   * Encender uno apaga los demás: con dos negocios recibiendo, el mismo yapeo tendría dos
   * destinos y la respuesta dependería del orden de la lista.
   */
  mandarYapesAlNegocio: (id: string, activar: boolean) => void;
  /**
   * Los productos de TODOS los negocios. Cada pantalla filtra por el suyo.
   *
   * Se reparte la lista entera y no la de un negocio porque el contexto no sabe en qué
   * negocio se está: pasarle el negocio obligaría a un hook por negocio, y la lista completa
   * de una pollería son treinta nombres con su precio. No es un dato grande.
   */
  productos: Producto[];
  /** Crea uno nuevo o reemplaza el que tenga ese id. */
  guardarProducto: (producto: Producto) => void;
  /** Borra un producto. NO toca las ventas que lo incluían: ver utils/negocio. */
  quitarProducto: (id: string) => void;
  /**
   * Las ventas de TODOS los negocios, igual que los productos: cada pantalla filtra la suya.
   *
   * Y NO SE MEZCLAN CON "transactions" NI AQUÍ: son dos listas distintas en el contexto
   * porque son dos bolsillos distintos en la vida real. Es la decisión de arquitectura de
   * todo el Modo Negocio, y aquí es donde se podría deshacer sin querer.
   */
  ventas: Venta[];
  /** Crea una venta o reemplaza la que tenga ese id. */
  guardarVenta: (venta: Venta) => void;
  /** Borra una venta. La de un cobro que no fue, o la que se registró dos veces. */
  quitarVenta: (id: string) => void;
  /**
   * La plata que entra y sale de la CAJA del negocio: el pollo que se compró, el Yape que
   * entrará solo en el paso siguiente.
   *
   * Se llama "movimientosNegocio" y no "movimientos" a propósito: en esta app "movimiento"
   * es lo personal —lo que la pantalla de Inicio suma— y dos nombres iguales para dos
   * bolsillos distintos es justo el descuido que mezclaría la plata del negocio con la de
   * casa.
   */
  movimientosNegocio: MovimientoNegocio[];
  /** Anota plata que entra o sale de la caja del negocio. */
  guardarMovimientoNegocio: (movimiento: MovimientoNegocio) => void;
  /** Borra un movimiento del negocio. */
  quitarMovimientoNegocio: (id: string) => void;
  setIsPremium: (v: boolean) => void;
  /**
   * Mirar la app como alguien que no paga. **Solo quita Premium, nunca lo da.**
   *
   * `tienePremiumDeVerdad` es lo que hay debajo del disfraz: la pantalla de Acerca de necesita
   * saberlo para enseñar el interruptor únicamente a quien tiene algo que quitarse.
   */
  verComoGratis: boolean;
  setVerComoGratis: (v: boolean) => void;
  tienePremiumDeVerdad: boolean;
  isCloudSynced: boolean;
  // Modo señuelo. Solo los llama la pantalla de bloqueo; ninguna otra parte
  // de la app sabe que esto existe, y esa es la idea.
  enterDecoyMode: () => Promise<void>;
  leaveDecoyMode: () => Promise<void>;

  celebrateGoal: string | null;
  clearCelebration: () => void;

  toast: string;
  showToast: (msg: string) => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function currentRealMonth(): Month {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [userCurrency, setUserCurrency] = useState("PEN");
  const [userLanguage, setUserLanguage] = useState("es");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [month, setMonth] = useState<Month>(currentRealMonth);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [categoryOverrides, setCategoryOverridesState] = useState<CategoryOverrides>({});
  // Igual que la personalizacion: el dato de verdad vive en la variable de
  // modulo que consulta catInfo, y este estado existe para redibujar.
  const [categoriasPropias, setCategoriasPropiasState] = useState<CategoriaPropia[]>([]);
  /**
   * Los dibujos favoritos, tambien como estado.
   *
   * El dato de verdad vive en la variable de modulo que lee la pantalla de
   * categorias; esto existe por UN motivo concreto: la subida a la nube es un
   * efecto que se dispara cuando cambia algo de su lista de dependencias, y una
   * variable de modulo no dispara nada. Sin este estado, marcar un favorito se
   * guardaba en el celular y no se subia hasta que cambiara cualquier otra cosa
   * — es el mismo fallo que ya tuvieron la personalizacion y las categorias
   * propias, y esta anotado en las dependencias de ese efecto.
   */
  const [iconosFavoritos, setIconosFavoritosState] = useState<string[]>([]);
  // Se crea desde otra pantalla, encima de la de agregar. Al volver hay que
  // dejarla elegida: nadie crea una categoria para despues buscarla.
  const [categoriaRecienCreada, setCategoriaRecienCreada] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions);
  const [goals, setGoals] = useState<Goal[]>(seedGoals);
  /**
   * El Premium DE LA CUENTA: el que se guarda en el celular y viaja a la nube.
   *
   * Se llama distinto que el "isPremium" que ven las pantallas a propósito. Ese es
   * la suma de este MÁS la prueba gratuita, y son dos cosas que no se pueden
   * mezclar: si se guardara la suma, activar la prueba dejaría marcado Premium para
   * siempre, y al caducar se apagaría también el de quien ya lo tenía de antes.
   */
  const [isPremiumDeLaCuenta, setIsPremium] = useState(false);
  /** Cuándo se activó la prueba gratuita, o null. Solo de este celular. */
  const [pruebaInicio, setPruebaInicio] = useState<number | null>(null);
  /**
   * Se mueve solo para que la prueba caduque a la vista.
   *
   * Sin esto, "¿tiene Premium?" se calcula al dibujar y nadie vuelve a dibujar
   * cuando pasa la hora: la prueba seguiría abierta hasta que la persona tocara
   * cualquier otra cosa. Un minuto es de sobra para una cuenta de 24 horas, y no
   * hace nada mientras no haya prueba corriendo.
   */
  /**
   * MODO NEGOCIO (V1). Los negocios, sus productos y sus ventas.
   *
   * VA EN SU PROPIO ESTADO Y NO DENTRO DE "transactions", que es la decisión de arquitectura
   * de toda la función: la plata del negocio no puede mezclarse con la personal ni en los
   * totales, y guardándola aparte eso no depende de acordarse de filtrar en los 16 sitios
   * que leen movimientos. Ver utils/negocio.
   */
  const [datosNegocio, setDatosNegocio] = useState<DatosDelNegocio>(NEGOCIO_VACIO);

  const [ahora, setAhora] = useState(() => Date.now());
  const pruebaCorriendo = pruebaVigente(pruebaInicio, ahora);
  useEffect(() => {
    if (!pruebaCorriendo) return;
    const reloj = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(reloj);
  }, [pruebaCorriendo]);
  /**
   * VER LA APP COMO ALGUIEN SIN PREMIUM, a propósito y desde Acerca de.
   *
   * Existe para poder comprobar los candados con los ojos en vez de fiándose del código: el
   * 08/08/2026 se cambió qué se puede ver sin Premium, y la única forma de saber si quedó bien
   * es mirarlo.
   *
   * **NO PUEDE DAR PREMIUM A NADIE, y eso es lo que lo hace seguro de publicar.** Solo QUITA.
   * Un interruptor escondido que lo diera sería una puerta trasera —siete toques y Premium
   * gratis— y esto es lo contrario: encenderlo solo puede hacer que veas menos.
   *
   * No se guarda en el disco: se suelta al cerrar la app. Un modo de prueba que sobrevive a
   * reiniciar es un modo de prueba que alguien deja puesto sin querer y no entiende por qué su
   * Premium desapareció.
   */
  const [verComoGratis, setVerComoGratis] = useState(false);

  /** Lo que ven las pantallas: Premium de la cuenta O prueba corriendo. */
  const isPremium = (isPremiumDeLaCuenta || pruebaCorriendo) && !verComoGratis;
  // Lo que la persona le enseñó al clasificador de importaciones:
  // { "primax": "transporte", ... }. Ver utils/classifier.ts.
  const [merchantLearned, setMerchantLearned] = useState<Record<string, string>>({});
  // Meses cuyo "Saldo anterior" se muestra en cero ("AAAA-MM"), cada uno
  // independiente del resto. Lo maneja el botón de Inicio.
  const [carryoverCleared, setCarryoverCleared] = useState<string[]>([]);
  // Captura automática desde notificaciones. El estado real vive en el
  // módulo nativo (sobrevive a que la app se cierre); aquí solo tenemos un
  // reflejo para pintar la pantalla de ajustes.
  const [autoCaptureOn, setAutoCaptureOnState] = useState(false);
  const [autoCapturePermission, setAutoCapturePermission] = useState(false);
  const [autoCaptureLog, setAutoCaptureLog] = useState<CaptureLogEntry[]>([]);
  const [celebrateGoal, setCelebrateGoal] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El "uid" de la cuenta que inició sesión de verdad (y ya verificó su
  // correo). Mientras esto no tenga un valor, no subimos nada a la nube.
  const [uid, setUid] = useState<string | null>(null);

  // Una versión de fmt() ya conectada a la moneda elegida — toda la app
  // la usa a través del contexto, así que se actualiza en el mismo
  // instante en que cambia userCurrency, sin pasos intermedios.
  function fmt(n: number) {
    return formatAmount(n, currencySymbolFor(userCurrency));
  }

  // Traduce un texto según el idioma elegido. Si falta esa traducción en
  // ese idioma, usa el español como respaldo (para nunca mostrar nada
  // vacío o roto). "vars" reemplaza cosas como {amount} o {count}.
  function t(key: string, vars?: Record<string, string | number>) {
    const dict = translations[userLanguage as keyof typeof translations] || translations.es;
    let text = dict[key] ?? translations.es[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        // replaceAll, no replace: con replace solo se sustituía la PRIMERA
        // aparición, así que un texto que usara la misma variable dos veces
        // mostraba un "{month}" crudo en la segunda. No había ningún texto
        // así todavía, pero es una trampa fácil de pisar al traducir.
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  }

  const monthNames = monthNamesFor(userLanguage);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user && user.emailVerified ? user.uid : null);
    });
    return unsubscribe;
  }, []);

  // Cada vez que cargamos datos ya guardados, avisamos al generador de
  // números cuál es el más alto que ya existe. Así un movimiento nuevo
  // nunca reutiliza el número de uno viejo (que lo reemplazaría en vez de
  // agregarse).
  function protectExistingIds(loadedTransactions: Transaction[], loadedGoals: Goal[]) {
    const ids = [...loadedTransactions.map((x) => x.id), ...loadedGoals.map((x) => x.id)];
    if (ids.length > 0) reserveIdsAbove(Math.max(...ids));
  }

  /**
   * TODO lo que va a la copia de la cuenta, en UN SOLO SITIO.
   *
   * POR QUÉ, Y NO ESCRITO EN CADA SUBIDA
   *
   * Había dos: la subida normal (que espera un segundo y medio tras cada cambio) y
   * la de cerrar sesión. Al añadir los dibujos favoritos el 07/08/2026, la primera
   * los llevaba y la segunda no — y subir REEMPLAZA el documento entero, así que
   * cerrar sesión los habría borrado de la nube justo después de guardarlos.
   *
   * No es la primera vez: es el mismo fallo que ya pasó con la personalización y
   * con las categorías propias. Con un solo armador, un campo nuevo entra en las
   * dos subidas a la vez y no hay una segunda lista que acordarse de tocar.
   */
  function datosParaLaNube(): CloudData {
    return {
      hasOnboarded,
      userName,
      userPhoto,
      userCurrency,
      userLanguage,
      budgets,
      categoryBudgets,
      transactions,
      goals,
      // EL DE LA CUENTA, no el que ven las pantallas: la prueba gratuita no puede
      // subirse como Premium comprado. Si se subiera, al caducar quedaria marcado
      // en la nube y volveria en cualquier celular donde se entrara.
      isPremium: isPremiumDeLaCuenta,
      merchantLearned,
      categoryOverrides,
      categoriasPropias,
      carryoverCleared,
      // SIN LAS FOTOS: paraLaNube las quita. Todo este documento tiene un tope de
      // 1 MB compartido con los movimientos, y pasarse no lo deja a medias: lo
      // deja sin guardar. Ver la nota en utils/iconosFavoritos.
      iconosFavoritos: paraLaNube(iconosFavoritos),
    };
  }

  // Trae lo que haya guardado en la nube para esta cuenta (por ejemplo,
  // al iniciar sesión desde un celular nuevo). Si no hay nada guardado
  // todavía, no hace nada y devuelve "false".
  async function hydrateFromCloud(userUid: string): Promise<boolean> {
    const cloud = await loadCloudData(userUid);
    if (!cloud) return false;
    setUserName(cloud.userName);
    setUserPhoto(cloud.userPhoto);
    setUserCurrency(cloud.userCurrency);
    setUserLanguage(cloud.userLanguage);
    setBudgets(cloud.budgets);
    setCategoryBudgets(cloud.categoryBudgets);
    setTransactions(cloud.transactions);
    setGoals(cloud.goals);
    protectExistingIds(cloud.transactions, cloud.goals);
    setIsPremium(cloud.isPremium);
    setMerchantLearned(cloud.merchantLearned ?? {});
    // La personalizacion va a los DOS sitios: a la variable de modulo que
    // consulta catInfo, y al estado que provoca el redibujado. Solo con el
    // estado, las pantallas se dibujarian con los datos viejos.
    //
    // Y con saveOverrides —no setOverrides— para que ADEMAS quede en el disco de
    // este celular. Con setOverrides se quedaba solo en memoria: al cerrar y
    // volver a abrir la app se leia el disco, que estaba vacio, y la
    // personalizacion desaparecia otra vez.
    saveOverrides(cloud.categoryOverrides ?? {});
    setCategoryOverridesState(cloud.categoryOverrides ?? {});
    // Igual que la personalizacion: a la variable de modulo que consulta
    // catInfo, al estado, Y al disco.
    savePropias(cloud.categoriasPropias ?? []);
    setCategoriasPropiasState(cloud.categoriasPropias ?? []);
    // Y los dibujos favoritos, a los tres sitios igual. Ver paraLaNube: en la
    // nube van sin las fotos propias.
    saveFavoritos(cloud.iconosFavoritos ?? []);
    setIconosFavoritosState(cloud.iconosFavoritos ?? []);
    setCarryoverCleared(cloud.carryoverCleared ?? []);
    setHasOnboarded(true);
    saveJSON(STORAGE_KEYS.profile, {
      userName: cloud.userName,
      userEmail,
      userPhoto: cloud.userPhoto,
      userCurrency: cloud.userCurrency,
      userLanguage: cloud.userLanguage,
      hasOnboarded: true,
    });
    saveJSON(STORAGE_KEYS.budgets, cloud.budgets);
    saveJSON(STORAGE_KEYS.categoryBudgets, cloud.categoryBudgets);
    saveJSON(STORAGE_KEYS.transactions, cloud.transactions);
    saveJSON(STORAGE_KEYS.goals, cloud.goals);
    saveJSON(STORAGE_KEYS.isPremium, cloud.isPremium);
    saveJSON(STORAGE_KEYS.merchantLearned, cloud.merchantLearned ?? {});
    saveJSON(STORAGE_KEYS.carryoverCleared, cloud.carryoverCleared ?? []);

    /**
     * Y EL NEGOCIO, QUE VIVE EN OTRO DOCUMENTO.
     *
     * Va con su propia llamada porque es otro documento de Firestore, no un campo de este.
     * Si esta línea faltara, el negocio se subiría bien y **no bajaría nunca**: quien entrara
     * desde otro celular vería sus movimientos personales y el negocio vacío, con las ventas
     * y los precios a salvo en la nube.
     *
     * No es una suposición: eso pasó exactamente el 07/08/2026 con las categorías propias y
     * la personalización — estaban en el tipo, se subían, y aquí no se leían.
     *
     * Si no hay nada en la nube se deja lo que haya en el celular: puede ser un negocio
     * creado sin sesión, y borrarlo por venir vacío de la nube sería perderlo.
     */
    const negocioDeLaNube = await bajarNegocio(userUid);
    if (negocioDeLaNube) {
      setDatosNegocio(negocioDeLaNube);
      guardarNegocios(negocioDeLaNube.negocios);
      guardarProductos(negocioDeLaNube.productos);
      guardarVentas(negocioDeLaNube.ventas);
      // Y LA CAJA. Faltaba esta línea: los gastos y los ingresos del negocio bajaban de la
      // nube, se veían en la pantalla, y al reiniciar la app volvían a estar vacíos porque
      // nunca se habían escrito en el celular. Es el mismo fallo de las categorías propias,
      // una lista más abajo.
      guardarMovimientosNegocio(negocioDeLaNube.movimientos);
    }
    return true;
  }

  /**
   * Entra en el modo señuelo: la app pasa a leer y escribir en un almacén
   * aparte y deja de hablar con la nube.
   *
   * El orden importa y no es intercambiable:
   *
   *  1. Se escribe YA lo que estuviera en cola. Son cambios de la cuenta
   *     REAL; si se quedaran encolados, se escribirían después del cambio de
   *     modo y acabarían dentro del señuelo — datos de verdad guardados en
   *     el almacén falso, y perdidos del bueno.
   *  2. Se enciende el interruptor. A partir de aquí todo va al otro lado.
   *  3. Si es la primera vez, se siembran los movimientos inventados.
   *  4. Se recargan los datos, que ahora salen del almacén del señuelo.
   */
  async function enterDecoyMode() {
    await flushPendingSaves();
    activateDecoy();

    const existing = await loadJSON<Transaction[]>(STORAGE_KEYS.transactions, []);
    if (existing.length === 0) {
      const fake = buildDecoyTransactions();
      saveJSON(STORAGE_KEYS.transactions, fake);
      saveJSON(STORAGE_KEYS.budgets, { [monthKey(new Date().getFullYear(), new Date().getMonth())]: DECOY_BUDGET });
      saveJSON(STORAGE_KEYS.goals, []);
      saveJSON(STORAGE_KEYS.categoryBudgets, {});
      saveJSON(STORAGE_KEYS.merchantLearned, {});
      saveJSON(STORAGE_KEYS.carryoverCleared, []);
      // El señuelo NO es Premium. Si lo fuera, quien mire podría entrar a
      // Ajustes → Bloqueo y encontrarse la pantalla del PIN, que es
      // justamente lo que no debe existir en esta versión de la app.
      saveJSON(STORAGE_KEYS.isPremium, false);
      await flushPendingSaves();
    }

    await reloadPersistedData();
  }

  /** Vuelve a la cuenta real. Solo desde la pantalla de bloqueo. */
  async function leaveDecoyMode() {
    await flushPendingSaves();
    deactivateDecoy();
    await reloadPersistedData();
  }

  async function reloadPersistedData() {
    const [
      savedBudgets,
      savedCategoryBudgets,
      savedTransactions,
      savedGoals,
      savedIsPremium,
      savedLearned,
      savedCarryoverCleared,
      savedOverrides,
      savedPropias,
      savedFavoritos,
      savedPrueba,
      savedNegocio,
    ] = await Promise.all([
      loadJSON<Record<string, number>>(STORAGE_KEYS.budgets, {}),
      loadJSON<Record<string, number>>(STORAGE_KEYS.categoryBudgets, {}),
      loadJSON<Transaction[]>(STORAGE_KEYS.transactions, seedTransactions),
      loadJSON<Goal[]>(STORAGE_KEYS.goals, seedGoals),
      loadJSON<boolean>(STORAGE_KEYS.isPremium, false),
      loadJSON<Record<string, string>>(STORAGE_KEYS.merchantLearned, {}),
      loadJSON<string[]>(STORAGE_KEYS.carryoverCleared, []),
      // La personalizacion de categorias se carga en la variable de modulo
      // que consulta catInfo, y ademas al estado para que las pantallas se
      // dibujen con ella desde el primer momento.
      loadOverrides(),
      // Y las categorias propias, por el mismo motivo: catInfo las consulta
      // desde una variable de modulo, no desde el contexto.
      loadPropias(),
      // Los iconos favoritos, tambien en variable de modulo: la pantalla de
      // crear categoria los necesita al dibujarse, y leer el disco en cada
      // letra que se escribe seria leer el disco decenas de veces.
      loadFavoritos(),
      // Cuando se activo la prueba gratuita, si se activo. Ver utils/pruebaPremium.
      loadPrueba(),
      // El negocio: sus negocios, productos y ventas. Ver utils/negocio.
      cargarNegocio(),
    ]);
    setBudgets(savedBudgets);
    setCategoryBudgets(savedCategoryBudgets);
    setCategoryOverridesState(savedOverrides);
    setCategoriasPropiasState(savedPropias);
    setIconosFavoritosState(savedFavoritos);
    setPruebaInicio(savedPrueba);
    setTransactions(savedTransactions);
    setGoals(savedGoals);
    protectExistingIds(savedTransactions, savedGoals);
    setIsPremium(savedIsPremium);
    setMerchantLearned(savedLearned);
    setCarryoverCleared(savedCarryoverCleared);
    setDatosNegocio(savedNegocio);
  }

  // Cierra la sesión de verdad (Firebase) y limpia los datos de este
  // celular, para que la siguiente cuenta que inicie sesión aquí no vea
  // los movimientos/metas de la cuenta anterior.
  async function logout() {
    // Antes de salir, espera a que el último cambio (por ejemplo, la
    // moneda que acabas de elegir) termine de subirse a la nube. Si no
    // se espera esto, cerrar sesión muy rápido después de un cambio
    // podía "perderlo": ya no quedaba ni en el celular (se borra abajo)
    // ni en la nube (no le había dado tiempo de subir).
    if (uid) await saveCloudData(uid, datosParaLaNube());
    // También hay que salir del lado de Google. Si no, la próxima vez que
    // alguien pulse "Continuar con Google" entraría directo con la última
    // cuenta usada, sin poder elegir otra — un problema real en un celular
    // compartido, y confuso al probar con varias cuentas.
    await signOutFromGoogle();
    await signOut(auth);
    // Borra todos los datos de la cuenta de forma atómica y esperada
    // ANTES de actualizar el estado. Si la app se cierra en este momento,
    // AsyncStorage ya está limpio y no hay riesgo de que al reabrir la
    // app se encuentre con datos de la sesión anterior.
    await clearAccountData();
    setHasOnboarded(false);
    setUserName("");
    setUserEmail("");
    setUserPhoto(null);
    setUserCurrency("PEN");
    setUserLanguage("es");
    setBudgets({});
    setCategoryBudgets({});
    setTransactions([]);
    setGoals([]);
    setIsPremium(false);
    setDatosNegocio(NEGOCIO_VACIO);
    // La prueba gratuita tambien se suelta: el disco ya se limpio, pero lo que
    // esta en memoria sobrevive y la cuenta siguiente entraria con la prueba de la
    // anterior a medio correr.
    setPruebaInicio(null);
    setMerchantLearned({});
    setCarryoverCleared([]);
  }

  // Antes de cambiar la contraseña o borrar la cuenta, Firebase exige
  // confirmar la contraseña actual — por seguridad, para que nadie más
  // haga estos cambios si te dejaste la sesión abierta en otro celular.
  async function reauthenticate(currentPassword: string) {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error("No hay una sesión activa.");
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    return user;
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const user = await reauthenticate(currentPassword);
    await updatePassword(user, newPassword);
  }

  // Borra la cuenta por completo: primero los datos en la nube (mientras
  // todavía se puede probar que es el dueño de la cuenta), luego la
  // cuenta de inicio de sesión, y por último todo lo guardado en este
  // celular. Es un cambio que no se puede deshacer.
  async function deleteAccount(currentPassword: string) {
    const user = await reauthenticate(currentPassword);
    await deleteCloudAccount(user.uid);
    await deleteUser(user);
    await clearAccountData();
    setHasOnboarded(false);
    setUserName("");
    setUserEmail("");
    setUserPhoto(null);
    setUserCurrency("PEN");
    setUserLanguage("es");
    setBudgets({});
    setCategoryBudgets({});
    setTransactions([]);
    setGoals([]);
    setIsPremium(false);
    setDatosNegocio(NEGOCIO_VACIO);
    // La prueba gratuita tambien se suelta: el disco ya se limpio, pero lo que
    // esta en memoria sobrevive y la cuenta siguiente entraria con la prueba de la
    // anterior a medio correr.
    setPruebaInicio(null);
    setMerchantLearned({});
    setCarryoverCleared([]);
  }

  useEffect(() => {
    async function init() {
      const savedTheme = await loadJSON<ThemeMode>(STORAGE_KEYS.themeMode, "system");
      setThemeMode(savedTheme);
      colorScheme.set(savedTheme);
      const profile = await loadJSON<Profile | null>(STORAGE_KEYS.profile, null);
      if (profile?.hasOnboarded) {
        setUserName(profile.userName);
        setUserPhoto(profile.userPhoto ?? null);
        setUserCurrency(profile.userCurrency || "PEN");
        setUserLanguage(profile.userLanguage || "es");
        setHasOnboarded(true);
        await reloadPersistedData();
      }
      setReady(true);
    }
    init();
    // Esto debe ejecutarse UNA sola vez, al abrir la app. Si añadiéramos
    // reloadPersistedData a la lista, se volvería a ejecutar en cada
    // recarga y pisaría los datos que la persona esté editando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * LE PASA LA MONEDA AL SERVICIO QUE HABLA (11/08/2026).
   *
   * La voz leía "S/ 1" tal cual y el celular pronunciaba "ese ene uno": un símbolo no es una
   * palabra. Para decir "un sol" hay que saber la moneda, y quien habla es el servicio de
   * Android —con Finzo cerrada—, que no puede leer los ajustes de la app.
   *
   * Así que se le deja escrita: al arrancar y cada vez que cambia. Es un dato suelto y
   * pequeño, no una copia de los ajustes: lo único que cambia es la palabra que se oye.
   */
  useEffect(() => {
    if (!ready) return;
    notificationReader.setMoneda(userCurrency);
  }, [userCurrency, ready]);

  // AQUÍ ESTABA EL COPIADO AUTOMÁTICO DEL PRESUPUESTO, quitado el 10/08/2026.
  //
  // Copiaba al mes en curso el último presupuesto puesto a mano, para no tener que escribirlo
  // doce veces al año. Duró un día: ver un número que nadie había escrito —y encima en meses
  // futuros, que se heredaban al leer— desconcertaba más de lo que ahorraba. El porqué entero
  // está en utils/presupuestoMensual.
  //
  // Cada mes empieza vacío. Es más trabajo, y es lo que se pidió.

  // Guardado automático: cada vez que algo cambia, se guarda solo.
  useEffect(() => {
    if (ready) saveJSON(STORAGE_KEYS.budgets, budgets);
  }, [budgets, ready]);
  useEffect(() => {
    if (ready) saveJSON(STORAGE_KEYS.categoryBudgets, categoryBudgets);
  }, [categoryBudgets, ready]);
  useEffect(() => {
    if (ready) saveJSON(STORAGE_KEYS.transactions, transactions);
  }, [transactions, ready]);
  useEffect(() => {
    if (ready) saveJSON(STORAGE_KEYS.goals, goals);
  }, [goals, ready]);
  useEffect(() => {
    // El de la cuenta. Guardando el que ven las pantallas, activar la prueba
    // dejaria Premium marcado para siempre en este celular.
    if (ready) saveJSON(STORAGE_KEYS.isPremium, isPremiumDeLaCuenta);
  }, [isPremiumDeLaCuenta, ready]);
  useEffect(() => {
    if (ready) saveJSON(STORAGE_KEYS.merchantLearned, merchantLearned);
  }, [merchantLearned, ready]);
  useEffect(() => {
    if (ready) saveJSON(STORAGE_KEYS.carryoverCleared, carryoverCleared);
  }, [carryoverCleared, ready]);
  // EL NEGOCIO, en sus cuatro claves. Se guardan las cuatro juntas porque cambian juntas:
  // una venta toca las ventas, pero borrar un negocio toca las cuatro a la vez.
  useEffect(() => {
    if (!ready) return;
    guardarNegocios(datosNegocio.negocios);
    guardarProductos(datosNegocio.productos);
    guardarVentas(datosNegocio.ventas);
    guardarMovimientosNegocio(datosNegocio.movimientos);
  }, [datosNegocio, ready]);

  /**
   * Y A LA NUBE, EN SU PROPIO DOCUMENTO.
   *
   * Va en un efecto aparte del de la cuenta a propósito: es OTRO documento de Firestore
   * (`negocios/{uid}`), porque en el de la cuenta no cabe — tiene tope de 1 MB y ahí ya
   * están todos los movimientos. Ver utils/cloudNegocio.
   *
   * Agrupado 1,5 s igual que el otro: sin agrupar, teclear el nombre de un producto mandaría
   * una subida por letra.
   */
  useEffect(() => {
    if (!(ready && hasOnboarded && uid)) return;
    const timer = setTimeout(() => {
      subirNegocio(uid, datosNegocio);
    }, 1500);
    return () => clearTimeout(timer);
  }, [datosNegocio, ready, hasOnboarded, uid]);

  // Además de guardar en este celular, si hay una cuenta con sesión
  // iniciada y correo verificado, también sube los datos a la nube.
  //
  // Va agrupado (1.5 s) por el mismo motivo que el guardado local, pero
  // más marcado: cada subida manda el conjunto COMPLETO de datos por
  // internet. Sin agrupar, una sola acción podía disparar varias subidas
  // idénticas seguidas — trabajo de red repetido y sin ningún beneficio,
  // porque cada una pisa a la anterior con lo mismo.
  //
  // Perder la última subida no pierde datos: el celular ya los tiene
  // guardados, y logout() sube todo explícitamente antes de cerrar sesión.
  useEffect(() => {
    if (!(ready && hasOnboarded && uid)) return;
    const timer = setTimeout(() => {
      saveCloudData(uid, datosParaLaNube());
    }, 1500);
    return () => clearTimeout(timer);
    // datosParaLaNube se queda FUERA de esta lista a propósito. Es una función que
    // se crea de nuevo en cada dibujado, así que incluirla dispararía una subida
    // por dibujado — internet gastado en mandar lo mismo. La lista de abajo son
    // los DATOS que decide subir: es lo que tiene que estar aquí, y el armador
    // solo los recoge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    hasOnboarded,
    uid,
    userName,
    userPhoto,
    userCurrency,
    userLanguage,
    budgets,
    categoryBudgets,
    transactions,
    goals,
    isPremium,
    merchantLearned,
    // Sin esto, personalizar una categoria se quedaba solo en el celular:
    // la subida a la nube no se rehacia y al entrar desde otro telefono
    // volvian los nombres y colores de fabrica.
    categoryOverrides,
    // Y lo mismo con las categorias creadas: crear "Broster" no disparaba la
    // subida, asi que se guardaba en el celular y desaparecia al cambiar de
    // telefono. El aviso del linter estaba senalando ese fallo exacto.
    categoriasPropias,
    // Y lo mismo con los favoritos: marcar uno no disparaba la subida, asi que se
    // quedaba en el celular. Por eso hay un estado ademas de la variable de
    // modulo — ver iconosFavoritos arriba.
    iconosFavoritos,
    carryoverCleared,
  ]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  // ---------------------------------------------------------------------
  // CAPTURA AUTOMÁTICA DESDE NOTIFICACIONES
  // ---------------------------------------------------------------------
  // El servicio de Android va guardando en el celular las notificaciones de
  // apps de dinero, incluso con Finzo cerrada. Aquí las recogemos cada vez
  // que la app se abre o vuelve al frente — que es justo cuando la persona
  // regresa de Yape.
  //
  // Se hace así, y no reaccionando al instante a cada notificación, porque
  // Android limita mucho lo que una app puede ejecutar en segundo plano y
  // los fabricantes cierran procesos por batería. Recoger al volver es lo
  // único que funciona igual de bien en todos los celulares.

  // Los valores más recientes, para que la recogida use los movimientos y
  // categorías de ahora sin tener que volver a montar el escuchador cada
  // vez que cambia algo.
  //
  // Se actualiza dentro de un useEffect y no directamente al dibujar porque
  // este proyecto usa el compilador de React: si se escribiera al dibujar,
  // el compilador podría saltarse ese paso y la recogida acabaría usando
  // una lista de movimientos vieja (y registrando repetidos).
  //
  // EL NEGOCIO TAMBIÉN VA AQUÍ, y no leído del estado dentro de la recogida: la recogida
  // corre desde un escuchador y desde un temporizador que se montan una vez, así que ahí
  // dentro el estado sería el de cuando se montaron. Un yapeo habría acabado en el bolsillo
  // que estaba elegido al abrir la app, no en el de ahora.
  const captureInputs = useRef({ transactions, merchantLearned, t, negocio: datosNegocio });
  useEffect(() => {
    captureInputs.current = { transactions, merchantLearned, t, negocio: datosNegocio };
  });
  // Evita que dos recogidas se pisen (abrir la app y volver al frente casi
  // a la vez): sin esto, las dos vaciarían el buzón y se duplicaría todo.
  const captureBusy = useRef(false);

  useEffect(() => {
    let alive = true;
    loadJSON<CaptureLogEntry[]>(STORAGE_KEYS.autoCaptureLog, []).then((saved) => {
      if (alive && Array.isArray(saved)) setAutoCaptureLog(saved);
    });
    if (notificationReader.isSupported) {
      setAutoCaptureOnState(notificationReader.isEnabled());
      setAutoCapturePermission(notificationReader.isPermissionGranted());
    }
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (ready) saveJSON(STORAGE_KEYS.autoCaptureLog, autoCaptureLog);
  }, [autoCaptureLog, ready]);

  useEffect(() => {
    if (!(ready && hasOnboarded && notificationReader.isSupported)) return;

    /**
     * Vuelve a leer del disco y se queda con TODO lo que haya.
     *
     * La app guarda la lista entera cada vez que cambia algo. Mientras solo
     * escriba ella eso funciona, pero en cuanto algo más escriba —el servicio
     * registrando un yapeo con la app cerrada— la lista de memoria se queda
     * vieja y el siguiente guardado la pisa entera: el movimiento desaparece
     * sin dejar rastro.
     *
     * Con dinero eso no es un despiste. Es un movimiento que existió y ya no
     * está, y nadie se entera hasta que las cuentas no cuadran.
     */
    async function recogerDelDisco() {
      try {
        const [guardadas, registro] = await Promise.all([
          loadJSON<Transaction[]>(STORAGE_KEYS.transactions, []),
          loadJSON<CaptureLogEntry[]>(STORAGE_KEYS.autoCaptureLog, []),
        ]);
        setTransactions((memoria) =>
          hayNovedades(memoria, guardadas) ? mergeTransactions(memoria, guardadas) : memoria
        );
        // Y EL REGISTRO DE AVISOS, IGUAL.
        //
        // Se leía del disco UNA sola vez, al arrancar. El trabajo de fondo
        // también escribe ahí, así que un yapeo registrado con la app en
        // segundo plano quedaba en los movimientos pero NO en esta lista
        // hasta cerrar la app del todo. Justo la pantalla a la que se recurre
        // para comprobar si un yapeo llegó.
        if (Array.isArray(registro)) {
          setAutoCaptureLog((memoria) => mergeCaptureLog(memoria, registro));
        }
        // Y LA CAJA DEL NEGOCIO, POR LO MISMO. Desde el paso 5, el trabajo de fondo también
        // escribe ahí: un yapeo que entra al negocio con la app cerrada quedaría en el disco,
        // y el siguiente guardado de la app —que tiene su lista de memoria vieja— lo pisaría.
        const caja = await loadJSON<MovimientoNegocio[]>(STORAGE_KEYS.movimientosNegocio, []);
        const cajaDelDisco = Array.isArray(caja) ? caja : [];
        if (cajaDelDisco.length > 0) {
          setDatosNegocio((antes) => {
            const juntos = fusionarMovimientosNegocio(antes.movimientos, cajaDelDisco);
            // La misma referencia si no hay nada nuevo: esto corre cada ocho segundos, y un
            // objeto nuevo cada vez volvería a guardar y a subir el negocio entero sin motivo.
            return juntos === antes.movimientos ? antes : { ...antes, movimientos: juntos };
          });
        }
        // SE DEVUELVE, ADEMÁS DE GUARDARSE. Lo de arriba entra en el estado, y el estado no
        // está listo hasta el siguiente dibujo — pero el reparto de un yapeo ocurre en esta
        // misma pasada y necesita saber qué hay YA en la caja para no registrarlo dos veces.
        // Con la lista del estado, un yapeo que el trabajo de fondo acabara de anotar podría
        // volver a entrar. Un ingreso duplicado en una caja no se ve: solo infla el saldo.
        return cajaDelDisco;
      } catch {
        // Si no se puede leer, se sigue con lo que hay en memoria. Nunca se
        // borra nada por no haber podido leer.
      }
      return [] as MovimientoNegocio[];
    }

    async function collect() {
      // Antes que nada, recoger lo que se haya escrito por fuera.
      const cajaDelDisco = await recogerDelDisco();

      if (captureBusy.current) return;
      // El permiso de Android se puede quitar desde los ajustes del sistema
      // en cualquier momento, así que se comprueba en cada recogida.
      if (!notificationReader.isEnabled() || !notificationReader.isPermissionGranted()) return;

      captureBusy.current = true;
      try {
        // Lo que un trabajo de fondo saco del buzon y no llego a registrar.
        //
        // Va PRIMERO y junto con lo del buzon: si Android corto el proceso a
        // medias, ese yapeo no esta ni registrado ni en el buzon, y sin esto
        // no lo veria nadie nunca.
        const delBuzon = await notificationReader.drain();
        const aMedias = (await pendientesDeCaptura()) as typeof delBuzon;
        const captured = [...aMedias, ...delBuzon];
        if (captured.length === 0) return;

        const {
          transactions: current,
          merchantLearned: learned,
          t: translate,
          negocio: datosDelNegocio,
        } = captureInputs.current;
        const { toAdd, log, avisoDe } = processCaptured(captured, current, learned, translate);

        /**
         * Y AQUÍ SE REPARTE: qué se queda en lo personal y qué entra a la caja del negocio.
         *
         * Va DESPUÉS de processCaptured y no dentro: el camino personal —entender el aviso,
         * descartar repetidos, dejar el registro— sigue haciendo exactamente lo de siempre.
         * Y si no hay ningún negocio recibiendo yapeos, que es como está por defecto,
         * separarLoDelNegocio devuelve la lista tal cual entró.
         */
        const receptor = negocioQueRecibeYapes(datosDelNegocio.negocios);
        const { personales, delNegocio } = separarLoDelNegocio(
          toAdd,
          avisoDe,
          receptor,
          // LA CAJA DE MEMORIA **Y** LA DEL DISCO. Un yapeo que el trabajo de fondo acabara de
          // anotar está en el disco y todavía no en el estado, y sin juntarlas volvería a
          // entrar. Ver recogerDelDisco.
          fusionarMovimientosNegocio(datosDelNegocio.movimientos, cajaDelDisco)
        );

        limpiarPendientes();
        setAutoCaptureLog((prev) => [...prev, ...log].slice(-40));
        if (personales.length > 0) {
          setTransactions((prev) => [...personales, ...prev]);
        }
        if (delNegocio.length > 0) {
          setDatosNegocio((antes) => ({ ...antes, movimientos: [...antes.movimientos, ...delNegocio] }));
        }
        // UN SOLO AVISO, Y DICE A DÓNDE FUE. Con dos mensajes seguidos —uno por cada
        // bolsillo— el segundo pisa al primero y no se llega a leer ninguno. Y si no se
        // dijera a dónde fue, un yapeo que "desaparece" de Inicio parecería un fallo.
        if (delNegocio.length > 0) {
          showToast(translate("autoCapture.toastNegocio", { count: delNegocio.length }));
        } else if (personales.length > 0) {
          showToast(
            translate(personales.length > 1 ? "autoCapture.toastPlural" : "autoCapture.toast", {
              count: personales.length,
            })
          );
        }
      } catch {
        // Un fallo aquí no debe impedir que la app se abra. Lo capturado
        // sigue en el buzón del celular y se reintenta la próxima vez.
      } finally {
        captureBusy.current = false;
      }
    }

    collect();

    // Y CADA POCO, MIENTRAS LA APP ESTE EN PANTALLA.
    //
    // Sin esto, un yapeo que llega con Finzo abierta no se registraba hasta
    // salir y volver a entrar. El trabajo de fondo no lo toca a proposito
    // —con la app delante lo hace ella, y hacerlo los dos seria registrarlo
    // dos veces— pero la app solo recogia al VOLVER al frente. Estando ya
    // delante no volvia nunca, asi que el yapeo se quedaba esperando.
    //
    // Ocho segundos: si el buzon esta vacio, recoger no cuesta nada.
    const cada = setInterval(collect, 8000);

    // EN EL MOMENTO EN QUE LLEGA EL YAPEO.
    //
    // El servicio de Android avisa aquí en cuanto captura un aviso de dinero,
    // y se registra al instante: no hay que esperar al repaso de arriba.
    //
    // El repaso se queda igualmente. Este aviso solo llega si el APK trae esa
    // parte y si la app está viva para escucharlo; el repaso cubre todo lo
    // demás —un APK anterior, un aviso que llegó con la app cerrada— y no
    // duplica nada, porque el buzón se vacía de una sola vez.
    const alLlegar = notificationReader.onCapture(() => {
      collect();
    });

    /**
     * PEDIRLE A ANDROID QUE VUELVA A ENGANCHAR EL LECTOR DE AVISOS.
     *
     * ESTE ERA EL FALLO DE "DESPUÉS DE INSTALAR EL APK DEJÓ DE HABLAR" (07/08/2026).
     *
     * Dar el permiso y que el lector esté ENGANCHADO son dos cosas distintas. Al
     * actualizar la app, Android mata el proceso del lector y **no lo vuelve a
     * enganchar**: en los ajustes del sistema el permiso sigue dado —así que desde fuera
     * todo parece bien— pero el lector no recibe ni un aviso. Ni registra ni habla.
     *
     * El servicio ya pedía reengancharse él mismo, pero solo en `onListenerDisconnected`,
     * y ese aviso NO LLEGA cuando se actualiza la app: el proceso muere de golpe, sin que
     * nadie pueda avisar de nada. Nadie pedía la reconexión.
     *
     * Y se podía arreglar a mano: hay un botón en "Captura automática". Pero eso es el
     * mismo error de siempre en este proyecto —*se puede* pero *no se encuentra*—: hay que
     * saber que el botón existe, que hay que tocarlo, y que hay que tocarlo justo después
     * de instalar. Nadie lo sabe.
     *
     * Ahora lo pide la app sola: al arrancar y cada vez que vuelve al frente. Pedirlo
     * cuando ya está enganchado no hace nada, así que se puede pedir tranquilamente.
     */
    function reengancharLector() {
      try {
        if (!notificationReader.isPermissionGranted()) return;
        notificationReader.requestRebind();
      } catch {
        // Una reconexión que falla no puede impedir que la app arranque.
      }
    }

    reengancharLector();

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      // Al volver al frente puede que la persona acabe de conceder (o
      // quitar) el permiso desde los ajustes de Android.
      setAutoCapturePermission(notificationReader.isPermissionGranted());
      // Y puede que Android haya tirado el lector mientras la app estaba en segundo
      // plano — los Honor y Huawei aprietan el ahorro de batería. Ver reengancharLector.
      reengancharLector();
      collect();
    });
    return () => {
      clearInterval(cada);
      alLlegar.remove();
      sub.remove();
    };
    // Solo depende de si la app ya está lista: los datos que necesita los
    // lee de captureInputs en el momento de recoger.
  }, [ready, hasOnboarded]);

  function setAutoCaptureOn(value: boolean) {
    notificationReader.setEnabled(value);
    setAutoCaptureOnState(notificationReader.isEnabled());
    if (!value) {
      // Al apagar se tira lo que quedara sin procesar: si la persona vuelve
      // a encender la función semanas después, no queremos que aparezcan de
      // golpe gastos de antes de apagarla.
      notificationReader.clear();
    }
  }

  function openAutoCaptureSettings() {
    notificationReader.openPermissionSettings();
  }

  function refreshAutoCapture() {
    if (!notificationReader.isSupported) return;
    setAutoCaptureOnState(notificationReader.isEnabled());
    setAutoCapturePermission(notificationReader.isPermissionGranted());
  }

  function clearAutoCaptureLog() {
    setAutoCaptureLog([]);
  }

  const mk = monthKey(month.y, month.m);
  /**
   * EL PRESUPUESTO DE ESTE MES, Y DE NINGÚN OTRO.
   *
   * Cada mes empieza vacío hasta que la persona escribe el suyo. Ver utils/presupuestoMensual,
   * donde está por qué se dio marcha atrás a la herencia el 10/08/2026.
   */
  const budget = presupuestoDelMes(budgets, mk);

  // Estos cálculos recorren TODOS los movimientos guardados, así que solo
  // se vuelven a hacer cuando los movimientos, los presupuestos o el mes
  // elegido cambian de verdad — no en cada pequeño cambio de pantalla.
  const { spent, income } = useMemo(() => {
    const mTx = transactions.filter((t) => t.date.startsWith(mk));
    const s = mTx.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    const i = mTx.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    return { spent: s, income: i };
  }, [transactions, mk]);

  // Cuánto se ha gastado este mes en cada categoría (solo gastos), para
  // compararlo contra el límite que la persona puso por categoría.
  const categorySpent = useMemo(() => {
    const result: Record<string, number> = {};
    transactions
      .filter((t) => t.date.startsWith(mk) && t.type === "expense")
      .forEach((t) => {
        result[t.category] = (result[t.category] || 0) + t.amount;
      });
    return result;
  }, [transactions, mk]);

  // El saldo con el que arranca el mes que se está viendo.
  //
  // La cuenta NO se escribe aquí: vive en utils/saldoAnterior, que es donde
  // están explicadas las puertas entre meses y por qué los presupuestos se
  // leen en crudo. Aquí solo se le pasan los datos.
  //
  // Antes esto era una suma plana de todo lo anterior, y la marca de "poner
  // en cero" cortaba con un `alguno <= mes`: una marca en agosto dejaba en
  // cero agosto, septiembre, octubre y todo lo siguiente. Ahora la marca de
  // un mes cierra ÚNICAMENTE la puerta que entra a ese mes, y el resultado
  // real de ese mes sigue su camino al siguiente (10/08/2026).
  const prevBalance = useMemo(
    () => saldoAnteriorDe(mk, budgets, transactions, carryoverCleared),
    [transactions, budgets, mk, carryoverCleared]
  );

  // El botón "restaurar" se ofrece en el mes que tiene la puerta cerrada,
  // que es el único desde el que tiene sentido volver a abrirla.
  const carryoverActive = carryoverCleared.includes(mk);

  const autoSavings = budget + income - spent;

  // EL AHORRO, COMO SOBRES. Ver utils/ahorro.
  //
  // El disponible es EL MISMO que enseña Inicio —con el saldo anterior
  // dentro—. La pantalla de Ahorro enseñaba autoSavings, que se lo deja
  // fuera: dos pantallas, dos numeros, el mismo mes.
  // La cuenta NO se escribe aqui: se llama a la de utils/finances, que es la
  // que usa Inicio y la que usa Reportes.
  //
  // Escribirla otra vez es el fallo que mas ha costado en este proyecto. Ya
  // paso: una pantalla decia un numero y otra decia otro del mismo mes,
  // porque una de las dos copias se cambio y la otra no. Con una sola no
  // pueden discrepar.
  const disponible = availableBalance({ budget, prevBalance, income, spent });
  const apartado = useMemo(() => totalApartado(goals), [goals]);
  const libre = saldoLibre(disponible, apartado);
  const descuadre = hayDescuadre(disponible, apartado);
  const monthLabel = `${monthNames[month.m]} ${month.y}`;

  function completeOnboarding(budgetAmount: number) {
    const initialMonth = currentRealMonth();
    const key = monthKey(initialMonth.y, initialMonth.m);
    setMonth(initialMonth);
    setBudgets((b) => ({ ...b, [key]: budgetAmount }));
    setHasOnboarded(true);
    saveJSON(STORAGE_KEYS.profile, {
      userName,
      userEmail,
      userPhoto,
      userCurrency,
      userLanguage,
      hasOnboarded: true,
    });
  }

  function updateProfileInfo(name: string, photo: string | null) {
    setUserName(name);
    setUserPhoto(photo);
    saveJSON(STORAGE_KEYS.profile, {
      userName: name,
      userEmail,
      userPhoto: photo,
      userCurrency,
      userLanguage,
      hasOnboarded: true,
    });
    showToast(t("toast.profileUpdated"));
  }

  function updateCurrency(id: string) {
    setUserCurrency(id);
    saveJSON(STORAGE_KEYS.profile, {
      userName,
      userEmail,
      userPhoto,
      userCurrency: id,
      userLanguage,
      hasOnboarded: true,
    });
    showToast(t("toast.currencyUpdated"));
  }

  function updateLanguage(id: string) {
    setUserLanguage(id);
    saveJSON(STORAGE_KEYS.profile, {
      userName,
      userEmail,
      userPhoto,
      userCurrency,
      userLanguage: id,
      hasOnboarded: true,
    });
    showToast(translations[id as keyof typeof translations]?.["toast.languageUpdated"] || "Idioma actualizado");
  }

  /**
   * Pone idioma y moneda de una vez, al elegir un país.
   *
   * Va aparte y no llama a updateCurrency + updateLanguage seguidos por una
   * razón concreta: las dos guardan el perfil ENTERO, cada una con el valor
   * de la otra tal como estaba al empezar. Encadenadas, la segunda escribiría
   * encima con el idioma o la moneda viejos y uno de los dos cambios se
   * perdería. Aquí se escribe el perfil una sola vez, con los dos ya puestos.
   *
   * Y un solo mensajito, en el idioma NUEVO: dos avisos seguidos por una sola
   * decisión sobran.
   */
  function updateCountry(language: string, currency: string) {
    setUserLanguage(language);
    setUserCurrency(currency);
    saveJSON(STORAGE_KEYS.profile, {
      userName,
      userEmail,
      userPhoto,
      userCurrency: currency,
      userLanguage: language,
      hasOnboarded: true,
    });
    showToast(
      translations[language as keyof typeof translations]?.["toast.countryUpdated"] ||
        "Listo"
    );
  }

  function updateThemeMode(mode: ThemeMode) {
    setThemeMode(mode);
    colorScheme.set(mode);
    saveJSON(STORAGE_KEYS.themeMode, mode);
    showToast(t("toast.themeUpdated"));
  }

  // "No pasar el saldo" al mes que se está viendo: ese mes arranca en 0.
  //
  // SOLO CIERRA LA PUERTA DE ENTRADA A ESTE MES. El resultado real de este
  // mes —lo que gane y gaste por su cuenta— pasa al siguiente con toda
  // normalidad. Si agosto no recibe nada y termina con 150, septiembre
  // recibe esos 150.
  //
  // No borra NADA: los movimientos, presupuestos y metas de los meses
  // anteriores siguen intactos y se pueden seguir consultando en el
  // Historial.
  function resetCarryover() {
    setCarryoverCleared((prev) => (prev.includes(mk) ? prev : [...prev, mk]));
    showToast(t("toast.carryoverReset"));
  }

  // Vuelve a abrir la puerta de entrada a este mes: recibe otra vez el
  // saldo real del mes anterior. Los demás meses con la puerta cerrada
  // siguen como estaban — cada uno es su propia decisión.
  //
  // Existe porque "no pasar saldo" es fácil de tocar por curiosidad o por
  // error, y sin esto no habría forma de volver atrás: al quedar el saldo
  // en 0 el propio botón desaparecía, así que la acción era irreversible
  // desde la app. Como no se borró ningún dato, restaurar es solo dejar de
  // ocultarlo — el saldo vuelve exactamente al valor que tenía.
  function restoreCarryover() {
    setCarryoverCleared((prev) => prev.filter((m) => m !== mk));
    showToast(t("toast.carryoverRestored"));
  }

  function setBudgetForCurrentMonth(amount: number) {
    setBudgets((b) => ({ ...b, [mk]: amount }));
    showToast(t("toast.budgetUpdated"));
  }

  // Reemplaza todos los límites por categoría de una sola vez (la
  // pantalla de "Presupuestos por categoría" guarda todos los cambios
  // juntos, en vez de uno por uno).
  /**
   * Guarda la personalizacion y avisa a las pantallas.
   *
   * El aviso hace falta porque catInfo lee de una variable de modulo, no del
   * contexto: cambiarla no redibuja nada por si sola. Este estado existe solo
   * para provocar ese redibujado — el dato de verdad vive en categoryCustom.
   */
  function updateCategoryOverrides(next: CategoryOverrides) {
    saveOverrides(next);
    setCategoryOverridesState(next);
  }

  /**
   * Crea una categoria propia y devuelve su id, para poder dejarla elegida.
   *
   * Guarda en los DOS sitios, igual que la personalizacion: la variable de
   * modulo que consulta catInfo —si no, la categoria nueva se veria como
   * "Otros" en las 38 pantallas— y el estado, que es lo que provoca el
   * redibujado.
   */
  function crearCategoria(datos: {
    nombre: string;
    tipo: "expense" | "income";
    color: string;
    icono: string;
    image?: string;
  }): string {
    const { lista, creada } = crearPropia(categoriasPropias, datos);
    savePropias(lista);
    setCategoriasPropiasState(lista);
    setCategoriaRecienCreada(creada.id);
    return creada.id;
  }

  /**
   * Guarda los favoritos en los DOS sitios: disco y estado.
   *
   * El disco es donde viven de verdad; el estado existe para que la subida a la
   * nube se dispare. Ver iconosFavoritos.
   */
  function guardarFavoritos(lista: string[]) {
    saveFavoritos(lista);
    // Se relee del sitio donde quedaron, no se guarda lo que llego: saveFavoritos
    // limpia repetidos y aplica el tope, y el estado tiene que ser lo mismo que
    // hay en el disco o la nube recibiria una lista distinta de la que se ve.
    setIconosFavoritosState(getFavoritos());
  }

  /**
   * Enciende la prueba gratuita. Solo se puede una vez, y aqui se hace cumplir.
   *
   * La pantalla ya esconde el boton cuando esta usada, pero la regla se comprueba
   * TAMBIEN aqui: un boton escondido es una decision de pantalla, y esto es una
   * decision de la cuenta. Devuelve si se pudo, para poder avisar.
   */
  /**
   * Guarda un negocio: lo crea si es nuevo, lo reemplaza si ya estaba.
   *
   * Uno solo para las dos cosas a propósito. Con "crear" y "editar" separados, cada uno
   * escribe en la lista a su manera y basta que uno olvide algo para que editar pierda un
   * dato que crear sí guardaba.
   */
  function guardarNegocio(negocio: Negocio) {
    setDatosNegocio((antes) => {
      const yaEstaba = antes.negocios.some((n) => n.id === negocio.id);
      return {
        ...antes,
        negocios: yaEstaba
          ? antes.negocios.map((n) => (n.id === negocio.id ? negocio : n))
          : [...antes.negocios, negocio],
      };
    });
  }

  /**
   * Borra un negocio con sus productos y sus ventas.
   *
   * En cascada, y aquí sí es lo correcto: quien borra el negocio quiere que no quede nada
   * suyo. Dejar sus ventas las volvería imposibles de ver y seguirían contando en cualquier
   * total que se sume mañana. La cuenta la hace utils/negocio, no aquí: así se puede
   * comprobar con números en las pruebas.
   */
  function quitarNegocio(id: string) {
    setDatosNegocio((antes) => borrarNegocioYLoSuyo(antes, id));
  }

  /**
   * A qué bolsillo van los yapeos que entren: a este negocio o a lo personal.
   *
   * La cuenta de "solo uno puede recibir" la hace utils/negocioCaptura, no esta función: así
   * se puede comprobar con una lista de negocios en las pruebas, sin dibujar nada.
   */
  function mandarYapesAlNegocio(id: string, activar: boolean) {
    setDatosNegocio((antes) => ({ ...antes, negocios: mandarYapesA(antes.negocios, id, activar) }));
  }

  /**
   * Guarda un producto: lo crea si es nuevo, lo reemplaza si ya estaba.
   *
   * Uno solo para las dos cosas, por lo mismo que en guardarNegocio: con "crear" y "editar"
   * separados basta que uno olvide un campo para que editar pierda lo que crear sí guardaba.
   */
  function guardarProducto(producto: Producto) {
    setDatosNegocio((antes) => {
      const yaEstaba = antes.productos.some((p) => p.id === producto.id);
      return {
        ...antes,
        productos: yaEstaba
          ? antes.productos.map((p) => (p.id === producto.id ? producto : p))
          : [...antes.productos, producto],
      };
    });
  }

  /**
   * Borra un producto, Y NO TOCA LAS VENTAS que lo incluían.
   *
   * Puede parecer un descuido y es lo contrario: la venta guarda el nombre y el precio
   * copiados, así que una venta de ayer sigue diciendo "Broster S/ 15" aunque el Broster ya no
   * esté en la carta. Borrar esas ventas cambiaría el dinero que se ganó, que es lo último que
   * puede pasar aquí. La cuenta la hace utils/negocio para poder comprobarla con números.
   */
  function quitarProducto(id: string) {
    setDatosNegocio((antes) => ({ ...antes, productos: quitarProductoDeLaLista(antes.productos, id) }));
  }

  /**
   * Guarda una venta: la crea si es nueva, la reemplaza si ya estaba.
   *
   * Una sola función para las dos cosas, por lo mismo que en guardarNegocio y guardarProducto:
   * con "crear" y "editar" separados basta que una olvide un campo para que corregir una venta
   * pierda lo que registrarla sí guardaba. Y aquí lo que se perdería es dinero.
   */
  function guardarVenta(venta: Venta) {
    setDatosNegocio((antes) => {
      const yaEstaba = antes.ventas.some((v) => v.id === venta.id);
      return {
        ...antes,
        ventas: yaEstaba ? antes.ventas.map((v) => (v.id === venta.id ? venta : v)) : [...antes.ventas, venta],
      };
    });
  }

  /**
   * Borra una venta.
   *
   * TIENE QUE PODERSE. Una venta se registra con el cliente delante y en dos toques: se
   * equivoca cualquiera. Sin poder borrarla, el único arreglo sería registrar otra al revés,
   * y el historial acabaría contando una historia que no pasó.
   */
  function quitarVenta(id: string) {
    setDatosNegocio((antes) => ({ ...antes, ventas: antes.ventas.filter((v) => v.id !== id) }));
  }

  /** Anota plata que entra o sale de la caja del negocio. Crear y editar, otra vez juntos. */
  function guardarMovimientoNegocio(movimiento: MovimientoNegocio) {
    setDatosNegocio((antes) => {
      const yaEstaba = antes.movimientos.some((m) => m.id === movimiento.id);
      return {
        ...antes,
        movimientos: yaEstaba
          ? antes.movimientos.map((m) => (m.id === movimiento.id ? movimiento : m))
          : [...antes.movimientos, movimiento],
      };
    });
  }

  function quitarMovimientoNegocio(id: string) {
    setDatosNegocio((antes) => ({ ...antes, movimientos: antes.movimientos.filter((m) => m.id !== id) }));
  }

  function activarPruebaPremium(): boolean {
    if (pruebaYaUsada(pruebaInicio)) return false;
    const inicio = Date.now();
    setPruebaInicio(inicio);
    savePrueba(inicio);
    // El reloj de dentro se pone al dia para que la prueba cuente desde ya y no
    // desde el ultimo minuto redondo.
    setAhora(inicio);
    return true;
  }

  /** Cambia una propia. Lo que no se pase se deja como estaba. */
  function editarCategoria(
    id: string,
    cambios: { nombre?: string; color?: string; icono?: string; image?: string | null }
  ) {
    const lista = editarPropia(categoriasPropias, id, cambios);
    savePropias(lista);
    setCategoriasPropiasState(lista);
  }

  /**
   * Borra una propia.
   *
   * LOS MOVIMIENTOS NO SE TOCAN, Y ES A PROPÓSITO.
   *
   * Un movimiento guarda el ID de su categoría, no la categoría entera. Al
   * borrarla, catInfo los devuelve como "Otros" y siguen contando en todos los
   * totales. Perder el nombre de la categoría es molesto; borrar el gasto
   * sería grave — y nadie que quita una categoría está pidiendo eso.
   */
  function borrarCategoria(id: string) {
    const lista = borrarPropia(categoriasPropias, id);
    savePropias(lista);
    setCategoriasPropiasState(lista);
  }

  /** Cuántos movimientos quedarían en "Otros" si se borra esta categoría. */
  function movimientosDeCategoria(id: string): number {
    return transactions.filter((t) => t.category === id).length;
  }

  function updateCategoryBudgets(newBudgets: Record<string, number>) {
    setCategoryBudgets(newBudgets);
    showToast(t("toast.budgetUpdated"));
  }

  function addOrUpdateTransaction(t2: Transaction) {
    const isEdit = transactions.some((p) => p.id === t2.id);
    setTransactions((prev) => (isEdit ? prev.map((p) => (p.id === t2.id ? t2 : p)) : [t2, ...prev]));
    showToast(isEdit ? t("toast.transactionUpdated") : t("toast.transactionSaved"));
  }

  // Agrega varios movimientos de golpe (importación de estados de cuenta)
  // y, si se fusionó con movimientos que ya existían, los reemplaza. Todo
  // en UN solo cambio de estado, para no disparar 30 guardados seguidos.
  //   toAdd    → movimientos nuevos (ya con su id puesto)
  //   toReplace→ movimientos fusionados (mismo id que uno existente)
  function commitImport(toAdd: Transaction[], toReplace: Transaction[]) {
    if (toAdd.length === 0 && toReplace.length === 0) return;
    const replaceMap = new Map(toReplace.map((t2) => [t2.id, t2]));
    setTransactions((prev) => {
      const updated = prev.map((p) => replaceMap.get(p.id) ?? p);
      return [...toAdd, ...updated];
    });
    showToast(
      t(toAdd.length + toReplace.length > 1 ? "importSheet.doneToastPlural" : "importSheet.doneToast", {
        count: toAdd.length + toReplace.length,
      })
    );
  }

  // Guarda que un comercio va en una categoría, para futuras importaciones.
  function learnMerchantCategory(merchantText: string, category: string) {
    setMerchantLearned((prev) => learnCategory(merchantText, category, prev));
  }

  function deleteTransaction(id: number) {
    setTransactions((prev) => prev.filter((p) => p.id !== id));
    showToast(t("toast.transactionDeleted"));
  }

  function deleteTransactions(ids: number[]) {
    if (!ids.length) return;
    setTransactions((prev) => prev.filter((p) => !ids.includes(p.id)));
    showToast(
      t(ids.length > 1 ? "toast.transactionsDeletedPlural" : "toast.transactionsDeleted", {
        count: ids.length,
      })
    );
  }

  function addOrUpdateGoal(g: Goal) {
    setGoals((prev) => {
      const exists = prev.some((p) => p.id === g.id);
      return exists ? prev.map((p) => (p.id === g.id ? g : p)) : [g, ...prev];
    });
    showToast(t("toast.goalSaved"));
  }

  function deleteGoal(id: number) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    showToast(t("toast.goalDeleted"));
  }

  function addMoneyToGoal(amount: number, goalId: number) {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const newSaved = goal.saved + amount;
    const justCompleted = !goal.completed && newSaved >= goal.target;
    setGoals((prev) =>
      prev.map((g) => (g.id === goal.id ? { ...g, saved: newSaved, completed: newSaved >= g.target } : g))
    );
    if (justCompleted) {
      setCelebrateGoal(goal.name);
      setTimeout(() => setCelebrateGoal(null), 2600);
    } else {
      showToast(t("toast.moneyAdded"));
    }
  }

  function withdrawMoneyFromGoal(goalId: number, amount: number) {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const newSaved = Math.max(0, goal.saved - amount);
    setGoals((prev) =>
      prev.map((g) => (g.id === goal.id ? { ...g, saved: newSaved, completed: newSaved >= g.target } : g))
    );
    showToast(t("toast.moneyWithdrawn"));
  }

  return (
    <AppDataContext.Provider
      value={{
        ready,
        hasOnboarded,
        completeOnboarding,
        reloadPersistedData,
        hydrateFromCloud,
        logout,
        changePassword,
        deleteAccount,
        userName,
        setUserName,
        userEmail,
        setUserEmail,
        userPhoto,
        updateProfileInfo,
        userCurrency,
        updateCurrency,
        updateCountry,
        fmt,
        userLanguage,
        updateLanguage,
        t,
        monthNames,
        themeMode,
        updateThemeMode,
        month,
        setMonth,
        budgets,
        budget,
        spent,
        income,
        prevBalance,
        carryoverActive,
        resetCarryover,
        restoreCarryover,
        autoSavings,
        disponible,
        apartado,
        libre,
        descuadre,
        maximoAApartar: maximoAApartar(disponible, apartado),
        monthLabel,
        setBudgetForCurrentMonth,
        categoryBudgets,
        categorySpent,
        updateCategoryBudgets,
        categoryOverrides,
        updateCategoryOverrides,
        categoriasPropias,
        crearCategoria,
        categoriaRecienCreada,
        guardarFavoritos,
        olvidarCategoriaRecienCreada: () => setCategoriaRecienCreada(null),
        elegirCategoriaEnMovimiento: setCategoriaRecienCreada,
        editarCategoria,
        borrarCategoria,
        movimientosDeCategoria,
        transactions,
        addOrUpdateTransaction,
        deleteTransaction,
        deleteTransactions,
        commitImport,
        merchantLearned,
        learnMerchantCategory,
        autoCaptureSupported: notificationReader.isSupported,
        autoCapturePermission,
        autoCaptureOn,
        setAutoCaptureOn,
        openAutoCaptureSettings,
        refreshAutoCapture,
        autoCaptureLog,
        clearAutoCaptureLog,
        goals,
        addOrUpdateGoal,
        deleteGoal,
        addMoneyToGoal,
        withdrawMoneyFromGoal,
        isPremium,
        pruebaInicio,
        pruebaHoras: pruebaHorasRestantes(pruebaInicio, ahora),
        activarPruebaPremium,
        negocios: datosNegocio.negocios,
        guardarNegocio,
        quitarNegocio,
        mandarYapesAlNegocio,
        productos: datosNegocio.productos,
        guardarProducto,
        quitarProducto,
        ventas: datosNegocio.ventas,
        guardarVenta,
        quitarVenta,
        movimientosNegocio: datosNegocio.movimientos,
        guardarMovimientoNegocio,
        quitarMovimientoNegocio,
        setIsPremium,
        verComoGratis,
        setVerComoGratis,
        tienePremiumDeVerdad: isPremiumDeLaCuenta || pruebaCorriendo,
        isCloudSynced: uid !== null,
        enterDecoyMode,
        leaveDecoyMode,
        celebrateGoal,
        clearCelebration: () => setCelebrateGoal(null),
        toast,
        showToast,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData debe usarse dentro de AppDataProvider");
  return ctx;
}
