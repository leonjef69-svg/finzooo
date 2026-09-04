import {
  CreditState,
  EMPTY_CREDIT_STATE,
  cardTotals,
  dueDateForPurchase,
  loadCreditState,
  makeId,
  outstandingAmount,
  saveCreditState,
} from "@/utils/creditStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CURRENCIES, currencyLabelFor, currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { nextId } from "@/utils/id";
import { irUnaVez } from "@/utils/nav";
import {
  creditMoneyEpsilon,
  creditMoneyPlaceholder,
  formatCreditMoney,
  parseCreditMoneyInput,
  sanitizeCreditMoneyInput,
} from "@/utils/creditMoney";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ReceiptText,
  ShoppingBag,
  Utensils,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type PurchaseIconName = "shopping" | "service" | "food";
const ICONS: PurchaseIconName[] = ["shopping", "service", "food"];
export default function CreditPurchaseV4() {
  const router = useRouter();
  const saving = useRef(false);
  const { addOrUpdateTransaction, disponible, userCurrency, userLanguage, t } = useAppData();
  const { cardId, convertId, editId } = useLocalSearchParams<{
    cardId: string;
    convertId?: string;
    editId?: string;
  }>();
  const [state, setState] = useState<CreditState>(EMPTY_CREDIT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState<"pending" | "paid" | "installments">(
    convertId ? "installments" : "pending",
  );
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("1");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [balanceMode, setBalanceMode] = useState<"fino" | "separate">("fino");
  const [paidMethod, setPaidMethod] = useState<"fino" | "external">("fino");
  const [homeAmount, setHomeAmount] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState(userCurrency || "PEN");
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState("");
  const [icon, setIcon] = useState<PurchaseIconName>("shopping");
  useEffect(() => {
    loadCreditState().then((value) => {
      setState(value);
      if (convertId || editId) {
        const current = value.purchases.find(
          (p) => p.id === (convertId ?? editId),
        );
        if (current) {
          setDesc(current.description);
          setAmount(String(current.total));
          setPurchaseCurrency(current.currency ?? value.cards.find((c) => c.id === current.cardId)?.currency ?? "PEN");
          setBalanceMode(current.balanceMode ?? "fino");
          setKind(convertId ? "installments" : current.installments > 1 ? "installments" : "pending");
          setCount(String(current.installments || 1));
          const currentQuota = value.installments.find(
            (quota) => quota.purchaseId === current.id,
          );
          if (currentQuota && current.installments > 1)
            setInstallmentAmount(String(currentQuota.amount));
        }
      }
      setLoaded(true);
    });
  }, [convertId, editId]);
  const card = state.cards.find((c) => c.id === cardId);
  const datesConfigured = Boolean(card?.closingDay && card?.paymentDay);
  const limitCurrency = card?.currency ?? "PEN";
  const cardCurrency = purchaseCurrency;
  const homeSymbol = currencySymbolFor(userCurrency);
  const differentCurrency = purchaseCurrency !== userCurrency;
  const currencyOptions = useMemo(() => {
    const query = currencyQuery.trim().toLocaleLowerCase(userLanguage);
    return CURRENCIES.map((item) => ({ ...item, name: currencyLabelFor(item.id, t, userLanguage) }))
      .filter((item) => !query || item.id.toLowerCase().includes(query) || item.symbol.toLocaleLowerCase(userLanguage).includes(query) || item.name.toLocaleLowerCase(userLanguage).includes(query));
  }, [currencyQuery, t, userLanguage]);
  const total = parseCreditMoneyInput(amount, cardCurrency) ?? 0;
  const parsedQty = Number(count);
  const qty =
    kind === "installments" && Number.isInteger(parsedQty)
      ? Math.min(60, Math.max(1, parsedQty))
      : 1;
  const each =
    kind === "installments"
      ? parseCreditMoneyInput(installmentAmount, cardCurrency) ?? 0
      : total;
  const existingPurchase = state.purchases.find(
    (purchase) => purchase.id === (convertId ?? editId),
  );
  const purchaseDate = useMemo(
    () =>
      existingPurchase ? new Date(existingPurchase.createdAt) : new Date(),
    [existingPurchase],
  );
  const afterCut =
    card?.closingDay != null && purchaseDate.getDate() > card.closingDay;
  const preview = useMemo(
    () =>
      card
        ? Array.from({ length: qty }, (_, i) => ({
            number: i + 1,
            date: dueDateForPurchase(
              purchaseDate,
              i,
              card.closingDay,
              card.paymentDay,
            ),
          }))
        : [],
    [card, qty, purchaseDate],
  );
  function cycleIcon() {
    setIcon((current) => ICONS[(ICONS.indexOf(current) + 1) % ICONS.length]);
  }
  async function save() {
    if (
      !card ||
      !desc.trim() ||
      total <= 0 ||
      qty > 60 ||
      (kind === "installments" && each <= 0)
    )
      return Alert.alert(
        "Revisa los datos",
        "Completa descripción, monto, meses y monto de cada cuota.",
      );
    if (kind === "installments" && (!card.closingDay || !card.paymentDay))
      return Alert.alert(
        "Configura las fechas",
        "Para usar cuotas, indica el día de corte y el último día de pago de esta tarjeta. Fino no inventará vencimientos.",
      );
    const previousQuotas = state.installments.filter(
      (quota) => quota.purchaseId === (convertId ?? editId),
    );
    const hasRelatedPayments = previousQuotas.some(
      (quota) => quota.paid || (quota.payments?.length ?? 0) > 0,
    );
    const previousDebt = previousQuotas
      .filter((quota) => (quota.currency ?? existingPurchase?.currency ?? limitCurrency) === limitCurrency)
      .reduce((sum, quota) => sum + outstandingAmount(quota), 0);
    const availableForPurchase =
      card.limit - cardTotals(state, card.id).debt + previousDebt;
    const newDebt = each * qty;
    if (
      purchaseCurrency === limitCurrency &&
      kind !== "paid" &&
      !hasRelatedPayments &&
      newDebt > availableForPurchase + creditMoneyEpsilon(cardCurrency)
    ) {
      return Alert.alert(
        "Límite insuficiente",
        `Esta compra generaría ${formatCreditMoney(newDebt, cardCurrency)} de deuda y tienes ${formatCreditMoney(Math.max(0, availableForPurchase), cardCurrency)} disponibles.`,
      );
    }
    if (saving.current) return;
    const amountFromHome = differentCurrency
      ? parseCreditMoneyInput(homeAmount, userCurrency) ?? 0
      : total;
    if (kind === "paid" && paidMethod === "fino" && amountFromHome <= 0)
      return Alert.alert(
        "Indica el monto descontado",
        `Escribe cuánto salió de tu saldo en ${userCurrency}.`,
      );
    if (
      kind === "paid" &&
      paidMethod === "fino" &&
      amountFromHome > disponible + creditMoneyEpsilon(userCurrency)
    )
      return Alert.alert(
        "Saldo insuficiente",
        `Tu saldo disponible en Inicio es ${formatCreditMoney(disponible, userCurrency)}. Puedes elegir Pago externo.`,
      );
    saving.current = true;
    try {
      const id = convertId ?? editId ?? makeId("purchase"),
        now = new Date();
      if (editId && hasRelatedPayments) {
      const firstPrevious = previousQuotas[0];
      const changedFinancialData =
        purchaseCurrency !== (existingPurchase?.currency ?? limitCurrency) ||
        Math.abs(total - Number(existingPurchase?.total ?? 0)) >
          creditMoneyEpsilon(cardCurrency) ||
        qty !== existingPurchase?.installments ||
        (qty > 1 &&
          Math.abs(each - Number(firstPrevious?.amount ?? 0)) >
            creditMoneyEpsilon(cardCurrency));
      if (changedFinancialData) {
        saving.current = false;
        return Alert.alert(
          "Compra con pagos",
          "Puedes cambiar la descripción, pero no el monto ni las cuotas porque ya existen pagos relacionados.",
        );
      }
      await saveCreditState({
        ...state,
        purchases: state.purchases.map((purchase) =>
          purchase.id === editId
            ? {
                ...purchase,
                description: desc.trim(),
                icon,
                balanceMode,
              }
            : purchase,
        ),
      });
        router.back();
        return;
      }
      const purchase = {
      id,
      cardId: card.id,
      description: desc.trim(),
      total,
      currency: purchaseCurrency,
      installments: qty,
      createdAt:
        state.purchases.find((p) => p.id === id)?.createdAt ??
        now.toISOString(),
      icon,
      balanceMode:
        kind === "paid"
          ? paidMethod === "fino"
            ? "fino"
            : "separate"
          : balanceMode,
    };
    const homeTransactionId =
      kind === "paid" && paidMethod === "fino" ? nextId() : undefined;
    const quotas = preview.map((q) => ({
      id: makeId(`quota-${q.number}`),
      purchaseId: id,
      cardId: card.id,
      number: q.number,
      total: qty,
      amount: each,
      currency: purchaseCurrency,
      dueDate: q.date,
      paid: kind === "paid",
      paidAt: kind === "paid" ? now.toISOString() : undefined,
      paidMethod:
        kind === "paid"
          ? paidMethod === "fino"
            ? "Saldo de Fino"
            : "Pago externo"
          : undefined,
      homeTransactionId,
      homeCurrency:
        kind === "paid" && paidMethod === "fino" ? userCurrency : undefined,
      homeAmount:
        kind === "paid" && paidMethod === "fino" ? amountFromHome : undefined,
      payments:
        kind === "paid"
          ? [
              {
                id: makeId("payment"),
                amount: each,
                status: "confirmed" as const,
                createdAt: now.toISOString(),
                method:
                  paidMethod === "fino" ? "Saldo de Fino" : "Pago externo",
                homeTransactionId,
                homeCurrency:
                  paidMethod === "fino" ? userCurrency : undefined,
                homeAmount:
                  paidMethod === "fino" ? amountFromHome : undefined,
              },
            ]
          : undefined,
    }));
    const purchases = convertId || editId
      ? state.purchases.map((p) => (p.id === id ? purchase : p))
      : [...state.purchases, purchase];
    const installments = [
      ...state.installments.filter((q) => q.purchaseId !== id),
      ...quotas,
    ];
      await saveCreditState({ ...state, purchases, installments });
      if (kind === "paid" && paidMethod === "fino" && homeTransactionId) {
        addOrUpdateTransaction({
          id: homeTransactionId,
          type: "expense",
          amount: amountFromHome,
          category: "otros",
          date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
          time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
          method: "credit-card-payment",
          description: `Pago tarjeta ${card.bank}`,
          notes: desc.trim(),
          origin: "manual",
        });
      }
      router.back();
    } catch {
      saving.current = false;
      Alert.alert(
        "No se pudo guardar",
        "Revisa el espacio del teléfono e inténtalo nuevamente.",
      );
    }
  }
  if (!loaded)
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#0f766e" />
        <Text className="mt-2 text-sm text-slate-500">Cargando compra…</Text>
      </View>
    );
  return (
    <ScrollView
      className="flex-1 bg-slate-50 px-4 pt-12"
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-full bg-white p-2"
        >
          <ArrowLeft color="#0f766e" />
        </TouchableOpacity>
        <View className="ml-3">
          <Text className="text-xl font-extrabold">
            {convertId
              ? "Pasar a cuotas"
              : editId
                ? "Editar compra"
                : "Registrar compra"}
          </Text>
          <Text className="text-sm text-slate-500">
            {card?.bank ?? "Tarjeta"}
          </Text>
        </View>
      </View>
      {!convertId && !editId && (
        <View className="mt-4 flex-row rounded-xl bg-slate-200 p-1">
          <Choice
            active={kind === "pending"}
            label="Pendiente"
            onPress={() => setKind("pending")}
          />
          <Choice
            active={kind === "paid"}
            label="Ya pagada"
            onPress={() => setKind("paid")}
          />
          <Choice
            active={kind === "installments"}
            label="Cuotas"
            disabled={!datesConfigured}
            onPress={() => {
              if (!card || datesConfigured) return setKind("installments");
              Alert.alert(
                "Cuotas no disponibles",
                "Configura el día de corte y el último día de pago para calcular vencimientos reales.",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Configurar",
                    onPress: () =>
                      irUnaVez({
                        pathname: "/credit-card-settings",
                        params: { cardId: card.id },
                      }),
                  },
                ],
              );
            }}
          />
        </View>
      )}
      {!convertId && !editId && !datesConfigured && (
        <Text className="mt-1 text-center text-[11px] font-semibold text-slate-500">
          Cuotas desactivadas · configura corte y pago
        </Text>
      )}
      <View className="mt-2 flex-row items-end gap-3">
        <TouchableOpacity
          onPress={cycleIcon}
          className="h-[44px] w-[58px] items-center justify-center rounded-xl border border-slate-300 bg-white shadow-sm"
        >
          <PurchaseIcon name={icon} />
        </TouchableOpacity>
        <View className="flex-1">
          <Field
            label="Descripción"
            value={desc}
            onChangeText={setDesc}
            placeholder="Netflix, servicio..."
          />
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field
            label="Monto original"
            value={amount}
            onChangeText={(v: string) =>
              setAmount(sanitizeCreditMoneyInput(v))
            }
            keyboardType="decimal-pad"
            placeholder={creditMoneyPlaceholder(cardCurrency)}
          />
        </View>
        {kind === "installments" ? (
          <View className="flex-1">
            <Field
              label="Número de cuotas"
              value={count}
              onChangeText={(v: string) => setCount(digits(v, 2))}
              keyboardType="number-pad"
              placeholder="1"
            />
          </View>
        ) : (
          <View className="flex-1">
            <ReadOnly
              label="Fecha y hora"
              value={new Intl.DateTimeFormat("es-PE", {
                day: "2-digit",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              }).format(purchaseDate)}
            />
          </View>
        )}
      </View>
      <Text className="mt-2 font-bold">Moneda de esta compra</Text>
      <TouchableOpacity
        onPress={() => setCurrencyPickerOpen(true)}
        className="mt-1 min-h-[48px] flex-row items-center justify-between rounded-xl border border-slate-300 bg-white px-3"
        accessibilityRole="button"
        accessibilityLabel={`Moneda de compra ${purchaseCurrency}`}
      >
        <View>
          <Text className="font-extrabold">{currencySymbolFor(purchaseCurrency)} · {purchaseCurrency}</Text>
          <Text className="text-xs text-slate-500">El límite está en {limitCurrency}</Text>
        </View>
        <ChevronDown size={19} color="#64748b" />
      </TouchableOpacity>
      {card?.closingDay && (
        <Text className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
          {afterCut
            ? `Compra posterior al corte del día ${card.closingDay}: entrará en el siguiente periodo.`
            : `Compra dentro del periodo actual, antes del corte del día ${card.closingDay}.`}
        </Text>
      )}
      {kind === "paid" && (
        <View className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <Text className="font-extrabold text-emerald-900">
            ¿Cómo pagaste esta compra?
          </Text>
          <View className="mt-2 flex-row gap-2">
            <Choice
              active={paidMethod === "fino"}
              label="Saldo de Fino"
              onPress={() => setPaidMethod("fino")}
            />
            <Choice
              active={paidMethod === "external"}
              label="Pago externo"
              onPress={() => setPaidMethod("external")}
            />
          </View>
          {paidMethod === "fino" && differentCurrency && (
            <Field
              label={`Monto descontado en ${userCurrency}`}
              value={homeAmount}
              onChangeText={(v: string) =>
                setHomeAmount(sanitizeCreditMoneyInput(v))
              }
              keyboardType="decimal-pad"
              placeholder={`${homeSymbol} ${creditMoneyPlaceholder(userCurrency)}`}
            />
          )}
          <Text className="mt-2 text-xs text-emerald-800">
            {paidMethod === "fino"
              ? `Se descontará del saldo de Inicio y aparecerá directamente en Pagado.`
              : "Aparecerá directamente en Pagado sin modificar el saldo de Inicio."}
          </Text>
        </View>
      )}
      {kind === "installments" && (
        <>
          <View className="mt-2 flex-row gap-2">
            {[3, 6, 12].map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setCount(String(option))}
                className={`flex-1 rounded-xl border py-2 ${qty === option ? "border-cyan-600 bg-cyan-50" : "border-slate-300 bg-white"}`}
              >
                <Text
                  className={`text-center text-sm font-extrabold ${qty === option ? "text-cyan-700" : "text-slate-700"}`}
                >
                  {option} meses
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field
            label="Cuota mensual indicada por el banco"
            value={installmentAmount}
            onChangeText={(v: string) =>
              setInstallmentAmount(sanitizeCreditMoneyInput(v))
            }
            keyboardType="decimal-pad"
            placeholder={creditMoneyPlaceholder(cardCurrency)}
          />
          <ReadOnly
            label="Fecha y hora"
            value={new Intl.DateTimeFormat("es-PE", {
              day: "2-digit",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            }).format(purchaseDate)}
          />
        </>
      )}
      {kind === "installments" && (
        <View className="mt-3 rounded-2xl bg-white p-3">
          <Text className="font-extrabold">Al pagar las cuotas</Text>
          <View className="mt-2 flex-row gap-2">
            <Choice
              active={balanceMode === "fino"}
              label="Conectar a saldo Fino"
              onPress={() => setBalanceMode("fino")}
            />
            <Choice
              active={balanceMode === "separate"}
              label="Mantener separado"
              onPress={() => setBalanceMode("separate")}
            />
          </View>
          <Text className="mt-2 text-xs text-slate-500">
            {balanceMode === "fino"
              ? "El pago propondrá descontar el saldo de Inicio."
              : "Las cuotas no modificarán Inicio salvo que lo elijas al pagar."}
          </Text>
        </View>
      )}
      {kind === "installments" && (
        <View className="mt-3 rounded-2xl bg-white p-3">
          <View className="flex-row items-center">
            <CalendarDays color="#0f766e" size={20} />
            <Text className="ml-2 font-extrabold">Cuotas y vencimientos</Text>
          </View>
          <Text className="mt-1 text-sm text-slate-500">
            {qty} pagos de {formatCreditMoney(each, cardCurrency)} · Total a pagar{" "}
            {formatCreditMoney(each * qty, cardCurrency)}
          </Text>
          {preview.map((p) => (
            <View
              key={p.number}
              className="mt-2 flex-row justify-between border-t border-slate-100 pt-2"
            >
              <Text className="text-sm">
                Cuota {p.number} de {qty}
              </Text>
              <Text className="text-sm font-bold">{p.date}</Text>
            </View>
          ))}
        </View>
      )}
      <TouchableOpacity
        onPress={save}
        className="mt-5 rounded-xl bg-teal-600 p-4"
        accessibilityRole="button"
        accessibilityLabel="Guardar compra"
      >
        <Text className="text-center font-extrabold text-white">
          {convertId
            ? "Confirmar cuotas"
            : editId
              ? "Guardar cambios"
              : kind === "paid"
                ? "Guardar como pagada"
                : "Guardar compra"}
        </Text>
      </TouchableOpacity>
      <Modal visible={currencyPickerOpen} animationType="slide" onRequestClose={() => setCurrencyPickerOpen(false)}>
        <View className="flex-1 bg-slate-50 px-4 pt-12">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-extrabold">Moneda de la compra</Text>
            <TouchableOpacity onPress={() => setCurrencyPickerOpen(false)} className="rounded-xl bg-slate-200 px-3 py-2">
              <Text className="font-bold">Cerrar</Text>
            </TouchableOpacity>
          </View>
          <TextInput disableFullscreenUI value={currencyQuery} onChangeText={setCurrencyQuery} placeholder="Buscar moneda o código" className="my-3 rounded-xl border border-slate-300 bg-white p-3" />
          <FlatList
            data={currencyOptions}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setPurchaseCurrency(item.id); setCurrencyPickerOpen(false); setCurrencyQuery(""); }}
                className={`mb-2 flex-row items-center rounded-xl border p-3 ${purchaseCurrency === item.id ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-white"}`}
              >
                <Text className="mr-3 w-20 font-extrabold">{item.symbol} · {item.id}</Text>
                <Text className="flex-1 text-slate-600">{item.name}</Text>
                {purchaseCurrency === item.id && <Check size={19} color="#0d9488" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
      <View className="h-16" />
    </ScrollView>
  );
}
function Choice({ active, label, onPress, disabled }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-1 rounded-xl py-3 ${active ? "bg-teal-600" : "bg-transparent"} ${disabled ? "opacity-40" : ""}`}
    >
      <Text
        className={`text-center font-extrabold ${active ? "text-white" : "text-slate-600"}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
function Field({ label, ...props }: any) {
  return (
    <View className="mt-3">
      <Text className="mb-1 text-sm font-semibold">{label}</Text>
      <TextInput
        disableFullscreenUI
        {...props}
        className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-[15px] shadow-sm"
      />
    </View>
  );
}
function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-3">
      <Text className="mb-1 text-sm font-semibold">{label}</Text>
      <View className="h-[48px] justify-center rounded-xl border border-slate-300 bg-white px-3 shadow-sm">
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          className="text-sm font-semibold text-slate-700"
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
function PurchaseIcon({ name }: { name: PurchaseIconName }) {
  if (name === "service") return <ReceiptText size={20} color="#0f766e" />;
  if (name === "food") return <Utensils size={20} color="#0f766e" />;
  return <ShoppingBag size={20} color="#0f766e" />;
}
function digits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}
