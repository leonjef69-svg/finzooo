import { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Pencil, Plus } from "lucide-react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import { catInfo, gastosDisponibles, ingresosDisponibles } from "@/constants/categories";
import { useAppData } from "@/contexts/AppDataContext";
import { esPropia } from "@/utils/categoriasPropias";

/**
 * ELEGIR CATEGORÍA.
 *
 * POR QUÉ EXISTE ESTA PANTALLA
 *
 * La cuadrícula de categorías estaba DENTRO de "Nuevo movimiento" y se comía
 * media pantalla: había que desplazarse para llegar a la fecha, la descripción
 * y las notas. El usuario lo pidió así el 06/08/2026 —"quiero que solo quede un
 * botón que diga Elegir categoría y todo lo que está en azul desaparezca"— y
 * eligió la versión del botón solo, sin atajos al lado.
 *
 * Así que la cuadrícula se mudó aquí entera, y de paso arregla dos cosas que
 * arrastraba:
 *
 *   - Caben TODAS a la vista. El "Ver más" existía porque no había sitio; aquí
 *     sobra, y con él se va el problema de que las propias vivieran escondidas
 *     detrás de un botón.
 *   - "Crear categoría" y "Editar esta" ya no compiten por el espacio con los
 *     campos del movimiento.
 *
 * LO QUE SE PAGA
 *
 * Elegir era un toque y ahora son tres: abrir, elegir, volver. Se le ofreció
 * dejar las cuatro más usadas en el movimiento para conservar el toque único, y
 * prefirió el botón solo. Queda anotado para no volver a proponerlo.
 *
 * CÓMO VUELVE LA ELEGIDA AL MOVIMIENTO
 *
 * Por el contexto (elegirCategoriaEnMovimiento), no por una propiedad: son dos
 * pantallas distintas y esta se apila ENCIMA de la otra, que sigue viva debajo
 * con el monto y la fecha ya escritos. Es el mismo canal por el que ya volvía
 * una categoría recién creada.
 */
export default function ElegirCategoria({
  tipo,
  actual,
  onBack,
  onCrear,
  onEditar,
}: {
  tipo: "expense" | "income";
  /** La que está puesta ahora, para marcarla y no perder de vista cuál es. */
  actual: string;
  onBack: () => void;
  onCrear: () => void;
  /** Solo se llama con una categoría propia elegida. */
  onEditar: (id: string) => void;
}) {
  const { t, categoriasPropias, elegirCategoriaEnMovimiento } = useAppData();
  const insets = useSafeAreaInsets();

  // Las de la app MÁS las que creó la persona. Se recalcula cuando cambian
  // porque desde aquí mismo se puede crear una, y tiene que aparecer al volver.
  const cats = useMemo(
    () => (tipo === "expense" ? gastosDisponibles() : ingresosDisponibles()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tipo, categoriasPropias]
  );

  /** Elegir y volver en el mismo gesto: nadie quiere confirmar una elección. */
  function elegir(id: string) {
    elegirCategoriaEnMovimiento(id);
    onBack();
  }

  return (
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
      <View className="px-5 pt-3 pb-2 flex-row items-center gap-2">
        <TouchableOpacity onPress={onBack} className="w-9 h-9 items-center justify-center -ml-2">
          <ChevronLeft size={24} color="#94a3b8" />
        </TouchableOpacity>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          {t("elegirCat.title")}
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 28 }}
      >
        {/* Mismas medidas y colores que tenía en el movimiento (21% de ancho,
            cuadro de 48 puntos): la cuadrícula se mudó de sitio, no cambió de
            aspecto. Quien ya sabía usarla la reconoce. */}
        <View className="flex-row flex-wrap gap-3">
          {cats.map((c) => {
            const active = actual === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => elegir(c.id)}
                className="items-center gap-1.5"
                style={{ width: "21%" }}
              >
                <View
                  className={`w-12 h-12 rounded-2xl items-center justify-center bg-${c.color}-100 ${
                    active ? `border-2 border-${c.color}-500` : ""
                  }`}
                >
                  <CategoryAvatar id={c.id} size={20} />
                </View>
                <Text
                  className={`text-xs font-bold text-center ${
                    active ? `text-${c.color}-600` : "text-slate-600 dark:text-slate-200"
                  }`}
                  numberOfLines={1}
                >
                  {t(c.label)}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* CREAR UNA PROPIA.
              Sigue DENTRO de la cuadrícula, como una casilla más, y no en un
              botón aparte debajo: es donde la persona ya está mirando justo
              cuando descubre que la suya no está. Si desapareciera de aquí no
              quedaría ningún camino para crear una, porque el cuadrito "Nueva"
              del movimiento se fue con la cuadrícula. */}
          <TouchableOpacity onPress={onCrear} className="items-center gap-1.5" style={{ width: "21%" }}>
            <View className="w-12 h-12 rounded-2xl items-center justify-center border-2 border-dashed border-emerald-400">
              <Plus size={20} color="#059669" />
            </View>
            <Text className="text-xs font-bold text-center text-emerald-600" numberOfLines={1}>
              {t("nuevaCat.boton")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* EDITAR LA PROPIA QUE ESTÉ ELEGIDA.
            Solo aparece con una categoría tuya seleccionada, y por eso no
            estorba: el resto del tiempo no está. Se descarta el toque largo a
            propósito — es invisible, y quien no lo sepa no encuentra nunca cómo
            cambiar lo que acaba de crear. */}
        {esPropia(actual) && (
          <TouchableOpacity
            onPress={() => onEditar(actual)}
            className="flex-row items-center justify-center gap-1.5 mt-5 pt-4 border-t-[1.5px] border-slate-200 dark:border-slate-700"
          >
            <Pencil size={13} color="#64748b" />
            <Text className="text-xs font-bold text-slate-600 dark:text-slate-200">
              {t("nuevaCat.editarEsta", { nombre: catInfo(actual).label })}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
