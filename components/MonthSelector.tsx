import { useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { CalendarDays, Check, ChevronDown, X } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import type { Month } from "@/types";

type Props = {
  month: Month;
  months: string[];
  monthNames: string[];
  onChange: (month: Month) => void;
};

function monthFromKey(key: string): Month {
  const [y, m] = key.split("-").map(Number);
  return { y, m: m - 1 };
}

function labelFor(key: string, monthNames: string[]) {
  const { y, m } = monthFromKey(key);
  return `${monthNames[m]} ${y}`;
}

/**
 * Selector único para Historial y Reportes. La lista se recibe ya filtrada:
 * por eso nunca ofrece un mes vacío ni cambia información financiera.
 */
export default function MonthSelector({ month, months, monthNames, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { colorScheme } = useColorScheme();
  const currentKey = `${month.y}-${String(month.m + 1).padStart(2, "0")}`;
  const label = `${monthNames[month.m]} ${month.y}`;
  const dark = colorScheme === "dark";

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Elegir mes, ${label}`}
        className="flex-row items-center gap-1.5 rounded-full border-[1.5px] border-slate-200 bg-slate-50 px-3 py-2 dark:border-noche-borde dark:bg-noche-2"
      >
        <CalendarDays size={14} color={dark ? "#cbd5e1" : "#475569"} />
        <Text className="max-w-[132px] text-xs font-bold text-slate-700 dark:text-slate-100" numberOfLines={1}>
          {label}
        </Text>
        <ChevronDown size={14} color={dark ? "#cbd5e1" : "#475569"} />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/45">
          <View className="max-h-[72%] rounded-t-3xl bg-white px-5 pb-8 pt-4 dark:bg-noche-2">
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Mes con movimientos</Text>
                <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">Elige un mes para ver sus datos.</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-noche">
                <X size={18} color={dark ? "#cbd5e1" : "#475569"} />
              </TouchableOpacity>
            </View>

            {months.length === 0 ? (
              <Text className="py-8 text-center text-sm text-slate-500 dark:text-slate-300">Aún no hay meses con movimientos.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="gap-2 pb-2">
                  {months.map((key) => {
                    const selected = key === currentKey;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => {
                          onChange(monthFromKey(key));
                          setOpen(false);
                        }}
                        className={`flex-row items-center justify-between rounded-2xl border-[1.5px] px-4 py-3 ${
                          selected
                            ? "border-emerald-600 bg-emerald-600"
                            : "border-slate-200 bg-slate-50 dark:border-noche-borde dark:bg-noche"
                        }`}
                      >
                        <Text className={`text-sm font-bold ${selected ? "text-white" : "text-slate-800 dark:text-slate-100"}`}>
                          {labelFor(key, monthNames)}
                        </Text>
                        {selected ? <Check size={17} color="#ffffff" strokeWidth={3} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
