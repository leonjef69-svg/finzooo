import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Camera as CameraIcon, Check, ChevronLeft, ImageIcon, RotateCcw } from "lucide-react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import ImageCropper from "@/components/ImageCropper";
import { ALL_CATS, catInfo } from "@/constants/categories";
import { COLOR_HEX_600 } from "@/constants/colors";
import { CARD_SHADOW } from "@/constants/style";
import { applyChange, sanitizeName, type CategoryOverrides } from "@/utils/categoryCustom";
import { useAppData } from "@/contexts/AppDataContext";

/** Los colores que ya usa la app, en el orden en que se ven mejor juntos. */
const COLORES = [
  "rose", "red", "orange", "amber", "yellow", "lime",
  "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "fuchsia", "pink", "stone", "slate",
];

/**
 * Colores libres, para quien no quiera ninguno de los de la app.
 *
 * Es una segunda fila con tonos que NO están arriba, no un selector de rueda:
 * elegir un color exacto en una rueda dentro de un celular es incómodo y casi
 * siempre acaba en un tono que no combina con el resto de la app. Con estos
 * se cubre lo que la gente busca —un morado más oscuro, un dorado— sin poder
 * elegir un amarillo ilegible sobre blanco.
 */
const COLORES_LIBRES = [
  "#0f172a", "#7c2d12", "#831843", "#4a044e", "#1e1b4b", "#052e16",
  "#b45309", "#be123c", "#6d28d9", "#0e7490", "#166534", "#a16207",
];

