import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from "firebase/auth";
import { Alert, AppState, Modal, Platform, Text, View } from "react-native";
import { colorScheme, useColorScheme, vars } from "nativewind";
import { nativewindThemeVariables, type VisualStyle } from "@/constants/visualTheme";
import { seedTransactions, seedGoals } from "@/constants/seed";
import { currencySymbolFor } from "@/constants/currencies";
import { countryById, countryFor } from "@/constants/countries";
import { monthNamesFor, translations } from "@/constants/i18n";
import {
  clearAccountData,
  clearRetiredAlternateData,
  hasUnreadableLocalData,
  loadJSON,
  saveJSON,
  saveJSONNow,
  saveJSONBatchNow,
  setAccountStorageAvailable,
  STORAGE_KEYS,
  subscribeStorageWriteErrors,
  subscribeStorageReadErrors,
} from "@/utils/storage";
import { allowPreAccountPreferences, archiveLocalAccount, deleteLocalAccountVault, LocalAccountVaultError, prepareLocalAccount, resumeLocalAccount, withLocalAccountOperation } from "@/utils/localAccountVault";
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
import {
  marcarPagado,
  movimientoDelPago,
  pagosParaLaNube,
  type PagoProgramado,
} from "@/utils/calendarioPagos";
import { reprogramarAvisosDePagos } from "@/utils/avisosDePagos";
import { useValorEstable } from "@/utils/valorEstable";
import { nextId, reserveIdsAbove } from "@/utils/id";
import { learnCategory, suggestCategory } from "@/utils/classifier";
import { bajarNegocio, subirNegocio } from "@/utils/cloudNegocio";
import {
  fusionarMovimientosNegocio,
  mandarYapesA,
  negocioQueRecibeYapes,
  separarLoDelNegocio,
} from "@/utils/negocioCaptura";
// setOverrides y setPropias ya no se usan aqui: al traer los datos de la nube se
// llama a saveOverrides y savePropias, que ponen la variable de modulo Y escriben
// el disco. Con las versiones "set" se quedaban solo en memoria y al reabrir la app
// volvia el disco vacio — la personalizacion y las categorias propias desaparecian
// otra vez.
import { loadOverrides, saveOverrides, setOverrides, type CategoryOverrides } from "@/utils/categoryCustom";
import {
  borrar as borrarPropia,
  crear as crearPropia,
  editar as editarPropia,
  loadPropias,
  savePropias,
  setPropias,
  type CategoriaPropia,
} from "@/utils/categoriasPropias";
import {
  getFavoritos,
  loadFavoritos,
  paraLaNube,
  saveFavoritos,
  setFavoritos,
} from "@/utils/iconosFavoritos";
import {
  loadPrueba,
  pruebaHorasRestantes,
  pruebaVigente,
  pruebaYaUsada,
  savePrueba,
} from "@/utils/pruebaPremium";
import { fmt as formatAmount, fmtCompact as formatCompactAmount, monthKey, horaDe } from "@/utils/format";
import { auth } from "@/utils/firebase";
import { reauthenticateWithGoogle, signOutFromGoogle } from "@/utils/googleAuth";
import {
  deleteCloudAccount,
  CloudPremiumRequiredError,
  loadCloudData,
  saveCloudData,
  type CloudData,
} from "@/utils/cloudSync";
import { CLOUD_SYNC_GROUPS, cloudGroupValue, mergeCloudFields, recordCloudGroupChange, replaceCloudGroup, type CloudSyncGroup } from "@/utils/cloudFieldMerge";
import { clearHistoryV2Cache } from "@/utils/cloudHistoryV2";
import { subscribeTesterPremium } from "@/utils/testerPremium";
import { TESTER_PREMIUM_INACTIVE, type TesterPremiumState } from "@/utils/testerPremiumState";
import { processCaptured, type CaptureLogEntry } from "@/utils/autoCapture";
import { guardarPendientes, limpiarPendientes, pendientesDeCaptura } from "@/utils/capturaEnFondo";
import {
  mergeGoals,
  mergeTransactions,
  hayNovedades,
  mergeCaptureLog,
  pruneDeletedGoalIds,
  pruneDeletedTransactionIds,
} from "@/utils/mergeTransactions";
import { activatePremiumTrialCloud } from "@/utils/premiumTrialCloud";
import { getCloudAccountAccess } from "@/utils/cloudAccountAccess";
import { finishPersonalReturn, mergePersonalReturn, personalReturnIsCurrent, recoverPersonalReturn, type PersonalReturnReceipt } from "@/utils/personalReturn";
import { spaceErrorKey } from "@/utils/spaceErrors";
import { presupuestoCubreTransferencias, presupuestoDelMes, transferidoPendienteDelMes } from "@/utils/presupuestoMensual";
import { hayDescuadre, maximoAApartar, saldoLibre, totalApartado } from "@/utils/ahorro";
import { availablePersonalBalance, totalsForMonth } from "@/utils/finances";
import { saldoAnteriorDe } from "@/utils/saldoAnterior";
import { isSafeMoneyAmount } from "@/utils/amount";
import { unlinkCreditPaymentsForHomeTransactions } from "@/utils/creditStore";
import * as notificationReader from "@/modules/notification-reader";
import { cancelarProgramacionAlCerrarSesion } from "@/utils/scheduledExport";
import { desconectarDropbox } from "@/utils/dropbox";
import { desconectarOneDrive } from "@/utils/onedrive";
import { disableLock } from "@/utils/appLock";
import { setPendingImport } from "@/utils/pendingImport";
import { paymentNotificationFormatter } from "@/utils/notificationCurrency";
import { guardarCajasEnMemoria, limpiarCajasEnMemoria } from "@/utils/cajasMemoria";
import { patchPrivateBoxPersonal, validatePrivateBoxPatch } from "@/utils/privateBoxPersonal";
import { validatePrivateBoxRepair, type PrivateBoxRepairChoice } from "@/utils/privateBoxRepair";
import { assertPrivateBoxRepairCloud, loadPrivateBoxRepairCloud } from "@/utils/privateBoxRepairCloud";
import { captureAccountTask } from "@/utils/accountTask";
import { CAJAS_VACIAS, fusionarCajas, validarCajas, type DatosCajas } from "@/utils/cajas";
import type { Goal, Month, Profile, Transaction } from "@/types";

export type ThemeMode = "light" | "dark" | "system";

