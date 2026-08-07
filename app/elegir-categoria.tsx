import { router, useLocalSearchParams } from "expo-router";
import ElegirCategoria from "@/screens/ElegirCategoria";
import { safeBack } from "@/utils/nav";

/**
 * Elegir la categoría de un movimiento.
 *
 * Se llega EMPUJANDO (push) encima de "Nuevo movimiento", igual que la de crear
 * categorías: así la pantalla de agregar sigue viva debajo con el monto y la
 * fecha que ya se hubieran escrito, y al volver no hay que rellenarlos otra vez.
 * La elegida vuelve por el contexto (elegirCategoriaEnMovimiento).
 *
 * POR QUÉ "CREAR" Y "EDITAR" VAN CON REPLACE Y NO CON PUSH
 *
 * Porque después de crear una categoría, el sitio donde hay que acabar es el
 * MOVIMIENTO, no el selector: la recién creada ya queda elegida sola, así que
 * volver al selector solo obligaría a un toque más para cerrar algo que ya no
 * hace falta. Con replace, la pantalla de crear ocupa el lugar de esta, y su
 * "atrás" —el que se toca al guardar, al borrar o al cambiar de idea— deja
 * directamente en el movimiento.
 *
 * Se descartó pedir dos "atrás" seguidos: encadenar dos órdenes de navegación en
 * el mismo instante es justo el tipo de cosa que funciona en la computadora y
 * falla a medias en el celular.
 */
export default function ElegirCategoriaRoute() {
  const { tipo, actual } = useLocalSearchParams<{ tipo?: string; actual?: string }>();
  return (
    <ElegirCategoria
      tipo={tipo === "income" ? "income" : "expense"}
      actual={actual ?? ""}
      onBack={safeBack}
      onCrear={() =>
        router.replace({
          pathname: "/nueva-categoria",
          params: { tipo: tipo === "income" ? "income" : "expense" },
        })
      }
      onEditar={(id) =>
        router.replace({
          pathname: "/nueva-categoria",
          params: { tipo: tipo === "income" ? "income" : "expense", id },
        })
      }
    />
  );
}
