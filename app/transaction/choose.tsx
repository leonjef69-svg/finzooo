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
      // EN EL LUGAR DE ESTE PANEL, NO ENCIMA (10/08/2026).
      //
      // Antes se apilaba (`push`), así que al guardar había que deshacer DOS pantallas de una
      // vez —esta y la de "Nuevo movimiento"— para caer en Inicio. Android no sabe animar eso:
      // las quitaba de golpe, y el cambio a Inicio se sentía brusco, como un corte.
      //
      // Poniéndola en su lugar solo queda una pantalla que cerrar, y la anima el sistema: la
      // hoja se baja y aparece Inicio. Además, "volver" ya cae en Inicio por sí solo, que es lo
      // que se quería desde el principio y antes había que forzar con `dismissTo`.
      //
      // Es lo mismo que ya hacían la voz y el escáner, aquí debajo. Esta era la rara.
      onPick={(type) => router.replace(`/transaction/new?type=${type}`)}
      onVoice={() => router.replace("/voice")}
      onScan={() => router.replace("/scan-receipt")}
    />
  );
}
