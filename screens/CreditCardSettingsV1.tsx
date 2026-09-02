import {
  CreditState,
  EMPTY_CREDIT_STATE,
  dueDateForPurchase,
  loadCreditState,
  makeId,
  saveCreditState,
} from "@/utils/creditStore";
import { useAppData } from "@/contexts/AppDataContext";
import {
  CURRENCIES,
  currencyLabelFor,
  currencySymbolFor,
} from "@/constants/currencies";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { ArrowLeft, Check, ChevronDown, Search, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#ea580c"];

function isValidMembershipDate(value: string) {
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("/").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function formatMembershipDate(value: string) {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 8);
  if (digitsOnly.length <= 4) return digitsOnly;
  if (digitsOnly.length <= 6)
    return `${digitsOnly.slice(0, 4)}/${digitsOnly.slice(4)}`;
  return `${digitsOnly.slice(0, 4)}/${digitsOnly.slice(4, 6)}/${digitsOnly.slice(6)}`;
}

export default function CreditCardSettingsV1() {
  const saving = useRef(false);
  const {
    userCurrency,
    userLanguage,
    t,
    quitarPagoProgramado,
    deleteTransactions,
  } = useAppData();
  const router = useRouter();
  const { cardId, mode } = useLocalSearchParams<{
    cardId?: string;
    mode?: string;
  }>();
  const creating = mode === "create" || !cardId;
  const [state, setState] = useState<CreditState>(EMPTY_CREDIT_STATE);
  const [bank, setBank] = useState("");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [monthlyGoal, setMonthlyGoal] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [membershipStart, setMembershipStart] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState("2");
  const [reminderHour, setReminderHour] = useState("09");
  const [reminderMinute, setReminderMinute] = useState("00");
  const [cutReminderEnabled, setCutReminderEnabled] = useState(false);
  const [cutReminderDays, setCutReminderDays] = useState("2");
  const [cutReminderHour, setCutReminderHour] = useState("09");
  const [cutReminderMinute, setCutReminderMinute] = useState("00");
  const [color, setColor] = useState(COLORS[0]);
  const [currency, setCurrency] = useState(userCurrency || "PEN");
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState("");
  const suggestedCurrencies = useMemo(() => {
    const extras =
      userCurrency === "PEN"
        ? ["USD", "EUR"]
        : userCurrency === "USD"
          ? ["EUR", "CAD"]
          : userCurrency === "EUR"
            ? ["USD", "GBP"]
            : ["USD", "EUR"];
    return Array.from(new Set([userCurrency || "PEN", ...extras])).slice(0, 3);
  }, [userCurrency]);
  const currencyOptions = useMemo(() => {
    const query = currencyQuery.trim().toLocaleLowerCase(userLanguage);
    return CURRENCIES.map((item) => ({
      ...item,
      name: currencyLabelFor(item.id, t, userLanguage),
    })).filter(
      (item) =>
        !query ||
        item.id.toLowerCase().includes(query) ||
        item.symbol.toLocaleLowerCase(userLanguage).includes(query) ||
        item.name.toLocaleLowerCase(userLanguage).includes(query),
    );
  }, [currencyQuery, t, userLanguage]);
  useEffect(() => {
    loadCreditState().then((value) => {
      setState(value);
      const card = value.cards.find((c) => c.id === cardId);
      if (card) {
        setBank(card.bank);
        setLimit(String(card.limit));
        setCurrency(card.currency ?? userCurrency ?? "PEN");
        setClosingDay(card.closingDay ? String(card.closingDay) : "");
        setPaymentDay(card.paymentDay ? String(card.paymentDay) : "");
        setCutoff(card.paymentCutoffTime ?? "");
        setMonthlyGoal(
          card.membershipMonthlyGoal ? String(card.membershipMonthlyGoal) : "",
        );
        setMinimumPayment(
          card.statementMinimumPayment
            ? String(card.statementMinimumPayment)
            : "",
        );
        setMembershipStart(
          card.membershipStartDate &&
            isValidMembershipDate(card.membershipStartDate.replace(/-/g, "/"))
            ? card.membershipStartDate.replace(/-/g, "/")
            : "",
        );
        setReminderEnabled(card.reminderEnabled ?? false);
        setReminderDays(String(card.reminderDaysBefore ?? 2));
        setColor(card.color);
        const [h, m] = (card.reminderTime ?? "09:00").split(":");
        setReminderHour(h);
        setReminderMinute(m);
        setCutReminderEnabled(card.cutReminderEnabled ?? false);
        setCutReminderDays(String(card.cutReminderDaysBefore ?? 2));
        const [cutH, cutM] = (card.cutReminderTime ?? "09:00").split(":");
        setCutReminderHour(cutH);
        setCutReminderMinute(cutM);
      }
    });
  }, [cardId, userCurrency]);
  async function toggleReminder(
    enabled: boolean,
    setEnabled: (value: boolean) => void,
  ) {
    if (enabled) return setEnabled(false);
    if (!closingDay || !paymentDay)
      return Alert.alert(
        "Configura las fechas",
        "Indica el día de corte y el último día de pago antes de activar este aviso.",
      );
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted)
      permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        "Notificaciones bloqueadas",
        "Fino no podrá avisarte hasta que permitas las notificaciones en los ajustes del celular.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Abrir ajustes", onPress: () => Linking.openSettings() },
        ],
      );
    setEnabled(true);
  }
  async function save() {
    const lim = Number(limit.replace(",", ".")),
      close = closingDay ? Number(closingDay) : undefined,
      pay = paymentDay ? Number(paymentDay) : undefined,
      goal = monthlyGoal ? Number(monthlyGoal.replace(",", ".")) : undefined,
      minimum = minimumPayment
        ? Number(minimumPayment.replace(",", "."))
        : undefined,
      days = Number(reminderDays) || 0,
      time = `${reminderHour.padStart(2, "0")}:${reminderMinute.padStart(2, "0")}`,
      cutDays = Number(cutReminderDays) || 0,
      cutTime = `${cutReminderHour.padStart(2, "0")}:${cutReminderMinute.padStart(2, "0")}`;
    const hasOnlyOneCardDate = Boolean(close) !== Boolean(pay);
    const hasOnlyOneMembershipValue = Boolean(goal) !== Boolean(membershipStart);
    if (membershipStart && !isValidMembershipDate(membershipStart))
      return Alert.alert(
        "Fecha inválida",
        "Escribe una fecha real como año/mes/día. Ejemplo: 2025/11/20.",
      );
    if (
      !bank.trim() ||
      lim <= 0 ||
      !/^[A-Z]{3}$/.test(currency) ||
      (close !== undefined && (close < 1 || close > 31)) ||
      (pay !== undefined && (pay < 1 || pay > 31)) ||
      hasOnlyOneCardDate ||
      (goal !== undefined && goal <= 0) ||
      hasOnlyOneMembershipValue ||
      (minimum !== undefined && minimum <= 0) ||
      !/^$|^([01]?\d|2[0-3]):[0-5]\d$/.test(cutoff) ||
      (Boolean(cutoff) && !pay) ||
      days < 0 ||
      days > 30 ||
      cutDays < 0 ||
      cutDays > 30 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(cutTime) ||
      (reminderEnabled && (!close || !pay)) ||
      (cutReminderEnabled && (!close || !pay))
    )
      return Alert.alert(
        "Revisa los datos",
        hasOnlyOneCardDate
          ? "Completa el día de corte y el último día de pago, o deja ambos sin configurar."
          : hasOnlyOneMembershipValue
            ? "Para controlar la membresía, completa el consumo mínimo y la fecha de inicio; o deja ambos vacíos."
            : (reminderEnabled || cutReminderEnabled) && (!close || !pay)
              ? "Configura el día de corte y el último día de pago para activar los avisos."
              : cutoff && !pay
                ? "La hora límite necesita un último día de pago configurado."
                : "Hay un dato inválido.",
      );
    if (saving.current) return;
    saving.current = true;
    const resolvedId = cardId ?? makeId("card");
    const cardData = {
      id: resolvedId,
      bank: bank.trim(),
      limit: lim,
      currency,
      closingDay: close,
      paymentDay: pay,
      paymentCutoffTime: cutoff || undefined,
      membershipMonthlyGoal: goal,
      statementMinimumPayment: minimum,
      membershipStartDate: membershipStart
        ? membershipStart.replace(/\//g, "-")
        : undefined,
      reminderEnabled,
      reminderDaysBefore: days,
      reminderTime: time,
      cutReminderEnabled,
      cutReminderDaysBefore: cutDays,
      cutReminderTime: cutTime,
      color,
    };
    const next = {
      ...state,
      cards: creating
        ? [...state.cards, cardData]
        : state.cards.map((card) =>
            card.id === resolvedId ? { ...card, ...cardData } : card,
          ),
      installments: state.installments.map((quota) => {
        if (quota.cardId !== resolvedId || quota.paid) return quota;
        const purchase = state.purchases.find(
          (item) => item.id === quota.purchaseId,
        );
        if (!purchase) return quota;
        return {
          ...quota,
          dueDate: dueDateForPurchase(
            new Date(purchase.createdAt),
            quota.number - 1,
            close,
            pay,
          ),
        };
      }),
    };
    await saveCreditState(next);
    const reminderId = `credit-card-${resolvedId}`;
    // Retira el recordatorio mensual antiguo. Los avisos de tarjeta ahora se
    // programan desde cada cuota pendiente real al guardar el estado.
    quitarPagoProgramado(reminderId);
    router.back();
  }
  function askDelete() {
    if (!cardId) return;
    const count = state.purchases.filter((p) => p.cardId === cardId).length;
    const linkedIds = Array.from(
      new Set(
        state.installments
          .filter((quota) => quota.cardId === cardId)
          .flatMap((quota) => [
            ...(quota.homeTransactionId ? [quota.homeTransactionId] : []),
            ...(quota.payments ?? [])
              .map((payment) => payment.homeTransactionId)
              .filter((id): id is number => id != null),
          ]),
      ),
    );
    Alert.alert(
      "Eliminar tarjeta",
      count > 0
        ? `Se borrarán ${count} movimiento${count === 1 ? "" : "s"}, sus cuotas y pagos.${linkedIds.length ? ` También se eliminarán ${linkedIds.length} pago${linkedIds.length === 1 ? "" : "s"} vinculado${linkedIds.length === 1 ? "" : "s"} de Inicio y se actualizará tu saldo.` : " No se modificará el saldo de Inicio."}`
        : "Se borrará esta tarjeta.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            await saveCreditState({
              ...state,
              cards: state.cards.filter((c) => c.id !== cardId),
              purchases: state.purchases.filter((p) => p.cardId !== cardId),
              installments: state.installments.filter(
                (q) => q.cardId !== cardId,
              ),
            });
            if (linkedIds.length) deleteTransactions(linkedIds);
            quitarPagoProgramado(`credit-card-${cardId}`);
            router.replace("/credit");
          },
        },
      ],
    );
  }
  return (
    <ScrollView className="flex-1 bg-slate-50 px-4 pt-12">
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-full bg-white p-2"
        >
          <ArrowLeft color="#0f766e" />
        </TouchableOpacity>
        <View className="ml-3">
          <Text className="text-xl font-extrabold">
            {creating ? "Agregar tarjeta" : "Datos de la tarjeta"}
          </Text>
          <Text className="text-sm text-slate-500">
            Completa ahora lo que conozcas
          </Text>
        </View>
      </View>
      <Field
        label="Banco *"
        value={bank}
        onChangeText={(v: string) => setBank(v.replace(/[0-9]/g, ""))}
      />
      <View className="flex-row gap-3">
        <View className="flex-[2]">
          <Field
            label="Límite de crédito *"
            value={limit}
            onChangeText={(v: string) => setLimit(money(v))}
            keyboardType="decimal-pad"
          />
        </View>
        <View className="flex-1">
          <Text className="mb-1 mt-3 text-xs font-semibold">Moneda *</Text>
          <TouchableOpacity
            onPress={() => setCurrencyPickerOpen(true)}
            className="min-h-[52px] flex-row items-center justify-between rounded-xl border border-slate-300 bg-white px-3"
          >
            <View className="mr-1 flex-1">
              <Text numberOfLines={1} className="text-sm font-extrabold text-slate-800">
                {currencySymbolFor(currency)} · {currency}
              </Text>
              <Text numberOfLines={1} className="text-[10px] text-slate-500">
                {currencyLabelFor(currency, t, userLanguage)}
              </Text>
            </View>
            <ChevronDown size={16} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>
      <View className="mt-2 flex-row gap-2">
        {suggestedCurrencies.map((code) => (
            <TouchableOpacity
              key={code}
              onPress={() => setCurrency(code)}
              className={`flex-1 rounded-xl border px-2 py-2 ${currency === code ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"}`}
            >
              <Text
                className={`text-center text-xs font-extrabold ${currency === code ? "text-teal-700" : "text-slate-600"}`}
              >
                {currencySymbolFor(code)} · {currencyLabelFor(code, t, userLanguage)}
              </Text>
            </TouchableOpacity>
          ))}
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <DayField
            label="Día de corte"
            value={closingDay}
            onChange={setClosingDay}
          />
        </View>
        <View className="flex-1">
          <DayField
            label="Último día de pago"
            value={paymentDay}
            onChange={setPaymentDay}
          />
        </View>
      </View>
      <Text className="mt-1 text-[11px] text-slate-500">
        Opcionales, pero necesitas ambos para usar cuotas, vencimientos y avisos.
      </Text>
      <Field
        label="Hora límite del banco"
        value={cutoff}
        onChangeText={(v: string) =>
          setCutoff(v.replace(/[^0-9:]/g, "").slice(0, 5))
        }
        keyboardType="numbers-and-punctuation"
        placeholder="Ej. 17:00 · opcional"
      />
      <Field
        label="Pago mínimo indicado por el banco"
        value={minimumPayment}
        onChangeText={(v: string) => setMinimumPayment(money(v))}
        keyboardType="decimal-pad"
        placeholder="Opcional · puedes actualizarlo cada mes"
      />
      <Modal
        visible={currencyPickerOpen}
        animationType="slide"
        onRequestClose={() => setCurrencyPickerOpen(false)}
      >
        <View className="flex-1 bg-slate-50 px-4 pb-6 pt-12">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-extrabold">Elegir moneda</Text>
            <TouchableOpacity
              onPress={() => setCurrencyPickerOpen(false)}
              className="rounded-xl bg-slate-200 px-3 py-2"
            >
              <Text className="font-bold text-slate-700">Cerrar</Text>
            </TouchableOpacity>
          </View>
          <View className="mt-4 flex-row items-center rounded-xl border border-slate-300 bg-white px-3">
            <Search size={18} color="#64748b" />
            <TextInput
              disableFullscreenUI
              value={currencyQuery}
              onChangeText={setCurrencyQuery}
              placeholder="Buscar sol, dólar, euro..."
              className="flex-1 p-3"
            />
          </View>
          <FlatList
            data={currencyOptions}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setCurrency(item.id);
                  setCurrencyPickerOpen(false);
                  setCurrencyQuery("");
                }}
                className={`mb-2 flex-row items-center rounded-xl border p-3 ${currency === item.id ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-white"}`}
              >
                <View className="mr-3 w-12 items-center rounded-lg bg-slate-100 py-2">
                  <Text className="font-extrabold">{item.symbol}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold">{item.name}</Text>
                  <Text className="text-xs text-slate-500">{item.id}</Text>
                </View>
                {currency === item.id && <Check size={19} color="#0d9488" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
      <View className="mt-3 flex-row gap-3">
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setColor(c)}
            style={{
              backgroundColor: c,
              borderWidth: color === c ? 4 : 0,
              borderColor: "#bbf7d0",
            }}
            className="h-10 w-10 rounded-full"
          />
        ))}
      </View>
      <View className="mt-4 rounded-2xl bg-sky-50 p-3">
        <Text className="font-extrabold text-sky-900">Avisos de la tarjeta</Text>
        <Text className="mb-1 text-xs text-sky-700">
          Configura cada aviso por separado
        </Text>
        <ReminderOption
          title="Antes del corte"
          enabled={cutReminderEnabled}
          onToggle={() =>
            toggleReminder(cutReminderEnabled, setCutReminderEnabled)
          }
          days={cutReminderDays}
          setDays={setCutReminderDays}
          hour={cutReminderHour}
          setHour={setCutReminderHour}
          minute={cutReminderMinute}
          setMinute={setCutReminderMinute}
        />
        <ReminderOption
          title="Antes del pago"
          enabled={reminderEnabled}
          onToggle={() => toggleReminder(reminderEnabled, setReminderEnabled)}
          days={reminderDays}
          setDays={setReminderDays}
          hour={reminderHour}
          setHour={setReminderHour}
          minute={reminderMinute}
          setMinute={setReminderMinute}
          divided
        />
      </View>
      <View className="mt-4 rounded-2xl bg-amber-50 p-3">
        <Text className="font-extrabold text-amber-900">
          Meta para evitar membresía
        </Text>
        <Text className="mt-1 text-xs text-amber-800">
          Fino controlará 12 meses de consumo; no lo sumará como deuda.
        </Text>
        <Field
          label="Consumo mínimo por mes"
          value={monthlyGoal}
          onChangeText={(v: string) => setMonthlyGoal(money(v))}
          keyboardType="decimal-pad"
          placeholder="Opcional"
        />
        <Field
          label="Inicio del control anual (año/mes/día)"
          value={membershipStart}
          onChangeText={(v: string) => setMembershipStart(formatMembershipDate(v))}
          keyboardType="numbers-and-punctuation"
          placeholder="AAAA/MM/DD · opcional"
        />
        <Text className="mt-1 text-xs text-amber-800">
          Fecha real desde la que el banco empieza a contar los 12 meses.
        </Text>
      </View>
      <TouchableOpacity
        onPress={save}
        className="mt-5 rounded-xl bg-teal-600 p-4"
      >
        <Text className="text-center font-extrabold text-white">
          {creating ? "Guardar tarjeta" : "Guardar cambios"}
        </Text>
      </TouchableOpacity>
      {!creating && (
        <TouchableOpacity
          onPress={askDelete}
          className="mt-3 flex-row items-center justify-center rounded-xl bg-rose-50 p-4"
        >
          <Trash2 size={17} color="#e11d48" />
          <Text className="ml-2 font-extrabold text-rose-600">
            Eliminar tarjeta
          </Text>
        </TouchableOpacity>
      )}
      <View className="h-16" />
    </ScrollView>
  );
}
function ReminderOption({
  title,
  enabled,
  onToggle,
  days,
  setDays,
  hour,
  setHour,
  minute,
  setMinute,
  divided,
}: any) {
  return (
    <View className={`${divided ? "mt-3 border-t border-sky-200 pt-3" : "mt-2"}`}>
      <View className="flex-row items-center justify-between">
        <Text className="font-bold text-sky-950">{title}</Text>
        <TouchableOpacity
          onPress={onToggle}
          className={`rounded-full px-3 py-1.5 ${enabled ? "bg-teal-600" : "bg-slate-300"}`}
        >
          <Text className="text-[11px] font-extrabold text-white">
            {enabled ? "Activado" : "Desactivado"}
          </Text>
        </TouchableOpacity>
      </View>
      {enabled && (
        <View className="mt-1 flex-row gap-3">
          <View className="flex-1">
            <Field
              label="Días antes"
              value={days}
              onChangeText={(value: string) => setDays(digits(value, 2))}
              keyboardType="number-pad"
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1 mt-3 text-sm font-semibold">Hora</Text>
            <View className="flex-row items-center rounded-xl border border-slate-200 bg-white px-3">
              <TextInput
                disableFullscreenUI
                value={hour}
                onChangeText={(value) => setHour(digits(value, 2))}
                keyboardType="number-pad"
                className="flex-1 py-3 text-center"
              />
              <Text>:</Text>
              <TextInput
                disableFullscreenUI
                value={minute}
                onChangeText={(value) => setMinute(digits(value, 2))}
                keyboardType="number-pad"
                className="flex-1 py-3 text-center"
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
function Field({ label, ...props }: any) {
  return (
    <View className="mt-3">
      <Text className="mb-1 text-sm font-semibold">{label}</Text>
      <TextInput
        disableFullscreenUI
        {...props}
        className="rounded-xl border border-slate-200 bg-white px-3 py-3"
      />
    </View>
  );
}
function DayField({ label, value, onChange }: any) {
  const current = Number(value) || 0;
  const changeBy = (amount: number) => {
    if (current === 1 && amount < 0) {
      onChange("");
      return;
    }
    const next = current
      ? Math.min(31, Math.max(1, current + amount))
      : 1;
    onChange(String(next));
  };
  return (
    <View className="mt-3">
      <Text className="mb-1 text-sm font-semibold">{label}</Text>
      <View className="min-h-[50px] flex-row items-center rounded-xl border border-slate-300 bg-white px-1">
        <TouchableOpacity onPress={() => changeBy(-1)} className="px-3 py-3">
          <Text className="text-xl font-bold text-teal-700">−</Text>
        </TouchableOpacity>
        <TextInput
          disableFullscreenUI
          value={value}
          onChangeText={(text) => onChange(digits(text, 2))}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="Sin configurar"
          placeholderTextColor="#94a3b8"
          className="flex-1 py-3 text-center text-base font-bold"
        />
        <TouchableOpacity onPress={() => changeBy(1)} className="px-3 py-3">
          <Text className="text-xl font-bold text-teal-700">+</Text>
        </TouchableOpacity>
      </View>
      <View className="mt-1 flex-row items-center justify-between">
        <Text className="text-[10px] text-slate-500">Del 1 al 31</Text>
        {!!value && (
          <TouchableOpacity onPress={() => onChange("")} hitSlop={8}>
            <Text className="text-[10px] font-bold text-teal-700">
              Quitar
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
function digits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}
function money(value: string) {
  return value.replace(/[^0-9.,]/g, "");
}
