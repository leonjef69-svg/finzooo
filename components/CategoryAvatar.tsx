import { Image, View } from "react-native";
import { catInfo } from "@/constants/categories";
import { COLOR_HEX_600 } from "@/constants/colors";

/**
 * El dibujo de una categoría: su foto propia si la tiene, y si no, su icono.
 *
 * ANTES ERA EL EMOJI, Y SE CAMBIÓ EL 03/08/2026
 *
 * La app enseñaba la misma categoría de dos maneras: emoji 🍔 al elegirla, e
 * icono de línea en Inicio y el Historial. La misma categoría, dos caras. Se
 * unificó al icono, que es el que se lee mejor en una cuadrícula y el que
 * permite tener MIL para elegir — con emojis no hay forma de ofrecer eso.
 *
 * Existe este componente para no repetir "si tiene foto, foto; si no, icono"
 * en los seis sitios donde se dibuja una categoría. Repetido, basta con que
 * alguien añada un séptimo y se olvide para que ahí siga saliendo lo viejo
 * mientras en el resto ya está lo nuevo — y eso se descubre tarde y por
 * casualidad. Ya pasó: la foto no salía en Inicio.
 */
export default function CategoryAvatar({
  id,
  size = 20,
}: {
  id: string;
  /** El tamaño del icono. La foto se ajusta a él. */
  size?: number;
}) {
  const c = catInfo(id);

  if (!c.image) {
    return <c.icon size={size} color={COLOR_HEX_600[c.color] || "#475569"} strokeWidth={2.2} />;
  }

  // La foto se hace un poco más grande que el icono: un icono deja aire
  // alrededor y una foto no, así que a igual tamaño la foto se veía pequeña
  // al lado de los iconos de las categorías de al lado.
  const lado = Math.round(size * 1.35);
  return (
    <View
      style={{ width: lado, height: lado, borderRadius: lado / 2 }}
      className="overflow-hidden bg-slate-100 dark:bg-noche-3"
    >
      <Image source={{ uri: c.image }} style={{ width: lado, height: lado }} />
    </View>
  );
}
