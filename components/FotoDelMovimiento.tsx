import { useState } from "react";
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageIcon, Trash2 } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useAppData } from "@/contexts/AppDataContext";
import { borrarFoto, guardarFoto, hayFoto } from "@/utils/fotoMovimiento";

/**
 * LA FOTO DE UN MOVIMIENTO: tomarla, cambiarla, quitarla.
 *
 * Vive en un componente y no dentro de una pantalla porque se usa en DOS —al anotar el gasto y
 * al mirarlo después— y ahí es donde se separan las cosas: dos copias acaban tomando la foto de
 * formas distintas, guardándola con calidades distintas, y un día una de las dos deja de borrar
 * el archivo viejo al cambiarla.
 *
 * LO QUE NO HACE, A PROPÓSITO: recortar. El escáner de boletas sí recorta, porque ahí la foto
 * se va a LEER y el fondo estropea la lectura. Aquí la foto es para mirarla con los ojos, y una
 * pantalla de recorte de más entre "tomar la foto" y "guardar el gasto" es un paso que nadie
 * pidió.
 */
export default function FotoDelMovimiento({
  ruta,
  onChange,
  compacto = false,
}: {
  ruta?: string;
  onChange: (ruta: string | undefined) => void;
  /** En "Nuevo movimiento" se enseña más pequeña: ahí compite con seis campos más. */
  compacto?: boolean;
}) {
  const { t, showToast } = useAppData();
  const { colorScheme } = useColorScheme();
  const [ocupado, setOcupado] = useState(false);
  const iconColor = colorScheme === "dark" ? "#94a3b8" : "#475569";

  // La ruta existe pero el archivo no: el movimiento vino de otro celular. Ver
  // utils/fotoMovimiento — la ruta viaja a la nube y el archivo no.
  const perdida = !!ruta && !hayFoto(ruta);

  async function elegir(desde: "camara" | "galeria") {
    if (ocupado) return;
    setOcupado(true);
    try {
      const permiso =
        desde === "camara"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        showToast(t("fotoMov.sinPermiso"));
        return;
      }
      const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
      const r =
        desde === "camara"
          ? await ImagePicker.launchCameraAsync(opciones)
          : await ImagePicker.launchImageLibraryAsync(opciones);
      if (r.canceled || !r.assets[0]) return;

      const nueva = await guardarFoto(r.assets[0].uri);
      if (!nueva) {
        showToast(t("fotoMov.error"));
        return;
      }
      // LA VIEJA SE BORRA AL CAMBIARLA. Sin esto, cada foto reemplazada se queda ocupando sitio
      // para siempre y nadie la vuelve a ver.
      borrarFoto(ruta);
      onChange(nueva);
    } catch {
      showToast(t("fotoMov.error"));
    } finally {
      setOcupado(false);
    }
  }

  function quitar() {
    borrarFoto(ruta);
    onChange(undefined);
  }

  return (
    <View>
      <Text className="text-xs font-semibold text-slate-600 dark:text-slate-200 mb-1.5">
        {t("fotoMov.titulo")}
      </Text>

      {ruta && !perdida ? (
        <View>
          <Image
            source={{ uri: ruta }}
            style={{ width: "100%", height: compacto ? 160 : 260, borderRadius: 16 }}
            resizeMode="cover"
          />
          <View className="flex-row gap-2.5 mt-2.5">
            <TouchableOpacity
              onPress={() => elegir("camara")}
              disabled={ocupado}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-slate-800"
            >
              <Camera size={15} color={iconColor} />
              <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200">
                {t("fotoMov.otraFoto")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => elegir("galeria")}
              disabled={ocupado}
              className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-slate-800"
            >
              <ImageIcon size={15} color={iconColor} />
              <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-200">
                {t("fotoMov.cambiar")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={quitar}
              disabled={ocupado}
              className="w-11 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950"
            >
              <Trash2 size={15} color="#f43f5e" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View>
          {/* LA FOTO QUE SE QUEDÓ EN EL OTRO CELULAR. Se dice lo que pasó en vez de enseñar un
              recuadro roto: quien cambia de teléfono y ve un hueco piensa que la app perdió
              algo, y lo que perdió es solo la imagen — el gasto está entero. */}
          {perdida && (
            <Text className="text-[11px] leading-5 text-amber-700 dark:text-amber-400 mb-2">
              {t("fotoMov.enOtroCelular")}
            </Text>
          )}
          <View className="flex-row gap-2.5">
            <TouchableOpacity
              onPress={() => elegir("camara")}
              disabled={ocupado}
              className="flex-1 flex-row items-center justify-center gap-2 py-4 rounded-2xl border-[1.5px] border-dashed border-slate-300 dark:border-slate-600"
            >
              {ocupado ? (
                <ActivityIndicator size="small" color={iconColor} />
              ) : (
                <Camera size={17} color="#059669" />
              )}
              <Text className="text-sm font-bold text-slate-600 dark:text-slate-200">
                {t("fotoMov.tomar")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => elegir("galeria")}
              disabled={ocupado}
              className="flex-1 flex-row items-center justify-center gap-2 py-4 rounded-2xl border-[1.5px] border-dashed border-slate-300 dark:border-slate-600"
            >
              <ImageIcon size={17} color="#059669" />
              <Text className="text-sm font-bold text-slate-600 dark:text-slate-200">
                {t("fotoMov.galeria")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
