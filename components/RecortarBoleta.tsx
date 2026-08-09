import { useRef, useState } from "react";
import { ActivityIndicator, Image, PanResponder, Text, TouchableOpacity, View } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Check, X } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";
import { encajar, imagenDentroDelHueco, recorteEnPixeles, MINIMO, type Rect } from "@/utils/recorte";

/**
 * RECORTAR LA BOLETA ANTES DE LEERLA.
 *
 * Sustituye al recortador de Android (`allowsEditing`). El motivo es suyo y es concreto: *"ese
 * cuadro sigue siendo de color blanco, no se ve nada cuando se recorta la imagen"*. Ese
 * recuadro lo pintaba el sistema, y su celular lo dibuja en blanco sobre una foto que también
 * es blanca — el papel. No había forma de cambiarlo desde la app.
 *
 * POR QUÉ ESTE SÍ SE VE, PASE LO QUE PASE
 *
 * No basta con elegir un color bonito: la foto puede ser de cualquier color. Se ve por tres
 * cosas a la vez, y cada una tapa el fallo de la otra:
 *
 *   1. Lo de FUERA se oscurece. El recuadro se distingue aunque el borde no se viera.
 *   2. El borde es GRUESO y verde, con las esquinas marcadas aparte.
 *   3. Las esquinas son ademas el sitio por donde se estira, así que el dibujo que se ve y el
 *      sitio donde hay que poner el dedo son el mismo.
 *
 * LAS CUENTAS NO ESTÁN AQUÍ. Viven en utils/recorte para poder comprobarlas con números: que
 * el recorte caiga donde se ve no se puede mirar a ojo, y si sale corrido se lleva el total.
 */
