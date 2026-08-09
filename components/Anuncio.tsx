import { View } from "react-native";
import { tocaVerAnuncios } from "@/constants/anuncios";
import { useAppData } from "@/contexts/AppDataContext";

/**
 * EL HUECO DE UN ANUNCIO. Solo aparece para quien no paga.
 *
 * Decisión suya del 08/08/2026: gratis con anuncios, Premium sin ellos.
 *
 * POR QUÉ ESTO ES UN COMPONENTE Y NO UN ANUNCIO PUESTO EN CADA PANTALLA
 *
 * Porque la regla "quien paga no ve anuncios" tiene que estar escrita **una sola vez**. Con la
 * comprobación repetida en cada sitio, basta que una pantalla nueva se olvide para que alguien
 * que pagó vea publicidad — y eso no es un fallo de dibujo, es cobrar por algo que no se
 * entregó. El usuario se entera antes que nadie y pide su plata de vuelta.
 *
 * MIENTRAS NO HAYA IDENTIFICADORES DE ADMOB, NO DIBUJA NADA. Ni un hueco gris, ni un marco
 * vacío: nada. Un espacio reservado "para cuando haya anuncios" es una mancha que la gente ve
 * y no entiende, y encima mueve el resto de la pantalla cuando por fin cargue.
 *
 * ---- EL BANNER DE VERDAD TODAVÍA NO ESTÁ, Y ES A PROPÓSITO ----
 *
 * Falta instalar `react-native-google-mobile-ads`, que es código de Android y obliga a compilar
 * un APK. Se hace UNA vez, cuando existan los identificadores. Este componente ya está en su
 * sitio para que ese día sea cambiar este archivo y nada más — ninguna pantalla se entera.
 */
export default function Anuncio() {
  const { isPremium } = useAppData();
  if (!tocaVerAnuncios(isPremium)) return null;

  // Aquí irá <BannerAd unitId={ADMOB_BANNER_ID} size={BannerAdSize.BANNER} /> cuando el APK
  // traiga la librería. La altura fija de 50 es la del banner estándar de AdMob: dejarla
  // puesta desde ahora evita que la pantalla dé un salto el día que el anuncio cargue.
  return <View className="w-full items-center" style={{ height: 50 }} />;
}
