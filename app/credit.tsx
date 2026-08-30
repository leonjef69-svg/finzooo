import { useRouter } from "expo-router";
import { CalendarDays, ChevronRight, CreditCard, Plus } from "lucide-react-native";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function CreditScreen() {
  const router = useRouter();
  return <ScrollView className="flex-1 bg-white px-5 pt-14">
    <Text className="text-3xl font-extrabold text-slate-900">Línea de crédito</Text>
    <Text className="mt-1 text-slate-500">Tus pagos, claros y ordenados</Text>
    <View className="mt-6 rounded-3xl bg-emerald-700 p-5">
      <View className="flex-row items-center"><CreditCard color="white" size={24}/><Text className="ml-3 text-xl font-bold text-white">Scotiabank</Text></View>
      <View className="mt-5 flex-row justify-between"><View><Text className="text-emerald-100">Disponible</Text><Text className="text-2xl font-extrabold text-white">S/ 1,250</Text></View><View><Text className="text-emerald-100">Deuda actual</Text><Text className="text-2xl font-extrabold text-white">S/ 750</Text></View></View>
      <View className="mt-4 h-2 rounded-full bg-emerald-900"><View className="h-2 w-2/3 rounded-full bg-emerald-300"/></View>
    </View>
    <TouchableOpacity onPress={() => router.push("/credit-calendar")} className="mt-5 flex-row items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><View className="flex-row items-center"><CalendarDays color="#047857" size={24}/><Text className="ml-3 text-base font-bold text-emerald-800">Calendario de pagos</Text></View><ChevronRight color="#047857"/></TouchableOpacity>
    <TouchableOpacity className="mt-4 rounded-2xl bg-slate-100 p-4"><Text className="font-bold text-slate-800">Registrar gasto en cuotas</Text><Text className="mt-1 text-slate-500">Fino calcula el monto automáticamente</Text></TouchableOpacity>
    <TouchableOpacity className="mt-5 flex-row items-center justify-center rounded-2xl bg-emerald-600 p-4"><Plus color="white"/><Text className="ml-2 font-bold text-white">Agregar tarjeta</Text></TouchableOpacity>
  </ScrollView>;
}
