/**
 * AGREGAR O EDITAR UN PAGO DEL CALENDARIO (18/08/2026, rediseñado el 19)
 *
 * Aquí se cumple lo que pidió: *"pueda yo personalizar qué día y hora me avise para
 * pagarlo"*. El aviso es de **cada pago** y no un ajuste general.
 *
 * **EL REDISEÑO DEL 19/08, con sus palabras:** *"que el usuario tenga la menor interacción,
 * intuitiva, quitar el exceso de texto que no sirve, que el usuario pueda agregarle un icono
 * personalizado"*. De nueve bloques quedaron cinco:
 *
 * - **Fuera los seis títulos en mayúsculas.** El sitio y el dibujo ya dicen qué es cada campo.
 * - **Fuera las tres notas al pie**: la del día 31, la de la repetición y la del primer aviso.
 *   La del 31 sobra porque ahora se dice "el último día de cada mes", que es lo que es.
 * - **Monto y fecha van juntos**, y los días y la hora del aviso en un solo renglón.
 * - **El dibujo se pone SOLO al escribir el nombre** (`iconoSugerido`). En el caso normal,
 *   agregar un pago son cero toques de más; el lápiz está para cuando no acierta.
 *
 * La fecha llega hecha del calendario grande — aquí hubo uno propio y él lo mandó quitar:
 * *"cuando dije tocar libremente el calendario me refería a la segunda imagen"*.
 */
import { memo, useCallback, useEffect, useState } from "react";
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, CalendarDays, Pencil, Repeat, Trash2 } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import BackButton from "@/components/BackButton";
import Toggle from "@/components/Toggle";
import { useAppData } from "@/contexts/AppDataContext";
import { TODOS_LOS_GRUPOS, iconoDe } from "@/constants/iconos";
import { esFoto } from "@/utils/iconosFavoritos";
import { COLOR_HEX_600 } from "@/constants/colors";
import {
  iconoSugerido,
  mesDe,
  soloMonto,
  textoDeRepeticion,
  validarPago,
  type TipoDeAnotacion,
} from "@/utils/calendarioPagos";

/** El color con el que se pinta el dibujo, según el tipo. Los mismos tres de la otra pantalla. */
const TINTA: Record<TipoDeAnotacion, string> = {
  pago: "#d97706",
  ingreso: "#059669",
  recordatorio: "#64748b",
};

function soloNumeros(texto: string, tope: number): string {
  const limpio = texto.replace(/\D/g, "").slice(0, 2);
  if (limpio === "") return "";
  return String(Math.min(Number(limpio), tope));
}

/**
 * Cuántos grupos se dibujan en el primer instante al abrir el selector.
 *
 * Cuatro son unos 70 dibujos: más de tres pantallas, así que lo que se ve está completo desde
 * el principio. Subirlo devuelve el tirón; bajarlo deja hueco a un deslizón rápido. Es el
 * mismo número que se afinó para el catálogo de categorías.
 */
const GRUPOS_AL_ABRIR = 4;

function dosDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

