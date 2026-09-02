import {
  CreditState,
  EMPTY_CREDIT_STATE,
  cardTotals,
  loadCreditState,
} from "@/utils/creditStore";
import { irUnaVez } from "@/utils/nav";
import { currencySymbolFor } from "@/constants/currencies";
import { useFocusEffect } from "expo-router";
import { CreditCard, Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function CreditListV3() {
  const [state, setState] = useState<CreditState>(EMPTY_CREDIT_STATE);
  useFocusEffect(
    useCallback(() => {
      loadCreditState().then(setState);
    }, []),
  );
  return (
    <ScrollView className="flex-1 bg-slate-50 px-4 pt-12">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-extrabold">Mis tarjetas</Text>
          <Text className="text-sm text-slate-500">
            Elige una para ver sus detalles
          </Text>
        </View>
        {state.cards.length > 0 && (
          <TouchableOpacity
            onPress={() =>
              irUnaVez({
                pathname: "/credit-card-settings",
                params: { mode: "create" },
              })
            }
            className="rounded-full bg-teal-600 p-3"
          >
            <Plus color="white" />
          </TouchableOpacity>
        )}
      </View>
      {state.cards.length === 0 ? (
        <View className="mt-6 items-center rounded-2xl bg-white p-6">
          <CreditCard size={38} color="#0f766e" />
          <Text className="mt-3 text-lg font-extrabold">
            Agrega tu primera tarjeta
          </Text>
          <Text className="mt-1 text-center text-sm text-slate-500">
            No pediremos número de tarjeta ni CVV.
          </Text>
          <TouchableOpacity
            onPress={() =>
              irUnaVez({
                pathname: "/credit-card-settings",
                params: { mode: "create" },
              })
            }
            className="mt-4 rounded-xl bg-teal-600 px-5 py-3"
          >
            <Text className="font-extrabold text-white">Agregar tarjeta</Text>
          </TouchableOpacity>
        </View>
      ) : (
        state.cards.map((card) => {
          const totals = cardTotals(state, card.id);
          const symbol = currencySymbolFor(card.currency ?? "PEN");
          return (
            <TouchableOpacity
              key={card.id}
              onPress={() =>
                irUnaVez({
                  pathname: "/credit-detail",
                  params: { cardId: card.id },
                })
              }
              style={{ backgroundColor: card.color }}
              className="mt-3 rounded-2xl p-4"
            >
              <View className="flex-row items-center justify-between">
                <Text
                  numberOfLines={1}
                  className="mr-3 flex-1 text-lg font-extrabold text-white"
                >
                  {card.bank}
                </Text>
                <CreditCard color="white" size={20} />
              </View>
              <View className="mt-3 flex-row items-end">
                <View className="mr-3 flex-1">
                  <Text className="text-xs text-white/80">Disponible</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.55}
                    className="text-2xl font-extrabold text-white"
                  >
                    {symbol} {(card.limit - totals.debt).toFixed(2)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                    className="text-right text-xs text-white/80"
                  >
                    Deuda {symbol} {totals.debt.toFixed(2)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="mt-1 text-right text-xs text-white/80"
                  >
                    {totals.next?.dueDate ?? "Sin pagos"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
      <View className="h-16" />
    </ScrollView>
  );
}
