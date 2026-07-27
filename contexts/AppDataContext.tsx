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
import { colorScheme } from "nativewind";
import { seedTransactions, seedGoals } from "@/constants/seed";
import { currencySymbolFor } from "@/constants/currencies";
import { monthNamesFor, translations } from "@/constants/i18n";
import { clearAccountData, loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";
import { fmt as formatAmount, monthKey } from "@/utils/format";
import { reserveIdsAbove } from "@/utils/id";
import { learnCategory } from "@/utils/classifier";
import { auth } from "@/utils/firebase";
import { signOutFromGoogle } from "@/utils/googleAuth";
import { deleteCloudAccount, loadCloudData, saveCloudData } from "@/utils/cloudSync";
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
  monthLabel: string;
  setBudgetForCurrentMonth: (amount: number) => void;
  categoryBudgets: Record<string, number>;
  categorySpent: Record<string, number>;
  updateCategoryBudgets: (newBudgets: Record<string, number>) => void;

  transactions: Transaction[];
  addOrUpdateTransaction: (t: Transaction) => void;
  deleteTransaction: (id: number) => void;
  deleteTransactions: (ids: number[]) => void;
  commitImport: (toAdd: Transaction[], toReplace: Transaction[]) => void;

  merchantLearned: Record<string, string>;
  learnMerchantCategory: (merchantText: string, category: string) => void;

  goals: Goal[];
  addOrUpdateGoal: (g: Goal) => void;
  deleteGoal: (id: number) => void;
  addMoneyToGoal: (amount: number, goalId: number) => void;
  withdrawMoneyFromGoal: (goalId: number, amount: number) => void;

  isPremium: boolean;
  setIsPremium: (v: boolean) => void;
  isCloudSynced: boolean;

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
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions);
  const [goals, setGoals] = useState<Goal[]>(seedGoals);
  const [isPremium, setIsPremium] = useState(false);
  // Lo que la persona le enseñó al clasificador de importaciones:
  // { "primax": "transporte", ... }. Ver utils/classifier.ts.
  const [merchantLearned, setMerchantLearned] = useState<Record<string, string>>({});
  // Meses cuyo "Saldo anterior" se muestra en cero ("AAAA-MM"), cada uno
  // independiente del resto. Lo maneja el botón de Inicio.
  const [carryoverCleared, setCarryoverCleared] = useState<string[]>([]);
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

  async function reloadPersistedData() {
    const [
      savedBudgets,
      savedCategoryBudgets,
      savedTransactions,
      savedGoals,
      savedIsPremium,
      savedLearned,
      savedCarryoverCleared,
    ] = await Promise.all([
      loadJSON<Record<string, number>>(STORAGE_KEYS.budgets, {}),
      loadJSON<Record<string, number>>(STORAGE_KEYS.categoryBudgets, {}),
      loadJSON<Transaction[]>(STORAGE_KEYS.transactions, seedTransactions),
      loadJSON<Goal[]>(STORAGE_KEYS.goals, seedGoals),
      loadJSON<boolean>(STORAGE_KEYS.isPremium, false),
      loadJSON<Record<string, string>>(STORAGE_KEYS.merchantLearned, {}),
      loadJSON<string[]>(STORAGE_KEYS.carryoverCleared, []),
    ]);
    setBudgets(savedBudgets);
    setCategoryBudgets(savedCategoryBudgets);
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
    carryoverCleared,
  ]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
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
  // Poner el Saldo anterior en cero es una decisión INDEPENDIENTE POR MES.
  //
  // Cada mes se calcula siempre desde el principio de tu historial, salvo
  // que ese mes concreto esté en la lista de "puestos en cero". Ponerlo en
  // cero en agosto no cambia nada en julio ni en septiembre: septiembre
  // vuelve a sumar todo por su cuenta, incluido lo que se ocultó en
  // agosto. Si también se quiere en cero, hay que hacerlo ahí.
  //
  // Es distinto a un "punto de corte" que se arrastra hacia adelante, que
  // fue como estaba antes: con esto, borrar y restaurar afectan solo al
  // mes en el que se pulsa el botón.
  const carryoverActive = carryoverCleared.includes(mk);

  const prevBalance = useMemo(() => {
    if (carryoverCleared.includes(mk)) return 0;
    let carry = 0;
    for (const [monthK, amount] of Object.entries(budgets)) {
      if (monthK < mk) carry += amount || 0;
    }
    for (const tx of transactions) {
      if (tx.date.slice(0, 7) >= mk) continue;
      carry += tx.type === "income" ? tx.amount : -tx.amount;
    }
    return carry;
  }, [transactions, budgets, mk, carryoverCleared]);

  const autoSavings = budget + income - spent;
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
        monthLabel,
        setBudgetForCurrentMonth,
        categoryBudgets,
        categorySpent,
        updateCategoryBudgets,
        transactions,
        addOrUpdateTransaction,
        deleteTransaction,
        deleteTransactions,
        commitImport,
        merchantLearned,
        learnMerchantCategory,
        goals,
        addOrUpdateGoal,
        deleteGoal,
        addMoneyToGoal,
        withdrawMoneyFromGoal,
        isPremium,
        setIsPremium,
        isCloudSynced: uid !== null,
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
