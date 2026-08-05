import { memo, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  InteractionManager,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronLeft, Trash2 } from "lucide-react-native";
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

const TODOS_LOS_GRUPOS = [...GRUPOS_GENERICOS, ...GRUPOS_MARCAS];

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
  onElegir,
}: {
  id: string;
  elegido: boolean;
  color: string;
  onElegir: (id: string) => void;
}) {
  const D = iconoDe(id);
  return (
    <TouchableOpacity
      onPress={() => onElegir(id)}
      // El ancho lo reparte la fila, no lo fija el dibujo: con ancho fijo, las
      // cinco casillas no llegaban al borde y quedaba un vacío a la derecha.
      className={`flex-1 aspect-square rounded-2xl items-center justify-center ${
        elegido
          ? `bg-${color}-100 border-2 border-${color}-500`
          : "bg-slate-50 dark:bg-slate-800 border-[1.5px] border-slate-200 dark:border-slate-700"
      }`}
    >
      <D size={22} color={elegido ? COLOR_HEX_600[color] || "#475569" : "#64748b"} strokeWidth={2.2} />
    </TouchableOpacity>
  );
});

// Cuántos dibujos caben de ancho.
const POR_FILA = 5;

/**
 * El catálogo aplanado: títulos y filas de cinco, en una sola lista.
 *
 * Se aplana para poder usar una lista que solo construye lo que se ve. Con la
 * cuadrícula normal, los 236 dibujos se montaban TODOS a la vez aunque en
 * pantalla cupieran veinte — y cada uno es un dibujo vectorial de verdad, no
 * una letra. Eso era el peso real, y por eso memorizar no bastó: el problema
 * no era rehacerlos, era tenerlos.
 *
 * Se calcula una vez al cargar el archivo, no en cada dibujado.
 */
type Renglon =
  | { clase: "titulo"; clave: string }
  | { clase: "fila"; clave: string; iconos: (string | null)[] };

const RENGLONES: Renglon[] = TODOS_LOS_GRUPOS.flatMap((g) => {
  const filas: Renglon[] = [{ clase: "titulo", clave: g.titulo }];
  for (let i = 0; i < g.iconos.length; i += POR_FILA) {
    const trozo: (string | null)[] = g.iconos.slice(i, i + POR_FILA);
    // La última fila de cada grupo casi nunca viene completa, y como el ancho
    // lo reparte la fila, sus dibujos se estirarían para llenarla: saldrían más
    // grandes que los de arriba. Los huecos se rellenan con espacio vacío.
    while (trozo.length < POR_FILA) trozo.push(null);
    filas.push({ clase: "fila", clave: g.titulo + i, iconos: trozo });
  }
  return filas;
});

/** Una fila de cinco casillas. Memorizada: son las que la lista recicla. */
const Fila = memo(function Fila({
  iconos,
  elegido,
  color,
  onElegir,
}: {
  iconos: (string | null)[];
  elegido: string;
  color: string;
  onElegir: (id: string) => void;
}) {
  return (
    <View className="flex-row gap-2.5 mb-2.5">
      {iconos.map((id, i) =>
        id === null ? (
          <View key={"hueco" + i} className="flex-1" />
        ) : (
          <Dibujito key={id} id={id} elegido={elegido === id} color={color} onElegir={onElegir} />
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

  // ABRIR PRIMERO, DIBUJAR DESPUÉS.
  //
  // La pantalla entra con una animación. Si en ese mismo instante hay que
  // construir además las casillas, las dos cosas se pelean por el celular y la
  // animación sale a tirones: eso es lo que se sentía "feo al abrir", y no se
  // arregla haciendo las casillas más baratas, porque el problema es CUÁNDO se
  // hacen. Así entra la vista previa y el nombre de inmediato, y las casillas
  // en cuanto la animación terminó — un pestañeo después.
  const [catalogoListo, setCatalogoListo] = useState(false);
  useEffect(() => {
    const tarea = InteractionManager.runAfterInteractions(() => setCatalogoListo(true));
    return () => tarea.cancel();
  }, []);

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
      editarCategoria(editandoId, { nombre: limpio, color, icono });
      showToast(t("nuevaCat.guardada"));
      onCreada(editandoId);
      return;
    }
    const id = crearCategoria({ nombre: limpio, tipo, color, icono });
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

      {/* Los colores son 18 y caben: un ScrollView normal basta. El catálogo
          de dibujos, en cambio, va en una LISTA QUE SOLO CONSTRUYE LO QUE SE
          VE, y por eso el color va primero en este if: la lista no puede
          quedar dentro de un ScrollView, porque ahí cree que tiene sitio
          infinito y vuelve a construir los 236 de golpe. */}
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
      ) : catalogoListo ? (
        <FlatList
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 12 }}
          data={RENGLONES}
          keyExtractor={(r) => r.clave}
          // Solo lo que cabe y un poco más. Sin esto, la lista sigue montando
          // de golpe todo lo que crea que entra en la pantalla.
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            item.clase === "titulo" ? (
              <Text className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-2.5 mt-2.5">
                {titulos[item.clave]}
              </Text>
            ) : (
              <Fila iconos={item.iconos} elegido={icono} color={color} onElegir={setIcono} />
            )
          }
        />
      ) : (
        // Un instante, mientras termina de abrirse. Ver "abrir primero".
        <View className="flex-1" />
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
    </View>
  );
}
