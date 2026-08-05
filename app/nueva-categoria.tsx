import { router, useLocalSearchParams } from "expo-router";
import NuevaCategoria from "@/screens/NuevaCategoria";
import { safeBack } from "@/utils/nav";

/**
 * Crear o editar una categoría propia.
 *
 * Se llega EMPUJANDO (push) encima de "Nuevo movimiento", no en su lugar. Es
 * a propósito: así la pantalla de agregar sigue viva debajo con el monto y la
 * fecha que ya se hubieran escrito, y al volver no hay que rellenarlos otra
 * vez. Al crear la categoría, esa misma pantalla la deja elegida sola —
 * ver categoriaRecienCreada en el contexto.
 *
 * Con "id" se edita esa categoría; sin él se crea una nueva.
 */
export default function NuevaCategoriaRoute() {
  const { tipo, id } = useLocalSearchParams<{ tipo?: string; id?: string }>();
  return (
    <NuevaCategoria
      tipo={tipo === "income" ? "income" : "expense"}
      editandoId={id}
      onBack={safeBack}
      onCreada={() => router.back()}
    />
  );
}
