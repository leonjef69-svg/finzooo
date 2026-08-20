import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { COUNTRIES, countryFor } from "@/constants/countries";
import { currencySymbolFor } from "@/constants/currencies";
import { languageLabelFor } from "@/constants/i18n";
import { useAppData } from "@/contexts/AppDataContext";
import BackButton from "@/components/BackButton";

export default function CountryPicker({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (language: string, currency: string) => void;
}) {
  const { t, userLanguage, userCurrency } = useAppData();
  const insets = useSafeAreaInsets();

  // Cuál está puesto ahora. Se deduce del idioma y la moneda en vez de
  // guardarse aparte: así, quien ya tenía español y soles ve Perú marcado sin
  // haber elegido nunca un país, y un dato menos que pueda quedar desfasado
  // respecto a los otros dos.
  const actual = countryFor(userLanguage, userCurrency);

  return (
    <View
      className="flex-1 bg-white dark:bg-noche"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
          {t("settings.country")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">
          {t("country.subtitle")}
        </Text>

        <View className="gap-2.5">
          {COUNTRIES.map((c) => {
            const selected = actual?.id === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => {
                  onSelect(c.language, c.currency);
                  onBack();
                }}
                className={`flex-row items-center gap-3 rounded-2xl p-4 border-[1.5px] ${
                  selected
                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-slate-200 dark:border-noche-borde bg-white dark:bg-noche-2"
                }`}
              >
                <Text className="text-2xl">{c.flag}</Text>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {t(c.label)}
                  </Text>
                  {/* Se dice exactamente qué va a cambiar. Elegir un país y
                      que la app se ponga en otro idioma sin avisar asusta,
                      sobre todo si el idioma nuevo no se entiende. */}
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {languageLabelFor(c.language)} · {currencySymbolFor(c.currency)}
                  </Text>
                </View>
                {selected && <Check size={18} color="#059669" />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Si el idioma y la moneda puestos no son los de ningún país —inglés
            con soles, por ejemplo— no se marca ninguno, y aquí se explica por
            qué en vez de dejar la pantalla sin nada señalado. */}
        {!actual && (
          <View className="mt-4 rounded-2xl border-[1.5px] border-slate-200 dark:border-noche-borde bg-slate-50 dark:bg-noche-2 p-4">
            <Text className="text-xs text-slate-600 dark:text-slate-300 leading-5">
              {t("country.custom", {
                language: languageLabelFor(userLanguage),
                currency: currencySymbolFor(userCurrency),
              })}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
