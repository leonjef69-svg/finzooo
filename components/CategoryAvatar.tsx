import { Image, Text, View } from "react-native";
import { catInfo } from "@/constants/categories";

/**
 * El circulito de una categoría: su imagen propia si la tiene, y si no, su
 * emoji.
 *
 * Existe para no repetir ese "si tiene imagen, imagen; si no, emoji" en los
 * seis sitios donde se dibuja una categoría. Repetido, basta con que alguien
 * añada un séptimo y se olvide para que ahí siga saliendo el emoji viejo
 * mientras en el resto de la app ya está la foto — y eso se descubre tarde y
 * por casualidad.
 */
export default function CategoryAvatar({
  id,
  size = 20,
}: {
  id: string;
  /** El tamaño de la letra del emoji. La imagen se ajusta a él. */
  size?: number;
}) {
  const c = catInfo(id);
  if (!c.image) return <Text style={{ fontSize: size }}>{c.emoji}</Text>;

  // La imagen se hace un poco más grande que la letra: un emoji deja aire
  // alrededor y una foto no, así que a igual tamaño la foto se veía pequeña
  // al lado de los emojis de las categorías de al lado.
  const lado = Math.round(size * 1.35);
  return (
    <View
      style={{ width: lado, height: lado, borderRadius: lado / 2 }}
      className="overflow-hidden bg-slate-100 dark:bg-slate-700"
    >
      <Image source={{ uri: c.image }} style={{ width: lado, height: lado }} />
    </View>
  );
}
