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
import { activate as activateDecoy, deactivate as deactivateDecoy } from "@/utils/decoyMode";
import {
  loadOverrides,
  saveOverrides,
  setOverrides,
  type CategoryOverrides,
} from "@/utils/categoryCustom";
import {
  borrar as borrarPropia,
  crear as crearPropia,
  editar as editarPropia,
  loadPropias,
  savePropias,
  type CategoriaPropia,
} from "@/utils/categoriasPropias";
import { DECOY_BUDGET, buildDecoyTransactions } from "@/utils/decoySeed";
import { fmt as formatAmount, monthKey } from "@/utils/format";
import { reserveIdsAbove } from "@/utils/id";
import { learnCategory } from "@/utils/classifier";
import { auth } from "@/utils/firebase";
import { signOutFromGoogle } from "@/utils/googleAuth";
import { deleteCloudAccount, loadCloudData, saveCloudData } from "@/utils/cloudSync";
import { processCaptured, type CaptureLogEntry } from "@/utils/autoCapture";
import { limpiarPendientes, pendientesDeCaptura } from "@/utils/capturaEnFondo";
import { mergeTransactions, hayNovedades, mergeCaptureLog } from "@/utils/mergeTransactions";
import { presupuestoAHeredar } from "@/utils/presupuestoMensual";
import { hayDescuadre, maximoAApartar, saldoLibre, totalApartado } from "@/utils/ahorro";
import { availableBalance } from "@/utils/finances";
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
  crearCategoria: (datos: { nombre: string; tipo: "expense" | "income"; color: string; icono: string }) => string;
  /** La recien creada, para que la pantalla de agregar la deje elegida. */
  categoriaRecienCreada: string | null;
  olvidarCategoriaRecienCreada: () => void;
  editarCategoria: (id: string, cambios: { nombre?: string; color?: string; icono?: string }) => void;
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

  isPremium: boolean;
  setIsPremium: (v: boolean) => void;
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
  // Se crea desde otra pantalla, encima de la de agregar. Al volver hay que
  // dejarla elegida: nadie crea una categoria para despues buscarla.
  const [categoriaRecienCreada, setCategoriaRecienCreada] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions);
  const [goals, setGoals] = useState<Goal[]>(seedGoals);
  const [isPremium, setIsPremium] = useState(false);
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
    setOverrides(cloud.categoryOverrides ?? {});
    setCategoryOverridesState(cloud.categoryOverrides ?? {});
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
    ]);
    setBudgets(savedBudgets);
    setCategoryBudgets(savedCategoryBudgets);
    setCategoryOverridesState(savedOverrides);
    setCategoriasPropiasState(savedPropias);
    setTransactions(savedTransactions);
    setGoals(savedGoals);
    protectExistingIds(savedTransactions, savedGoals);
    setIsPremium(savedIsPremium);
    setMerchantLearned(savedLearned);
    setCarryoverCleared(savedCarryoverCleared);
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
    if (uid) {
      await saveCloudData(uid, {
        hasOnboarded,
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
        categoryOverrides,
        carryoverCleared,
      });
    }
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
   * EL PRESUPUESTO SIGUE VIGENTE EL MES SIGUIENTE.
   *
   * Los presupuestos se guardan mes por mes, y un mes sin su entrada valía
   * cero. Así que cada 1 de mes había que volver a escribirlo, y hasta
   * hacerlo Inicio decía que no hay presupuesto. Doce veces al año.
   *
   * Se copia SOLO al mes en curso, y solo si no tiene el suyo. Heredarlo al
   * vuelo —devolver el del mes anterior cuando falta— se vería igual de bien
   * y rompería el Saldo anterior: ese suma los presupuestos de todos los
   * meses previos, así que quien puso 500 en enero y no abrió la app en seis
   * meses tendría de golpe 3.000 soles salidos de la nada.
   *
   * Y se avisa. Escribir un presupuesto sin decirlo es cambiarle a alguien un
   * número de dinero a sus espaldas, aunque sea el número que quería.
   */
  useEffect(() => {
    if (!(ready && hasOnboarded)) return;
    const mesEnCurso = monthKey(new Date().getFullYear(), new Date().getMonth());
    const heredado = presupuestoAHeredar(budgets, mesEnCurso);
    if (heredado === null) return;
    setBudgets((prev) => ({ ...prev, [mesEnCurso]: heredado }));
    showToast(t("home.budgetInherited", { amount: formatAmount(heredado, userCurrency) }));
    // Solo al abrir la app y al cambiar de mes estando abierta. No depende de
    // "budgets" a propósito: si dependiera, se volvería a disparar con su
    // propio cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, hasOnboarded]);

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
    if (ready) saveJSON(STORAGE_KEYS.isPremium, isPremium);
  }, [isPremium, ready]);
  useEffect(() => {
    if (ready) saveJSON(STORAGE_KEYS.merchantLearned, merchantLearned);
  }, [merchantLearned, ready]);
  useEffect(() => {
    if (ready) saveJSON(STORAGE_KEYS.carryoverCleared, carryoverCleared);
  }, [carryoverCleared, ready]);

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
      saveCloudData(uid, {
        hasOnboarded,
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
        categoryOverrides,
        carryoverCleared,
      });
    }, 1500);
    return () => clearTimeout(timer);
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
  const captureInputs = useRef({ transactions, merchantLearned, t });
  useEffect(() => {
    captureInputs.current = { transactions, merchantLearned, t };
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
      } catch {
        // Si no se puede leer, se sigue con lo que hay en memoria. Nunca se
        // borra nada por no haber podido leer.
      }
    }

    async function collect() {
      // Antes que nada, recoger lo que se haya escrito por fuera.
      await recogerDelDisco();

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

        const { transactions: current, merchantLearned: learned, t: translate } = captureInputs.current;
        const { toAdd, log } = processCaptured(captured, current, learned, translate);

        limpiarPendientes();
        setAutoCaptureLog((prev) => [...prev, ...log].slice(-40));
        if (toAdd.length > 0) {
          setTransactions((prev) => [...toAdd, ...prev]);
          showToast(
            translate(toAdd.length > 1 ? "autoCapture.toastPlural" : "autoCapture.toast", {
              count: toAdd.length,
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

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      // Al volver al frente puede que la persona acabe de conceder (o
      // quitar) el permiso desde los ajustes de Android.
      setAutoCapturePermission(notificationReader.isPermissionGranted());
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
  const budget = budgets[mk] || 0;

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

  // Lo que sobró (o faltó) de todos los meses ANTERIORES al que se está
  // viendo: presupuestos + ingresos − gastos de esos meses.
  //
  // Antes esto recorría la lista completa de movimientos DOS veces por
  // cada mes con datos. Con varios meses de historial eso se multiplicaba
  // rápido, y este cálculo se rehace cada vez que cambia un movimiento o
  // se cambia de mes. Ahora es una sola pasada, con el mismo resultado.
  //
  // Poner un mes en cero ROMPE LA CADENA de ahí en adelante.
  //
  // El arrastre funciona como un relevo: cada mes le pasa su saldo final
  // al siguiente. Si un mes se pone en cero, deja de recibir y también
  // deja de pasar — y como el siguiente ya no recibe nada, tampoco tiene
  // qué pasar. El relevo queda cortado mientras esa marca siga puesta.
  //
  // Ejemplo, poniendo AGOSTO en cero:
  //    julio       → sin cambios (es anterior al corte)
  //    agosto      → 0
  //    septiembre  → 0
  //    octubre     → 0   ... y así hasta que se restaure agosto
  //
  // Al restaurar agosto, la cadena entera se reconstruye sola: no hay que
  // ir mes por mes.
  //
  // Ojo con la diferencia (fue un malentendido real durante el
  // desarrollo): NO es "septiembre arranca de nuevo desde agosto". Es
  // "mientras la cadena esté rota, ningún mes posterior arrastra nada".
  const carryoverBroken = useMemo(
    () => carryoverCleared.some((cleared) => cleared <= mk),
    [carryoverCleared, mk]
  );

  // El botón "restaurar" solo se ofrece en el mes exacto donde se puso la
  // marca — que es donde tiene sentido quitarla, y desde donde se
  // reconstruye todo.
  const carryoverActive = carryoverCleared.includes(mk);

  const prevBalance = useMemo(() => {
    if (carryoverBroken) return 0;
    let carry = 0;
    for (const [monthK, amount] of Object.entries(budgets)) {
      if (monthK < mk) carry += amount || 0;
    }
    for (const tx of transactions) {
      if (tx.date.slice(0, 7) >= mk) continue;
      carry += tx.type === "income" ? tx.amount : -tx.amount;
    }
    return carry;
  }, [transactions, budgets, mk, carryoverBroken]);

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

  // "Empezar de cero" desde el mes que se está viendo: el Saldo anterior
  // pasa a contar solo desde aquí, así que queda en 0 para este mes.
  //
  // No borra NADA: los movimientos, presupuestos y metas de los meses
  // anteriores siguen intactos y se pueden seguir consultando en el
  // Historial. Lo único que cambia es desde dónde arranca el arrastre.
  function resetCarryover() {
    setCarryoverCleared((prev) => (prev.includes(mk) ? prev : [...prev, mk]));
    showToast(t("toast.carryoverReset"));
  }

  // Deshace lo anterior, SOLO en el mes que se está viendo: ese mes vuelve
  // a sumar su historial completo. Los demás meses puestos en cero siguen
  // como estaban.
  //
  // Existe porque "empezar de cero" es fácil de tocar por curiosidad o por
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
  function crearCategoria(datos: { nombre: string; tipo: "expense" | "income"; color: string; icono: string }): string {
    const { lista, creada } = crearPropia(categoriasPropias, datos);
    savePropias(lista);
    setCategoriasPropiasState(lista);
    setCategoriaRecienCreada(creada.id);
    return creada.id;
  }

  /** Cambia una propia. Lo que no se pase se deja como estaba. */
  function editarCategoria(
    id: string,
    cambios: { nombre?: string; color?: string; icono?: string }
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
        olvidarCategoriaRecienCreada: () => setCategoriaRecienCreada(null),
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
        setIsPremium,
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
