import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Minus, Plus } from "lucide-react-native";
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

/**
 * EL MARCO TIENE LA FORMA DEL ICONO DE VERDAD, Y ESO ES EL PUNTO.
 *
 * Era un círculo, heredado de cuando las categorías se dibujaban redondas. Las
 * categorías son cuadrados de esquinas redondeadas desde el 03/08/2026, así que
 * el marco enseñaba una forma y el resultado salía en otra: encuadrabas una cara
 * en un círculo y en la lista aparecía con las esquinas puestas.
 *
 * La proporción sale de las casillas reales: 16 puntos de redondeo en una
 * casilla de ~55, y 24 en la vista previa de 80. Las dos dan casi 0,3, así que
 * el marco a 0,3 es la MISMA forma a otro tamaño.
 */
const REDONDEO = 0.3;

/** Lo máximo que se puede acercar. */
const ZOOM_MAX = 4;
const ZOOM_MIN = 1;
/** Cuánto acerca cada toque a los botones − y +. */
const PASO_ZOOM = 0.25;

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

export type CropResult = { uri: string; base64: string };

/** Deja el zoom dentro de lo permitido. */
export function limitarZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM_MIN;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}

/**
 * Hasta dónde se puede arrastrar sin dejar un hueco en blanco en el marco.
 *
 * ESTO SE SEPARÓ POR UN FALLO REAL: el arrastre de la pantalla no tenía tope,
 * pero el recorte SÍ. Así que arrastrando de más se veía la imagen corrida
 * —incluso con un borde vacío— y al guardar salía otra cosa, porque el recorte
 * se había topado por su cuenta. La promesa de esta ventana es "lo que ves es
 * lo que se guarda", y solo se cumple si las dos usan el mismo tope.
 */
export function limitarPan(
  anchoReal: number,
  altoReal: number,
  zoom: number,
  panX: number,
  panY: number,
  ventana = VENTANA
): { x: number; y: number } {
  // La imagen se dibuja "cubriendo" el marco: se agranda hasta que el lado
  // corto lo llena, y lo que sobra del lado largo se sale por los bordes.
  const escala = Math.max(ventana / anchoReal, ventana / altoReal) * zoom;
  const margenX = Math.max(0, (anchoReal * escala - ventana) / 2);
  const margenY = Math.max(0, (altoReal * escala - ventana) / 2);
  return {
    x: Math.max(-margenX, Math.min(margenX, panX)),
    y: Math.max(-margenY, Math.min(margenY, panY)),
  };
}

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
  const escalaBase = Math.max(ventana / anchoReal, ventana / altoReal);
  const escala = escalaBase * zoom;

  // El MISMO tope que usa el arrastre de la pantalla. Ver limitarPan.
  const { x, y } = limitarPan(anchoReal, altoReal, zoom, panX, panY, ventana);

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

  /**
   * ARRASTRAR CON UN DEDO, ACERCAR CON DOS.
   *
   * Va todo en un solo gesto porque los dedos entran y salen a mitad de camino:
   * se empieza arrastrando, se apoya el segundo dedo para acercar, se levanta y
   * se sigue arrastrando. Cada vez que cambia el número de dedos hay que VOLVER
   * A TOMAR la referencia; si no, la imagen da un salto en ese instante, que es
   * el fallo clásico de una pinza hecha a mano.
   */
  const gesto = useRef({ dedos: 0, pan: { x: 0, y: 0 }, zoom: 1, dist: 0, dx: 0, dy: 0 }).current;

  function separacion(dedos: { pageX: number; pageY: number }[]): number {
    const [a, b] = dedos;
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  }

  function tomarReferencia(dedos: { pageX: number; pageY: number }[], dx: number, dy: number) {
    gesto.dedos = dedos.length;
    gesto.pan = pan;
    gesto.zoom = zoom;
    gesto.dist = dedos.length >= 2 ? separacion(dedos) : 0;
    gesto.dx = dx;
    gesto.dy = dy;
  }

  const arrastre = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => tomarReferencia(e.nativeEvent.touches, 0, 0),
    onPanResponderMove: (e, g) => {
      const dedos = e.nativeEvent.touches;
      if (dedos.length !== gesto.dedos) {
        tomarReferencia(dedos, g.dx, g.dy);
        return;
      }
      if (dedos.length >= 2) {
        if (gesto.dist <= 0) return;
        // La proporción entre lo que se han separado los dedos y lo que estaban
        // al empezar. Separar el doble acerca el doble.
        setZoom(limitarZoom(gesto.zoom * (separacion(dedos) / gesto.dist)));
        return;
      }
      // Un dedo: mover. Se resta la referencia porque g.dx cuenta desde el
      // principio del gesto, y el gesto pudo empezar con dos dedos.
      if (!tam) return;
      setPan(
        limitarPan(
          tam.w,
          tam.h,
          zoom,
          gesto.pan.x + (g.dx - gesto.dx),
          gesto.pan.y + (g.dy - gesto.dy),
          VENTANA
        )
      );
    },
    onPanResponderRelease: () => {
      gesto.dedos = 0;
    },
  });

  /**
   * Acerca o aleja de a pasos, para quien no puede hacer la pinza.
   *
   * Al alejar hay que volver a topar el arrastre: con menos zoom la imagen
   * ocupa menos, así que un arrastre que antes era válido ahora dejaría un
   * borde vacío.
   */
  function cambiarZoom(hacia: number) {
    const nuevo = limitarZoom(zoom + hacia);
    setZoom(nuevo);
    if (tam) setPan(limitarPan(tam.w, tam.h, nuevo, pan.x, pan.y, VENTANA));
  }

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

      {/* EL MARCO, con la forma exacta del icono. Lo que quede dentro es lo que
          se recorta y lo que se verá. Ver REDONDEO. */}
      <View
        style={{ width: VENTANA, height: VENTANA, borderRadius: VENTANA * REDONDEO }}
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

      {/* El zoom de a pasos. Está además de la pinza, no en su lugar: la pinza
          es lo natural, pero con una sola mano ocupada no se puede hacer. */}
      <View className="flex-row items-center gap-4 mt-6">
        <TouchableOpacity
          onPress={() => cambiarZoom(-PASO_ZOOM)}
          disabled={zoom <= ZOOM_MIN}
          className={`w-11 h-11 rounded-full items-center justify-center border-[1.5px] border-slate-600 ${
            zoom <= ZOOM_MIN ? "opacity-40" : ""
          }`}
        >
          <Minus size={20} color="#e2e8f0" strokeWidth={2.6} />
        </TouchableOpacity>
        <Text className="text-white text-sm font-bold w-14 text-center">
          {zoom.toFixed(1)}x
        </Text>
        <TouchableOpacity
          onPress={() => cambiarZoom(PASO_ZOOM)}
          disabled={zoom >= ZOOM_MAX}
          className={`w-11 h-11 rounded-full items-center justify-center border-[1.5px] border-slate-600 ${
            zoom >= ZOOM_MAX ? "opacity-40" : ""
          }`}
        >
          <Plus size={20} color="#e2e8f0" strokeWidth={2.6} />
        </TouchableOpacity>
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