export default function RecortarBoleta({
  uri,
  anchoImagen,
  altoImagen,
  onCancelar,
  onListo,
}: {
  uri: string;
  anchoImagen: number;
  altoImagen: number;
  onCancelar: () => void;
  onListo: (uri: string, ancho: number, alto: number) => void;
}) {
  const { t } = useAppData();
  const [hueco, setHueco] = useState({ ancho: 0, alto: 0 });
  const [seleccion, setSeleccion] = useState<Rect | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const dibujo = imagenDentroDelHueco(anchoImagen, altoImagen, hueco.ancho, hueco.alto);

  /**
   * El recuadro mientras el dedo lo mueve.
   *
   * Va en una referencia y no en el estado porque el gesto necesita saber DE DÓNDE partió, y el
   * estado dentro de un gesto se queda con el valor de cuando empezó. Con el estado, arrastrar
   * daba saltos.
   */
   const alEmpezar = useRef<Rect | null>(null);

  function empezar() {
    alEmpezar.current = seleccion;
  }

  function mover(dx: number, dy: number) {
    const base = alEmpezar.current;
    if (!base) return;
    setSeleccion(encajar({ ...base, x: base.x + dx, y: base.y + dy }, dibujo));
  }

  /** Estira desde una esquina. Las de arriba y las de la izquierda mueven además el origen. */
  function estirar(esquina: "ai" | "ad" | "bi" | "bd", dx: number, dy: number) {
    const base = alEmpezar.current;
    if (!base) return;
    const izquierda = esquina === "ai" || esquina === "bi";
    const arriba = esquina === "ai" || esquina === "ad";
    const ancho = Math.max(MINIMO, izquierda ? base.ancho - dx : base.ancho + dx);
    const alto = Math.max(MINIMO, arriba ? base.alto - dy : base.alto + dy);
    setSeleccion(
      encajar(
        {
          ancho,
          alto,
          x: izquierda ? base.x + (base.ancho - ancho) : base.x,
          y: arriba ? base.y + (base.alto - alto) : base.y,
        },
        dibujo
      )
    );
  }

  const gestoMover = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => empezar(),
      onPanResponderMove: (_e, g) => mover(g.dx, g.dy),
    })
  ).current;

  const gestoEsquina = (esquina: "ai" | "ad" | "bi" | "bd") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => empezar(),
      onPanResponderMove: (_e, g) => estirar(esquina, g.dx, g.dy),
    }).panHandlers;

  async function confirmar() {
    if (!seleccion || trabajando) return;
    setTrabajando(true);
    try {
      const zona = recorteEnPixeles(seleccion, dibujo, anchoImagen, altoImagen);
      const hecho = await ImageManipulator.manipulate(uri).crop(zona).renderAsync();
      const guardado = await hecho.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
      onListo(guardado.uri, zona.width, zona.height);
    } catch {
      // SI EL RECORTE FALLA SE SIGUE CON LA FOTO ENTERA. Leerla con la mesa dentro es peor que
      // recortarla, pero muchísimo mejor que dejar a la persona con una pantalla muerta y la
      // foto ya tomada.
      onListo(uri, anchoImagen, altoImagen);
    }
  }

  return (
    <View className="flex-1 bg-black">
      <View className="flex-row items-center justify-between px-5 pt-14 pb-3">
        <TouchableOpacity onPress={onCancelar} className="w-10 h-10 items-center justify-center">
          <X size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text className="text-sm font-bold text-white">{t("recorte.titulo")}</Text>
        <View className="w-10" />
      </View>

      <View
        className="flex-1"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setHueco({ ancho: width, alto: height });
          // EL RECUADRO ARRANCA CASI LLENO, no en un cuadradito en medio: en una boleta lo
          // normal es querer casi toda la foto y recortar un poco los bordes. Empezar chico
          // obliga a estirar siempre.
          const d = imagenDentroDelHueco(anchoImagen, altoImagen, width, height);
          setSeleccion({
            x: d.x + d.ancho * 0.04,
            y: d.y + d.alto * 0.04,
            ancho: d.ancho * 0.92,
            alto: d.alto * 0.92,
          });
        }}
      >
        <Image source={{ uri }} style={{ flex: 1 }} resizeMode="contain" />

        {seleccion && (
          <>
            {/* LO DE FUERA, OSCURECIDO. Es lo que hace que el recuadro se vea aunque el borde
                cayera sobre algo del mismo color — que es exactamente lo que le pasaba con el
                recortador de Android sobre el papel blanco. */}
            <View
              pointerEvents="none"
              style={{ position: "absolute", left: 0, right: 0, top: 0, height: seleccion.y, backgroundColor: "rgba(0,0,0,0.62)" }}
            />
            <View
              pointerEvents="none"
              style={{ position: "absolute", left: 0, right: 0, top: seleccion.y + seleccion.alto, bottom: 0, backgroundColor: "rgba(0,0,0,0.62)" }}
            />
            <View
              pointerEvents="none"
              style={{ position: "absolute", left: 0, width: seleccion.x, top: seleccion.y, height: seleccion.alto, backgroundColor: "rgba(0,0,0,0.62)" }}
            />
            <View
              pointerEvents="none"
              style={{ position: "absolute", left: seleccion.x + seleccion.ancho, right: 0, top: seleccion.y, height: seleccion.alto, backgroundColor: "rgba(0,0,0,0.62)" }}
            />

            {/* EL RECUADRO. Se arrastra desde cualquier punto de dentro. */}
            <View
              {...gestoMover.panHandlers}
              style={{
                position: "absolute",
                left: seleccion.x,
                top: seleccion.y,
                width: seleccion.ancho,
                height: seleccion.alto,
                borderWidth: 3,
                borderColor: "#10b981",
              }}
            />

            {/* LAS ESQUINAS. Son el dibujo Y el sitio por donde se estira, así que lo que se ve
                y donde hay que poner el dedo son el mismo punto. El área que responde es más
                grande que el dibujo: una esquina de 3 puntos no se acierta con el dedo. */}
            {(
              [
                ["ai", seleccion.x, seleccion.y],
                ["ad", seleccion.x + seleccion.ancho, seleccion.y],
                ["bi", seleccion.x, seleccion.y + seleccion.alto],
                ["bd", seleccion.x + seleccion.ancho, seleccion.y + seleccion.alto],
              ] as const
            ).map(([esquina, cx, cy]) => (
              <View
                key={esquina}
                {...gestoEsquina(esquina)}
                style={{ position: "absolute", left: cx - 22, top: cy - 22, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
              >
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#10b981", borderWidth: 3, borderColor: "#ffffff" }} />
              </View>
            ))}
          </>
        )}
      </View>

      <View className="px-5 pb-10 pt-3">
        <Text className="text-[11px] leading-5 text-white/70 text-center mb-3">
          {t("recorte.ayuda")}
        </Text>
        <TouchableOpacity
          onPress={confirmar}
          disabled={trabajando}
          className="flex-row items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-600"
        >
          {trabajando ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Check size={18} color="#ffffff" />
              <Text className="text-sm font-bold text-white">{t("recorte.listo")}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