export default function CategoryCustomize({ onBack }: { onBack: () => void }) {
  const { t, categoryOverrides, updateCategoryOverrides, showToast } = useAppData();
  const insets = useSafeAreaInsets();

  const [abierta, setAbierta] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [recortando, setRecortando] = useState<string | null>(null);

  // Al abrir una categoría se carga su nombre actual en el campo. Si no
  // tiene uno propio, se deja vacío y el marcador de posición enseña el de
  // la app: así se ve qué se está cambiando sin tener que borrar nada.
  useEffect(() => {
    if (!abierta) return;
    setNombre(categoryOverrides[abierta]?.name ?? "");
  }, [abierta, categoryOverrides]);

  function cambiar(id: string, cambio: Parameters<typeof applyChange>[2]) {
    const siguiente: CategoryOverrides = applyChange(categoryOverrides, id, cambio);
    updateCategoryOverrides(siguiente);
  }

  async function elegirImagen(id: string) {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      showToast(t("settings.photoPermission"));
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    // No se usa el recorte de Android (allowsEditing) a propósito: cambia de
    // un celular a otro y en algunos no deja cuadrado. El recortador propio
    // enseña el círculo de verdad, que es como se va a ver luego.
    setRecortando(r.assets[0].uri);
    setAbierta(id);
  }

  /**
   * La foto, tomada en el momento.
   *
   * Antes solo se podia elegir de la galeria, asi que para poner el logo de un
   * negocio o un producto habia que fotografiarlo primero, salir a la galeria
   * y volver. El permiso de camara ya lo tiene la app —lo usa el escaner de
   * boletas— asi que esto no necesita un APK nuevo.
   *
   * Termina en el mismo recortador que la galeria: una sola forma de encuadrar
   * y una sola de guardar.
   */
  async function tomarFoto(id: string) {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      showToast(t("catCustom.cameraPermission"));
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    setRecortando(r.assets[0].uri);
    setAbierta(id);
  }

  const cat = abierta ? catInfo(abierta) : null;
  const original = abierta ? ALL_CATS.find((c) => c.id === abierta) : null;
  const tieneCambios = abierta ? !!categoryOverrides[abierta] : false;

  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-3 pb-2 flex-row items-center gap-2">
        <TouchableOpacity
          onPress={abierta ? () => setAbierta(null) : onBack}
          className="w-9 h-9 items-center justify-center -ml-2"
        >
          <ChevronLeft size={24} color="#94a3b8" />
        </TouchableOpacity>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          {t("catCustom.title")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {abierta === null ? (
          <>
            <Text className="text-xs text-slate-500 dark:text-slate-300 mb-4">
              {t("catCustom.subtitle")}
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              {ALL_CATS.map((c) => {
                const info = catInfo(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setAbierta(c.id)}
                    style={{ width: "31%" }}
                    className="items-center rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3.5 px-1"
                  >
                    <CategoryAvatar id={c.id} size={24} />
                    <Text
                      className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mt-1.5 text-center"
                      numberOfLines={1}
                    >
                      {t(info.label)}
                    </Text>
                    <View
                      className="w-6 h-1 rounded-full mt-1.5"
                      style={{ backgroundColor: COLOR_HEX_600[info.color] || info.color }}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          <>
            {/* Cómo va a quedar. Antes de tocar nada se ve el resultado, no
                una descripción de él. */}
            <View
              className="items-center rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-6 mb-5"
              style={CARD_SHADOW}
            >
              <CategoryAvatar id={abierta} size={40} />
              <Text className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-2">
                {cat ? t(cat.label) : ""}
              </Text>
              <View
                className="w-12 h-1.5 rounded-full mt-2"
                style={{ backgroundColor: cat ? COLOR_HEX_600[cat.color] || cat.color : "#000" }}
              />
            </View>

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("catCustom.name")}
            </Text>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              onBlur={() => cambiar(abierta, { name: sanitizeName(nombre) || null })}
              placeholder={original ? t(original.label) : ""}
              placeholderTextColor="#94a3b8"
              maxLength={24}
              className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 mb-5"
            />

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("catCustom.image")}
            </Text>
            {/* Los dos caminos, uno al lado del otro. Para el logo de un
                negocio o un producto, tener que fotografiarlo primero, salir a
                la galería y volver sobraba. */}
            <View className="flex-row gap-2.5 mb-2.5">
              <TouchableOpacity
                onPress={() => tomarFoto(abierta)}
                className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <CameraIcon size={16} color="#64748b" />
                <Text className="text-sm font-bold text-slate-600 dark:text-slate-200">
                  {t("catCustom.takePhoto")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => elegirImagen(abierta)}
                className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <ImageIcon size={16} color="#64748b" />
                <Text className="text-sm font-bold text-slate-600 dark:text-slate-200">
                  {t("catCustom.pickImage")}
                </Text>
              </TouchableOpacity>
            </View>
            {cat?.image && (
              <TouchableOpacity
                onPress={() => cambiar(abierta, { image: null })}
                className="py-2.5 mb-3 items-center rounded-xl border-[1.5px] border-slate-200 dark:border-slate-700"
              >
                <Text className="text-sm font-bold text-rose-500">{t("catCustom.removeImage")}</Text>
              </TouchableOpacity>
            )}
            <View className="mb-5" />

            <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
              {t("catCustom.color")}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {COLORES.map((nombreColor) => (
                <TouchableOpacity
                  key={nombreColor}
                  onPress={() => cambiar(abierta, { color: nombreColor })}
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    cat?.color === nombreColor ? "border-[2.5px] border-slate-900 dark:border-white" : ""
                  }`}
                  style={{ backgroundColor: COLOR_HEX_600[nombreColor] }}
                >
                  {cat?.color === nombreColor && <Check size={14} color="#ffffff" />}
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
              {t("catCustom.moreColors")}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {COLORES_LIBRES.map((hex) => (
                <TouchableOpacity
                  key={hex}
                  onPress={() => cambiar(abierta, { color: hex })}
                  className={`w-9 h-9 rounded-full items-center justify-center ${
                    cat?.color === hex ? "border-[2.5px] border-slate-900 dark:border-white" : ""
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {cat?.color === hex && <Check size={14} color="#ffffff" />}
                </TouchableOpacity>
              ))}
            </View>

            {tieneCambios && (
              <TouchableOpacity
                onPress={() => {
                  cambiar(abierta, { name: null, color: null, image: null });
                  setNombre("");
                  showToast(t("catCustom.restored"));
                }}
                className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl border-[1.5px] border-slate-200 dark:border-slate-700"
              >
                <RotateCcw size={16} color="#64748b" />
                <Text className="text-sm font-bold text-slate-600 dark:text-slate-200">
                  {t("catCustom.restore")}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {recortando !== null && abierta !== null && (
        <ImageCropper
          uri={recortando}
          onCancel={() => setRecortando(null)}
          onDone={(r) => {
            cambiar(abierta, { image: r.base64 });
            setRecortando(null);
          }}
          labels={{
            title: t("catCustom.cropTitle"),
            hint: t("catCustom.cropHint"),
            cancel: t("common.cancel"),
            save: t("common.save"),
            error: t("catCustom.cropError"),
          }}
        />
      )}
    </View>
  );
}
