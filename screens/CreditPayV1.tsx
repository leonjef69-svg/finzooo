import {
  CreditState,
  EMPTY_CREDIT_STATE,
  confirmedPaidAmount,
  dueDateForPurchase,
  loadCreditState,
  makeId,
  outstandingAmount,
  saveCreditState,
} from "@/utils/creditStore";
import { useAppData } from "@/contexts/AppDataContext";
import { currencySymbolFor } from "@/constants/currencies";
import { nextId } from "@/utils/id";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function CreditPayV1() {
  const router = useRouter();
  const saving = useRef(false);
  const { addOrUpdateTransaction, userCurrency, disponible } = useAppData();
  const { cardId, purchaseId } = useLocalSearchParams<{
    cardId: string;
    purchaseId: string;
  }>();
  const [state, setState] = useState<CreditState>(EMPTY_CREDIT_STATE);
  const [method, setMethod] = useState<"fino" | "card" | "external">("fino");
  const [account, setAccount] = useState("");
  const [targetId, setTargetId] = useState("");
  const [homeAmount, setHomeAmount] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"full" | "minimum" | "other">(
    "full",
  );
  const [customAmount, setCustomAmount] = useState("");
  useEffect(() => {
    loadCreditState().then((value) => {
      setState(value);
      const savedPurchase = value.purchases.find((p) => p.id === purchaseId);
      setMethod(
        savedPurchase?.balanceMode === "separate" ? "external" : "fino",
      );
    });
  }, [purchaseId]);
  const source = state.cards.find((c) => c.id === cardId);
  const purchase = state.purchases.find((p) => p.id === purchaseId);
  const pending = useMemo(
    () =>
      state.installments
        .filter((q) => q.purchaseId === purchaseId && !q.paid)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [state, purchaseId],
  );
  const nextQuota = pending[0];
  const pendingAmount = nextQuota ? outstandingAmount(nextQuota) : 0;
  const minimumAmount = Math.min(
    source?.statementMinimumPayment ?? pendingAmount,
    pendingAmount,
  );
  const amount =
    paymentMode === "full"
      ? pendingAmount
      : paymentMode === "minimum"
        ? minimumAmount
        : Number(customAmount.replace(",", ".")) || 0;
  const cardCurrency = source?.currency ?? "PEN";
  const cardSymbol = currencySymbolFor(cardCurrency);
  const homeSymbol = currencySymbolFor(userCurrency);
  const differentCurrency = cardCurrency !== userCurrency;
  const amountFromHome = differentCurrency
    ? Number(homeAmount.replace(",", ".")) || 0
    : amount;
  const otherCards = state.cards.filter((c) => c.id !== cardId);
  const targetCard = otherCards.find((card) => card.id === targetId);
  const targetCurrency = targetCard?.currency ?? "PEN";
  const targetSymbol = currencySymbolFor(targetCurrency);
  const differentTargetCurrency =
    Boolean(targetCard) && targetCurrency !== cardCurrency;
  const amountForTarget = differentTargetCurrency
    ? Number(targetAmount.replace(",", ".")) || 0
    : amount;
  async function confirm(reviewed = false) {
    if (!nextQuota)
      return Alert.alert(
        "Sin pagos pendientes",
        "Este movimiento ya está pagado.",
      );
    if (amount <= 0 || amount > pendingAmount + 0.005)
      return Alert.alert(
        "Monto inválido",
        `El pago debe ser mayor que cero y no superar ${cardSymbol} ${pendingAmount.toFixed(2)}.`,
      );
    if (method === "card" && !targetId)
      return Alert.alert(
        "Elige una tarjeta",
        "Selecciona la tarjeta que asumirá el pago.",
      );
    if (method === "card" && differentTargetCurrency && amountForTarget <= 0)
      return Alert.alert(
        "Indica el monto convertido",
        `Escribe cuánto cargará la tarjeta en ${targetCurrency}.`,
      );
    if (method === "fino" && differentCurrency && amountFromHome <= 0)
      return Alert.alert(
        "Indica el monto descontado",
        `Escribe cuánto saldrá de tu saldo en ${userCurrency}.`,
      );
    if (method === "fino" && amountFromHome > disponible + 0.005)
      return Alert.alert(
        "Saldo insuficiente",
        `Tu saldo disponible en Inicio es ${homeSymbol} ${disponible.toFixed(2)}. Puedes registrar el pago como externo o elegir otro monto.`,
      );
    if (!reviewed) {
      const origin =
        method === "fino"
          ? `Saldo de Fino: ${homeSymbol} ${amountFromHome.toFixed(2)}`
          : method === "card"
            ? `${targetCard?.bank ?? "Otra tarjeta"}: ${targetSymbol} ${amountForTarget.toFixed(2)}`
            : account.trim() || "Pago externo";
      const remaining = Math.max(0, pendingAmount - amount);
      return Alert.alert(
        "Revisar pago",
        `Pagarás: ${cardSymbol} ${amount.toFixed(2)}\nOrigen: ${origin}\nQuedará pendiente: ${cardSymbol} ${remaining.toFixed(2)}${method === "fino" ? `\nSaldo de Inicio después: ${homeSymbol} ${(disponible - amountFromHome).toFixed(2)}` : ""}`,
        [
          { text: "Volver", style: "cancel" },
          {
            text: "Confirmar",
            onPress: () => void confirm(true),
          },
        ],
      );
    }
    if (saving.current) return;
    saving.current = true;
    const now = new Date();
    const paidMethod =
      method === "fino"
        ? "Saldo de Fino"
        : method === "card"
          ? "Otra tarjeta"
          : account.trim() || "Pago externo";
    const homeTransactionId = method === "fino" ? nextId() : undefined;
    const confirmedAfter = confirmedPaidAmount(nextQuota) + amount;
    const fullyPaid = confirmedAfter >= nextQuota.amount - 0.005;
    const paymentRecord = {
      id: makeId("payment"),
      amount,
      status: "confirmed" as const,
      createdAt: now.toISOString(),
      method: paidMethod,
      homeTransactionId,
      homeCurrency: method === "fino" ? userCurrency : undefined,
      homeAmount: method === "fino" ? amountFromHome : undefined,
    };
    let purchases = state.purchases;
    let installments = state.installments.map((q) =>
      q.id === nextQuota.id
        ? {
            ...q,
            paid: fullyPaid,
            paidAt: fullyPaid ? now.toISOString() : q.paidAt,
            paidMethod,
            homeTransactionId,
            homeCurrency: method === "fino" ? userCurrency : undefined,
            homeAmount: method === "fino" ? amountFromHome : undefined,
            payments: [...(q.payments ?? []), paymentRecord],
          }
        : q,
    );
    if (method === "fino" && homeTransactionId) {
      addOrUpdateTransaction({
        id: homeTransactionId,
        type: "expense",
        amount: amountFromHome,
        category: "otros",
        date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        method: "credit-card-payment",
        description: `Pago tarjeta ${source?.bank ?? ""}`.trim(),
        notes: `${purchase?.description ?? "Compra"}${nextQuota.total > 1 ? ` · Cuota ${nextQuota.number} de ${nextQuota.total}` : ""}`,
        origin: "manual",
      });
    }
    if (method === "card") {
      const target = state.cards.find((c) => c.id === targetId);
      if (!target) {
        saving.current = false;
        return;
      }
      const transferId = makeId("purchase");
      purchases = [
        ...purchases,
        {
          id: transferId,
          cardId: target.id,
          description: `Pago de ${source?.bank ?? "tarjeta"}`,
          total: amountForTarget,
          installments: 1,
          createdAt: now.toISOString(),
        },
      ];
      installments = [
        ...installments,
        {
          id: makeId("quota-1"),
          purchaseId: transferId,
          cardId: target.id,
          number: 1,
          total: 1,
          amount: amountForTarget,
          dueDate: dueDateForPurchase(
            now,
            0,
            target.closingDay,
            target.paymentDay,
          ),
          paid: false,
        },
      ];
    }
    await saveCreditState({ ...state, purchases, installments });
    router.back();
  }
  return (
    <ScrollView className="flex-1 bg-slate-50 px-5 pt-14">
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="rounded-full bg-white p-2"
        >
          <ArrowLeft color="#0f766e" />
        </TouchableOpacity>
        <View className="ml-3">
          <Text className="text-2xl font-extrabold">Pagar tarjeta</Text>
          <Text className="text-slate-500">
            {purchase?.description ?? source?.bank}
          </Text>
        </View>
      </View>
      <View className="mt-6 rounded-3xl bg-teal-700 p-5">
        <Text className="text-white/70">Monto pendiente</Text>
        <Text className="text-3xl font-extrabold text-white">
          {cardSymbol} {pendingAmount.toFixed(2)}
        </Text>
      </View>
      <Text className="mt-5 font-bold">¿Cuánto pagarás?</Text>
      <View className="mt-2 flex-row gap-2">
        <Choice
          active={paymentMode === "full"}
          label="Todo"
          onPress={() => setPaymentMode("full")}
        />
        {source?.statementMinimumPayment ? (
          <Choice
            active={paymentMode === "minimum"}
            label={`Mínimo ${cardSymbol} ${minimumAmount.toFixed(2)}`}
            onPress={() => setPaymentMode("minimum")}
          />
        ) : null}
        <Choice
          active={paymentMode === "other"}
          label="Otro monto"
          onPress={() => setPaymentMode("other")}
        />
      </View>
      {paymentMode === "other" && (
        <View className="mt-2 flex-row items-center rounded-xl border border-slate-300 bg-white px-3">
          <Text className="font-extrabold">{cardSymbol}</Text>
          <TextInput
            disableFullscreenUI
            value={customAmount}
            onChangeText={(value) =>
              setCustomAmount(value.replace(/[^0-9.,]/g, ""))
            }
            keyboardType="decimal-pad"
            placeholder="0.00"
            className="flex-1 p-3 text-base"
          />
        </View>
      )}
      <Text className="mt-6 font-bold">¿Cómo registrarás el pago?</Text>
      <View className="mt-3 flex-row gap-2">
        <Choice
          active={method === "fino"}
          label="Saldo de Fino"
          onPress={() => setMethod("fino")}
        />
        <Choice
          active={method === "card"}
          label="Otra tarjeta"
          onPress={() => setMethod("card")}
        />
        <Choice
          active={method === "external"}
          label="Pago externo"
          onPress={() => setMethod("external")}
        />
      </View>
      {method === "fino" &&
        (differentCurrency ? (
          <View className="mt-3 rounded-xl bg-emerald-50 p-3">
            <Text className="text-xs font-bold text-emerald-900">
              La tarjeta está en {cardCurrency} y Fino en {userCurrency}
            </Text>
            <Text className="mb-1 mt-2 text-xs text-emerald-800">
              ¿Cuánto descontará realmente el banco?
            </Text>
            <View className="flex-row items-center rounded-xl bg-white px-3">
              <Text className="font-extrabold">{homeSymbol}</Text>
              <TextInput
                disableFullscreenUI
                value={homeAmount}
                onChangeText={(value) =>
                  setHomeAmount(value.replace(/[^0-9.,]/g, ""))
                }
                keyboardType="decimal-pad"
                placeholder="0.00"
                className="flex-1 p-3"
              />
            </View>
            {amountFromHome > 0 && (
              <View className="mt-2">
                <Text className="text-xs font-bold text-emerald-800">
                  Pagar {cardSymbol} {amount.toFixed(2)} descontará {homeSymbol}{" "}
                  {amountFromHome.toFixed(2)}
                </Text>
                <Text className="mt-1 text-[10px] text-emerald-700">
                  Tipo de cambio: 1 {cardCurrency} ={" "}
                  {(amountFromHome / amount).toFixed(4)} {userCurrency}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
            Se descontará {homeSymbol} {amount.toFixed(2)} del saldo de Inicio.
          </Text>
        ))}
      {method === "external" && (
        <View className="mt-4">
          <Text className="mb-2 font-semibold">Medio de pago (opcional)</Text>
          <TextInput
            disableFullscreenUI
            value={account}
            onChangeText={setAccount}
            placeholder="Ej. Efectivo o cuenta externa"
            className="rounded-2xl bg-white p-4"
          />
          <Text className="mt-2 text-xs text-slate-500">
            Solo marcará el pago. No modificará el saldo de Inicio.
          </Text>
        </View>
      )}
      {method === "card" && (
        <View className="mt-4">
          {otherCards.length === 0 ? (
            <Text className="rounded-2xl bg-amber-50 p-4 text-amber-800">
              Agrega otra tarjeta para usar esta opción.
            </Text>
          ) : (
            otherCards.map((card) => (
              <TouchableOpacity
                key={card.id}
                onPress={() => {
                  setTargetId(card.id);
                  setTargetAmount("");
                }}
                className={`mb-3 rounded-2xl border p-4 ${targetId === card.id ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"}`}
              >
                <Text className="font-extrabold">{card.bank}</Text>
                <Text className="text-xs text-slate-500">
                  {currencySymbolFor(card.currency ?? "PEN")} ·{" "}
                  {card.currency ?? "PEN"}
                </Text>
              </TouchableOpacity>
            ))
          )}
          {differentTargetCurrency && (
            <View className="rounded-xl bg-cyan-50 p-3">
              <Text className="text-xs font-bold text-cyan-900">
                Monto que cargará {targetCard?.bank} en {targetCurrency}
              </Text>
              <View className="mt-2 flex-row items-center rounded-xl bg-white px-3">
                <Text className="font-extrabold">{targetSymbol}</Text>
                <TextInput
                  disableFullscreenUI
                  value={targetAmount}
                  onChangeText={(value) =>
                    setTargetAmount(value.replace(/[^0-9.,]/g, ""))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  className="flex-1 p-3"
                />
              </View>
              {amountForTarget > 0 && (
                <Text className="mt-2 text-[10px] text-cyan-800">
                  1 {cardCurrency} = {(amountForTarget / amount).toFixed(4)}{" "}
                  {targetCurrency}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
      <TouchableOpacity
        onPress={() => confirm()}
        className="mt-7 rounded-2xl bg-teal-600 p-4"
      >
        <Text className="text-center font-extrabold text-white">
          Confirmar pago
        </Text>
      </TouchableOpacity>
      <View className="h-20" />
    </ScrollView>
  );
}
function Choice({ active, label, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-1 justify-center rounded-2xl border px-2 py-4 ${active ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"}`}
    >
      <Text
        numberOfLines={2}
        className={`text-center text-xs font-extrabold ${active ? "text-teal-700" : "text-slate-600"}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
