import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { Check, Search, X } from "lucide-react-native";
import { countriesFor, countryLabelFor, type Country } from "@/constants/countries";
import { CURRENCIES, currencyLabelFor, currencySymbolFor } from "@/constants/currencies";
import { useAppData } from "@/contexts/AppDataContext";
import { deviceCountry } from "@/utils/deviceLocale";

const TOTAL_STEPS = 3;
const LAST_STEP = TOTAL_STEPS - 1;

const PANELS = [
  require("../assets/images/onboarding/welcome.png"),
  require("../assets/images/onboarding/setup.png"),
  require("../assets/images/onboarding/access.png"),
] as const;

type Props = {
  onGoogle: () => Promise<void>;
  onCreateAccount: () => void;
  onLogin: () => void;
};

type PickerKind = "country" | "currency";

export default function Onboarding({ onGoogle, onCreateAccount, onLogin }: Props) {
  const { setInitialCountry, t } = useAppData();
  const detectedCountry = useMemo(deviceCountry, []);
  const [step, setStep] = useState(0);
  const [country, setCountry] = useState<Country>(detectedCountry);
  const [currency, setCurrency] = useState(detectedCountry.currency);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const language = country.language || "es";
  const countries = useMemo(() => countriesFor(language), [language]);
  const countryName = countryLabelFor(country, language);
  const currencyName = currencyLabelFor(currency, t, language);

  async function continueFromSetup() {
    setInitialCountry(country.id, country.language, currency);
    if (notificationsEnabled) {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Avisos de Fino",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        await Notifications.requestPermissionsAsync();
      } catch {
        // El permiso también puede activarse después desde Ajustes.
      }
    }
    setStep(LAST_STEP);
  }

  async function continueWithGoogle() {
    setGoogleError("");
    setGoogleLoading(true);
    try {
      await onGoogle();
    } catch (error) {
      setGoogleError(error instanceof Error ? error.message : "No se pudo entrar con Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  function changeCountry(country: Country) {
    setCountry(country);
    setCurrency(country.currency);
    setInitialCountry(country.id, country.language, country.currency);
    setCountryModalVisible(false);
    setQuery("");
  }

  function selectCurrency(next: string) {
    setCurrency(next);
    setCurrencyModalVisible(false);
    setQuery("");
  }

  return (
    <View className="flex-1 bg-[#f8f3e9]">
      <StatusBar hidden />
      <Image source={PANELS[step]} resizeMode="stretch" className="absolute inset-0 w-full h-full" />

      {step === 0 ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Empezar"
          activeOpacity={0.82}
          onPress={() => setStep(1)}
          style={{ position: "absolute", left: "7%", right: "7%", bottom: "2%", height: "8%" }}
        />
      ) : null}

      {step === 1 ? (
        <>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`País: ${countryName}`}
            onPress={() => setCountryModalVisible(true)}
            style={{ position: "absolute", left: "8%", right: "8%", top: "43%", height: "10%" }}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Moneda: ${currencyName}`}
            onPress={() => setCurrencyModalVisible(true)}
            style={{ position: "absolute", left: "8%", right: "8%", top: "54%", height: "10%" }}
          />
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{ checked: notificationsEnabled }}
            accessibilityLabel="Activar los avisos"
            onPress={() => setNotificationsEnabled((value) => !value)}
            style={{ position: "absolute", left: "8%", right: "8%", top: "66%", height: "15%" }}
          />

          <View
            pointerEvents="none"
            style={{ position: "absolute", right: "11%", top: "45.2%", width: "38%", height: "5.5%", backgroundColor: "#fffdf4", justifyContent: "center", alignItems: "flex-end", paddingRight: 18 }}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit className="text-[18px] font-bold text-[#082f64]">{countryName}</Text>
          </View>
          <View
            pointerEvents="none"
            style={{ position: "absolute", right: "11%", top: "56.1%", width: "47%", height: "5.5%", backgroundColor: "#fffdf4", justifyContent: "center", alignItems: "flex-end", paddingRight: 18 }}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit className="text-[17px] font-bold text-[#082f64]">
              {currencyName} ({currencySymbolFor(currency)})
            </Text>
          </View>
          {!notificationsEnabled ? (
            <View pointerEvents="none" style={{ position: "absolute", right: "10.5%", top: "72.1%", width: 55, height: 32, borderRadius: 18, backgroundColor: "#cbd5e1", justifyContent: "center", padding: 3 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "white" }} />
            </View>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Continuar"
            activeOpacity={0.82}
            onPress={continueFromSetup}
            style={{ position: "absolute", left: "7%", right: "7%", bottom: "2%", height: "8%" }}
          />
        </>
      ) : null}

      {step === LAST_STEP ? (
        <>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Continuar con Google"
            disabled={googleLoading}
            activeOpacity={0.82}
            onPress={continueWithGoogle}
            style={{ position: "absolute", left: "7%", right: "7%", top: "47%", height: "9%" }}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Crear cuenta"
            activeOpacity={0.82}
            onPress={onCreateAccount}
            style={{ position: "absolute", left: "7%", right: "7%", top: "57%", height: "8%" }}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Ya tengo una cuenta"
            activeOpacity={0.82}
            onPress={onLogin}
            style={{ position: "absolute", left: "25%", right: "25%", top: "66%", height: "6%" }}
          />
          {googleError ? (
            <View style={{ position: "absolute", left: "8%", right: "8%", bottom: "5%", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.94)", padding: 12 }}>
              <Text className="text-center text-sm font-semibold text-red-600">{googleError}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      <PickerModal
        kind="country"
        visible={countryModalVisible}
        query={query}
        setQuery={setQuery}
        onClose={() => { setCountryModalVisible(false); setQuery(""); }}
        countries={countries}
        selected={country.id}
        language={language}
        onCountry={changeCountry}
        onCurrency={selectCurrency}
      />
      <PickerModal
        kind="currency"
        visible={currencyModalVisible}
        query={query}
        setQuery={setQuery}
        onClose={() => { setCurrencyModalVisible(false); setQuery(""); }}
        countries={countries}
        selected={currency}
        language={language}
        onCountry={changeCountry}
        onCurrency={selectCurrency}
      />
    </View>
  );
}

function PickerModal({
  kind,
  visible,
  query,
  setQuery,
  onClose,
  countries,
  selected,
  language,
  onCountry,
  onCurrency,
}: {
  kind: PickerKind;
  visible: boolean;
  query: string;
  setQuery: (value: string) => void;
  onClose: () => void;
  countries: Country[];
  selected: string;
  language: string;
  onCountry: (country: Country) => void;
  onCurrency: (currency: string) => void;
}) {
  const { t } = useAppData();
  const normalized = query.trim().toLocaleLowerCase();
  const filteredCountries = countries.filter((item) =>
    `${countryLabelFor(item, language)} ${item.id}`.toLocaleLowerCase().includes(normalized)
  );
  const filteredCurrencies = CURRENCIES.filter((item) =>
    `${currencyLabelFor(item.id, t, language)} ${item.id} ${item.symbol}`.toLocaleLowerCase().includes(normalized)
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="h-[78%] rounded-t-[28px] bg-[#fffdf4] px-5 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-extrabold text-[#082f64]">{kind === "country" ? "Elige tu país" : "Elige tu moneda"}</Text>
            <TouchableOpacity accessibilityLabel="Cerrar" onPress={onClose} className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
              <X size={22} color="#082f64" />
            </TouchableOpacity>
          </View>
          <View className="mb-3 flex-row items-center rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <Search size={20} color="#64748b" />
            <TextInput
              disableFullscreenUI
              accessibilityLabel="Buscar"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Busca por nombre o código"
              placeholderTextColor="#64748b"
              className="ml-3 flex-1 text-base text-[#082f64]"
            />
          </View>
          {kind === "country" ? (
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <PickerRow
                  icon={item.flag}
                  label={countryLabelFor(item, language)}
                  code={item.id}
                  active={selected === item.id}
                  onPress={() => onCountry(item)}
                />
              )}
            />
          ) : (
            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <PickerRow
                  icon={item.symbol}
                  label={currencyLabelFor(item.id, t, language)}
                  code={item.id}
                  active={selected === item.id}
                  onPress={() => onCurrency(item.id)}
                />
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function PickerRow({ icon, label, code, active, onPress }: {
  icon: string;
  label: string;
  code: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="mb-2 flex-row items-center rounded-2xl border border-slate-200 bg-white px-4 py-4"
    >
      <Text className="w-12 text-2xl">{icon}</Text>
      <View className="flex-1">
        <Text className="text-base font-bold text-[#082f64]">{label}</Text>
        <Text className="text-sm text-slate-500">{code}</Text>
      </View>
      {active ? <Check size={22} color="#059669" /> : null}
    </TouchableOpacity>
  );
}
