import { memo, useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check, ChevronLeft, ImageIcon, Trash2, X } from "lucide-react-native";
import ImageCropper from "@/components/ImageCropper";
import { ALTO_TITULO, CATALOGO_EN_FILAS, LADO_DE, SEPARACION } from "@/constants/catalogoFilas";
import { COLOR_HEX_600 } from "@/constants/colors";
import { iconoDe, TODOS_LOS_GRUPOS } from "@/constants/iconos";
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
 * Un dibujo de la cuadrícula.
 *
 * Va en su propio componente memorizado por un motivo medible: son 236 en
 * pantalla. Sin esto, elegir uno redibujaba los 236 aunque solo cambien dos
 * —el que se deja y el que se toma— y el toque se sentía pesado.
 */
const Dibujito = memo(function Dibujito({
  id,
  elegido,
  color,
  lado,
  onElegir,
}: {
  id: string;
  elegido: boolean;
  color: string;
  /** Medida del cuadrado, calculada del ancho de la pantalla. Ver LADO_DE. */
  lado: number;
  onElegir: (id: string) => void;
}) {
  const D = iconoDe(id);
  return (
    <TouchableOpacity
      onPress={() => onElegir(id)}
      // La medida va en número, no en clase. Con "flex-1" la repartía la fila y
      // se veía igual, pero nadie sabía cuánto medía hasta después de dibujarla
      // — y la lista necesita saberlo ANTES para poder adelantarse al dedo.
      style={{ width: lado, height: lado }}
      className={`rounded-2xl items-center justify-center ${
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
});

/** Una fila de cinco casillas. Memorizada para que un toque no rehaga las demás. */
const Fila = memo(function Fila({
  iconos,
  elegido,
  color,
  lado,
  onElegir,
}: {
  iconos: (string | null)[];
  elegido: string;
  color: string;
  lado: number;
  onElegir: (id: string) => void;
}) {
  return (
    // Alto y separación explícitos: es la altura que la lista da por hecha.
    <View
      style={{ flexDirection: "row", height: lado, gap: SEPARACION, marginBottom: SEPARACION }}
    >
      {iconos.map((id, i) =>
        id === null ? (
          <View key={"hueco" + i} style={{ width: lado }} />
        ) : (
          <Dibujito
            key={id}
            id={id}
            elegido={elegido === id}
            color={color}
            lado={lado}
            onElegir={onElegir}
          />
        )
      )}
    </View>
  );
});


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
  editandoId,
  onBack,
  onCreada,
}: {
  tipo: "expense" | "income";
  /** Si viene, se está EDITANDO esa categoría en vez de creando una. */
  editandoId?: string;
  onBack: () => void;
  /** Se avisa con el id para poder dejarla ya elegida en el movimiento. */
  onCreada: (id: string) => void;
}) {
  const {
    t,
    categoriasPropias,
    crearCategoria,
    editarCategoria,
    borrarCategoria,
    movimientosDeCategoria,
    showToast,
  } = useAppData();
  const insets = useSafeAreaInsets();

  // La que se está editando, si es que se está editando alguna.
  const original = editandoId ? categoriasPropias.find((c) => c.id === editandoId) : undefined;
  const editando = !!original;

  // Se arranca con lo que ya tenía. useState con función: se lee UNA vez, al
  // abrir. Si se leyera en cada dibujado, cada toque en el catálogo pisaría lo
  // que la persona acaba de elegir con el valor guardado.
  const [nombre, setNombre] = useState(() => original?.nombre ?? "");
  const [icono, setIcono] = useState(() => original?.icono ?? "Tag");
  const [color, setColor] = useState(() => original?.color ?? "violet");
  const [pestana, setPestana] = useState<"icono" | "color">("icono");
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  // LA FOTO PROPIA. Cuando hay, se dibuja en vez del icono — la misma regla que
  // sigue CategoryAvatar en el resto de la app, para que no se vea de una forma
  // aquí y de otra en Inicio.
  //
  // El icono elegido NO se borra al poner una foto: queda debajo, y quitando la
  // foto vuelve a salir. Quien prueba una foto y no le gusta no pierde lo que
  // había elegido antes.
  const [foto, setFoto] = useState<string | undefined>(() => original?.image);
  /** La imagen recién elegida, esperando a que se encuadre. */
  const [recortando, setRecortando] = useState<string | null>(null);

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      showToast(t("catCustom.cameraPermission"));
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    setRecortando(r.assets[0].uri);
  }

  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      showToast(t("settings.photoPermission"));
      return;
    }
    // Sin allowsEditing a propósito: el recorte que trae Android cambia de un
    // celular a otro y en algunos no deja cuadrado. Cámara y galería terminan
    // las dos en el recortador propio, así que hay UNA sola forma de encuadrar.
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    setRecortando(r.assets[0].uri);
  }

  // El lado de cada casilla sale del ancho real de la pantalla, para que las
  // cinco de una fila lleguen justo al borde. Ver constants/catalogoFilas.ts.
  const { width: anchoPantalla } = useWindowDimensions();
  const lado = LADO_DE(anchoPantalla);

  // Los títulos de los grupos, traducidos UNA vez. Pasarle la función de
  // traducir al catálogo lo redibujaría entero en cada letra escrita, que es
  // justo lo que se está evitando. El idioma no se puede cambiar sin salir de
  // aquí, así que calcularlo una vez es correcto.
  const titulos = useMemo(
    () => Object.fromEntries(TODOS_LOS_GRUPOS.map((g) => [g.titulo, t(g.titulo)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const Dibujo = iconoDe(icono);
  const limpio = sanitizeName(nombre);
  // Al editar no cuenta como repetida consigo misma.
  const repetido = nombreRepetido(categoriasPropias, limpio, tipo, editandoId);
  const puedeGuardar = limpio.length > 0 && !repetido;

  function guardar() {
    if (!puedeGuardar) return;
    if (editando && editandoId) {
      // La foto va como null cuando se quitó: sin ese null, "no la toques" y
      // "bórrala" serían lo mismo y no habría forma de sacarla.
      editarCategoria(editandoId, { nombre: limpio, color, icono, image: foto ?? null });
      showToast(t("nuevaCat.guardada"));
      onCreada(editandoId);
      return;
    }
    const id = crearCategoria({ nombre: limpio, tipo, color, icono, image: foto });
    showToast(t("nuevaCat.creada"));
    onCreada(id);
  }

  function borrar() {
    if (!editandoId) return;
    borrarCategoria(editandoId);
    showToast(t("nuevaCat.borrada"));
    onBack();
  }

  // Cuántos movimientos pasarían a "Otros". Se dice ANTES de borrar, con el
  // número: "se va a borrar" no informa igual que "3 movimientos quedarán en
  // Otros", y es justo el dato que hace dudar o seguir.
  const cuantos = editandoId ? movimientosDeCategoria(editandoId) : 0;

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
          {t(editando ? "nuevaCat.titleEditar" : "nuevaCat.title")}
        </Text>
      </View>

      {/* LA VISTA PREVIA. Cambia con cada toque, y es lo que se está creando.
          Si hay foto, MANDA la foto: es la misma regla que CategoryAvatar sigue
          en el resto de la app, y saltársela aquí haría que la categoría se
          viera de una forma al crearla y de otra en Inicio. Ya pasó una vez. */}
      <View className="items-center py-5">
        <View
          className={`w-20 h-20 rounded-3xl items-center justify-center overflow-hidden bg-${color}-100`}
          style={CARD_SHADOW}
        >
          {foto ? (
            <Image source={{ uri: foto }} style={{ width: 80, height: 80 }} />
          ) : (
            <Dibujo size={36} color={COLOR_HEX_600[color] || "#475569"} strokeWidth={2.2} />
          )}
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

      {/* El "px-5" de las dos pantallas deslizables es el MARGEN_LATERAL de las
          medidas, y de ahí sale el ancho de las casillas. Cambiar uno sin el
          otro descoloca la cuadrícula. */}
      {pestana === "color" ? (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 12 }}
        >
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
        </ScrollView>
      ) : (
        // UNA PANTALLA DESLIZABLE NORMAL CON LOS 236 DIBUJOS PUESTOS. Sin lista
        // virtual, sin cargar por partes, sin nada que aparezca después.
        //
        // Esto sería impensable con dibujos vectoriales —armarlos tarda cerca de
        // un segundo, y por eso hubo cinco intentos de repartir ese segundo en
        // algún sitio donde no se notara—. Con la tipografía cada dibujo es una
        // letra, así que los 236 salen de una y ya está. El arreglo no estuvo
        // nunca en cómo organizar la lista: estuvo en de qué están hechos los
        // dibujos. Ver constants/iconos.tsx.
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* TU PROPIA FOTO, PRIMERO.
              Va arriba del catálogo y no en una pestaña aparte porque es otra
              forma de contestar la misma pregunta —"¿con qué dibujo?"—, y una
              pestaña más la esconde. Son casillas del mismo tamaño que las
              demás para que se lean como parte de la misma elección. */}
          <View style={{ height: ALTO_TITULO, justifyContent: "center" }}>
            <Text className="text-xs font-bold text-slate-500 dark:text-slate-300">
              {t("nuevaCat.tuFoto")}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", height: lado, gap: SEPARACION, marginBottom: SEPARACION }}
          >
            <TouchableOpacity
              onPress={tomarFoto}
              style={{ width: lado, height: lado }}
              className="rounded-2xl items-center justify-center bg-slate-50 dark:bg-slate-800 border-[1.5px] border-dashed border-slate-300 dark:border-slate-600"
            >
              <Camera size={22} color="#64748b" strokeWidth={2.2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={elegirDeGaleria}
              style={{ width: lado, height: lado }}
              className="rounded-2xl items-center justify-center bg-slate-50 dark:bg-slate-800 border-[1.5px] border-dashed border-slate-300 dark:border-slate-600"
            >
              <ImageIcon size={22} color="#64748b" strokeWidth={2.2} />
            </TouchableOpacity>
            {/* La foto puesta, y encima la forma de sacarla. Sin esto, quien
                pone una foto no encuentra cómo volver a un dibujo: elegir un
                icono no la quitaría, porque la foto manda. */}
            {foto && (
              <TouchableOpacity
                onPress={() => setFoto(undefined)}
                style={{ width: lado, height: lado }}
                className={`rounded-2xl items-center justify-center overflow-hidden border-2 border-${color}-500`}
              >
                <Image source={{ uri: foto }} style={{ width: lado, height: lado }} />
                <View className="absolute inset-0 items-center justify-center bg-slate-900/45">
                  <X size={20} color="#ffffff" strokeWidth={2.6} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {CATALOGO_EN_FILAS.map((grupo) => (
            <View key={grupo.titulo}>
              <View style={{ height: ALTO_TITULO, justifyContent: "center" }}>
                <Text className="text-xs font-bold text-slate-500 dark:text-slate-300">
                  {titulos[grupo.titulo]}
                </Text>
              </View>
              {grupo.filas.map((fila, f) => (
                <Fila
                  key={f}
                  iconos={fila}
                  elegido={icono}
                  color={color}
                  lado={lado}
                  onElegir={setIcono}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <View className="px-5" style={{ paddingBottom: insets.bottom + 16 }}>
        {/* BORRAR, solo al editar.
            Se pide confirmación en el sitio, no con una ventana: la ventana
            del sistema tapa la pantalla y no deja leer cuántos movimientos
            están en juego, que es justo el dato que importa. */}
        {editando &&
          (confirmandoBorrado ? (
            <View className="mb-3 rounded-2xl border-[1.5px] border-rose-300 bg-rose-50 dark:bg-rose-900/20 p-3.5">
              <Text className="text-[11px] leading-5 text-rose-700 dark:text-rose-300">
                {cuantos > 0
                  ? t("nuevaCat.borrarConMovs", { count: cuantos })
                  : t("nuevaCat.borrarSinMovs")}
              </Text>
              <View className="flex-row gap-2.5 mt-3">
                <TouchableOpacity
                  onPress={() => setConfirmandoBorrado(false)}
                  className="flex-1 py-2.5 rounded-xl items-center border-[1.5px] border-slate-300 dark:border-slate-600"
                >
                  <Text className="text-xs font-bold text-slate-600 dark:text-slate-200">
                    {t("nuevaCat.cancelar")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={borrar}
                  className="flex-1 py-2.5 rounded-xl items-center bg-rose-600"
                >
                  <Text className="text-xs font-extrabold text-white">
                    {t("nuevaCat.borrarSi")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setConfirmandoBorrado(true)}
              className="flex-row items-center justify-center gap-2 py-3 mb-3"
            >
              <Trash2 size={15} color="#e11d48" />
              <Text className="text-sm font-bold text-rose-600">{t("nuevaCat.borrar")}</Text>
            </TouchableOpacity>
          ))}

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
            {t(editando ? "nuevaCat.guardar" : "nuevaCat.aplicar")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* EL RECORTADOR PROPIO, el mismo para cámara y galería.
          Encima de todo y no en otra pantalla: al volver de la cámara la app
          ya está aquí, con el nombre y el color que se iban escribiendo. */}
      {recortando && (
        <ImageCropper
          uri={recortando}
          onCancel={() => setRecortando(null)}
          onDone={(r) => {
            setFoto(r.base64);
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
