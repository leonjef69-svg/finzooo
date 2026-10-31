import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { ENTRY_FONT, useEntryTheme } from "@/components/EntryUI";

type Props = {
  label: string;
  type?: "text" | "password";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: "default" | "email-address";
  light?: boolean;
  editable?: boolean;
  warm?: boolean;
};

export default function AuthField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  keyboardType = "default",
  light = false,
  editable = true,
  warm = false,
}: Props) {
  const { colors: ENTRY_COLORS } = useEntryTheme();
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <View>
      <Text style={warm ? { color: ENTRY_COLORS.muted, fontFamily: ENTRY_FONT.medium, fontSize: 12 } : undefined} className={`text-xs font-semibold mb-1.5 ${light ? "text-slate-700 dark:text-slate-100" : "text-slate-600 dark:text-slate-200"}`}>{label}</Text>
      <View
        style={warm ? { backgroundColor: ENTRY_COLORS.paper, borderColor: error ? ENTRY_COLORS.error : ENTRY_COLORS.line, borderWidth: 1, borderRadius: 14, minHeight: 50, paddingVertical: 10 } : undefined}
        className={`flex-row items-center rounded-xl border-[1.5px] px-4 py-3.5 ${light ? "bg-white dark:bg-noche-3" : "bg-slate-50 dark:bg-noche-2"} ${
          error ? "border-rose-400" : light ? "border-slate-300" : "border-slate-200 dark:border-noche-borde"
        }`}
      >
        <TextInput
          disableFullscreenUI
          value={value}
          editable={editable}
          accessibilityLabel={label}
          autoCorrect={false}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={isPassword && !show}
          keyboardType={keyboardType}
          style={warm ? { color: ENTRY_COLORS.ink, fontFamily: ENTRY_FONT.regular, fontSize: 16 } : undefined}
          autoCapitalize="none"
          className={`flex-1 text-sm ${light ? "text-slate-900 dark:text-slate-100" : "text-slate-900 dark:text-slate-100"}`}
        />
        {isPassword && (
          <TouchableOpacity
            disabled={!editable}
            onPress={() => setShow(!show)}
            accessibilityRole="button"
            accessibilityLabel={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            hitSlop={10}
          >
            {show ? <EyeOff size={17} color="#94a3b8" /> : <Eye size={17} color="#94a3b8" />}
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text className="text-rose-500 text-xs mt-1 font-medium dark:text-rose-300">{error}</Text> : null}
    </View>
  );
}
