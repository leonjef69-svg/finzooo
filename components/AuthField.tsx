import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

type Props = {
  label: string;
  type?: "text" | "password";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: "default" | "email-address";
  light?: boolean;
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
}: Props) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <View>
      <Text className={`text-xs font-semibold mb-1.5 ${light ? "text-slate-700" : "text-slate-600 dark:text-slate-200"}`}>{label}</Text>
      <View
        className={`flex-row items-center rounded-xl border-[1.5px] px-4 py-3.5 ${light ? "bg-white" : "bg-slate-50 dark:bg-noche-2"} ${
          error ? "border-rose-400" : light ? "border-slate-300" : "border-slate-200 dark:border-noche-borde"
        }`}
      >
        <TextInput
          disableFullscreenUI          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={isPassword && !show}
          keyboardType={keyboardType}
          autoCapitalize="none"
          className={`flex-1 text-sm ${light ? "text-slate-900" : "text-slate-900 dark:text-slate-100"}`}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShow(!show)}
            accessibilityRole="button"
            accessibilityLabel={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            hitSlop={10}
          >
            {show ? <EyeOff size={17} color="#94a3b8" /> : <Eye size={17} color="#94a3b8" />}
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text className="text-rose-500 text-xs mt-1 font-medium">{error}</Text> : null}
    </View>
  );
}
