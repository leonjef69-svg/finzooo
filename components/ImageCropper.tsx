import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useBackClose } from "@/utils/useBackClose";

/**
 * Recorta una imagen a un cuadrado, con zoom y arrastre.
 *
 * CÓMO FUNCIONA
 *
 * Se ve una ventana cuadrada con la imagen dentro. El deslizador la acerca y
 * se puede arrastrar para encuadrarla. Al guardar, lo que se ve en la ventana
 * es exactamente lo que se recorta.
 *
 * LO QUE HAY QUE CALCULAR BIEN
 *
 * La imagen se enseña en una ventana de unos 240 puntos, pero el archivo
 * puede ser de 4000 píxeles de ancho. El recorte hay que pedirlo en píxeles
 * del ARCHIVO, no en lo que se ve. Confundir las dos medidas es el error
 * clásico aquí: el recorte sale desplazado, y con una cara encuadrada sale
 * media frente.
 *
 * Por eso todo se calcula en una sola conversión, al final, y se topa a los
 * bordes reales de la imagen: pedir un recorte que se salga hace fallar la
 * operación entera en vez de recortar lo que se pueda.
 */

const VENTANA = 240;

/**
 * A cuántos píxeles se guarda la imagen recortada.
 *
 * Estaba en 128 y se veía como una mancha: el círculo grande de la pantalla
 * de personalizar mide unos 64 puntos, que en un celular normal son 192
 * píxeles reales. Se guardaba menos de lo que la pantalla iba a enseñar.
 *
 * PERO NO SE PUEDE SUBIR SIN MIRAR: la imagen se guarda dentro de los datos
 * de la cuenta, y TODA la copia de la nube va en un solo documento con un
 * tope de 1 MB. Cada imagen ocupa aproximadamente:
 *
 *    128 px, calidad 0.6  →   ~4 KB
 *    256 px, calidad 0.8  →  ~18 KB
 *    512 px, calidad 0.9  → ~110 KB   ← con seis ya se come medio MB
 *
 * 256 es cuatro veces más nítida y deja sitio de sobra. Si algún día se
 * suben más, hay que mirar antes cuántas categorías con foto caben junto a
 * los movimientos: pasarse del megabyte deja la copia sin guardarse.
 */
const LADO = 256;
const CALIDAD = 0.8;

// Los pasos del zoom. Cinco y no un control continuo: en un circulito de 240
// puntos, la diferencia entre 1.6 y 1.7 no se aprecia, y con pasos se acierta
// a la primera sin pelearse con el dedo.
const PASOS_ZOOM = [1, 1.5, 2, 2.5, 3];

export type CropResult = { uri: string; base64: string };

/**
 * De lo que se ve en pantalla a píxeles del archivo.
 *
 * Se separa para poder comprobarlo: que el recorte caiga donde se ve es una
 * cuenta, no algo que se pueda mirar a ojo.
 */
export function cropRect(
  anchoReal: number,
  altoReal: number,
  zoom: number,
  panX: number,
  panY: number,
  ventana = VENTANA
): { originX: number; originY: number; width: number; height: number } {
  // La imagen se dibuja "cubriendo" la ventana: se agranda hasta que el lado
  // corto la llena, y lo que sobra del lado largo se sale por los bordes.
  const escalaBase = Math.max(ventana / anchoReal, ventana / altoReal);
  const escala = escalaBase * zoom;

  // Lo que ocupa la imagen en pantalla, ya con el zoom puesto.
  const anchoEnPantalla = anchoReal * escala;
  const altoEnPantalla = altoReal * escala;

  // Cuánto puede moverse antes de dejar un hueco en blanco.
  const margenX = Math.max(0, (anchoEnPantalla - ventana) / 2);
  const margenY = Math.max(0, (altoEnPantalla - ventana) / 2);
  const x = Math.max(-margenX, Math.min(margenX, panX));
  const y = Math.max(-margenY, Math.min(margenY, panY));

  // La esquina de la ventana, llevada a píxeles del archivo.
  const lado = ventana / escala;
  const originX = (anchoReal - lado) / 2 - x / escala;
  const originY = (altoReal - lado) / 2 - y / escala;

  // Se topa a los bordes: pedir un recorte que se salga hace fallar la
  // operación entera, y entonces no se recorta nada.
  return {
    originX: Math.round(Math.max(0, Math.min(anchoReal - lado, originX))),
    originY: Math.round(Math.max(0, Math.min(altoReal - lado, originY))),
    width: Math.round(Math.min(lado, anchoReal)),
    height: Math.round(Math.min(lado, altoReal)),
  };
}