export default function NuevoPagoProgramado({
  id,
  fecha,
  onBack,
}: {
  id?: string;
  /** "2026-08-14", el día que se tocó en el calendario grande. */
  fecha?: string;
  onBack: () => void;
}) {
  const { t, monthNames, pagosProgramados, guardarPagoProgramado, quitarPagoProgramado } =
    useAppData();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const oscuro = colorScheme === "dark";

  const existente = pagosProgramados.find((p) => p.id === id);
  const hoy = new Date();

  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoDeAnotacion>(existente?.tipo ?? "pago");
  const [monto, setMonto] = useState(existente?.monto != null ? String(existente.monto) : "");
  /**
   * EL DIBUJO ELEGIDO A MANO, SI SE ELIGIÓ. `null` quiere decir *"el que decida el nombre"*.
   *
   * Guardar aquí el sugerido desde el principio rompería lo que hace agradable a esto: al
   * corregir el nombre —de "Luz" a "Luz del depa"— el dibujo se quedaría clavado en el
   * primero que salió. Con `null`, sigue al nombre hasta que alguien decide otra cosa.
   */
  const [iconoElegido, setIconoElegido] = useState<string | null>(existente?.icono ?? null);
  const [eligiendoIcono, setEligiendoIcono] = useState(false);
  const [pestana, setPestana] = useState<"dibujo" | "foto" | "color">("dibujo");
  const [color, setColor] = useState<string | null>(existente?.color ?? null);
  /**
   * CUÁNTOS GRUPOS SE DIBUJAN YA, Y POR QUÉ NO LOS 18 DE GOLPE.
   *
   * *"Al darle click en el icono parece que fallara los primeros intentos, luego va bien."*
   * Son **236 dibujos**, y cada uno es una letra que Android tiene que medir: montarlos todos
   * en el mismo instante en que se abre el panel atropella al dedo.
   *
   * **Esto ya pasó con las categorías y está resuelto desde el 07/08** (ver ESTADO,
   * "EL CATÁLOGO EN DOS TANDAS"): los primeros grupos entran de una —lo que se ve está
   * completo desde el primer momento— y el resto llega solo unos milisegundos después, fuera
   * de la vista. **No es cargar al deslizar**, que es lo que él ya rechazó entonces: *"los
   * iconos ya deberían estar ahí fijos"*.
   */
  const [gruposListos, setGruposListos] = useState(GRUPOS_AL_ABRIR);
  useEffect(() => {
    /**
     * **AL CERRAR SE VUELVE A EMPEZAR, Y ESTO ERA UN FALLO** (19/08/2026).
     *
     * El contador se quedaba en 18 después de la primera vez. Como al cerrar el panel los
     * dibujos se desmontan, la SEGUNDA apertura montaba los 236 de golpe — justo el tirón
     * que las tandas venían a quitar. Él lo describió como *"si toco rápido el icono parece
     * que falla"*: la primera vez iba bien y las siguientes no.
     */
    if (!eligiendoIcono) {
      setGruposListos(GRUPOS_AL_ABRIR);
      return;
    }
    if (gruposListos >= TODOS_LOS_GRUPOS.length) return;
    const id = setTimeout(() => setGruposListos(TODOS_LOS_GRUPOS.length), 250);
    return () => clearTimeout(id);
  }, [eligiendoIcono, gruposListos]);

  const elegida = existente
    ? `${existente.mesUnico ?? mesDe(hoy)}-${dosDigitos(existente.dia)}`
    : (fecha ?? `${mesDe(hoy)}-${dosDigitos(hoy.getDate())}`);
  const mesVisible = elegida.slice(0, 7);
  const dia = Number(elegida.slice(8));
  const [repite, setRepite] = useState((existente?.repite ?? "mensual") === "mensual");

  const [diasAntes, setDiasAntes] = useState(String(existente?.avisoDiasAntes ?? 1));
  const [horaHH, setHoraHH] = useState((existente?.avisoHora ?? "09:00").split(":")[0]);
  const [horaMM, setHoraMM] = useState((existente?.avisoHora ?? "09:00").split(":")[1]);

  /**
   * Estable entre dibujados: ver `Casilla`. Con una función nueva cada vez, la memorización
   * de las 236 casillas no serviría de nada — es la mitad que se olvida.
   */
  const elegirDibujo = useCallback((x: string) => setIconoElegido(x), []);

  const esRecordatorio = tipo === "recordatorio";
  const icono = iconoElegido ?? iconoSugerido(nombre, tipo);
  const Dibujo = iconoDe(icono);
  const tinta = (color && COLOR_HEX_600[color]) || TINTA[tipo];
  const repeticion = textoDeRepeticion(dia, repite);
  const campo = oscuro ? "bg-slate-800" : "bg-slate-100";

  /**
   * LA FOTO, RECORTADA A UN CUADRADO Y ACHICADA A 256.
   *
   * Se guarda dentro del propio pago como texto `data:`, igual que hacen las categorías
   * propias. A 256 px y calidad 0.7 son unos 18 KB: bastante para un dibujo de 56 puntos y
   * poco para el celular.
   *
   * `allowsEditing` con `aspect` cuadrado usa el recortador de Android. Es el mismo camino
   * que ya usa la foto de perfil en Ajustes; el recortador propio de las categorías es más
   * fino pero arrastra media pantalla de código, y aquí el dibujo se ve a 56 puntos.
   */
  async function tomarFoto(conCamara: boolean) {
    const permiso = conCamara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) return;
    const r = conCamara
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
    if (r.canceled || !r.assets[0]) return;
    try {
      const ctx = ImageManipulator.manipulate(r.assets[0].uri).resize({ width: 256, height: 256 });
      const hecha = await ctx.renderAsync();
      const guardada = await hecha.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
      setIconoElegido(`data:image/jpeg;base64,${guardada.base64}`);
      setEligiendoIcono(false);
    } catch {
      // Si la foto no se pudo preparar, se deja el dibujo que hubiera. Un pago sin foto
      // funciona igual; uno que no se puede guardar, no.
    }
  }

  function guardar() {
    const montoNumero = esRecordatorio ? undefined : Number(monto.replace(",", "."));
    const check = validarPago(nombre, tipo, montoNumero, dia);
    if (!check.ok) {
      Alert.alert(t("calendario.nuevo.faltaTitulo"), t(`calendario.nuevo.falta.${check.motivo}`));
      return;
    }
    guardarPagoProgramado({
      id: existente?.id ?? `pago_${Date.now()}`,
      nombre: nombre.trim(),
      tipo,
      monto: montoNumero,
      dia,
      repite: repite ? "mensual" : "unica",
      mesUnico: repite ? undefined : mesVisible,
      // Se guarda el que se ve, sugerido o elegido: si se guardara solo el elegido, un pago
      // sin tocar el lápiz saldría en la lista con el dibujo de reserva y no con su rayo.
      icono,
      color: color ?? undefined,
      categoria: existente?.categoria,
      avisoDiasAntes: Number(diasAntes || 0),
      avisoHora: `${(horaHH || "0").padStart(2, "0")}:${(horaMM || "0").padStart(2, "0")}`,
      pagados: existente?.pagados ?? [],
      creado: existente?.creado ?? Date.now(),
    });
    onBack();
  }

  function borrar() {
    if (!existente) return;
    Alert.alert(
      t("calendario.nuevo.borrarTitulo", { nombre: existente.nombre }),
      t("calendario.nuevo.borrarTexto"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("calendario.nuevo.borrar"),
          style: "destructive",
          onPress: () => {
            quitarPagoProgramado(existente.id);
            onBack();
          },
        },
      ]
    );
  }

  return (
    <View
      className="flex-1 bg-white dark:bg-slate-900"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <BackButton onPress={onBack} />
        <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
          {t(existente ? "calendario.nuevo.editar" : "calendario.nuevo.titulo")}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row gap-2 mb-4">
          {(["pago", "ingreso", "recordatorio"] as TipoDeAnotacion[]).map((x) => (
            <TouchableOpacity
              key={x}
              onPress={() => setTipo(x)}
              className={`flex-1 py-2.5 rounded-xl items-center ${
                tipo === x ? "bg-slate-900 dark:bg-slate-100" : "bg-slate-100 dark:bg-slate-800"
              }`}
            >
              <Text
                className={`text-[13px] ${
                  tipo === x
                    ? "text-white dark:text-slate-900 font-bold"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {t(`calendario.tipo.${x}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* EL DIBUJO Y EL NOMBRE, EN LA MISMA FILA. El dibujo sale del nombre mientras se
            escribe; tocarlo abre el selector.
            **TOCAR EL DIBUJO YA LO ABRE, y el lápiz solo es la señal de que se puede.** Antes
            el lápiz era de 11 puntos: *"el icono del lápiz hazlo más grande, o con solo tocar
            el icono ya se pueda editar"*. Se hicieron las dos cosas — el sitio que se toca es
            el cuadro entero, que es de 56, y el lápiz creció a 15. */}
        <View className="flex-row items-center gap-3 mb-3">
          <TouchableOpacity
            onPress={() => setEligiendoIcono(true)}
            className="w-[56px] h-[56px] rounded-2xl items-center justify-center overflow-hidden"
            style={{ backgroundColor: tinta + (oscuro ? "33" : "22") }}
          >
            {esFoto(icono ?? "") ? (
              <Image source={{ uri: icono }} style={{ width: 56, height: 56 }} />
            ) : (
              <Dibujo size={28} color={tinta} strokeWidth={2.2} />
            )}
            <View className="absolute bottom-0 right-0 w-[22px] h-[22px] rounded-tl-xl items-center justify-center bg-white/90 dark:bg-slate-900/90">
              <Pencil size={13} color="#475569" />
            </View>
          </TouchableOpacity>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            placeholder={t("calendario.nuevo.nombreEjemplo")}
            placeholderTextColor="#94a3b8"
            className={`flex-1 h-[52px] rounded-2xl px-4 text-[16px] ${campo} text-slate-900 dark:text-slate-100`}
          />
        </View>

        {/* EL SELECTOR, EN TRES PESTAÑAS.
            Pedido suyo: *"que se pueda elegir una foto o tomar foto, aparte los iconos deben
            estar por su categoría —trabajo: salgan los iconos de trabajo— y elegir el
            color"*. Antes era una parrilla de 236 dibujos sin orden ninguno, y el primero
            que salía era el de comida: nadie encuentra ahí un maletín. */}
        {eligiendoIcono && (
          <View className="rounded-2xl p-3 mb-3 bg-slate-50 dark:bg-slate-800">
            <View className="flex-row items-center justify-between mb-2.5">
              <View className="flex-row flex-1">
                {(["dibujo", "foto", "color"] as const).map((x) => (
                  <TouchableOpacity
                    key={x}
                    onPress={() => setPestana(x)}
                    className="px-3 py-1.5 mr-1 rounded-lg"
                    style={{ backgroundColor: pestana === x ? tinta : "transparent" }}
                  >
                    <Text
                      className={`text-[12px] ${
                        pestana === x ? "text-white font-bold" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {t(`calendario.nuevo.pestana.${x}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => setEligiendoIcono(false)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900"
              >
                <Text className="text-[12px] font-bold text-slate-600 dark:text-slate-200">
                  {t("calendario.nuevo.listo")}
                </Text>
              </TouchableOpacity>
            </View>

            {pestana === "dibujo" && (
              <>
                {/* CON SU TÍTULO CADA GRUPO. Son los mismos 236 de las categorías —dos
                    catálogos para lo mismo es uno que se queda atrás— pero ordenados, que es
                    lo que faltaba. El alto máximo deja ver la lista de abajo mientras se
                    elige. */}
                <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                  {TODOS_LOS_GRUPOS.slice(0, gruposListos).map((g) => {
                    const titulo = t(g.titulo);
                    const suyos = g.iconos;
                    return (
                      <View key={g.titulo}>
                        <Text className="text-[11px] text-slate-400 dark:text-slate-500 mt-2.5 mb-1.5">
                          {titulo}
                        </Text>
                        <View className="flex-row flex-wrap">
                          {suyos.map((x) => (
                            <Casilla
                              key={x}
                              id={x}
                              puesto={x === icono}
                              tinta={tinta}
                              onPress={elegirDibujo}
                            />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {pestana === "foto" && (
              <View>
                <View className="flex-row gap-2.5">
                  <BotonFoto texto={t("calendario.nuevo.tomarFoto")} onPress={() => tomarFoto(true)} />
                  <BotonFoto texto={t("calendario.nuevo.galeria")} onPress={() => tomarFoto(false)} />
                </View>
                {esFoto(icono ?? "") && (
                  <TouchableOpacity
                    onPress={() => setIconoElegido(null)}
                    className="py-2.5 mt-2.5 rounded-xl items-center bg-white dark:bg-slate-900"
                  >
                    <Text className="text-[12px] font-bold text-rose-600">
                      {t("calendario.nuevo.quitarFoto")}
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Se dice que la foto no viaja: quien cambie de celular y no lo sepa creería
                    que se perdió. Ver pagosParaLaNube — el documento tiene tope de 1 MB. */}
                <Text className="text-[11px] leading-4 text-slate-400 mt-2.5">
                  {t("calendario.nuevo.fotoNota")}
                </Text>
              </View>
            )}

            {pestana === "color" && (
              <View className="flex-row flex-wrap gap-2.5 py-1">
                {Object.keys(COLOR_HEX_600).map((k) => (
                  <TouchableOpacity
                    key={k}
                    onPress={() => setColor(k)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: COLOR_HEX_600[k],
                      borderWidth: color === k ? 3 : 0,
                      borderColor: oscuro ? "#f1f5f9" : "#0f172a",
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <View className="flex-row gap-2.5 mb-3">
          {!esRecordatorio && (
            <View className={`flex-1 h-[50px] rounded-2xl px-4 flex-row items-center ${campo}`}>
              <Text className="text-[13px] text-slate-400 mr-1.5">S/</Text>
              <TextInput
                value={monto}
                onChangeText={(v) => setMonto(soloMonto(v))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                className="flex-1 text-[16px] text-slate-900 dark:text-slate-100"
              />
            </View>
          )}
          <View
            className={`h-[50px] rounded-2xl px-4 flex-row items-center gap-2 ${campo} ${
              esRecordatorio ? "flex-1" : "flex-[1.15]"
            }`}
          >
            <CalendarDays size={16} color="#64748b" />
            <Text className="text-[15px] text-slate-900 dark:text-slate-100">
              {t("calendario.nuevo.fechaCorta", {
                dia,
                mes: monthNames[Number(mesVisible.split("-")[1]) - 1],
              })}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2.5 py-3.5 border-t-[1.5px] border-slate-100 dark:border-slate-800">
          <Repeat size={17} color="#64748b" />
          <Text className="flex-1 text-[14px] text-slate-900 dark:text-slate-100">
            {t(repeticion.clave, {
              dia: repeticion.dia ?? dia,
              mes: monthNames[Number(mesVisible.split("-")[1]) - 1],
            })}
          </Text>
          <Toggle on={repite} onChange={setRepite} />
        </View>

        {/* EL AVISO, EN SU PROPIO RENGLON Y CON LOS DOS CAMPOS ANCHOS.
            Iba todo en una fila -campana, "AVISAME", los dias y la hora- y en su celular la
            hora salia cortada: se leia ")9:)0". Con cinco cosas en una linea, la ultima es la
            que se come el borde.
            Ahora el titulo sube a su renglon y los dos campos se reparten el ancho a mitades,
            asi que ninguno puede quedarse sin sitio por mucho que crezca el otro. */}
        <View className="py-3.5 border-t-[1.5px] border-b-[1.5px] border-slate-100 dark:border-slate-800 mb-5">
          <View className="flex-row items-center gap-2.5 mb-3">
            <Bell size={17} color="#64748b" />
            <Text className="text-[14px] text-slate-900 dark:text-slate-100">
              {t("calendario.nuevo.avisarme")}
            </Text>
          </View>
          <View className="flex-row gap-2.5">
            <View className={`flex-1 h-[46px] rounded-xl flex-row items-center justify-center ${campo}`}>
              <TextInput
                value={diasAntes}
                onChangeText={(v) => setDiasAntes(soloNumeros(v, 30))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
                className="w-8 text-[17px] text-center text-slate-900 dark:text-slate-100"
              />
              <Text className="text-[13px] text-slate-500 dark:text-slate-400">
                {t("calendario.nuevo.diasCorto")}
              </Text>
            </View>
            <View className={`flex-1 h-[46px] rounded-xl flex-row items-center justify-center ${campo}`}>
              <TextInput
                value={horaHH}
                onChangeText={(v) => setHoraHH(soloNumeros(v, 23))}
                keyboardType="number-pad"
                className="w-8 text-[17px] text-center text-slate-900 dark:text-slate-100"
              />
              <Text className="text-[17px] text-slate-400">:</Text>
              <TextInput
                value={horaMM}
                onChangeText={(v) => setHoraMM(soloNumeros(v, 59))}
                keyboardType="number-pad"
                className="w-8 text-[17px] text-center text-slate-900 dark:text-slate-100"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={guardar}
          className="h-[50px] rounded-2xl items-center justify-center bg-emerald-600"
        >
          <Text className="text-[15px] font-bold text-white">{t("calendario.nuevo.guardar")}</Text>
        </TouchableOpacity>

        {existente && (
          <TouchableOpacity
            onPress={borrar}
            className="flex-row items-center justify-center gap-2 py-3.5 mt-2"
          >
            <Trash2 size={15} color="#e11d48" />
            <Text className="text-[13px] font-bold text-rose-600">
              {t("calendario.nuevo.borrar")}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

/** Los dos botones de la pestaña de foto. Uno solo para que midan y separen igual. */
function BotonFoto({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 py-3 rounded-xl items-center bg-white dark:bg-slate-900"
    >
      <Text className="text-[12px] font-bold text-slate-600 dark:text-slate-200">{texto}</Text>
    </TouchableOpacity>
  );
}

/**
 * UNA CASILLA DEL CATÁLOGO, MEMORIZADA.
 *
 * **Sin esto, tocar un dibujo rehacía los 236.** Cambiar el elegido es un cambio de estado
 * de la pantalla, y la parrilla entera cuelga de ella: cada toque volvía a construir las 236
 * casillas, y cada dibujo es una letra que Android tiene que medir. Él lo notó enseguida:
 * *"al seleccionar diferentes iconos hay como una lentitud, se siente raro, como un retraso
 * de unos segundos"*.
 *
 * Memorizada, un toque rehace **dos**: la que suelta la marca y la que la toma. Es
 * exactamente lo que se hizo con la cuadrícula de categorías el 07/08 —y por lo mismo—, con
 * una diferencia que allí costó una entrega entera: **la función que se le pasa tiene que ser
 * estable**. Con una función nueva en cada dibujado, memorizar no sirve de nada; por eso el
 * `onPress` de aquí recibe el id y quien lo llama usa `useCallback`.
 */
const Casilla = memo(function Casilla({
  id,
  puesto,
  tinta,
  onPress,
}: {
  id: string;
  puesto: boolean;
  tinta: string;
  onPress: (id: string) => void;
}) {
  const D = iconoDe(id);
  return (
    <TouchableOpacity
      onPress={() => onPress(id)}
      style={{ width: "20%", aspectRatio: 1 }}
      className="items-center justify-center p-1"
    >
      <View
        className="w-full h-full rounded-xl items-center justify-center bg-white dark:bg-slate-900"
        style={puesto ? { backgroundColor: tinta } : undefined}
      >
        <D size={22} color={puesto ? "#ffffff" : "#64748b"} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
});
