import { router } from "expo-router";
import AddChooser from "@/screens/AddChooser";
import { safeBack } from "@/utils/nav";

// A diferencia de otras hojas de esta app, esta ruta SOLO se abre desde el
// botón "+" de Inicio (verificado: es la única llamada a este archivo en
// todo el proyecto) — nunca se llega aquí "huérfano" (por ejemplo, por un
// enlace directo sin pasar por Inicio). Por eso NO usa
// useRedirectIfOrphaned: ese guard deja la pantalla sin dibujar nada
// durante el primer instante mientras confirma que la navegación está
// lista, y como aquí ese caso nunca ocurre, lo único que lograba era un
// destello vacío garantizado cada vez que se abría este panel. safeBack()
// ya tiene su propio respaldo (vuelve a Inicio si no hay a dónde volver),
// así que la protección de fondo se mantiene sin necesitar bloquear el
// primer render.
export default function ChooseTransactionTypeRoute() {
  return (
    <AddChooser
      onClose={safeBack}
      onPick={(type) => router.push(`/transaction/new?type=${type}`)}
    />
  );
}