export default function ImageCropper({
  uri,
  onCancel,
  onDone,
  labels,
}: {
  uri: string;
  onCancel: () => void;
  onDone: (r: CropResult) => void;
  labels: { title: string; hint: string; cancel: string; save: string; error: string };
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [inicio, setInicio] = useState({ x: 0, y: 0 });
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // Atras cierra el recorte y deja debajo la pantalla de la categoria, en vez
  // de salirse de las dos de golpe.
  useBackClose(onCancel);

  // El tamaño real del archivo. Sin él no se puede convertir lo que se ve a
  // píxeles, así que hasta que llegue no se deja guardar.
  //
  // Va en un efecto y no suelto en el dibujado: ahí se pediría otra vez en
  // cada redibujado —y cada respuesta provoca uno—, así que se quedaría
  // preguntando el tamaño en bucle mientras la ventana esté abierta.
  useEffect(() => {
    let vivo = true;
    Image.getSize(
      uri,
      (w, h) => vivo && setTam({ w, h }),
      () => vivo && setError(labels.error)
    );
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  const arrastre = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => setInicio(pan),
    onPanResponderMove: (_, g) => setPan({ x: inicio.x + g.dx, y: inicio.y + g.dy }),
  });

  async function guardar() {
    if (!tam || guardando) return;
    setGuardando(true);
    setError("");
    try {
      const r = cropRect(tam.w, tam.h, zoom, pan.x, pan.y);
      const ctx = ImageManipulator.manipulate(uri).crop(r).resize({ width: LADO, height: LADO });
      const rendered = await ctx.renderAsync();
      const saved = await rendered.saveAsync({
        base64: true,
        compress: CALIDAD,
        format: SaveFormat.JPEG,
      });
      if (!saved.base64) throw new Error("sin imagen");
      onDone({ uri: saved.uri, base64: `data:image/jpeg;base64,${saved.base64}` });
    } catch {
      setError(labels.error);
    } finally {
      setGuardando(false);
    }
  }

  const escalaBase = tam ? Math.max(VENTANA / tam.w, VENTANA / tam.h) : 1;
  const escala = escalaBase * zoom;

  return (
    <View className="absolute inset-0 z-50 bg-slate-900/95 items-center justify-center px-6">
      <Text className="text-white font-extrabold text-base mb-1">{labels.title}</Text>
      <Text className="text-slate-300 text-xs mb-5 text-center">{labels.hint}</Text>

      {/* La ventana. Lo que quede dentro es lo que se recorta. */}
      <View
        style={{ width: VENTANA, height: VENTANA, borderRadius: VENTANA / 2 }}
        className="overflow-hidden bg-slate-800 border-[3px] border-white"
        {...arrastre.panHandlers}
      >
        {tam && (
          <Image
            source={{ uri }}
            style={{
              width: tam.w * escala,
              height: tam.h * escala,
              transform: [
                { translateX: pan.x - (tam.w * escala - VENTANA) / 2 },
                { translateY: pan.y - (tam.h * escala - VENTANA) / 2 },
              ],
            }}
          />
        )}
      </View>

      {/* El zoom. Ver PASOS_ZOOM. */}
      <View className="flex-row items-center gap-2 mt-6">
        <Text className="text-slate-400 text-xs">−</Text>
        {PASOS_ZOOM.map((z) => (
          <TouchableOpacity
            key={z}
            onPress={() => setZoom(z)}
            className={`w-9 h-9 rounded-full items-center justify-center border-[1.5px] ${
              zoom === z ? "bg-emerald-600 border-emerald-600" : "border-slate-600"
            }`}
          >
            <Text className={`text-[11px] font-bold ${zoom === z ? "text-white" : "text-slate-300"}`}>
              {z}x
            </Text>
          </TouchableOpacity>
        ))}
        <Text className="text-slate-400 text-xs">+</Text>
      </View>

      {error !== "" && <Text className="text-rose-400 text-xs mt-4">{error}</Text>}

      <View className="flex-row gap-3 mt-7 w-full">
        <TouchableOpacity
          onPress={onCancel}
          className="flex-1 py-3.5 rounded-2xl items-center border-[1.5px] border-slate-600"
        >
          <Text className="text-slate-300 font-bold">{labels.cancel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={guardar}
          disabled={!tam || guardando}
          className={`flex-1 py-3.5 rounded-2xl items-center bg-emerald-600 ${
            !tam || guardando ? "opacity-60" : ""
          }`}
        >
          {guardando ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-white font-extrabold">{labels.save}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