type AppDataContextValue = {
  ready: boolean;
  authReady: boolean;
  needsEmailVerification: boolean;
  hasOnboarded: boolean;
  completeOnboarding: (budgetAmount: number) => void;
  reloadPersistedData: () => Promise<void>;
  openLocalAccount: (uid: string, email?: string | null) => Promise<boolean>;
  hydrateFromCloud: (uid: string) => Promise<"restored" | "none" | "premium-required">;
  logout: (options?: { skipBackup?: boolean }) => Promise<void>;
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
  fmtCompact: (n: number) => string;
  userLanguage: string;
  userCountry: string;
  updateLanguage: (id: string) => void;
  updateCountry: (country: string, language: string, currency: string) => void;
  setInitialCountry: (country: string, language: string, currency: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  monthNames: string[];
  themeMode: ThemeMode;
  updateThemeMode: (mode: ThemeMode) => void;
  visualStyle: VisualStyle;
  updateVisualStyle: (style: VisualStyle) => void;

  month: Month;
  setMonth: (m: Month) => void;
  budgets: Record<string, number>;
  budget: number;
  spent: number;
  income: number;
  prevBalance: number;
  /** Meses donde se decidió no arrastrar el saldo del mes previo. */
  carryoverCleared: string[];
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
  deletedTransactionIds: number[];
  addOrUpdateTransaction: (t: Transaction, allowLinkedTransferUpdate?: boolean) => void;
  recordPersonalReturn: (receipt: PersonalReturnReceipt) => boolean;
  deleteTransaction: (id: number) => void;
  /** Solo para Familia/Cajas al borrar el movimiento enlazado en su origen. */
  deleteLinkedTransferTransaction: (id: number) => void;
  /** Repara pares enlazados sin mostrar una cadena de avisos. */
  repairLinkedTransferTransactions: (upserts: Transaction[], deleteIds?: number[]) => void;
  commitPrivateBoxData: (before: DatosCajas, data: DatosCajas, upserts: Transaction[], deleteIds: number[], current: () => boolean, apply: (data: DatosCajas) => void, repair?: true | PrivateBoxRepairChoice) => Promise<boolean>;
  deleteTransactions: (ids: number[]) => void;
  commitImport: (toAdd: Transaction[], toReplace: Transaction[]) => void;

  merchantLearned: Record<string, string>;
  learnMerchantCategory: (merchantText: string, category: string) => void;

  // ---- Captura automática desde notificaciones (solo Android) ----
  // ¿Existe siquiera en este celular? En iPhone y en versiones viejas de la
  // app es false, y la pantalla de ajustes lo explica en vez de mostrar un
  // interruptor que no haría nada.
  autoCaptureSupported: boolean;
  // ¿Android le dio a Fino acceso a las notificaciones?
  autoCapturePermission: boolean;
  // Interruptor propio de Fino, aparte del permiso de Android.
  autoCaptureOn: boolean;
  setAutoCaptureOn: (value: boolean) => void;
  openAutoCaptureSettings: () => void;
  refreshAutoCapture: () => void;
  // Últimas notificaciones vistas y qué se hizo con cada una.
  autoCaptureLog: CaptureLogEntry[];
  clearAutoCaptureLog: () => void;

  goals: Goal[];
  /**
   * EL CALENDARIO DE PAGOS (18/08/2026). Netflix, la luz, el agua, el sueldo.
   *
   * `marcarPagoDelMes` hace DOS cosas —marca el mes y crea el movimiento— y por eso vive
   * aquí y no en la pantalla: son las dos mitades de "ya lo pagué", y separadas se acaba
   * marcando sin anotar o al revés.
   */
  pagosProgramados: PagoProgramado[];
  guardarPagoProgramado: (pago: PagoProgramado) => void;
  quitarPagoProgramado: (id: string) => void;
  marcarPagoDelMes: (id: string, mes: string, pagado: boolean) => void;
  /** Cuántos avisos quedaron puestos en la última reprogramación. null = todavía no corrió. */
  avisosProgramados: number | null;
  /** Y por qué falló, si falló. Se enseña en pantalla: ver ResultadoDeProgramar. */
  avisosFallo: string | null;
  /**
   * Vuelve a poner los avisos ahora mismo. Lo llama el interruptor de Ajustes: apagarlo
   * tiene que callar los avisos EN EL ACTO, no la próxima vez que se toque un pago.
   */
  reprogramarAvisos: () => void;
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
  isTesterPremium: boolean;
  testerPremiumPendingVerification: boolean;
  testerPremiumGrantedAt: number | null;
  /** Cuando empezo la prueba gratuita, o null si no se ha usado. */
  pruebaInicio: number | null;
  /** Cuantas horas le quedan a la prueba. Cero si no hay ninguna corriendo. */
  pruebaHoras: number;
  /** Pide al servidor una prueba gratuita. Devuelve false si ya se había usado. */
  activarPruebaPremium: () => Promise<boolean>;
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
  hasCloudAccount: boolean;
  /** La ultima subida a la nube termino bien. NO es lo mismo que tener sesion iniciada. */
  respaldoAlDia: boolean;
  /** Por que fallo la ultima subida, para poder decirlo en vez de callarlo. */
  respaldoFallo: string | null;
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
  const { colorScheme: activeColorScheme } = useColorScheme();
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [userCurrency, setUserCurrency] = useState("PEN");
  const [userLanguage, setUserLanguage] = useState("es");
  const [userCountry, setUserCountry] = useState("PE");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("peachOlive");
  const visualStyleVariables = useMemo(
    () => vars(nativewindThemeVariables(visualStyle, activeColorScheme === "dark")),
    [visualStyle, activeColorScheme],
  );
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
  const [transactions, setRenderedTransactions] = useState<Transaction[]>(seedTransactions);
  const transactionsLive = useRef(transactions);
  const setTransactions = useCallback((update: SetStateAction<Transaction[]>) => {
    const next = typeof update === "function" ? update(transactionsLive.current) : update;
    transactionsLive.current = next;
    setRenderedTransactions(next);
  }, []);
  const [goals, setGoals] = useState<Goal[]>(seedGoals);
  const [pagosProgramados, setPagosProgramados] = useState<PagoProgramado[]>([]);
  const pagosEnCurso = useRef(new Set<string>());
  const [avisosProgramados, setAvisosProgramados] = useState<number | null>(null);
  const [avisosFallo, setAvisosFallo] = useState<string | null>(null);
  // Ver el efecto que reprograma los avisos: la caja con el traductor de ahora mismo.
  const tRef = useRef<(k: string, v?: Record<string, string | number>) => string>(() => "");
  /**
   * El Premium DE LA CUENTA: el que se guarda en el celular y viaja a la nube.
   *
   * Se llama distinto que el "isPremium" que ven las pantallas a propósito. Ese es
   * la suma de este MÁS la prueba gratuita, y son dos cosas que no se pueden
   * mezclar: si se guardara la suma, activar la prueba dejaría marcado Premium para
   * siempre, y al caducar se apagaría también el de quien ya lo tenía de antes.
   */
  const [isPremiumDeLaCuenta, setIsPremium] = useState(false);
  const [testerPremium, setTesterPremium] = useState<TesterPremiumState>(TESTER_PREMIUM_INACTIVE);
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

  /** El motivo del ultimo fallo al subir, o null si la ultima subida salio bien. */
  const [respaldoFallo, setRespaldoFallo] = useState<string | null>(null);

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

  /** Compra, prueba o concesión administrativa. Las tres fuentes siguen separadas. */
  const isPremium = (isPremiumDeLaCuenta || pruebaCorriendo || testerPremium.active) && !verComoGratis;
  // Lo que la persona le enseñó al clasificador de importaciones:
  // { "primax": "transporte", ... }. Ver utils/classifier.ts.
  const [merchantLearned, setMerchantLearned] = useState<Record<string, string>>({});
  // Meses cuyo "Saldo anterior" se muestra en cero ("AAAA-MM"), cada uno
  // independiente del resto. Lo maneja el botón de Inicio.
  const [carryoverCleared, setCarryoverCleared] = useState<string[]>([]);
  const [cloudSyncMeta, setCloudSyncMeta] = useState<Record<string, number>>({});
  const cloudSyncMetaRef = useRef<Record<string, number>>({});
  const cloudFieldsRef = useRef<CloudData | null>(null);
  const [deletedTransactionIds, setDeletedTransactionIds] = useState<number[]>([]);
  const [deletedGoalIds, setDeletedGoalIds] = useState<number[]>([]);
  const deletedTransactionIdsRef = useRef<number[]>([]);
  useEffect(() => {
    deletedTransactionIdsRef.current = deletedTransactionIds;
  }, [deletedTransactionIds]);
  // Captura automática desde notificaciones. El estado real vive en el
  // módulo nativo (sobrevive a que la app se cierre); aquí solo tenemos un
  // reflejo para pintar la pantalla de ajustes.
  const [autoCaptureOn, setAutoCaptureOnState] = useState(false);
  const [autoCapturePermission, setAutoCapturePermission] = useState(false);
  const [autoCaptureLog, setAutoCaptureLog] = useState<CaptureLogEntry[]>([]);
  const [celebrateGoal, setCelebrateGoal] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [storageReadBlocked, setStorageReadBlocked] = useState(hasUnreadableLocalData);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El "uid" de la cuenta que inició sesión de verdad (y ya verificó su
  // correo). Mientras esto no tenga un valor, no subimos nada a la nube.
  const [uid, setUid] = useState<string | null>(null);
  const localSessionVersion = useRef(0);
  const cloudAccessRevision = useRef(0);
  const returnReceipt = useRef<PersonalReturnReceipt | null>(null);
  const currencyForReturn = useRef(userCurrency);
  currencyForReturn.current = userCurrency;
  const localOpenRequest = useRef(0);

  // Una versión de fmt() ya conectada a la moneda elegida — toda la app
  // la usa a través del contexto, así que se actualiza en el mismo
  // instante en que cambia userCurrency, sin pasos intermedios.
  function fmt(n: number) {
    return formatAmount(n, currencySymbolFor(userCurrency), userCurrency);
  }

  function fmtCompact(n: number) {
    return formatCompactAmount(n, currencySymbolFor(userCurrency), userCurrency);
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

  // La caja con el traductor de ahora mismo, para quien no puede depender de `t` sin
  // volver a correr en cada dibujado. Ver el efecto que reprograma los avisos de pagos.
  tRef.current = t;

  const monthNames = monthNamesFor(userLanguage);

  useEffect(() => {
    let previousUser: string | null = null;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || (previousUser !== null && previousUser !== user.uid)) {
        localSessionVersion.current += 1;
        cloudFieldsRef.current = null;
        setAccountStorageAvailable(false);
        setHasOnboarded(false);
      }
      previousUser = user?.uid ?? null;
      setUid(user && user.emailVerified ? user.uid : null);
      setNeedsEmailVerification(!!user && !user.emailVerified);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setTesterPremium(TESTER_PREMIUM_INACTIVE);
    if (!uid) return;
    return subscribeTesterPremium(uid, (value) => {
      if (auth.currentUser?.uid === uid) setTesterPremium(value);
    });
  }, [uid]);

  // Solo permisos, nunca movimientos: Gratis también puede comprobar una
  // compra/prueba del servidor sin leer la copia financiera completa.
  useEffect(() => {
    if (!uid || !ready) return;
    let alive = true;
    const version = localSessionVersion.current;
    const refresh = async () => {
      const revision = cloudAccessRevision.current;
      try {
        const access = await getCloudAccountAccess(uid);
        if (!alive || version !== localSessionVersion.current || revision !== cloudAccessRevision.current || auth.currentUser?.uid !== uid) return;
        setIsPremium(access.isPremium);
        setPruebaInicio(access.premiumTrialStartedAt ?? null);
        savePrueba(access.premiumTrialStartedAt ?? null);
      } catch {
        // Sin respuesta válida no se concede nube; lo local no se borra.
        if (alive && version === localSessionVersion.current && revision === cloudAccessRevision.current && auth.currentUser?.uid === uid) setRespaldoFallo("permisos");
      }
    };
    void refresh();
    const listener = AppState.addEventListener("change", (state) => { if (state === "active") void refresh(); });
    return () => { alive = false; listener.remove(); };
  }, [uid, ready]);

  // Cada vez que cargamos datos ya guardados, avisamos al generador de
  // números cuál es el más alto que ya existe. Así un movimiento nuevo
  // nunca reutiliza el número de uno viejo (que lo reemplazaría en vez de
  // agregarse).
  function protectExistingIds(loadedTransactions: Transaction[], loadedGoals: Goal[]) {
    const ids = [...loadedTransactions.map((x) => x.id), ...loadedGoals.map((x) => x.id)];
    if (ids.length > 0) reserveIdsAbove(Math.max(...ids));
  }

  function markCloudGroup<T>(group: CloudSyncGroup, fallback: T, update: (current: T) => T): T {
    const local = cloudFieldsRef.current ?? { ...datosParaLaNube(), pagosProgramados, iconosFavoritos };
    const before = (cloudFieldsRef.current ? cloudGroupValue(local, group) : fallback) as T;
    const after = update(before);
    cloudSyncMetaRef.current = recordCloudGroupChange(cloudSyncMetaRef.current, group, before, after);
    // Disponible inmediatamente: una respuesta de red o un segundo toque
    // no pueden adelantarse al siguiente dibujado y pisar esta edición.
    cloudFieldsRef.current = { ...replaceCloudGroup(local, group, after), syncUpdatedAt: cloudSyncMetaRef.current, syncFormat: 2 };
    setCloudSyncMeta(cloudSyncMetaRef.current);
    // Se encolan en el mismo gesto, sin esperar a un efecto de React que
    // podría quedar suspendido al cerrar sesión inmediatamente después.
    if (ready && hasOnboarded) {
      const keys: Partial<Record<CloudSyncGroup, string>> = {
        budgets: STORAGE_KEYS.budgets, categoryBudgets: STORAGE_KEYS.categoryBudgets,
        payments: STORAGE_KEYS.pagosProgramados, merchants: STORAGE_KEYS.merchantLearned,
        categoryOverrides: STORAGE_KEYS.categoryCustom, customCategories: STORAGE_KEYS.categoriasPropias,
        carryover: STORAGE_KEYS.carryoverCleared, favoriteIcons: STORAGE_KEYS.iconosFavoritos,
      };
      const key = keys[group];
      if (key) saveJSON(key, after);
      saveJSON(STORAGE_KEYS.cloudSyncMeta, cloudSyncMetaRef.current);
    }
    return after;
  }

  function markCloudProfile(changes: Partial<Pick<CloudData, "userName" | "userPhoto" | "userCurrency" | "userLanguage">>) {
    return markCloudGroup(CLOUD_SYNC_GROUPS.profile,
      { userName, userPhoto, userCurrency, userLanguage }, (current) => ({ ...current, ...changes }));
  }

  function persistCloudProfile(profile: Pick<CloudData, "userName" | "userPhoto" | "userCurrency" | "userLanguage">,
    country = userCountry, onboarded = true) {
    setUserName(profile.userName);
    setUserPhoto(profile.userPhoto);
    setUserCurrency(profile.userCurrency);
    setUserLanguage(profile.userLanguage);
    setUserCountry(country);
    saveJSON(STORAGE_KEYS.profile, { ...profile, userEmail, userCountry: country, hasOnboarded: onboarded });
  }

  /** La misma unión se usa al subir y al recibir, nunca una lista entera. */
  const applyNewerCloudFields = useCallback((cloud: CloudData) => {
    const local = cloudFieldsRef.current;
    if (!local) return false;
    let merged: CloudData;
    try {
      merged = mergeCloudFields({ ...local, syncUpdatedAt: cloudSyncMetaRef.current }, cloud);
    } catch {
      // Una copia mal formada no modifica la memoria ni la copia local.
      setRespaldoFallo("datos-nube-invalidos");
      return false;
    }
    // Los atajos a fotos nunca viajan a Firebase, pero tampoco se quitan
    // del teléfono por haber recibido una copia que no puede contenerlos.
    const photos = (local.iconosFavoritos ?? []).filter((icon) => icon.startsWith("data:"));
    merged.iconosFavoritos = [...photos, ...(merged.iconosFavoritos ?? [])];
    cloudFieldsRef.current = merged;
    const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
    if (changed(cloudGroupValue(local, "profile"), cloudGroupValue(merged, "profile"))) {
      setUserName(merged.userName);
      setUserPhoto(merged.userPhoto);
      setUserCurrency(merged.userCurrency);
      setUserLanguage(merged.userLanguage);
      saveJSON(STORAGE_KEYS.profile, {
        userName: merged.userName,
        userEmail,
        userPhoto: merged.userPhoto,
        userCurrency: merged.userCurrency,
        userLanguage: merged.userLanguage,
        userCountry,
        hasOnboarded: true,
      });
    }
    if (changed(local.budgets, merged.budgets)) setBudgets(merged.budgets);
    if (changed(local.categoryBudgets, merged.categoryBudgets)) setCategoryBudgets(merged.categoryBudgets);
    if (changed(local.pagosProgramados ?? [], merged.pagosProgramados)) setPagosProgramados(merged.pagosProgramados ?? []);
    if (changed(local.merchantLearned ?? {}, merged.merchantLearned)) setMerchantLearned(merged.merchantLearned ?? {});
    if (changed(local.categoryOverrides ?? {}, merged.categoryOverrides)) {
      saveOverrides(merged.categoryOverrides ?? {});
      setCategoryOverridesState(merged.categoryOverrides ?? {});
    }
    if (changed(local.categoriasPropias ?? [], merged.categoriasPropias)) {
      savePropias(merged.categoriasPropias ?? []);
      setCategoriasPropiasState(merged.categoriasPropias ?? []);
    }
    if (changed(local.carryoverCleared ?? [], merged.carryoverCleared)) setCarryoverCleared(merged.carryoverCleared ?? []);
    if (changed(local.iconosFavoritos ?? [], merged.iconosFavoritos)) {
      saveFavoritos(merged.iconosFavoritos);
      setIconosFavoritosState(getFavoritos());
      cloudFieldsRef.current = { ...merged, iconosFavoritos: getFavoritos() };
    }
    if (changed(cloudSyncMetaRef.current, merged.syncUpdatedAt)) {
      cloudSyncMetaRef.current = merged.syncUpdatedAt ?? {};
      setCloudSyncMeta(cloudSyncMetaRef.current);
    }
    return true;
  }, [userEmail, userCountry]);

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
  function datosParaLaNube(fromState = false): CloudData {
    let data: CloudData = {
      syncFormat: 2,
      hasOnboarded,
      userName,
      userPhoto,
      userCurrency,
      userLanguage,
      budgets,
      categoryBudgets,
      transactions,
      deletedTransactionIds,
      goals,
      deletedGoalIds,
      /* SIN LAS FOTOS, IGUAL QUE LOS FAVORITOS DE AQUÍ ABAJO. **Esto estaba escrito y sin
         conectar (20/08/2026).** `pagosParaLaNube` existía, con su explicación, y no la
         llamaba nadie: los pagos subían con la foto pegada. Una foto son unos 18 KB en texto,
         y este documento tiene un tope de 1 MB COMPARTIDO CON LOS MOVIMIENTOS. Pasarse no lo
         guarda a medias: no guarda nada — ni los gastos. O sea que treinta pagos con foto
         propia dejaban la copia de seguridad muerta sin decir una palabra. */
      pagosProgramados: pagosParaLaNube(pagosProgramados),
      // EL DE LA CUENTA, no el que ven las pantallas: la prueba gratuita no puede
      // subirse como Premium comprado. Si se subiera, al caducar quedaria marcado
      // en la nube y volveria en cualquier celular donde se entrara.
      isPremium: isPremiumDeLaCuenta,
      premiumTrialStartedAt: pruebaInicio ?? undefined,
      merchantLearned,
      categoryOverrides,
      categoriasPropias,
      carryoverCleared,
      // SIN LAS FOTOS: paraLaNube las quita. Todo este documento tiene un tope de
      // 1 MB compartido con los movimientos, y pasarse no lo deja a medias: lo
      // deja sin guardar. Ver la nota en utils/iconosFavoritos.
      iconosFavoritos: paraLaNube(iconosFavoritos),
      syncUpdatedAt: cloudSyncMetaRef.current,
    };
    if (!fromState && cloudFieldsRef.current) {
      for (const group of Object.values(CLOUD_SYNC_GROUPS)) {
        data = replaceCloudGroup(data, group, cloudGroupValue(cloudFieldsRef.current, group));
      }
      data.pagosProgramados = pagosParaLaNube(data.pagosProgramados ?? []);
      data.iconosFavoritos = paraLaNube(data.iconosFavoritos ?? []);
    }
    return data;
  }

  // Se actualiza antes de los efectos de red y solo cuando este dibujado
  // ya incluye la última edición síncrona. No sobrescribe una edición posterior.
  useEffect(() => {
    if (!ready || cloudSyncMeta !== cloudSyncMetaRef.current) return;
    cloudFieldsRef.current = { ...datosParaLaNube(true), pagosProgramados, iconosFavoritos };
    // El armador se recrea por dibujado; importan sus datos, no su identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hasOnboarded, userName, userPhoto, userCurrency, userLanguage, budgets, categoryBudgets,
    transactions, deletedTransactionIds, goals, deletedGoalIds, pagosProgramados,
    isPremiumDeLaCuenta, pruebaInicio, merchantLearned, categoryOverrides,
    categoriasPropias, carryoverCleared, iconosFavoritos, cloudSyncMeta]);

  // Trae lo que haya guardado en la nube para esta cuenta (por ejemplo,
  // al iniciar sesión desde un celular nuevo). Si no hay nada guardado
  // todavía, no hace nada y devuelve "false".
  async function hydrateFromCloud(userUid: string): Promise<"restored" | "none" | "premium-required"> {
    const version = localSessionVersion.current;
    const checkSession = () => {
      if (auth.currentUser?.uid !== userUid || localSessionVersion.current !== version) throw new Error(tRef.current("settings.noActiveSession"));
    };
    checkSession();
    let cloud: CloudData | null;
    try {
      cloud = await loadCloudData(userUid, {
        allowCloudCopy: (entitlement) =>
          isPremiumDeLaCuenta || testerPremium.active || entitlement.isPremium || entitlement.isTester ||
          pruebaVigente(entitlement.premiumTrialStartedAt ?? pruebaInicio, Date.now()),
      });
    } catch (error) {
      checkSession();
      if (error instanceof CloudPremiumRequiredError) return "premium-required";
      throw error;
    }
    checkSession();
    if (!cloud) return "none";
    // Entrar a Pro o restaurar manualmente no autoriza reemplazar lo que
    // ya existe en este teléfono. Se conservan los dos historiales y los
    // borrados, con la misma unión que utiliza la subida atómica.
    const local = cloudFieldsRef.current;
    if (local?.hasOnboarded) {
      const merged = mergeCloudFields({ ...local, syncUpdatedAt: cloudSyncMetaRef.current }, cloud);
      const deleted = pruneDeletedTransactionIds([...(local.deletedTransactionIds ?? []), ...(cloud.deletedTransactionIds ?? [])]);
      const deletedGoals = pruneDeletedGoalIds([...(local.deletedGoalIds ?? []), ...(cloud.deletedGoalIds ?? [])]);
      cloud = {
        ...merged,
        isPremium: cloud.isPremium,
        premiumTrialStartedAt: cloud.premiumTrialStartedAt,
        deletedTransactionIds: deleted,
        transactions: mergeTransactions(local.transactions, cloud.transactions).filter((tx) => !deleted.includes(tx.id)),
        deletedGoalIds: deletedGoals,
        goals: mergeGoals(local.goals, cloud.goals).filter((goal) => !deletedGoals.includes(goal.id)),
        iconosFavoritos: [...(local.iconosFavoritos ?? []).filter((icon) => icon.startsWith("data:")), ...(merged.iconosFavoritos ?? [])],
      };
    }
    setUserName(cloud.userName);
    setUserPhoto(cloud.userPhoto);
    setUserCurrency(cloud.userCurrency);
    setUserLanguage(cloud.userLanguage);
    const localCountry = countryById(userCountry);
    const restoredCountry = localCountry?.currency === cloud.userCurrency
      ? localCountry.id
      : countryFor(cloud.userLanguage, cloud.userCurrency)?.id ?? "PE";
    setUserCountry(restoredCountry);
    setBudgets(cloud.budgets);
    setCategoryBudgets(cloud.categoryBudgets);
    const borrados = pruneDeletedTransactionIds(cloud.deletedTransactionIds ?? []);
    const metasBorradas = pruneDeletedGoalIds(cloud.deletedGoalIds ?? []);
    setDeletedTransactionIds(borrados);
    setTransactions(cloud.transactions.filter((tx) => !borrados.includes(tx.id)));
    setDeletedGoalIds(metasBorradas);
    setGoals(cloud.goals.filter((goal) => !metasBorradas.includes(goal.id)));
    setPagosProgramados(cloud.pagosProgramados ?? []);
    protectExistingIds(cloud.transactions, cloud.goals);
    setIsPremium(cloud.isPremium);
    const pruebaRestaurada = cloud.premiumTrialStartedAt ?? pruebaInicio;
    setPruebaInicio(pruebaRestaurada);
    savePrueba(pruebaRestaurada);
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
    cloudSyncMetaRef.current = cloud.syncUpdatedAt ?? {};
    cloudFieldsRef.current = cloud;
    setCloudSyncMeta(cloudSyncMetaRef.current);
    setHasOnboarded(true);
    saveJSON(STORAGE_KEYS.profile, {
      userName: cloud.userName,
      userEmail,
      userPhoto: cloud.userPhoto,
      userCurrency: cloud.userCurrency,
      userLanguage: cloud.userLanguage,
      userCountry: restoredCountry,
      hasOnboarded: true,
    });
    saveJSON(STORAGE_KEYS.budgets, cloud.budgets);
    saveJSON(STORAGE_KEYS.categoryBudgets, cloud.categoryBudgets);
    saveJSON(STORAGE_KEYS.transactions, cloud.transactions.filter((tx) => !borrados.includes(tx.id)));
    saveJSON(STORAGE_KEYS.deletedTransactionIds, borrados);
    saveJSON(STORAGE_KEYS.goals, cloud.goals.filter((goal) => !metasBorradas.includes(goal.id)));
    saveJSON(STORAGE_KEYS.deletedGoalIds, metasBorradas);
    saveJSON(STORAGE_KEYS.pagosProgramados, cloud.pagosProgramados ?? []);
    saveJSON(STORAGE_KEYS.isPremium, cloud.isPremium);
    saveJSON(STORAGE_KEYS.merchantLearned, cloud.merchantLearned ?? {});
    saveJSON(STORAGE_KEYS.carryoverCleared, cloud.carryoverCleared ?? []);
    saveJSON(STORAGE_KEYS.cloudSyncMeta, cloud.syncUpdatedAt ?? {});

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
    checkSession();
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
    return "restored";
  }

  async function reloadPersistedData(profile?: Profile | null) {
    const loadingUid = auth.currentUser?.uid;
    const version = localSessionVersion.current;
    const [
      savedBudgets,
      savedCategoryBudgets,
      savedTransactions,
      savedDeletedTransactionIds,
      savedGoals,
      savedDeletedGoalIds,
      savedIsPremium,
      savedLearned,
      savedCarryoverCleared,
      savedOverrides,
      savedPropias,
      savedFavoritos,
      savedPrueba,
      savedNegocio,
      savedPagos,
      savedCloudSyncMeta,
      savedCaptureLog,
    ] = await Promise.all([
      loadJSON<Record<string, number>>(STORAGE_KEYS.budgets, {}),
      loadJSON<Record<string, number>>(STORAGE_KEYS.categoryBudgets, {}),
      loadJSON<Transaction[]>(STORAGE_KEYS.transactions, seedTransactions),
      loadJSON<number[]>(STORAGE_KEYS.deletedTransactionIds, []),
      loadJSON<Goal[]>(STORAGE_KEYS.goals, seedGoals),
      loadJSON<number[]>(STORAGE_KEYS.deletedGoalIds, []),
      loadJSON<boolean>(STORAGE_KEYS.isPremium, false),
      loadJSON<Record<string, string>>(STORAGE_KEYS.merchantLearned, {}),
      loadJSON<string[]>(STORAGE_KEYS.carryoverCleared, []),
      // La personalizacion de categorias se carga en la variable de modulo
      // que consulta catInfo, y ademas al estado para que las pantallas se
      // dibujen con ella desde el primer momento.
      loadOverrides(false),
      // Y las categorias propias, por el mismo motivo: catInfo las consulta
      // desde una variable de modulo, no desde el contexto.
      loadPropias(false),
      // Los iconos favoritos, tambien en variable de modulo: la pantalla de
      // crear categoria los necesita al dibujarse, y leer el disco en cada
      // letra que se escribe seria leer el disco decenas de veces.
      loadFavoritos(false),
      // Cuando se activo la prueba gratuita, si se activo. Ver utils/pruebaPremium.
      loadPrueba(),
      // El negocio: sus negocios, productos y ventas. Ver utils/negocio.
      cargarNegocio(),
      // El calendario de pagos. Ver utils/calendarioPagos.
      loadJSON<PagoProgramado[]>(STORAGE_KEYS.pagosProgramados, []),
      loadJSON<Record<string, number>>(STORAGE_KEYS.cloudSyncMeta, {}),
      loadJSON<CaptureLogEntry[]>(STORAGE_KEYS.autoCaptureLog, []),
    ]);
    if (auth.currentUser?.uid !== loadingUid || version !== localSessionVersion.current) return;
    setOverrides(savedOverrides);
    setPropias(savedPropias);
    setFavoritos(savedFavoritos);
    setBudgets(savedBudgets);
    setCategoryBudgets(savedCategoryBudgets);
    setCategoryOverridesState(savedOverrides);
    setCategoriasPropiasState(savedPropias);
    setIconosFavoritosState(savedFavoritos);
    setPruebaInicio(savedPrueba);
    setDeletedTransactionIds(savedDeletedTransactionIds);
    setTransactions(savedTransactions.filter((tx) => !savedDeletedTransactionIds.includes(tx.id)));
    setDeletedGoalIds(savedDeletedGoalIds);
    setGoals(savedGoals.filter((goal) => !savedDeletedGoalIds.includes(goal.id)));
    setPagosProgramados(savedPagos);
    protectExistingIds(savedTransactions, savedGoals);
    setIsPremium(savedIsPremium);
    setMerchantLearned(savedLearned);
    setCarryoverCleared(savedCarryoverCleared);
    setDatosNegocio(savedNegocio);
    cloudSyncMetaRef.current = savedCloudSyncMeta;
    setCloudSyncMeta(savedCloudSyncMeta);
    // La copia para respuestas de red queda lista antes de resolver la
    // apertura, incluso si React todavía no dibujó estos datos cargados.
    cloudFieldsRef.current = {
      ...datosParaLaNube(true),
      ...(profile ? { userName: profile.userName || "", userPhoto: profile.userPhoto ?? null,
        userCurrency: profile.userCurrency || "PEN", userLanguage: profile.userLanguage || "es",
        hasOnboarded: profile.hasOnboarded } : {}),
      budgets: savedBudgets, categoryBudgets: savedCategoryBudgets,
      transactions: savedTransactions.filter((tx) => !savedDeletedTransactionIds.includes(tx.id)),
      deletedTransactionIds: savedDeletedTransactionIds,
      goals: savedGoals.filter((goal) => !savedDeletedGoalIds.includes(goal.id)),
      deletedGoalIds: savedDeletedGoalIds, pagosProgramados: savedPagos,
      isPremium: savedIsPremium, merchantLearned: savedLearned,
      categoryOverrides: savedOverrides, categoriasPropias: savedPropias,
      carryoverCleared: savedCarryoverCleared, iconosFavoritos: savedFavoritos,
      syncUpdatedAt: savedCloudSyncMeta,
    };
    setAutoCaptureLog(savedCaptureLog);
  }

  function applyLocalProfile(profile: Profile) {
    setUserName(profile.userName || "");
    setUserEmail(profile.userEmail || "");
    setUserPhoto(profile.userPhoto ?? null);
    setUserCurrency(profile.userCurrency || "PEN");
    setUserLanguage(profile.userLanguage || "es");
    setUserCountry(profile.userCountry || countryFor(profile.userLanguage || "es", profile.userCurrency || "PEN")?.id || "PE");
  }

  async function openLocalAccount(userUid: string, email?: string | null): Promise<boolean> {
    if (auth.currentUser?.uid !== userUid) throw new Error(tRef.current("settings.noActiveSession"));
    setReady(false);
    const request = ++localOpenRequest.current;
    localSessionVersion.current += 1;
    cloudFieldsRef.current = null;
    try {
      const onboarded = await prepareLocalAccount(userUid, email);
      const profile = await loadJSON<Profile | null>(STORAGE_KEYS.profile, null);
      if (auth.currentUser?.uid !== userUid || request !== localOpenRequest.current) throw new Error(tRef.current("settings.noActiveSession"));
      if (profile) applyLocalProfile(profile);
      await reloadPersistedData(profile);
      if (auth.currentUser?.uid !== userUid || request !== localOpenRequest.current) throw new Error(tRef.current("settings.noActiveSession"));
      setHasOnboarded(onboarded);
      return onboarded;
    } catch (error) {
      if (request === localOpenRequest.current) {
        setAccountStorageAvailable(false);
        setHasOnboarded(false);
      }
      if (error instanceof LocalAccountVaultError) {
        const accessError = new Error(tRef.current(error.reason === "owner" ? "localAccount.ownerMismatch" : "localAccount.restoreFailed"));
        accessError.name = "LocalAccountAccessError";
        throw accessError;
      }
      throw error;
    } finally {
      if (request === localOpenRequest.current) setReady(true);
    }
  }

  /** Limpia datos, avisos e integraciones locales que pertenecían a la cuenta. */
  async function limpiarCuentaEnEsteDispositivo(userUid: string | null) {
    if (userUid) clearHistoryV2Cache(userUid);
    notificationReader.setEnabled(false);
    await Promise.allSettled([
      reprogramarAvisosDePagos([], tRef.current, new Date(), fmt),
      cancelarProgramacionAlCerrarSesion(),
      desconectarDropbox(),
      desconectarOneDrive(),
      disableLock(),
      notificationReader.clear(),
      import("@/utils/creditNotifications").then(({ clearCreditNotifications }) =>
        clearCreditNotifications(),
      ),
    ]);
    limpiarPendientes();
    setPendingImport(null);
    limpiarCajasEnMemoria();
    // Al salir de la cuenta se limpian sus datos locales antes de vaciar React.
    // Si Android cerrase Fino durante esta operación, la siguiente apertura no
    // cargaría movimientos de la cuenta anterior.
    try {
    await clearAccountData();
    } finally {
    setHasOnboarded(false);
    setUserName("");
    setUserEmail("");
    setUserPhoto(null);
    setUserCurrency("PEN");
    setUserLanguage("es");
    setUserCountry("PE");
    setBudgets({});
    setCategoryBudgets({});
    setCategoryOverridesState({});
    setOverrides({});
    setCategoriasPropiasState([]);
    setPropias([]);
    setIconosFavoritosState([]);
    setFavoritos([]);
    setCategoriaRecienCreada(null);
    setTransactions([]);
    setDeletedTransactionIds([]);
    setDeletedGoalIds([]);
    setGoals([]);
    setPagosProgramados([]);
    setAvisosProgramados(0);
    setAvisosFallo(null);
    setIsPremium(false);
    setTesterPremium(TESTER_PREMIUM_INACTIVE);
    setDatosNegocio(NEGOCIO_VACIO);
    setAutoCaptureOnState(false);
    setAutoCaptureLog([]);
    setPruebaInicio(null);
    setMerchantLearned({});
    setCarryoverCleared([]);
    cloudSyncMetaRef.current = {};
    cloudFieldsRef.current = null;
    setCloudSyncMeta({});
    setRespaldoFallo(null);
    setCelebrateGoal(null);
    setVerComoGratis(false);
    }
  }

  // Cierra la sesión de verdad (Firebase) y limpia los datos de este
  // celular, para que la siguiente cuenta que inicie sesión aquí no vea
  // los movimientos/metas de la cuenta anterior.
  async function logout(options?: { skipBackup?: boolean }) {
    if (hasUnreadableLocalData()) throw new Error(tRef.current("storage.readBlockedBody"));
    const localUser = auth.currentUser;
    if (!localUser) throw new Error(tRef.current("settings.noActiveSession"));
    const captureWasEnabled = notificationReader.isEnabled();
    const onboardedBeforeLogout = hasOnboarded;
    localSessionVersion.current += 1;
    let archiving = false;
    setReady(false);
    notificationReader.setEnabled(false);
    try {
    // Antes de salir, espera a que el último cambio (por ejemplo, la
    // moneda que acabas de elegir) termine de subirse a la nube. Si no
    // se espera esto, cerrar sesión muy rápido después de un cambio
    // podía "perderlo": ya no quedaba ni en el celular (se borra abajo)
    // ni en la nube (no le había dado tiempo de subir).
    if (uid && isPremium && !options?.skipBackup) {
      const respaldo = await saveCloudData(uid, datosParaLaNube());
      if (!respaldo.ok) {
        const error = new Error("No se pudo respaldar tu información. Tu sesión y tus datos se conservaron. Revisa tu conexión y vuelve a intentarlo.");
        error.name = "BackupBeforeLogoutError";
        throw error;
      }
    }
    // También hay que salir del lado de Google. Si no, la próxima vez que
    // alguien pulse "Continuar con Google" entraría directo con la última
    // cuenta usada, sin poder elegir otra — un problema real en un celular
    // compartido, y confuso al probar con varias cuentas.
    // La copia local se confirma antes de cerrar Firebase o retirar datos.
    // Incluye también Gratis y a quien decide salir sin respaldo en la nube.
    const captureDeadline = Date.now() + 10_000;
    while (captureBusy.current) {
      if (Date.now() > captureDeadline) throw new Error(tRef.current("localAccount.saveFailed"));
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    archiving = true;
    await archiveLocalAccount(localUser.uid, localUser.email);
    archiving = false;
    setHasOnboarded(false);
    await Promise.allSettled([signOutFromGoogle()]);
    await signOut(auth);
    await limpiarCuentaEnEsteDispositivo(localUser.uid);
    } catch (error) {
      if (auth.currentUser?.uid === localUser.uid) {
        await resumeLocalAccount(localUser.uid).catch(() => {
          setAccountStorageAvailable(false);
          setStorageReadBlocked(true);
        });
        setHasOnboarded(onboardedBeforeLogout);
        notificationReader.setEnabled(captureWasEnabled);
      }
      if (archiving || error instanceof LocalAccountVaultError) throw new Error(tRef.current("localAccount.saveFailed"));
      throw error;
    } finally {
      setReady(true);
    }
  }

  // Antes de cambiar la contraseña o borrar la cuenta, Firebase exige
  // confirmar la contraseña actual — por seguridad, para que nadie más
  // haga estos cambios si te dejaste la sesión abierta en otro celular.
  async function reauthenticate(currentPassword: string) {
    const user = auth.currentUser;
    if (!user) throw new Error(tRef.current("settings.noActiveSession"));
    const usaContrasena = user.providerData.some(provider => provider.providerId === "password");
    if (!usaContrasena) {
      await reauthenticateWithGoogle();
      return user;
    }
    if (!user.email) throw new Error(tRef.current("settings.invalidAccountEmail"));
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
    if (hasUnreadableLocalData()) throw new Error(tRef.current("storage.readBlockedBody"));
    const user = await reauthenticate(currentPassword);
    await deleteCloudAccount(user.uid);
    await deleteUser(user);
    await Promise.allSettled([signOutFromGoogle()]);
    const cleanup = await Promise.allSettled([
      limpiarCuentaEnEsteDispositivo(user.uid),
      deleteLocalAccountVault(user.uid),
    ]);
    if (cleanup.some((result) => result.status === "rejected")) throw new Error(tRef.current("localAccount.deleteCleanupFailed"));
  }

  useEffect(() => {
    async function init() {
      // Estas tres lecturas no dependen entre sí. Hacerlas una detrás de otra
      // alargaba cada arranque con la suma de tres esperas del almacenamiento.
      // Los movimientos siguen cargándose antes de `ready`: no se sacrifica
      // seguridad de datos por mostrar Inicio antes de tiempo.
      const [, savedTheme, savedVisualStyle] = await Promise.all([
        clearRetiredAlternateData(),
        loadJSON<ThemeMode>(STORAGE_KEYS.themeMode, "system"),
        loadJSON<VisualStyle>(STORAGE_KEYS.visualStyle, "peachOlive"),
      ]);
      setThemeMode(savedTheme);
      setVisualStyle(savedVisualStyle === "classic" ? "classic" : "peachOlive");
      colorScheme.set(savedTheme);
      await auth.authStateReady();
      const user = auth.currentUser;
      if (user) {
        await openLocalAccount(user.uid, user.email);
        return;
      }
      const preAccount = await allowPreAccountPreferences();
      const profile = preAccount ? await loadJSON<Profile | null>(STORAGE_KEYS.profile, null) : null;
      // País y moneda se eligen ANTES de crear la cuenta. Android puede
      // cerrar Fino mientras la persona abre el correo de verificación; al
      // volver hay que restaurar esa elección aunque el setup aún no haya
      // terminado. Antes solo se leía el perfil si hasOnboarded era true y
      // Chile podía volver silenciosamente a soles.
      if (profile) {
        setUserName(profile.userName || "");
        setUserEmail(profile.userEmail || "");
        setUserPhoto(profile.userPhoto ?? null);
        setUserCurrency(profile.userCurrency || "PEN");
        setUserLanguage(profile.userLanguage || "es");
        setUserCountry(
          profile.userCountry ||
            countryFor(profile.userLanguage || "es", profile.userCurrency || "PEN")?.id ||
            "PE"
        );
      }
      setReady(true);
    }
    init().catch(async (error) => {
      // Una lectura local inesperadamente dañada no debe dejar la primera
      // apertura en una pantalla vacía para siempre. Las lecturas normales
      // ya tienen sus propios valores seguros; esto cubre el último recurso.
      setAccountStorageAvailable(false);
      setHasOnboarded(false);
      await signOut(auth).catch(() => undefined);
      const message = error instanceof LocalAccountVaultError
        ? tRef.current(error.reason === "owner" ? "localAccount.ownerMismatch" : "localAccount.restoreFailed")
        : error instanceof Error && error.name === "LocalAccountAccessError" ? error.message : tRef.current("localAccount.restoreFailed");
      Alert.alert(tRef.current("localAccount.title"), message);
      setReady(true);
    });
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
   * Android —con Fino cerrada—, que no puede leer los ajustes de la app.
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
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.budgets, budgets);
  }, [budgets, ready, hasOnboarded]);
  useEffect(() => {
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.categoryBudgets, categoryBudgets);
  }, [categoryBudgets, ready, hasOnboarded]);
  useEffect(() => {
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.transactions, transactions);
  }, [transactions, ready, hasOnboarded]);
  // Recupera una orden autorizada antes de cerrar la app, sin exigir Pro.
  useEffect(() => {
    if (!uid || !ready || !hasOnboarded) return;
    let alive = true;
    const version = localSessionVersion.current;
    const recover = async () => {
      try {
        const receipt = await recoverPersonalReturn(uid);
        if (!alive || version !== localSessionVersion.current || auth.currentUser?.uid !== uid || !receipt) return;
        recordPersonalReturn(receipt);
      } catch (error) {
        if (alive && version === localSessionVersion.current && auth.currentUser?.uid === uid) showToast(tRef.current(spaceErrorKey(error)));
      }
    };
    void recover();
    const listener = AppState.addEventListener("change", state => { if (state === "active") void recover(); });
    return () => { alive = false; listener.remove(); returnReceipt.current = null; };
    // La identidad determina esta escucha; los valores actuales se leen por referencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, ready, hasOnboarded]);
  useEffect(() => {
    const receipt = returnReceipt.current;
    if (!receipt || !ready || !hasOnboarded) return;
    const timer = setTimeout(() => {
      void finishPersonalReturn(receipt).then(done => { if (done && returnReceipt.current === receipt) returnReceipt.current = null; }).catch(() => undefined);
    }, 1000);
    return () => clearTimeout(timer);
  }, [transactions, ready, hasOnboarded]);
  useEffect(() => {
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.goals, goals);
  }, [goals, ready, hasOnboarded]);
  useEffect(() => {
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.deletedGoalIds, deletedGoalIds);
  }, [deletedGoalIds, ready, hasOnboarded]);
  useEffect(() => {
    if (!ready || !hasOnboarded) return;
    saveJSON(STORAGE_KEYS.pagosProgramados, pagosProgramados);
    /**
     * LOS AVISOS SE REPROGRAMAN ENTEROS EN CADA CAMBIO, y a propósito.
     *
     * Llevar la cuenta de qué aviso corresponde a qué pago —para tocar solo el que cambió—
     * es un segundo almacén que se puede desincronizar, y cuando eso pasa el fallo es un
     * aviso que suena de algo ya pagado, o uno que no suena nunca. Son cuatro o cinco
     * avisos: rehacerlos todos cuesta milésimas y así ninguno puede quedar huérfano.
     */
    /**
     * `t` NO PUEDE ESTAR EN LAS DEPENDENCIAS, y esto costó un fallo entero.
     *
     * `t` se declara dentro del componente, así que es una función nueva en cada dibujado.
     * Con ella entre las dependencias, este efecto corría decenas de veces seguidas, y como
     * reprogramar es "retirar y volver a poner", cada pasada retiraba lo que acababa de poner
     * la anterior. Resultado: **cero avisos programados**, sin ningún error a la vista. Lo
     * reportó él como *"no me llegó nada"*.
     *
     * Va por una caja que siempre tiene la última versión, así que el texto del aviso sigue
     * saliendo en el idioma puesto sin que el idioma dispare este efecto.
     */
    /**
     * EL NÚMERO SALE DE AQUÍ, Y NO DE PREGUNTARLE A ANDROID POR SEPARADO.
     *
     * La pantalla lo preguntaba por su cuenta al cambiar la lista, y como reprogramar es
     * asíncrono leía ANTES de que terminara: decía "ningún aviso programado" con los avisos
     * poniéndose en ese mismo instante. Lo vio él, y lo mandó a buscar un fallo que no
     * estaba ahí. Guardando lo que devuelve el propio reprogramado, el número no puede
     * adelantarse a los hechos.
     */
    const formatForNotification = paymentNotificationFormatter(userCurrency);
    reprogramarAvisosDePagos(pagosProgramados, (clave, valores) => tRef.current(clave, valores), new Date(), formatForNotification)
      .then((r) => {
        setAvisosProgramados(r.puestos);
        setAvisosFallo(r.fallo ?? null);
      });
  }, [pagosProgramados, ready, hasOnboarded, userCurrency]);
  useEffect(() => {
    // El de la cuenta. Guardando el que ven las pantallas, activar la prueba
    // dejaria Premium marcado para siempre en este celular.
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.isPremium, isPremiumDeLaCuenta);
  }, [isPremiumDeLaCuenta, ready, hasOnboarded]);
  useEffect(() => {
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.merchantLearned, merchantLearned);
  }, [merchantLearned, ready, hasOnboarded]);
  useEffect(() => {
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.carryoverCleared, carryoverCleared);
  }, [carryoverCleared, ready, hasOnboarded]);
  useEffect(() => {
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.cloudSyncMeta, cloudSyncMeta);
  }, [cloudSyncMeta, ready, hasOnboarded]);
  useEffect(() => {
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.deletedTransactionIds, deletedTransactionIds);
  }, [deletedTransactionIds, ready, hasOnboarded]);
  // EL NEGOCIO, en sus cuatro claves. Se guardan las cuatro juntas porque cambian juntas:
  // una venta toca las ventas, pero borrar un negocio toca las cuatro a la vez.
  useEffect(() => {
    if (!ready || !hasOnboarded) return;
    guardarNegocios(datosNegocio.negocios);
    guardarProductos(datosNegocio.productos);
    guardarVentas(datosNegocio.ventas);
    guardarMovimientosNegocio(datosNegocio.movimientos);
  }, [datosNegocio, ready, hasOnboarded]);

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
    if (!(ready && hasOnboarded && uid && isPremium)) return;
    let alive = true;
    const version = localSessionVersion.current;
    const timer = setTimeout(() => {
      void subirNegocio(uid, datosNegocio).catch((error) => {
        if (!alive || version !== localSessionVersion.current || auth.currentUser?.uid !== uid) return;
        const mensaje = String((error as Error)?.message ?? error);
        setRespaldoFallo(mensaje.includes("demasiado-grande") ? "demasiado-grande" : "negocio");
      });
    }, 1500);
    return () => { alive = false; clearTimeout(timer); };
  }, [datosNegocio, ready, hasOnboarded, uid, isPremium]);

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
    if (!(ready && hasOnboarded && uid && isPremium)) return;
    let alive = true;
    const version = localSessionVersion.current;
    const timer = setTimeout(() => {
      /* SE MIRA COMO FUE. Antes se lanzaba y se olvidaba, y el cartel de Ajustes decia
         "Tus datos estan respaldados" solo por haber iniciado sesion — aunque la subida
         llevara semanas fallando. Ver utils/cloudSync. */
      void saveCloudData(uid, datosParaLaNube()).then((r) => {
        if (!alive || version !== localSessionVersion.current || auth.currentUser?.uid !== uid) return;
        setRespaldoFallo(r.ok ? null : r.motivo);
        if (r.ok) applyNewerCloudFields(r.data);
      });
    }, 1500);
    return () => { alive = false; clearTimeout(timer); };
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
    isPremium,
    userName,
    userPhoto,
    userCurrency,
    userLanguage,
    budgets,
    categoryBudgets,
    transactions,
    goals,
    isPremiumDeLaCuenta,
    pruebaInicio,
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
    cloudSyncMeta,
    deletedTransactionIds,
    deletedGoalIds,
  ]);

  // Al entrar y cada vez que Fino vuelve al frente, recoge primero los
  // movimientos que otro dispositivo haya subido. Se fusionan por id: nunca
  // se sustituye la lista local completa por una copia posiblemente antigua.
  useEffect(() => {
    if (!(ready && hasOnboarded && uid && isPremium)) return;
    let alive = true;
    const version = localSessionVersion.current;
    const sincronizarMovimientos = async () => {
      const cloud = await loadCloudData(uid).catch(() => null);
      if (!alive || !cloud || version !== localSessionVersion.current || auth.currentUser?.uid !== uid) return;
      if (!applyNewerCloudFields(cloud)) return;
      const borrados = pruneDeletedTransactionIds([...deletedTransactionIds, ...(cloud.deletedTransactionIds ?? [])]);
      const metasBorradas = pruneDeletedGoalIds([...deletedGoalIds, ...(cloud.deletedGoalIds ?? [])]);
      setDeletedTransactionIds((actuales) =>
        actuales.length === borrados.length && actuales.every((id) => borrados.includes(id))
          ? actuales
          : borrados
      );
      setTransactions((locales) =>
        mergeTransactions(locales, cloud.transactions).filter((tx) => !borrados.includes(tx.id))
      );
      setDeletedGoalIds(metasBorradas);
      setGoals((locales) =>
        mergeGoals(locales, cloud.goals).filter((goal) => !metasBorradas.includes(goal.id))
      );
    };
    void sincronizarMovimientos();
    return () => {
      alive = false;
    };
  }, [ready, hasOnboarded, uid, isPremium, deletedTransactionIds, deletedGoalIds, applyNewerCloudFields, setTransactions]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  useEffect(() => {
    return subscribeStorageWriteErrors(() => {
      setToast(tRef.current("toast.localSaveFailed"));
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(""), 4_500);
    });
  }, []);

  useEffect(() => subscribeStorageReadErrors(() => {
    setStorageReadBlocked(true);
  }), []);

  // ---------------------------------------------------------------------
  // CAPTURA AUTOMÁTICA DESDE NOTIFICACIONES
  // ---------------------------------------------------------------------
  // El servicio de Android va guardando en el celular las notificaciones de
  // apps de dinero, incluso con Fino cerrada. Aquí las recogemos cada vez
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
  const captureInputs = useRef({ transactions, merchantLearned, t, negocio: datosNegocio, autoCaptureLog });
  useEffect(() => {
    captureInputs.current = { transactions, merchantLearned, t, negocio: datosNegocio, autoCaptureLog };
  });
  // Evita que dos recogidas se pisen (abrir la app y volver al frente casi
  // a la vez): sin esto, las dos vaciarían el buzón y se duplicaría todo.
  const captureBusy = useRef(false);

  useEffect(() => {
    if (notificationReader.isSupported) {
      setAutoCaptureOnState(notificationReader.isEnabled());
      setAutoCapturePermission(notificationReader.isPermissionGranted());
    }
  }, []);

  useEffect(() => {
    if (ready && hasOnboarded) saveJSON(STORAGE_KEYS.autoCaptureLog, autoCaptureLog);
  }, [autoCaptureLog, ready, hasOnboarded]);

  useEffect(() => {
    if (!(ready && hasOnboarded && notificationReader.isSupported)) return;
    let alive = true;
    const version = localSessionVersion.current;

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
        // El disco puede conservar durante unos milisegundos la lista anterior
        // porque el guardado está agrupado. Nunca reincorporamos identificadores
        // que la persona ya borró, aunque todavía aparezcan en esa copia vieja.
        const deleted = new Set(deletedTransactionIdsRef.current);
        const savedActive = guardadas.filter((tx) => !deleted.has(tx.id));
        setTransactions((memoria) => {
          const memoryActive = memoria.filter((tx) => !deleted.has(tx.id));
          return hayNovedades(memoryActive, savedActive)
            ? mergeTransactions(memoryActive, savedActive)
            : memoryActive;
        });
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
      if (captureBusy.current) return;
      // El permiso de Android se puede quitar desde los ajustes del sistema
      // en cualquier momento. Se comprueba ANTES de descifrar listas grandes:
      // con la captura apagada, el temporizador no debe tocar el disco.
      if (!notificationReader.isEnabled() || !notificationReader.isPermissionGranted()) return;

      captureBusy.current = true;
      try {
        // Recoge lo que haya escrito el trabajo de fondo únicamente cuando la
        // función está activa y realmente puede haber novedades.
        const cajaDelDisco = await recogerDelDisco();
        // Lo que un trabajo de fondo saco del buzon y no llego a registrar.
        //
        // Va PRIMERO y junto con lo del buzon: si Android corto el proceso a
        // medias, ese yapeo no esta ni registrado ni en el buzon, y sin esto
        // no lo veria nadie nunca.
        const delBuzon = await notificationReader.drain();
        const aMedias = (await pendientesDeCaptura()) as typeof delBuzon;
        const captured = [...new Map([...aMedias, ...delBuzon].map(item => [item.captureId || `${item.package}|${item.postedAt}|${item.title}|${item.text}`, item])).values()];
        if (captured.length === 0) return;
        await guardarPendientes(captured);

        const {
          transactions: current,
          merchantLearned: learned,
          t: translate,
          negocio: datosDelNegocio,
          autoCaptureLog: logEnMemoria,
        } = captureInputs.current;
        const [transactionsDelDisco, logDelDisco] = await Promise.all([
          loadJSON<Transaction[]>(STORAGE_KEYS.transactions, []),
          loadJSON<CaptureLogEntry[]>(STORAGE_KEYS.autoCaptureLog, []),
        ]);
        const basePersonal = mergeTransactions(current, transactionsDelDisco);
        const baseLog = mergeCaptureLog(logEnMemoria, logDelDisco);
        const { toAdd, log, avisoDe } = processCaptured(captured, basePersonal, learned, translate);

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

        const siguienteLog = [...baseLog, ...log].slice(-40);
        const siguientesPersonales = mergeTransactions(personales, basePersonal);
        const siguientesNegocio = [...fusionarMovimientosNegocio(datosDelNegocio.movimientos, cajaDelDisco), ...delNegocio];
        // Persistencia comprobable antes de confirmar el lote nativo. Así no
        // existe una ventana donde el buzón ya se borró y el movimiento vive
        // únicamente en memoria de React.
        const guardados = await Promise.all([
          saveJSONNow(STORAGE_KEYS.autoCaptureLog, siguienteLog),
          personales.length > 0 ? saveJSONNow(STORAGE_KEYS.transactions, siguientesPersonales) : Promise.resolve(true),
          delNegocio.length > 0 ? saveJSONNow(STORAGE_KEYS.movimientosNegocio, siguientesNegocio) : Promise.resolve(true),
        ]);
        if (guardados.some(ok => !ok)) throw new Error("capture-not-persisted");
        limpiarPendientes();
        setAutoCaptureLog(siguienteLog);
        if (personales.length > 0) {
          setTransactions(siguientesPersonales);
        }
        if (delNegocio.length > 0) {
          setDatosNegocio((antes) => ({ ...antes, movimientos: siguientesNegocio }));
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
        // El lote nativo solo desaparece después de que la captura llegó al
        // estado protegido de la app. Si el proceso cae antes, vuelve a
        // entregarse y captureId impide duplicarlo.
        await notificationReader.ackDrain();
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
    // Sin esto, un yapeo que llega con Fino abierta no se registraba hasta
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
        /* Y DE PASO SE ENCIENDE EL MOTOR DE VOZ (21/08/2026).
           *"Quiero que desde el primer yape sea al instante, no que recién al 2 sea
           instante."* El motor tarda 2 a 4 segundos en despertar y ya se encendía al
           enganchar el servicio, pero recién instalada la app Android tarda un momento en
           engancharlo — y un yapeo en esos segundos pagaba la espera.
           Quien va a yapear casi siempre abre Fino antes, o la tiene abierta detrás. Aquí ya
           está caliente para cuando llegue. Encenderlo dos veces no hace nada. */
        notificationReader.calentarVoz();
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
      if (uid && isPremium) {
        void loadCloudData(uid).then((cloud) => {
          if (!cloud || !alive || version !== localSessionVersion.current || auth.currentUser?.uid !== uid) return;
          if (!applyNewerCloudFields(cloud)) return;
          const borrados = pruneDeletedTransactionIds([...deletedTransactionIds, ...(cloud.deletedTransactionIds ?? [])]);
          const metasBorradas = pruneDeletedGoalIds([...deletedGoalIds, ...(cloud.deletedGoalIds ?? [])]);
          setDeletedTransactionIds((actuales) =>
            actuales.length === borrados.length && actuales.every((id) => borrados.includes(id))
              ? actuales
              : borrados
          );
          setTransactions((locales) =>
            mergeTransactions(locales, cloud.transactions).filter((tx) => !borrados.includes(tx.id))
          );
          setDeletedGoalIds(metasBorradas);
          setGoals((locales) =>
            mergeGoals(locales, cloud.goals).filter((goal) => !metasBorradas.includes(goal.id))
          );
        }).catch(() => undefined);
      }
    });
    return () => {
      alive = false;
      clearInterval(cada);
      alLlegar.remove();
      sub.remove();
    };
    // Solo depende de si la app ya está lista: los datos que necesita los
    // lee de captureInputs en el momento de recoger.
  }, [ready, hasOnboarded, uid, isPremium, deletedTransactionIds, deletedGoalIds, applyNewerCloudFields, setTransactions]);

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
  const { spent, income, transfersOut, transfersIn } = useMemo(() => {
    return totalsForMonth(transactions, mk);
  }, [transactions, mk]);

  // Cuánto se ha gastado este mes en cada categoría (solo gastos), para
  // compararlo contra el límite que la persona puso por categoría.
  const categorySpent = useMemo(() => {
    const result: Record<string, number> = {};
    transactions
      .filter((t) => t.date.startsWith(mk) && t.type === "expense" && !t.internalTransfer)
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
  const disponible = availablePersonalBalance({ budget, prevBalance, income, spent, transfersOut, transfersIn });
  const apartado = useMemo(() => totalApartado(goals), [goals]);
  const libre = saldoLibre(disponible, apartado);
  const descuadre = hayDescuadre(disponible, apartado);
  const monthLabel = `${monthNames[month.m]} ${month.y}`;

  function completeOnboarding(budgetAmount: number) {
    const initialMonth = currentRealMonth();
    const key = monthKey(initialMonth.y, initialMonth.m);
    setMonth(initialMonth);
    setBudgets(markCloudGroup(CLOUD_SYNC_GROUPS.budgets, budgets, (b) => ({ ...b, [key]: budgetAmount })));
    markCloudProfile({ userName, userPhoto, userCurrency, userLanguage });
    setHasOnboarded(true);
    saveJSON(STORAGE_KEYS.profile, {
      userName,
      userEmail,
      userPhoto,
      userCurrency,
      userLanguage,
      userCountry,
      hasOnboarded: true,
    });
  }

  function updateProfileInfo(name: string, photo: string | null) {
    persistCloudProfile(markCloudProfile({ userName: name, userPhoto: photo }));
    showToast(t("toast.profileUpdated"));
  }

  function updateCurrency(id: string) {
    const next = markCloudProfile({ userCurrency: id });
    // Cambiar cómo se muestran los montos no cambia el país real del usuario.
    // El país también controla métodos locales (Yape/Plin) y Telegram.
    persistCloudProfile(next);
    showToast(t("toast.currencyUpdated"));
  }

  function updateLanguage(id: string) {
    persistCloudProfile(markCloudProfile({ userLanguage: id }));
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
  function updateCountry(country: string, language: string, currency: string) {
    persistCloudProfile(markCloudProfile({ userLanguage: language, userCurrency: currency }), country);
    showToast(
      translations[language as keyof typeof translations]?.["toast.countryUpdated"] ||
        "Listo"
    );
  }

  /** Guarda la elección previa al registro sin dar por terminado el setup. */
  function setInitialCountry(country: string, language: string, currency: string) {
    persistCloudProfile(markCloudProfile({ userLanguage: language, userCurrency: currency }), country, false);
  }

  function updateThemeMode(mode: ThemeMode) {
    setThemeMode(mode);
    colorScheme.set(mode);
    saveJSON(STORAGE_KEYS.themeMode, mode);
    showToast(t("toast.themeUpdated"));
  }

  function updateVisualStyle(style: VisualStyle) {
    setVisualStyle(style);
    saveJSON(STORAGE_KEYS.visualStyle, style);
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
    setCarryoverCleared(markCloudGroup(CLOUD_SYNC_GROUPS.carryover, carryoverCleared,
      (prev) => (prev.includes(mk) ? prev : [...prev, mk])));
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
    setCarryoverCleared(markCloudGroup(CLOUD_SYNC_GROUPS.carryover, carryoverCleared,
      (prev) => prev.filter((m) => m !== mk)));
    showToast(t("toast.carryoverRestored"));
  }

  function setBudgetForCurrentMonth(amount: number) {
    if (!Number.isFinite(amount) || amount < 0) {
      showToast(t("toast.amountNonNegative"));
      return;
    }
    if (!isSafeMoneyAmount(amount)) {
      showToast(t("toast.amountTooLarge"));
      return;
    }
    if (!presupuestoCubreTransferencias(amount, transactions, mk)) {
      showToast(t("toast.budgetBelowTransfers", {
        amount: fmt(transferidoPendienteDelMes(transactions, mk)),
      }));
      return;
    }
    setBudgets(markCloudGroup(CLOUD_SYNC_GROUPS.budgets, budgets, (b) => ({ ...b, [mk]: amount })));
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
    markCloudGroup(CLOUD_SYNC_GROUPS.categoryOverrides, categoryOverrides, () => next);
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
    let creada: CategoriaPropia | undefined;
    const lista = markCloudGroup(CLOUD_SYNC_GROUPS.customCategories, categoriasPropias, (current) => {
      const result = crearPropia(current, datos);
      creada = result.creada;
      return result.lista;
    });
    if (!creada) throw new Error("category-create-failed");
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
    const next = markCloudGroup(CLOUD_SYNC_GROUPS.favoriteIcons, iconosFavoritos, () => {
      saveFavoritos(lista);
      return getFavoritos();
    });
    // Se relee del sitio donde quedaron, no se guarda lo que llego: saveFavoritos
    // limpia repetidos y aplica el tope, y el estado tiene que ser lo mismo que
    // hay en el disco o la nube recibiria una lista distinta de la que se ve.
    setIconosFavoritosState(next);
  }

  /**
   * Enciende la prueba gratuita. Solo se puede una vez, y aqui se hace cumplir.
   *
   * La pantalla ya esconde el boton cuando esta usada, pero la regla se comprueba
   * TAMBIEN aqui: un boton escondido es una decision de pantalla, y esto es una
   * decision de la cuenta. Devuelve si se pudo, para poder avisar.
   */
  /**
   * EL CALENDARIO DE PAGOS. Guardar crea o reemplaza, con el mismo criterio que un negocio.
   */
  function reprogramarAvisos() {
    reprogramarAvisosDePagos(pagosProgramados, (clave, valores) => tRef.current(clave, valores), new Date(), fmt)
      .then((r) => {
        setAvisosProgramados(r.puestos);
        setAvisosFallo(r.fallo ?? null);
      });
  }

  function guardarPagoProgramado(pago: PagoProgramado) {
    setPagosProgramados(markCloudGroup(CLOUD_SYNC_GROUPS.payments, pagosProgramados, (antes) =>
      antes.some((p) => p.id === pago.id)
        ? antes.map((p) => (p.id === pago.id ? pago : p))
        : [...antes, pago]
    ));
  }

  function quitarPagoProgramado(id: string) {
    setPagosProgramados(markCloudGroup(CLOUD_SYNC_GROUPS.payments, pagosProgramados,
      (antes) => antes.filter((p) => p.id !== id)));
  }

  /**
   * "YA LO PAGUÉ": MARCA EL MES **Y** ANOTA EL MOVIMIENTO. Las dos cosas, aquí.
   *
   * Están juntas porque son las dos mitades de un mismo gesto, y separadas es cuestión de
   * tiempo que una pantalla haga una y se olvide de la otra: quedaría un recibo en verde que
   * no aparece en los gastos —o un gasto que la lista sigue pidiendo—. Es el fallo de la
   * costura, que en este proyecto ya salió con la voz, con las fotos y con los favoritos.
   *
   * **Al desmarcar NO se borra el movimiento**, y es deliberado: para entonces puede tener
   * la categoría cambiada, notas, o haberse editado el monto. Borrarlo se llevaría por
   * delante trabajo de la persona por haber tocado un interruptor. Desmarcar solo vuelve a
   * ponerlo en la lista de pendientes.
   *
   * Un recordatorio no crea nada: `movimientoDelPago` devuelve null y aquí no se fuerza.
   */
  function marcarPagoDelMes(id: string, mes: string, pagado: boolean) {
    const currentPayments = cloudFieldsRef.current?.pagosProgramados ?? pagosProgramados;
    const pago = currentPayments.find((p) => p.id === id);
    if (!pago) return;
    const operationKey = `${id}:${mes}`;
    if (pagosEnCurso.current.has(operationKey)) return;
    pagosEnCurso.current.add(operationKey);
    setTimeout(() => pagosEnCurso.current.delete(operationKey), 700);

    const movementId = pago.movimientos?.[mes];
    const movementStillExists =
      movementId != null && transactions.some((tx) => tx.id === movementId);
    const mov = pagado ? movimientoDelPago(pago, mes) : null;
    const nextMovementId =
      pagado && mov && !movementStillExists ? nextId() : movementId;
    setPagosProgramados(markCloudGroup(CLOUD_SYNC_GROUPS.payments, currentPayments, (antes) =>
      antes.map((p) => {
        if (p.id !== id) return p;
        const marked = marcarPagado(p, mes, pagado);
        // Al desmarcar se conserva el enlace y el gasto. Si vuelve a marcarlo,
        // se reutiliza el mismo movimiento con sus notas y categoría.
        if (!pagado) return marked;
        if (nextMovementId == null) return marked;
        return {
          ...marked,
          movimientos: { ...(p.movimientos ?? {}), [mes]: nextMovementId },
        };
      })
    ));
    if (!pagado) {
      return;
    }
    if (movementStillExists || nextMovementId == null) return;
    if (!mov) return;
    addOrUpdateTransaction({
      id: nextMovementId,
      type: mov.type,
      amount: mov.amount,
      /**
       * LA CATEGORÍA SALE DEL NOMBRE, CON EL MISMO CLASIFICADOR QUE LOS YAPES.
       *
       * **Esto era un fallo suyo del 19/08:** *"al agregarle un icono en agregar pago no
       * viaja a las pantallas de inicio e historial"*. Y no podía viajar — en Inicio el
       * dibujo de un movimiento sale de su CATEGORÍA, no de un icono propio, y aquí se
       * estaba creando todo en "Otros".
       *
       * No se le puso un icono suelto al movimiento a propósito: los reportes, el PDF y los
       * límites agrupan por categoría, así que un movimiento con dibujo pero sin categoría
       * de verdad saldría bonito en Inicio y suelto en todo lo demás.
       *
       * Con el clasificador, "Netflix" cae en entretenimiento y "Luz" en servicios: el
       * dibujo sale solo y además las cuentas del mes cuadran.
       */
      category:
        pago.categoria || suggestCategory(pago.nombre, mov.type, merchantLearned),
      date: mov.date,
      method: "",
      description: mov.description,
      notes: "",
      /**
       * Y SU DIBUJO. Ver `Transaction.icono`: la categoría de arriba manda en las cuentas —
       * reportes, PDF, límites— y esto solo en lo que se pinta en la fila.
       *
       * **Esta línea faltaba, y por eso él vio el fallo tres veces.** Se dio por puesta en el
       * 19ago-08 y no llegó a aplicarse; el resto del camino —el campo en el tipo, el render
       * en Inicio y en el Historial— sí estaba, así que todo parecía hecho y no se veía nada.
       */
      icono: pago.icono,
    });
  }

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

  async function activarPruebaPremium(): Promise<boolean> {
    if (!hasOnboarded) return false;
    if (pruebaYaUsada(pruebaInicio)) return false;
    const userUid = auth.currentUser?.uid;
    const version = localSessionVersion.current;
    const { activated, startedAt: inicio } = await activatePremiumTrialCloud();
    if (!userUid || auth.currentUser?.uid !== userUid || version !== localSessionVersion.current) return false;
    // Una consulta iniciada antes de activar no puede retirar la prueba nueva.
    cloudAccessRevision.current += 1;
    setPruebaInicio(inicio);
    savePrueba(inicio);
    // El reloj de dentro se pone al dia para que la prueba cuente desde ya y no
    // desde el ultimo minuto redondo.
    setAhora(inicio);
    return activated;
  }

  /** Cambia una propia. Lo que no se pase se deja como estaba. */
  function editarCategoria(
    id: string,
    cambios: { nombre?: string; color?: string; icono?: string; image?: string | null }
  ) {
    const lista = markCloudGroup(CLOUD_SYNC_GROUPS.customCategories, categoriasPropias,
      (current) => editarPropia(current, id, cambios));
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
    const lista = markCloudGroup(CLOUD_SYNC_GROUPS.customCategories, categoriasPropias,
      (current) => borrarPropia(current, id));
    savePropias(lista);
    setCategoriasPropiasState(lista);
  }

  /** Cuántos movimientos quedarían en "Otros" si se borra esta categoría. */
  function movimientosDeCategoria(id: string): number {
    return transactions.filter((t) => t.category === id).length;
  }

  function updateCategoryBudgets(newBudgets: Record<string, number>) {
    const values = Object.values(newBudgets);
    if (values.some((amount) => !Number.isFinite(amount) || amount < 0)) {
      showToast(t("toast.amountNonNegative"));
      return;
    }
    if (values.some((amount) => !isSafeMoneyAmount(amount))) {
      showToast(t("toast.amountTooLarge"));
      return;
    }
    markCloudGroup(CLOUD_SYNC_GROUPS.categoryBudgets, categoryBudgets, () => newBudgets);
    setCategoryBudgets(newBudgets);
    showToast(t("toast.budgetUpdated"));
  }

  function recordPersonalReturn(receipt: PersonalReturnReceipt): boolean {
    if (!personalReturnIsCurrent(receipt)) return false;
    if (deletedTransactionIdsRef.current.includes(receipt.personalTransactionId)) return false;
    if (currencyForReturn.current !== receipt.currency) {
      showToast(tRef.current("spaces.currencyMismatch"));
      return false;
    }
    const tx: Transaction = { id: receipt.personalTransactionId, type: "income", amount: receipt.amount,
      category: "otros", date: receipt.fecha, time: horaDe(receipt.createdAt), method: "transfer",
      description: tRef.current(receipt.kind === "family" ? "family.returnFrom" : "boxes.returnFrom", { name: receipt.spaceName }),
      notes: "", origin: "manual", internalTransfer: receipt.kind, internalTransferLink: receipt.movementId,
      internalTransferSpaceId: receipt.spaceId, internalTransferSpaceName: receipt.spaceName,
      internalTransferAllocations: receipt.allocations, updatedAt: Date.now() };
    returnReceipt.current = receipt;
    setTransactions(previous => deletedTransactionIdsRef.current.includes(receipt.personalTransactionId)
      ? previous : mergePersonalReturn(previous, tx));
    return true;
  }

  async function commitPrivateBoxData(before: DatosCajas, data: DatosCajas, upserts: Transaction[], deleteIds: number[], current: () => boolean, apply: (data: DatosCajas) => void, repair?: true | PrivateBoxRepairChoice): Promise<boolean> {
    const owner = auth.currentUser?.uid ?? "", version = localSessionVersion.current;
    const task = captureAccountTask(owner, () => version === localSessionVersion.current);
    if (!ready || !hasOnboarded || !task.current() || !current() || hasUnreadableLocalData()) return false;
    const paired = !!repair || upserts.length > 0 || deleteIds.length > 0;
    // El contrato de varias claves está comprobado en el SQLite de Android,
    // no se supone equivalente en iOS/web. Operaciones de una Caja sin enlace
    // Personal continúan funcionando allí con una sola clave.
    if (paired && Platform.OS !== "android") throw new Error("private-box-android-only");
    const keys = paired ? [STORAGE_KEYS.transactions, STORAGE_KEYS.deletedTransactionIds, STORAGE_KEYS.cajasDinero] : [STORAGE_KEYS.cajasDinero];
    const checked = validarCajas(JSON.parse(JSON.stringify(data)));
    fusionarCajas(checked, CAJAS_VACIAS);
    const source = validarCajas(JSON.parse(JSON.stringify(before)));
    const initialPersonal = transactionsLive.current;
    if (repair && isPremium) {
      const oldLinks = new Map(source.movimientos.map(row => [row.id, row.personalTransactionId]));
      const ids = [...new Set([...checked.movimientos.flatMap(row => row.personalTransactionId != null && oldLinks.get(row.id) !== row.personalTransactionId ? [row.personalTransactionId] : []),
        ...upserts.flatMap(row => [row.id, ...(row.internalTransferAllocations || []).map(link => link.transactionId)])])];
      const remote = await task.wait(() => loadPrivateBoxRepairCloud(owner, ids));
      assertPrivateBoxRepairCloud(initialPersonal, remote);
    }
    return withLocalAccountOperation(async () => {
      if (!task.current() || !current()) return false;
      return saveJSONBatchNow(keys, () => {
        if (!task.current() || !current() || (paired && transactionsLive.current !== initialPersonal)) throw new Error("private-box-source-changed");
        const base = transactionsLive.current, deleted = deletedTransactionIdsRef.current;
        if (repair) validatePrivateBoxRepair(source, checked, base, deleted, upserts, deleteIds, owner, repair);
        else validatePrivateBoxPatch(source, checked, base, upserts, deleteIds, owner);
        const patch = patchPrivateBoxPersonal(base, deleted, upserts, deleteIds);
        return {
          entries: paired ? [[STORAGE_KEYS.transactions, patch.transactions], [STORAGE_KEYS.deletedTransactionIds, patch.deletedIds], [STORAGE_KEYS.cajasDinero, checked]] : [[STORAGE_KEYS.cajasDinero, checked]],
          stillValid: () => task.current() && current() && (!paired || (transactionsLive.current === base && deletedTransactionIdsRef.current === deleted)),
          committed: () => {
            if (!task.current()) return;
            if (paired) {
              const latest = transactionsLive.current === base && deletedTransactionIdsRef.current === deleted
                ? patch : patchPrivateBoxPersonal(transactionsLive.current, deletedTransactionIdsRef.current, upserts, deleteIds);
              deletedTransactionIdsRef.current = latest.deletedIds;
              if (returnReceipt.current && deleteIds.includes(returnReceipt.current.personalTransactionId)) returnReceipt.current = null;
              setDeletedTransactionIds(latest.deletedIds);
              setTransactions(latest.transactions);
            }
            guardarCajasEnMemoria(checked);
            apply(checked);
          },
        };
      });
    });
  }

  function addOrUpdateTransaction(t2: Transaction, allowLinkedTransferUpdate = false) {
    if (!Number.isFinite(t2.amount) || t2.amount <= 0) {
      showToast(t("toast.amountPositive"));
      return;
    }
    if (!isSafeMoneyAmount(t2.amount)) {
      showToast(t("toast.amountTooLarge"));
      return;
    }
    const existing = transactions.find((p) => p.id === t2.id);
    if (existing?.internalTransfer && !allowLinkedTransferUpdate) {
      showToast(t("toast.transferEditBlocked"));
      return;
    }
    const isEdit = Boolean(existing);
    // Un movimiento creado por un pago de tarjeta tiene su monto y fecha
    // enlazados al registro de la tarjeta. Editarlos solo desde Inicio dejaría
    // dos verdades distintas; esos campos se corrigen desde Tarjeta de crédito.
    const safeTransaction: Transaction = {
      ...(
      existing?.method === "credit-card-payment"
        ? {
            ...t2,
            type: existing.type,
            amount: existing.amount,
            date: existing.date,
            time: existing.time,
            method: existing.method,
          }
        : t2
      ),
      updatedAt: Date.now(),
    };
    setTransactions((prev) =>
      isEdit
        ? prev.map((p) => (p.id === safeTransaction.id ? safeTransaction : p))
        : [safeTransaction, ...prev],
    );
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
    setMerchantLearned(markCloudGroup(CLOUD_SYNC_GROUPS.merchants, merchantLearned,
      (prev) => learnCategory(merchantText, category, prev)));
  }

  function removeTransactions(ids: number[]) {
    if (!ids.length) return;
    void unlinkCreditPaymentsForHomeTransactions(ids);
    // Bloquea respuestas atrasadas desde este instante, no recién al dibujar.
    deletedTransactionIdsRef.current = pruneDeletedTransactionIds([...deletedTransactionIdsRef.current, ...ids]);
    if (returnReceipt.current && ids.includes(returnReceipt.current.personalTransactionId)) returnReceipt.current = null;
    setDeletedTransactionIds((prev) => {
      const next = pruneDeletedTransactionIds([...prev, ...ids]);
      deletedTransactionIdsRef.current = next;
      return next;
    });
    setTransactions((prev) => prev.filter((p) => !ids.includes(p.id)));
  }

  function deleteTransaction(id: number) {
    const transaction = transactions.find((item) => item.id === id);
    if (transaction?.internalTransfer) {
      showToast(t("toast.transferManagedInSpace"));
      return;
    }
    removeTransactions([id]);
    showToast(t("toast.transactionDeleted"));
  }

  function deleteLinkedTransferTransaction(id: number) {
    removeTransactions([id]);
    showToast(t("toast.transactionDeleted"));
  }

  function repairLinkedTransferTransactions(upserts: Transaction[], deleteIds: number[] = []) {
    if (deleteIds.length) removeTransactions(deleteIds);
    if (!upserts.length) return;
    // Si Familia/Caja conserva el vínculo válido, su contraparte de Personal
    // no puede seguir marcada como borrada: ese tombstone la ocultaría de
    // nuevo durante la siguiente sincronización. Solo se retiran los IDs que
    // acabamos de reconstruir desde una fuente enlazada y verificada.
    const restoredIds = new Set(upserts.map(item => item.id));
    deletedTransactionIdsRef.current = deletedTransactionIdsRef.current.filter(id => !restoredIds.has(id));
    setDeletedTransactionIds(prev => {
      const next = prev.filter(id => !restoredIds.has(id));
      deletedTransactionIdsRef.current = next;
      return next.length === prev.length ? prev : next;
    });
    setTransactions(prev => {
      const replacements = new Map(upserts.map(item => [item.id, item]));
      const repaired = prev.map(item => {
        const replacement = replacements.get(item.id);
        if (!replacement) return item;
        // Un espacio cerrado no se reabre por una copia activa anterior.
        if (item.internalTransferSettled && !replacement.internalTransferSettled) return item;
        return { ...item, ...replacement,
          updatedAt: Math.max(Date.now(), (item.updatedAt ?? 0) + 1, replacement.updatedAt ?? 0) };
      });
      const known = new Set(prev.map(item => item.id));
      return [...upserts.filter(item => !known.has(item.id)).map(item => ({ ...item, updatedAt: Math.max(Date.now(), item.updatedAt ?? 0) })), ...repaired];
    });
  }

  function deleteTransactions(ids: number[]) {
    const protectedIds = new Set(transactions.filter((item) => item.internalTransfer).map((item) => item.id));
    const deletableIds = ids.filter((id) => !protectedIds.has(id));
    if (!deletableIds.length) {
      if (ids.length) showToast(t("toast.transferManagedInSpace"));
      return;
    }
    removeTransactions(deletableIds);
    showToast(
      t(deletableIds.length > 1 ? "toast.transactionsDeletedPlural" : "toast.transactionsDeleted", {
        count: deletableIds.length,
      })
    );
  }

  function addOrUpdateGoal(g: Goal) {
    if (!isPremium) return;
    setGoals((prev) => {
      const exists = prev.some((p) => p.id === g.id);
      return exists ? prev.map((p) => (p.id === g.id ? g : p)) : [g, ...prev];
    });
    showToast(t("toast.goalSaved"));
  }

  function deleteGoal(id: number) {
    if (!isPremium) return;
    setDeletedGoalIds((prev) => pruneDeletedGoalIds([...prev, id]));
    setGoals((prev) => prev.filter((g) => g.id !== id));
    showToast(t("toast.goalDeleted"));
  }

  function addMoneyToGoal(amount: number, goalId: number) {
    if (!isPremium) return;
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
    if (!isPremium) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const newSaved = Math.max(0, goal.saved - amount);
    setGoals((prev) =>
      prev.map((g) => (g.id === goal.id ? { ...g, saved: newSaved, completed: newSaved >= g.target } : g))
    );
    showToast(t("toast.moneyWithdrawn"));
  }

  /* EL VALOR, ESTABILIZADO. Ver utils/valorEstable: hasta el 20/08/2026 esto era un objeto
     literal, o sea uno NUEVO en cada dibujado del proveedor, y como React compara los
     contextos por identidad, cualquier cambio de aquí dentro —un aviso, el mes, el mensajito
     de "guardado"— redibujaba TODAS las pantallas montadas aunque ninguna usara lo que había
     cambiado. Ahora solo se despierta a quien de verdad tiene algo nuevo que enseñar. */
  const valor = useValorEstable({
    ready,
    authReady,
    needsEmailVerification,
    hasOnboarded,
    completeOnboarding,
    reloadPersistedData,
    openLocalAccount,
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
    fmtCompact,
    setInitialCountry,
    userLanguage,
    userCountry,
    updateLanguage,
    t,
    monthNames,
    themeMode,
    updateThemeMode,
    visualStyle,
    updateVisualStyle,
    month,
    setMonth,
    budgets,
    budget,
    spent,
    income,
    prevBalance,
    carryoverCleared,
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
    deletedTransactionIds,
    recordPersonalReturn,
    pagosProgramados,
    guardarPagoProgramado,
    quitarPagoProgramado,
    marcarPagoDelMes,
    avisosProgramados,
    avisosFallo,
    reprogramarAvisos,
    deleteTransaction,
    deleteLinkedTransferTransaction,
    repairLinkedTransferTransactions,
    commitPrivateBoxData,
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
    isTesterPremium: testerPremium.active,
    testerPremiumPendingVerification: testerPremium.pendingVerification,
    testerPremiumGrantedAt: testerPremium.grantedAt,
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
    tienePremiumDeVerdad: isPremiumDeLaCuenta || pruebaCorriendo || testerPremium.active,
    isCloudSynced: uid !== null && isPremium,
    hasCloudAccount: uid !== null,
    /* "Respaldados" quiere decir que la ULTIMA subida termino bien, no que haya sesion
       iniciada. Ver el cartel de Ajustes y utils/cloudSync. */
    respaldoAlDia: uid !== null && respaldoFallo === null,
    respaldoFallo,
    celebrateGoal,
    clearCelebration: () => setCelebrateGoal(null),
    toast,
    showToast,
  });

  return (
    <AppDataContext.Provider value={valor}>
      <View style={[{ flex: 1 }, visualStyleVariables]}>{children}</View>
      <Modal visible={storageReadBlocked} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.72)" }}>
          <View style={{ borderRadius: 20, padding: 24, backgroundColor: "#FFFFFF" }}>
            <Text style={{ color: "#1B1B1B", fontSize: 20, fontWeight: "700", marginBottom: 12 }}>
              {t("storage.readBlockedTitle")}
            </Text>
            <Text style={{ color: "#3D3D3D", fontSize: 16, lineHeight: 24 }}>
              {t("storage.readBlockedBody")}
            </Text>
          </View>
        </View>
      </Modal>
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData debe usarse dentro de AppDataProvider");
  return ctx;
}
