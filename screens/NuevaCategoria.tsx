import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronLeft } from "lucide-react-native";
import { COLOR_HEX_600 } from "@/constants/colors";
import { GRUPOS_GENERICOS, GRUPOS_MARCAS, iconoDe } from "@/constants/iconos";
import { CARD_SHADOW } from "@/constants/style";
import { useAppData } from "@/contexts/AppDataContext";

import { nombreRepetido } from "@/utils/categoriasPropias";
import { sanitizeName } from "@/utils/categoryCustom";

// Los mismos de personalizar categorias, para que una categoria propia no
// pueda tener un color que las de fabrica no tienen.
const COLORES = [
  "rose", "red", "orange", "amber", "yellow", "lime",
  "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "fuchsia", "pink", "stone", "slate",
];


/**
 * Crear una categoría propia: nombre, dibujo y color.
 *
 * EL TIPO NO SE PREGUNTA
 *
 * Llega desde donde se tocó "Nueva categoría": si estabas en la pestaña de
 * Ingreso, nace como ingreso. Preguntarlo otra vez sería pedir un dato que la
 * persona acaba de dar sin darse cuenta.
 *
 * LA VISTA PREVIA VA ARRIBA Y SIEMPRE VISIBLE
 *
 * Elegir dibujo y color por separado, sin ver el resultado, obliga a guardar
 * para descubrir que no pegaban. Arriba y fija, se decide mirando.
 */
export default function NuevaCategoria({
  tipo,
  onBack,
  onCreada,
}: {
  tipo: "expense" | "income";
  onBack: () => void;
  /** Se avisa con el id para poder dejarla ya elegida en el movimiento. */
  onCreada: (id: string) => void;
}) {
  const { t, categoriasPropias, crearCategoria, showToast } = useAppData();
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState("");
  const [icono, setIcono] = useState("Tag");
  const [color, setColor] = useState("violet");
  const [pestana, setPestana] = useState<"icono" | "color">("icono");

  const Dibujo = iconoDe(icono);
  const limpio = sanitizeName(nombre);
  const repetido = nombreRepetido(categoriasPropias, limpio, tipo);
  const puedeGuardar = limpio.length > 0 && !repetido;

  function guardar() {
    if (!puedeGuardar) return;
    const id = crearCategoria({ nombre: limpio, tipo, color, icono });
    showToast(t("nuevaCat.creada"));
    onCreada(id);
  }

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top }}
    >
      <View className="px-5 pt-3 pb-2 flex-row items-center gap-2">
        <TouchableOpacity onPress={onBack} className="w-9 h-9 items-center justify-center -ml-2">
          <ChevronLeft size={24} color="#94a3b8" />
        </TouchableOpacity>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          {t("nuevaCat.title")}
        </Text>
      </View>

      {/* LA VISTA PREVIA. Cambia con cada toque, y es lo que se está creando. */}
      <View className="items-center py-5">
        <View
          className={`w-20 h-20 rounded-3xl items-center justify-center bg-${color}-100`}
          style={CARD_SHADOW}
        >
          <Dibujo size={36} color={COLOR_HEX_600[color] || "#475569"} strokeWidth={2.2} />
        </View>
        <Text className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2.5">
          {limpio || t("nuevaCat.sinNombre")}
        </Text>
      </View>

      <View className="px-5">
        <TextInput
          value={nombre}
          onChangeText={setNombre}
          placeholder={t("nuevaCat.nombrePlaceholder")}
          placeholderTextColor="#94a3b8"
          maxLength={24}
          className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
        />
        {/* Dos categorías del mismo tipo llamadas igual no se pueden
            distinguir al anotar un gasto: se elige una al azar y los totales
            quedan repartidos sin que nadie entienda por qué. */}
        {repetido && (
          <Text className="text-[11px] text-rose-500 mt-1.5">{t("nuevaCat.repetido")}</Text>
        )}
      </View>

      {/* Las dos pestañas. */}
      <View className="flex-row mx-5 mt-5 mb-1 border-b-[1.5px] border-slate-200 dark:border-slate-700">
        {(["icono", "color"] as const).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPestana(p)}
            className={`flex-1 items-center pb-2.5 ${
              pestana === p ? "border-b-2 border-emerald-600 -mb-[1.5px]" : ""
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                pestana === p ? "text-emerald-600" : "text-slate-400"
              }`}
            >
              {t(p === "icono" ? "nuevaCat.tabIcono" : "nuevaCat.tabColor")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 24, paddingTop: 12 }}>
        {pestana === "icono" ? (
          <>
            {[...GRUPOS_GENERICOS, ...GRUPOS_MARCAS].map((g) => (
              <View key={g.titulo} className="mb-5">
                <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-2.5">
                  {t(g.titulo)}
                </Text>
                <View className="flex-row flex-wrap gap-2.5">
                  {g.iconos.map((id) => {
                    const D = iconoDe(id);
                    const elegido = icono === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        onPress={() => setIcono(id)}
                        className={`w-12 h-12 rounded-2xl items-center justify-center ${
                          elegido
                            ? `bg-${color}-100 border-2 border-${color}-500`
                            : "bg-slate-50 dark:bg-slate-800 border-[1.5px] border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <D
                          size={22}
                          color={elegido ? COLOR_HEX_600[color] || "#475569" : "#64748b"}
                          strokeWidth={2.2}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {COLORES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                className={`w-12 h-12 rounded-full items-center justify-center ${
                  color === c ? "border-[3px] border-slate-900 dark:border-white" : ""
                }`}
                style={{ backgroundColor: COLOR_HEX_600[c] }}
              >
                {color === c && <Check size={18} color="#ffffff" />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View className="px-5" style={{ paddingBottom: insets.bottom + 16 }}>
        <TouchableOpacity
          onPress={guardar}
          disabled={!puedeGuardar}
          className={`py-4 rounded-2xl items-center ${
            puedeGuardar ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-800"
          }`}
        >
          <Text
            className={`font-extrabold ${
              puedeGuardar ? "text-white" : "text-slate-400"
            }`}
          >
            {t("nuevaCat.aplicar")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
