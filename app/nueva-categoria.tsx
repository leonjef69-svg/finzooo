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
 *   con "actual"  → se puede ELEGIR una de las que ya existen, y además crear,
 *                   retocar y borrar. Es como se entra desde el botón del
 *                   movimiento, y es el modo normal.
 *   con "id"      → se EDITA esa categoría, sola y sin lista.
 *   sin nada      → solo crear.
 *
 * EL MODO "id" YA NO SE USA DESDE NINGÚN SITIO (07/08/2026), y se conserva a
 * propósito: es el que hace que esta pantalla sepa editar UNA categoría sin más
 * contexto, y es la puerta que haría falta el día que se quiera llegar aquí desde
 * el historial o desde un reporte. Todo lo que antes obligaba a entrar por ahí
 * —cambiarle el nombre, el dibujo, el color, quitarle la foto, borrarla— se hace
 * ahora en la lista, que es donde la persona está mirando.
 *
 * La elegida vuelve por el contexto y no por una propiedad: son dos pantallas
 * distintas. Ver elegirCategoriaEnMovimiento.
 */
export default function NuevaCategoriaRoute() {
  const { tipo, id, actual, editar } = useLocalSearchParams<{
    tipo?: string;
    id?: string;
    actual?: string;
    editar?: string;
  }>();
  const { elegirCategoriaEnMovimiento } = useAppData();
  const suTipo = tipo === "income" ? "income" : "expense";

  return (
    <NuevaCategoria
      tipo={suTipo}
      editandoId={id}
      actual={actual}
      editarDirecto={editar === "1"}
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
    />
  );
}
