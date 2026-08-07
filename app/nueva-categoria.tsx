import { router, useLocalSearchParams } from "expo-router";
import { useAppData } from "@/contexts/AppDataContext";
import NuevaCategoria from "@/screens/NuevaCategoria";
import { safeBack } from "@/utils/nav";

/**
 * Elegir la categoría de un movimiento, o crear una propia.
 *
 * Se llega EMPUJANDO (push) encima de "Nuevo movimiento", no en su lugar. Es a
 * propósito: así la pantalla de agregar sigue viva debajo con el monto y la
 * fecha que ya se hubieran escrito, y al volver no hay que rellenarlos otra vez.
 *
 * Los tres modos, y los deciden los parámetros:
 *
 *   con "actual"  → se puede ELEGIR una de las que ya existen, y además crear.
 *                   Es como se entra desde el botón del movimiento.
 *   con "id"      → se EDITA esa categoría. Sin lista: quien viene a cambiarle el
 *                   nombre a "Broster" no viene a elegir otra.
 *   sin nada      → solo crear.
 *
 * La elegida vuelve por el contexto y no por una propiedad: son dos pantallas
 * distintas. Ver elegirCategoriaEnMovimiento.
 */
export default function NuevaCategoriaRoute() {
  const { tipo, id, actual } = useLocalSearchParams<{
    tipo?: string;
    id?: string;
    actual?: string;
  }>();
  const { elegirCategoriaEnMovimiento } = useAppData();
  const suTipo = tipo === "income" ? "income" : "expense";

  return (
    <NuevaCategoria
      tipo={suTipo}
      editandoId={id}
      actual={actual}
      onBack={safeBack}
      onCreada={() => router.back()}
      // Sin "actual" no hay lista de la que elegir, así que tampoco hace falta
      // esto: es lo que distingue "vengo a poner la categoría de este gasto" de
      // "vengo a crear una".
      onElegir={
        actual
          ? (elegida) => {
              elegirCategoriaEnMovimiento(elegida);
              router.back();
            }
          : undefined
      }
      // Editar REEMPLAZA esta pantalla en vez de apilarse encima: al guardar, el
      // "atrás" deja directamente en el movimiento, que es donde hay que acabar.
      // Apilando haría falta un toque más para cerrar una lista que ya no sirve.
      onEditar={(suId) =>
        router.replace({ pathname: "/nueva-categoria", params: { tipo: suTipo, id: suId } })
      }
    />
  );
}
