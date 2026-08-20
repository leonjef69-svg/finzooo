import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Keyboard, Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardAnimatedPadding } from "@/utils/keyboard";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check, ChevronLeft, ImageIcon, Star, Trash2, X } from "lucide-react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import ImageCropper from "@/components/ImageCropper";
import { catInfo, gastosDisponibles, ingresosDisponibles } from "@/constants/categories";
import {
  ALTO_TITULO,
  CATALOGO_EN_TROZOS,
  enFilas,
  FILAS_AL_ABRIR,
  FILAS_POR_TANDA,
  LADO_DE,
  SEPARACION,
} from "@/constants/catalogoFilas";
import { COLOR_HEX_100, COLOR_HEX_500, COLOR_HEX_600 } from "@/constants/colors";
import { iconoDe, TODOS_LOS_GRUPOS } from "@/constants/iconos";
import { CARD_SHADOW } from "@/constants/style";
import { useAppData } from "@/contexts/AppDataContext";

import { esPropia, nombreRepetido } from "@/utils/categoriasPropias";
import { alternar, esFoto, getFavoritos } from "@/utils/iconosFavoritos";
import { sanitizeName } from "@/utils/categoryCustom";

/**
 * Cuánto se espera antes de dibujar el resto del catálogo.
 *
 * Es lo que dura la animación de entrada de una pantalla en Android. Antes de eso, el
 * trabajo la atropella y el cambio de pantalla se ve a trompicones; mucho después, un
 * deslizón muy rápido podría llegar al final de lo ya dibujado. Ver gruposADibujar.
 */
const ESPERA_RESTO_MS = 350;

/**
 * Cuánto tiene que llevar la pantalla sin que nadie la toque para que el reparto del
 * catálogo siga. Ver filasADibujar.
 *
 * Medio segundo es lo que dura el hueco entre dos toques de alguien que está eligiendo.
 * Con menos, una tanda se cuela justo entre toque y toque; con mucho más, quien se queda
 * mirando la pantalla sin decidirse retrasaría el reparto sin motivo.
 */
const QUIETO_MS = 500;

/**
 * Cuándo se tocó una casilla por última vez.
 *
 * Va en un objeto de módulo y no en un estado a propósito: apuntar la hora del toque NO
 * TIENE QUE REDIBUJAR NADA. Si esto fuera un estado, cada toque rehacía la pantalla, que
 * es exactamente el coste que se está quitando.
 */
const ULTIMO_TOQUE = { cuando: 0 };

/**
 * QUIÉN ESTÁ MARCADO AHORA MISMO. UN SOLO SITIO LO SABE, Y AQUÍ ESTÁ EL ARREGLO DE LOS
 * DOS ICONOS MARCADOS A LA VEZ (07/08/2026).
 *
 * El fallo, con su foto: al cambiar de icono se veían **los dos marcados** —el viejo y el
 * nuevo— mientras el dedo estaba apoyado.
 *
 * Y era culpa del arreglo anterior. Cada casilla se pintaba ella misma al ser tocada, con
 * su propio estado, para que fuera instantáneo. Pero con el estado dentro de cada casilla,
 * **la casilla vieja no tenía cómo enterarse** de que ya no era la elegida hasta que el
 * dedo se levantaba y la pantalla entera se rehacía. Instantáneo para encenderse, tarde
 * para apagarse.
 *
 * Ahora la marca vive en UN solo sitio, fuera de React, y las casillas se apuntan para
 * que les avisen. Al avisar, cada una vuelve a mirar UNA pregunta: *"¿soy yo la marcada?"*
 * Para 225 la respuesta no cambia y no se rehacen; para dos sí —la que se apaga y la que
 * se enciende— y esas dos son las únicas que se rehacen. Sigue siendo instantáneo y ya no
 * hay dos marcadas nunca.
 *
 * POR QUÉ NO ES UN ESTADO NORMAL DE LA PANTALLA: porque un estado de la pantalla rehace la
 * pantalla, y eso es exactamente lo que costaba los segundos que se acaban de quitar. Este
 * canal avisa solo a las dos casillas que cambian, sin tocar nada más.
 *
 * Y POR QUÉ LAS FILAS YA NO RECIBEN "elegido": porque ya no lo necesitan. Antes había que
 * pasarles cuál estaba elegido y las filas afectadas se rehacían. Ahora la marca no pasa
 * por las filas, así que **ninguna fila se rehace al elegir**.
 */
let marcaActual: string | null = null;

/**
 * EL ASPECTO DE LA CASILLA MARCADA, Y EL COLOR CON EL QUE SE PINTÓ.
 *
 * Viaja por aquí y no como propiedad de las filas, y ese es el arreglo de la lentitud al
 * cambiar de color (07/08/2026). Antes el aspecto del color se le pasaba a las 46 filas y de
 * ahí a las 227 casillas, así que **tocar un color rehacía las 227** — con el catálogo ni a
 * la vista, estando en la pestaña de Color.
 *
 * Aquí solo lo mira la que está marcada. El nombre del color va al lado porque es lo que le
 * dice a esa casilla que algo cambió: las demás siguen contestando lo mismo y no se rehacen.
 * Ver la respuesta que da cada casilla en Dibujito.
 */
let colorDeLaMarca = "";
let aspectoDeLaMarca: { elegida: ViewStyle; tinta: string } | null = null;

const oyentesDeLaMarca = new Set<() => void>();

/** Cambia la marca y avisa. Si no cambia nada, no avisa: 227 avisos de balde. */
function ponerMarca(id: string | null) {
  if (marcaActual === id) return;
  marcaActual = id;
  oyentesDeLaMarca.forEach((avisar) => avisar());
}

/** Cambia el aspecto del color y avisa. Solo se entera la casilla marcada. */
function ponerAspectoDeLaMarca(color: string, aspecto: { elegida: ViewStyle; tinta: string }) {
  if (colorDeLaMarca === color && aspectoDeLaMarca !== null) return;
  colorDeLaMarca = color;
  aspectoDeLaMarca = aspecto;
  oyentesDeLaMarca.forEach((avisar) => avisar());
}

/** Lo mismo SIN avisar, para el primer dibujado. Ver apuntarMarca. */
function apuntarAspectoDeLaMarca(color: string, aspecto: { elegida: ViewStyle; tinta: string }) {
  colorDeLaMarca = color;
  aspectoDeLaMarca = aspecto;
}

/**
 * Apunta la marca SIN avisar a nadie.
 *
 * Es para el primer dibujado de la pantalla, y hace falta que sea sin avisar: avisar
 * mientras React está dibujando es un error. En ese momento tampoco hay a quién avisar
 * —las casillas todavía no existen— y así la marca ya está puesta cuando nacen, sin el
 * parpadeo de "primero sin marca y un instante después con marca".
 */
function apuntarMarca(id: string | null) {
  marcaActual = id;
}

function escucharLaMarca(avisar: () => void) {
  oyentesDeLaMarca.add(avisar);
  return () => {
    oyentesDeLaMarca.delete(avisar);
  };
}

/**
 * ESTO ERA EL MEDIDOR TEMPORAL, Y YA SE QUITÓ (7ago-22).
 *
 * Se deja escrito lo que dijo, porque es de donde salen las medidas de este archivo y
 * sin esto parecerían números elegidos a dedo:
 *
 *   · Primer toque con todo el catálogo en un golpe: **6000 ms**.
 *   · Con tandas de dos grupos: **136 a 353 ms**, y armar el resto tardaba **2400 a
 *     2800 ms** en total.
 *   · Filas rehechas por toque: **2**. O sea que la memorización sí funciona en el
 *     celular y por ahí no había nada que buscar.
 *
 * Y la lección: el medidor encontró en dos intentos lo que siete lecturas del código no
 * encontraron. Si algo vuelve a ir lento aquí, lo primero es medir, no leer.
 */
// Los mismos de personalizar categorias, para que una categoria propia no
// pueda tener un color que las de fabrica no tienen.
const COLORES = [
  "rose",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "fuchsia",
  "pink",
  "stone",
  "slate",
];

/**
 * El aspecto de una casilla, ya calculado. Ver por qué en AspectoCasilla.
 */
type AspectoCasilla = {
  /** Sin elegir: fondo y borde grises, con la medida dentro. */
  normal: ViewStyle;
  /** Elegida: fondo y borde del color de la categoría. */
  elegida: ViewStyle;
  /** Con qué color se pinta el dibujo cuando está elegido. */
  tinta: string;
};

/**
 * Calcula ese aspecto UNA vez para las 236 casillas.
 *
 * ESTE ES EL ARREGLO DE LA LENTITUD (07/08/2026)
 *
 * Cada casilla llevaba su aspecto en clases de NativeWind. Un componente con clases
 * se apunta al sistema de estilos para enterarse de los cambios de tema, y resuelve
 * su cadena de clases: son **236 apuntes y 236 resoluciones** solo para abrir la
 * pantalla, y otros tantos que comparar en cada toque.
 *
 * El usuario lo midió con el celular en la mano: *"se demora 2 a 3 segundos en
 * entrar"* y *"cuando le doy click a un icono se demora 1 a 2 segundos en
 * seleccionar"*.
 *
 * Con el aspecto ya calculado aquí, las 236 casillas comparten DOS objetos y no
 * usan ninguna clase. Y como el objeto es siempre el mismo, la memorización de cada
 * casilla funciona de verdad: al marcar un dibujo solo se rehacen dos.
 *
 * Los colores son los mismos valores de Tailwind que salían por las clases, así que
 * no cambia nada de lo que se ve. Ver COLOR_HEX_100 y COLOR_HEX_500.
 */
/**
 * EL ASPECTO GRIS, EL DE LAS 226 CASILLAS QUE NO ESTÁN ELEGIDAS.
 *
 * VA APARTE DEL DEL COLOR, Y AHÍ ESTÁ EL ARREGLO DEL 07/08/2026 POR LA NOCHE.
 *
 * Antes los dos salían juntos de una sola función que recibía el color, así que **cambiar
 * de color creaba un objeto nuevo**, ese objeto se le pasaba a las 46 filas y de ahí a las
 * 227 casillas, y **las 227 se rehacían**. Estando en la pestaña de Color, con el catálogo
 * ni a la vista.
 *
 * El usuario lo describió exacto: *"toco un color rojo y paso a otro, se siente como una
 * lentitud, al igual pasa con los demás… en iconos parece que ya está bien"*. Y tenía toda
 * la razón en la distinción: la pestaña de iconos ya estaba arreglada, y lo que la hacía
 * lenta era **lo que pasaba en las otras**.
 *
 * Este aspecto NO SABE NADA DEL COLOR —el gris es gris—, así que solo cambia si cambia la
 * medida de la casilla o el tema del celular. Cambiar de color ya no lo toca, y por eso las
 * filas y las casillas ya no se enteran.
 */
function casillaNormal(lado: number, oscuro: boolean): ViewStyle {
  return {
    width: lado,
    height: lado,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: oscuro ? "#1e293b" : "#f8fafc",
    borderWidth: 1.5,
    borderColor: oscuro ? "#334155" : "#e2e8f0",
  };
}

function aspectoDeCasilla(color: string, lado: number, oscuro: boolean): AspectoCasilla {
  const medida = { width: lado, height: lado, borderRadius: 16 } as const;
  return {
    normal: casillaNormal(lado, oscuro),
    elegida: {
      ...medida,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLOR_HEX_100[color] || "#f1f5f9",
      borderWidth: 2,
      borderColor: COLOR_HEX_500[color] || "#64748b",
    },
    tinta: COLOR_HEX_600[color] || "#475569",
  };
}

/**
 * Un dibujo de la cuadrícula.
 *
 * Va en su propio componente memorizado por un motivo medible: son 236 en
 * pantalla. Sin esto, elegir uno redibujaba los 236 aunque solo cambien dos
 * —el que se deja y el que se toma— y el toque se sentía pesado.
 */
const Dibujito = memo(function Dibujito({
  id,
  normal,
  lado,
  onElegir,
  onCancelar,
}: {
  id: string;
  /**
   * SOLO EL ASPECTO GRIS, el que NO depende del color.
   *
   * Antes llegaba el aspecto entero —gris y color juntos— y por eso tocar un color rehacia
   * las 227 casillas: el objeto era nuevo. El del color ya no viaja por aqui, lo mira del
   * canal la unica casilla que lo necesita. Ver aspectoDeLaMarca.
   */
  normal: ViewStyle;
  /** Medida del cuadrado, calculada del ancho de la pantalla. Ver LADO_DE. */
  lado: number;
  onElegir: (id: string) => void;
  /** Devuelve la marca a la de verdad cuando el dedo era un deslizón y no un toque. */
  onCancelar: () => void;
}) {
  // UNA FOTO PROPIA SE DIBUJA COMO FOTO, no como dibujo de línea. Aparece en la
  // pestaña de favoritos desde el 07/08/2026, cuando las fotos también se pueden
  // marcar. Sin esto, un favorito con foto saldría como el dibujo de respaldo y
  // parecerían todos iguales.
  const foto = esFoto(id);
  const D = foto ? null : iconoDe(id);

  /**
   * LA MARCA SE PINTA AL APOYAR EL DEDO, NO AL LEVANTARLO. (07/08/2026)
   *
   * Esto no es un arreglo de velocidad, y por eso los siete anteriores no lo movieron:
   * *"tocar un icono, ¿se marca al instante? no"*.
   *
   * La marca violeta la decidía la pantalla entera, y la pantalla se enteraba del toque
   * cuando el dedo se LEVANTABA — así funciona un botón: avisa al soltarlo. O sea que
   * por muy rápida que fuera la app, la marca llegaba siempre después del dedo. Se
   * estaba midiendo y optimizando algo que no era el problema.
   *
   * Ahora la marca se mueve en cuanto la tocan, sin rehacer la pantalla: la casilla
   * pregunta a un solo sitio si es ella la marcada. Ver marcaActual.
   *
   * LA PRIMERA VERSIÓN DE ESTO TENÍA UN FALLO Y ÉL LO VIO: se quedaban DOS marcadas a la
   * vez. Cada casilla llevaba su propia marca, así que la nueva se encendía al instante
   * pero **la vieja no tenía cómo enterarse** hasta que el dedo se levantaba. Instantáneo
   * para encender, tarde para apagar. De ahí que la marca sea ahora una sola y compartida.
   *
   * Dos cabos que hay que atar:
   *
   *  1. Si el dedo era el principio de un DESLIZÓN y no un toque, no se eligió nada: la
   *     marca vuelve a donde estaba. Eso lo dice "onPressOut sin onPress".
   *  2. Si sí se eligió, no hay que devolver nada: la marca ya está en su sitio, y cuando
   *     la pantalla se entera al levantar el dedo, no se ve ningún cambio.
   */
  /**
   * LA RESPUESTA ES EL COLOR CUANDO ESTA MARCADA, Y VACIO CUANDO NO.
   *
   * Que sea el color y no un simple si/no es lo que arregla la lentitud al cambiar de color:
   * al cambiarlo, las 226 que no estan marcadas siguen contestando vacio —misma respuesta,
   * no se rehacen— y la marcada contesta otro color, asi que se rehace solo ella.
   *
   * Con un si/no, la marcada no se enteraria del cambio de color y se quedaria pintada del
   * anterior.
   */
  const marcada = useSyncExternalStore(escucharLaMarca, () =>
    marcaActual === id ? colorDeLaMarca || "marcada" : ""
  );
  const aspectoElegida = marcada ? aspectoDeLaMarca?.elegida ?? normal : null;
  const tinta = marcada ? aspectoDeLaMarca?.tinta ?? "#64748b" : "#64748b";
  const eligio = useRef(false);

  return (
    // AQUÍ HUBO UN TOUCHABLEOPACITY, Y EL CAMBIO A PRESSABLE FALLÓ UNA VEZ. LEER ESTO
    // ANTES DE VOLVER A TOCARLO.
    //
    // El motivo del cambio: TouchableOpacity trae dentro una vista ANIMADA para bajar la
    // opacidad mientras la tocas. Eran 227 vistas animadas y 227 valores animados creados
    // al abrir, sin que ninguno haga nada hasta que se toca uno. Pressable es una vista
    // normal.
    //
    // POR QUÉ FALLÓ LA PRIMERA VEZ, Y POR QUÉ AHORA NO PUEDE FALLAR POR ESO:
    //
    // Falló porque para dar el aviso de "estoy tocando" con Pressable había que pasar la
    // medida en una FUNCIÓN —style={({pressed}) => [...]}— y las clases de NativeWind se
    // aplican también por "style": con una función de por medio, el ancho y el alto no
    // llegaban. Las casillas salieron como pastillas altas y estrechas. Lo vio el usuario
    // en el celular: "no quiero que se vea así, estaba bien como estaba antes".
    //
    // Ese aviso YA NO SE LE PIDE A NADIE: desde el 7ago-20 la casilla se pinta ella misma
    // al ser tocada (ver la nota de "tocada"). Así que la medida vuelve a ir en un OBJETO,
    // que es lo único que hacía falta. Y la casilla no usa ni una clase de NativeWind, así
    // que la causa de aquel fallo no existe aquí.
    //
    // Hay una prueba que vigila justamente eso: que la medida llegue en un objeto y no en
    // una función. Qué componente se use da igual.
    <Pressable
      onPressIn={() => {
        // La marca se mueve YA, y se mueve DE VERDAD: la anterior se apaga en el mismo
        // instante. Ver la nota de marcaActual.
        eligio.current = false;
        ponerMarca(id);
        // Y se apunta la hora, para que el reparto del catálogo no se ponga a armar nada
        // mientras hay un dedo en la pantalla. Ver ULTIMO_TOQUE y filasADibujar.
        ULTIMO_TOQUE.cuando = Date.now();
      }}
      onPress={() => {
        eligio.current = true;
        onElegir(id);
      }}
      onPressOut={() => {
        // SE COMPRUEBA EN EL SIGUIENTE TURNO Y NO AQUÍ MISMO. NO QUITAR EL setTimeout.
        //
        // Porque el orden de los dos avisos de Android DEPENDE DE CUÁNTO DURÓ EL TOQUE.
        // Se leyó el código de React Native (Pressability.js) para verlo:
        //
        //   · Toque de menos de 130 ms → el aviso de "dedo levantado" se RETRASA con un
        //     reloj, así que llega DESPUÉS del de "toque completado".
        //   · Toque de más de 130 ms → llega ANTES.
        //
        // Comprobando aquí mismo, un toque normal —que pasa de 130 ms de sobra— haría que
        // la marca volviera al icono viejo y un instante después saltara al nuevo. Un
        // parpadeo, y de los que solo se ven en el celular.
        //
        // En el siguiente turno los dos avisos ya llegaron, en el orden que sea, así que la
        // respuesta es correcta siempre. Devolver la marca un cuadro más tarde no se nota.
        setTimeout(() => {
          // Era el principio de un deslizón, no un toque: no se eligió nada, así que la
          // marca vuelve a la de verdad.
          if (!eligio.current) onCancelar();
        }, 0);
        // También cuenta como "acabo de tocar": si el reparto arrancara justo al soltar,
        // se comería el deslizón que la persona está empezando.
        ULTIMO_TOQUE.cuando = Date.now();
      }}
      // SIN NINGUNA CLASE, y ahí está el arreglo. Ver aspectoDeCasilla: el aspecto
      // ya viene calculado y las 236 comparten el mismo objeto.
      //
      // El recorte solo cuando hay foto: obliga a Android a darle a esa casilla su
      // propia capa para cortar lo que sobresale, y un dibujo de la tipografía cabe
      // dentro y no sobresale de nada.
      style={foto ? [aspectoElegida ?? normal, { overflow: "hidden" }] : aspectoElegida ?? normal}
    >
      {D ? (
        <D size={22} color={tinta} strokeWidth={2.2} />
      ) : (
        <Image source={{ uri: id }} style={{ width: lado, height: lado }} />
      )}
    </Pressable>
  );
});

/**
 * Una fila de cinco casillas. Memorizada para que un toque no rehaga las demás.
 *
 * "elegido" ES NULO EN LAS FILAS QUE NO TIENEN NADA ELEGIDO, y eso es lo que hace
 * que tocar un dibujo sea instantáneo.
 *
 * Antes se le pasaba a todas el dibujo elegido de la pantalla. Cambiaba con cada
 * toque, así que **las 48 filas se rehacían** —y con ellas las 236 casillas se
 * volvían a comparar— aunque el cambio solo afectara a dos. El usuario lo midió: *"al
 * seleccionar se demora 1 a 2 segundos"*.
 *
 * Luego se le pasaba nulo a las filas que no contenían al elegido, y así solo se rehacían
 * dos. Y DESDE EL 07/08/2026 NO SE LE PASA NADA: la marca no viaja por las filas, cada
 * casilla la pregunta a un solo sitio (ver marcaActual). Así que ahora **no se rehace
 * ninguna fila al elegir** — solo las dos casillas que cambian de aspecto.
 *
 * Por eso esta fila ya no tiene ninguna propiedad que cambie al usar la pantalla: todas
 * las que recibe son siempre las mismas, y la memorización la deja fuera SIEMPRE.
 */
const Fila = memo(function Fila({
  iconos,
  normal,
  lado,
  onElegir,
  onCancelar,
}: {
  iconos: (string | null)[];
  /** Solo el aspecto gris. El del color ya no viaja por aqui. Ver Dibujito. */
  normal: ViewStyle;
  lado: number;
  onElegir: (id: string) => void;
  onCancelar: () => void;
}) {
  return (
    // Alto y separación explícitos: es la altura que la lista da por hecha.
    <View style={{ flexDirection: "row", height: lado, gap: SEPARACION, marginBottom: SEPARACION }}>
      {iconos.map((id, i) =>
        id === null ? (
          <View key={"hueco" + i} style={{ width: lado }} />
        ) : (
          <Dibujito
            key={id}
            id={id}
            normal={normal}
            lado={lado}
            onElegir={onElegir}
            onCancelar={onCancelar}
          />
        ),
      )}
    </View>
  );
});

/**
 * CÓMO SE ESCONDE LA PESTAÑA QUE NO TOCA. Y OJO, QUE AQUÍ HABÍA DOS FALLOS EN UNO.
 *
 * Las cuatro pestañas se quedan puestas y solo se esconde la que no toca —así cambiar de
 * pestaña no vuelve a armar las 227 casillas—. Se escondían con `display: "none"` a secas,
 * y eso trae un problema que en Android no se ve venir:
 *
 * **UNA CAJA QUE MIDE CERO NO RECORTA LO QUE LLEVA DENTRO.** Yoga la deja en cero de alto,
 * pero Android sigue DIBUJANDO sus hijos, y como la caja de al lado empieza en el mismo
 * sitio, se dibujan encima. El usuario lo vio y lo mandó con foto (07/08/2026): *"cuando
 * salgo de la pestaña se pone así"* — los colores encima de "Tu propia foto" y del
 * catálogo, las dos pestañas a la vez.
 *
 * Y ESE FALLO ES ADEMÁS LA EXPLICACIÓN DE LO LENTO, que es lo que no se veía:
 *
 * Si el contenido escondido se sigue dibujando, **esconder una pestaña no ahorraba nada**.
 * Estando en "Color", Android seguía dibujando las 227 casillas del catálogo —unas 500
 * piezas— además de los colores. Cada pasada de dibujo de esta pantalla arrastraba TODAS
 * las pestañas, no solo la que se ve.
 *
 * Con el recorte puesto, una caja de alto cero no dibuja nada de lo que lleva dentro: se
 * arregla lo que se veía mal y, de paso, la pestaña que no toca deja de costar.
 *
 * El alto cero va escrito además del `display` a propósito: si algún día una versión de
 * React Native cambia cómo trata `display`, el alto cero con el recorte sigue escondiéndola.
 */
const PESTANA_A_LA_VISTA: ViewStyle = { display: "flex" };
const PESTANA_ESCONDIDA: ViewStyle = { display: "none", height: 0, overflow: "hidden" };

/**
 * UNA CATEGORÍA DE LA LISTA DE "TUS CATEGORÍAS", Y UN COLOR DE LA PALETA.
 *
 * POR QUÉ EXISTEN ESTAS DOS PIEZAS (07/08/2026)
 *
 * *"se siente lento, no fluido, piensa diferente"*. Y pensar diferente era mirar FUERA de
 * lo que se llevaba toda la tarde optimizando.
 *
 * Lo que se sabía por el medidor: **un dibujado de esta pantalla cuesta entre 136 y 353
 * ms**. Se había atacado CUÁNTAS VECES se dibuja; nunca CUÁNTO CUESTA cada vez.
 *
 * Y cuesta eso porque un dibujado de la pantalla arrastra consigo, cada vez, todo lo que
 * no está memorizado: **las 14 casillas de "Tus categorías" y los 18 colores**. Son unas
 * 50 piezas con clases de estilo, y varias de esas clases se ARMAN AL VUELO
 * (`bg-${color}-100`), que es lo más caro que hay: una clase así no se puede preparar de
 * antemano, hay que resolverla en el momento.
 *
 * El catálogo ya estaba arreglado —sus casillas están memorizadas y sin clases— y estas
 * dos cuadrículas, en la misma pantalla, nunca recibieron el mismo trato.
 *
 * Y LA PANTALLA SE REDIBUJA MÁS DE LO QUE PARECE, no solo al tocarla: el reparto de datos
 * de la app crea su paquete de nuevo en cada cambio, así que **cualquier cambio ahí
 * redibuja todas las pantallas montadas**, y tiene relojes de 8 y de 60 segundos. Eso son
 * tirones cada tanto sin que nadie toque nada, que es justo lo que se siente como "no
 * fluido".
 *
 * SE MEMORIZAN Y NO SE LES TOCA NI UNA CLASE, y eso es a propósito. Quitarles las clases
 * ahorraría un poco más, pero hay que reescribir medidas a mano y ya pasó una vez: *"no
 * quiero que se vea así, estaba bien como estaba antes"*. Memorizadas, un dibujado de la
 * pantalla **no las toca**, así que sus clases no se resuelven — el mismo ahorro, sin
 * poder cambiar cómo se ven.
 */
const CasillaCategoria = memo(function CasillaCategoria({
  id,
  color,
  nombre,
  puesta,
  onElegir,
}: {
  id: string;
  color: string;
  nombre: string;
  /** Es la que se va a aplicar. Cambia en DOS casillas: la que la suelta y la que la toma. */
  puesta: boolean;
  onElegir: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      // Tocarla la ELIGE, no cierra la pantalla. Ver elegirDeLaLista: volver de golpe
      // dejaba las otras pestañas sin poder usarse sobre una categoría que ya existe.
      onPress={() => onElegir(id)}
      className="items-center gap-1.5"
      style={{ width: "21%" }}
    >
      <View
        className={`w-12 h-12 rounded-2xl items-center justify-center bg-${color}-100 ${
          puesta ? `border-2 border-${color}-500` : ""
        }`}
      >
        <CategoryAvatar id={id} size={20} />
      </View>
      <Text
        className={`text-xs font-bold text-center ${
          puesta ? `text-${color}-600` : "text-slate-600 dark:text-slate-200"
        }`}
        numberOfLines={1}
      >
        {nombre}
      </Text>
    </TouchableOpacity>
  );
});

/**
 * El renglón con el nombre de un grupo del catálogo ("Comida y bebida").
 *
 * Memorizado por lo mismo que las casillas: son DIECIOCHO, y sin esto los dieciocho se
 * rehacían en cada dibujado de la pantalla. Es el último trozo que quedaba sin proteger.
 *
 * El alto va fijo y no lo decide el texto, porque de ese alto sale el hueco que se reserva
 * para lo que todavía no está dibujado. Ver ALTO_TITULO.
 */
const TituloDeGrupo = memo(function TituloDeGrupo({ texto }: { texto: string }) {
  return (
    <View style={{ height: ALTO_TITULO, justifyContent: "center" }}>
      <Text className="text-xs font-bold text-slate-500 dark:text-slate-300">{texto}</Text>
    </View>
  );
});

/** Un color de la paleta. Memorizada por lo mismo que CasillaCategoria. */
const CasillaColor = memo(function CasillaColor({
  color,
  puesto,
  onElegir,
}: {
  color: string;
  puesto: boolean;
  onElegir: (color: string) => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => onElegir(color)}
      className={`w-12 h-12 rounded-full items-center justify-center ${
        puesto ? "border-[3px] border-slate-900 dark:border-white" : ""
      }`}
      style={{ backgroundColor: COLOR_HEX_600[color] }}
    >
      {puesto && <Check size={18} color="#ffffff" />}
    </TouchableOpacity>
  );
});

/**
 * Elegir una categoría, o crear una propia con nombre, dibujo y color.
 *
 * UNA SOLA PANTALLA PARA LAS DOS COSAS (06/08/2026)
 *
 * Fueron dos pantallas durante unas horas: una con la lista de categorías y otra
 * con el catálogo de dibujos. El usuario lo señaló con las capturas delante — *"al
 * darle click a elegir categoría debería mandarme a la 3, no a la 2"*: quería el
 * catálogo, y la lista de por medio era un paso que no había pedido.
 *
 * El primer intento las juntó poniendo la lista SUELTA ARRIBA, encima de la vista
 * previa. Y volvió a decir lo mismo, marcando en azul justo esa parte: *"la idea
 * era que solo quede la parte de abajo y todo lo que esté de azul ya no esté, y
 * donde dice o crea una nueva debería decir Tus categorías"*.
 *
 * Tenía razón: media pantalla por delante del catálogo es el mismo estorbo que
 * antes, solo que sin cambiar de pantalla.
 *
 * PERO BORRAR LA LISTA NO ERA UNA OPCIÓN, y se le dijo dos veces antes de mover
 * nada: es lo que se usa en CADA gasto. Sin ella habría que crear una categoría
 * nueva cada vez, y los reportes acabarían repartidos entre veinte "Comida".
 *
 * La salida fue la que él mismo nombró: **"Tus categorías" es una PESTAÑA**, la
 * primera. De pestaña no ocupa nada hasta que se toca, así que la pantalla se abre
 * en el catálogo —lo que pedía— y elegir una que ya existe sigue costando un
 * toque. Ver la nota del estado inicial de `pestana` para el precio exacto.
 *
 * Así que la pantalla es la de siempre: vista previa, nombre y pestañas arriba y
 * fijos; debajo, lo que la pestaña elegida enseñe.
 *
 * LA VISTA PREVIA VA FUERA DE LA PARTE DESLIZABLE, Y ES DELIBERADO
 *
 * Elegir dibujo y color sin ver el resultado obliga a guardar para descubrir que
 * no pegaban. Fija arriba, se decide mirando. Es también la razón de fondo por la
 * que la lista no podía ir suelta encima: la empujaba fuera de la vista.
 *
 * EL TIPO NO SE PREGUNTA
 *
 * Llega de la pestaña donde se estaba (Gasto o Ingreso). Preguntarlo otra vez
 * sería pedir un dato que la persona acaba de dar sin darse cuenta.
 */
export default function NuevaCategoria({
  tipo,
  editandoId,
  actual,
  onBack,
  onCreada,
  onElegir,
}: {
  tipo: "expense" | "income";
  /** Si viene, se está EDITANDO esa categoría en vez de creando una. */
  editandoId?: string;
  /**
   * La categoría que el movimiento lleva puesta ahora. Sirve para marcarla en la
   * lista y para saber si se puede ofrecer "Editar «X»".
   */
  actual?: string;
  onBack: () => void;
  /** Se avisa con el id para poder dejarla ya elegida en el movimiento. */
  onCreada: (id: string) => void;
  /**
   * Si llega, arriba se puede elegir una de las que ya existen.
   *
   * Es lo que separa "vengo a poner la categoría de este gasto" de "vengo a
   * editar esta categoría": al editar, una lista para elegir otra no tendría
   * ningún sentido.
   */
  onElegir?: (id: string) => void;
}) {
  const {
    t,
    categoriasPropias,
    categoryOverrides,
    updateCategoryOverrides,
    crearCategoria,
    editarCategoria,
    borrarCategoria,
    guardarFavoritos,
    movimientosDeCategoria,
    showToast,
  } = useAppData();
  const insets = useSafeAreaInsets();
  /**
   * LOS BOTONES DE ABAJO, ENCIMA DEL TECLADO (12/08/2026).
   *
   * El mismo hueco que tenía "Presupuestos por categoría", y por el que se arreglaron las dos a
   * la vez: aquí se escribe el nombre de la categoría, y con el teclado abierto los botones de
   * guardar y borrar quedaban debajo. Había que cerrar el teclado a mano para llegar a ellos.
   *
   * Se usa la MISMA pieza que "Nuevo movimiento", no una copia: el alto del teclado lo entrega
   * Reanimated en vez de los avisos de Android, que llegan tarde y hacen saltar la pantalla.
   */
  const { animatedPaddingStyle } = useKeyboardAnimatedPadding();

  // Y SE CIERRA EL TECLADO AL SALIR. Es la otra mitad del arreglo del hueco fantasma: si esta
  // pantalla se va con el teclado abierto, la SIGUIENTE hereda ese estado. El guardia de
  // utils/keyboard ya lo tapa, pero las dos capas juntas son las que dejan el hueco en cero.
  useEffect(() => {
    return () => {
      Keyboard.dismiss();
    };
  }, []);

  // La que se está editando, si es que se está editando alguna.
  const original = editandoId ? categoriasPropias.find((c) => c.id === editandoId) : undefined;
  const editando = !!original;

  /** ¿Se puede elegir una que ya existe, o solo se viene a crear/editar? */
  const eligiendo = !!onElegir && !editando;

  // Las de la app MÁS las propias. Se recalcula cuando cambian porque desde aquí
  // mismo se crea una, y tiene que aparecer en la lista sin salir y volver.
  const cats = useMemo(
    () => (tipo === "expense" ? gastosDisponibles() : ingresosDisponibles()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tipo, categoriasPropias],
  );

  // Se arranca con lo que ya tenía. useState con función: se lee UNA vez, al
  // abrir. Si se leyera en cada dibujado, cada toque en el catálogo pisaría lo
  // que la persona acaba de elegir con el valor guardado.
  const [nombre, setNombre] = useState(() => original?.nombre ?? "");
  const [icono, setIcono] = useState(() => original?.icono ?? "Tag");
  const [color, setColor] = useState(() => original?.color ?? "violet");

  /**
   * LA CATEGORÍA QUE YA EXISTE Y SE TOCÓ EN "TUS CATEGORÍAS".
   *
   * Antes, tocar una volvía al movimiento en el acto. El usuario lo pidió al
   * revés el 07/08/2026: *"debería yo seleccionar el icono y recién cuando le doy
   * aplicar mandarme [al movimiento], aparte podría cambiarle el color"*.
   *
   * Y tiene razón: volver de golpe convertía las otras tres pestañas en algo que
   * no se podía usar sobre una categoría que ya existe. Ahora tocarla la deja
   * ELEGIDA —con su dibujo, su color y su nombre cargados arriba— y de ahí se le
   * puede cambiar lo que sea antes de darle a Aplicar.
   *
   * Nulo mientras no se haya tocado ninguna: entonces Aplicar CREA una nueva, que
   * es lo que hace la pantalla cuando se llega a ella para eso.
   */
  const [elegida, setElegida] = useState<string | null>(null);
  /**
   * Cómo era la elegida ANTES de tocarle nada.
   *
   * Hace falta para guardar solo lo que de verdad cambió. Guardando todo, el
   * nombre de una categoría de fábrica quedaría fijado al texto en español
   * ("Comida") y dejaría de traducirse al cambiar el idioma de la app — un daño
   * silencioso a cambio de nada.
   */
  const [comoEra, setComoEra] = useState<{
    nombre: string;
    icono: string;
    color: string;
    foto?: string;
  } | null>(null);

  /**
   * ARRANCA EN "icono", NO EN "tuyas", y es una decisión suya.
   *
   * Lo pidió tres veces: *"al darle click a elegir categoría debería mandarme a
   * la 3 imagen no a la 2"*. Así que la pantalla se abre en el catálogo de
   * dibujos, y elegir una categoría que ya existe cuesta un toque —la pestaña—.
   *
   * Queda anotado porque el precio es real y no es simétrico: crear una categoría
   * se hace de vez en cuando, y elegir una se hace en CADA gasto. Si algún día
   * dice que elegir se le hace pesado, lo que hay que cambiar es esta línea.
   */
  const [pestana, setPestana] = useState<"tuyas" | "icono" | "favoritos" | "color">("icono");

  /**
   * QUÉ PESTAÑAS SE HAN LLEGADO A ABRIR. Cada una se construye la PRIMERA vez que se
   * mira, y a partir de ahí se queda puesta.
   *
   * ES EL EQUILIBRIO ENTRE LOS DOS FALLOS QUE SE REPORTARON, y hubo que pasar por
   * los dos para verlo:
   *
   *   · Al principio cada pestaña se dibujaba solo si era la elegida. Volver a la de
   *     los dibujos rehacía las 236 casillas, y otra vez en cada ida y vuelta.
   *   · Se pasó a dejarlas las cuatro puestas y escondidas. Eso arregló el cambio de
   *     pestaña y **empeoró lo que más molestaba**: abrir la pantalla pasó a
   *     construirlas TODAS —incluida la lista de categorías con sus fotos— cuando
   *     antes solo montaba una. Y entrar era justo la queja: *"se demora 2 a 3
   *     segundos en entrar"*.
   *
   * Con esto, abrir cuesta SOLO la pestaña de los dibujos, igual que antes de todo
   * esto, y cambiar de pestaña se paga una vez y nunca más.
   *
   * Arranca con la de los dibujos porque es la que se ve al abrir; si no estuviera
   * aquí, se construiría igual pero un dibujado más tarde.
   */
  const [vistas, setVistas] = useState<Set<string>>(() => new Set(["icono"]));

  /**
   * CUÁNTOS GRUPOS DEL CATÁLOGO SE DIBUJAN. Los primeros al abrir; el resto, entero,
   * en cuanto la pantalla ya está puesta.
   *
   * ESTO ES LO ÚLTIMO QUE QUEDABA, Y HAY QUE LEER POR QUÉ ANTES DE TOCARLO
   *
   * Cada dibujo es una letra de una tipografía, y Android tiene que MEDIR cada letra.
   * Doscientas veintisiete medidas es un coste que no se puede abaratar: solo
   * repartir. Con todas de golpe, ese trabajo cae justo encima de la animación de
   * entrada y la pantalla llega a trompicones — *"el cambio de pantalla debe verse
   * fluido y más rápido"*.
   *
   * NO ES LO QUE SE RECHAZÓ EN AGOSTO, y la diferencia es la que importa:
   *
   *   · Aquello metía los grupos DE A UNO y dejaba huecos que se veían al deslizar
   *     («se pone así cuando deslizo rápido»), o no dibujaba nada hasta que acababa
   *     la animación («aparecen luego de 1 segundo»).
   *   · Esto son TANDAS QUE LLEGAN SOLAS, no al deslizar. La primera llena más de tres
   *     pantallas —lo que se ve está completo desde el primer instante— y las
   *     siguientes van entrando por su cuenta hasta que están los 227 puestos.
   *
   * Y TAMPOCO ES CARGAR AL DESLIZAR, que es lo que él rechazó con estas palabras: *"los
   * iconos ya deberían estar ahí fijos, no deberían cargar recién cuando yo deslizo"*.
   * Nadie tiene que deslizar para que lleguen; llegan igual con el dedo quieto.
   *
   * LO QUE MIDIÓ EL CELULAR, QUE ES DE DÓNDE SALE TODO ESTO
   *
   *   · Todo el resto en un solo golpe → el primer toque tardaba **6000 ms**. El toque
   *     hacía cola detrás de 223 dibujos, y mientras el golpe dura el dedo no existe.
   *   · Tandas de dos GRUPOS → **136 a 353 ms**. Muchísimo mejor y todavía se notaba.
   *   · Ahora tandas de dos FILAS, que son diez dibujos exactos. Un grupo no servía de
   *     medida: los hay de 6 y de 20, y el peor caso lo marcaba el más gordo.
   *
   * Y ADEMÁS SE PARA MIENTRAS LA PERSONA ESTÁ TOCANDO. Esto es la otra mitad, y es la
   * que hace que no haya "peor caso" en la práctica: mientras hay un dedo en la pantalla
   * no se arma nada. En cuanto se queda quieta —QUIETO_MS— sigue por donde iba. Así el
   * trabajo se hace en los huecos, que es cuando no molesta a nadie.
   *
   * La primera espera sigue siendo lo que dura la animación de entrada. Las siguientes
   * no esperan nada: solo ceden el turno, que es justamente lo que deja pasar el toque.
   */
  const [filasADibujar, setFilasADibujar] = useState(FILAS_AL_ABRIR);
  // Cuando el reparto se posterga por un dedo en la pantalla, hay que volver a mirarlo
  // más tarde. Este contador es lo que hace que el efecto se vuelva a ejecutar.
  useEffect(() => {
    if (filasADibujar >= CATALOGO_EN_TROZOS.length) return;

    /**
     * ESPERAR SIN REDIBUJAR NADA. AQUÍ HUBO UN BUCLE, Y ERA GRAVE.
     *
     * La primera versión de esta espera (7ago-22) tenía un estado, `reintento`, y cuando
     * encontraba un dedo reciente hacía `setReintento(r + 1)` para volver a mirar. Y eso
     * montaba un bucle que se comía la pantalla:
     *
     *   1. El reloj mira → hay un toque reciente → pide volver a mirar.
     *   2. Pedirlo es un CAMBIO DE ESTADO, así que la pantalla se rehace ENTERA.
     *   3. El reloj se vuelve a armar con espera CERO → dispara al instante.
     *   4. Sigue habiendo un toque reciente (falta medio segundo) → vuelta al 1.
     *
     * Resultado: mientras el dedo estaba sobre un icono, la pantalla se rehacía decenas
     * de veces por segundo **sin hacer absolutamente nada**. Reportado como *"la pestaña
     * de elegir icono está lenta, se siente raro"* — y raro es la palabra exacta: no era
     * trabajo de más, era trabajo inútil ahogando al dedo.
     *
     * Dos cosas lo arreglan, y hacen falta las dos:
     *
     *  · **Se espera lo que falta** para cumplir el medio segundo, no cero. Antes se
     *    volvía a mirar inmediatamente para encontrar lo mismo.
     *  · **Y se espera sin estado.** El reloj se rearma solo. Volver a mirar no tiene por
     *    qué redibujar nada: no ha cambiado lo que se ve, solo la hora.
     */
    let reloj: ReturnType<typeof setTimeout>;

    const mirar = () => {
      const falta = QUIETO_MS - (Date.now() - ULTIMO_TOQUE.cuando);
      if (falta > 0) {
        reloj = setTimeout(mirar, falta);
        return;
      }
      setFilasADibujar((n) => Math.min(n + FILAS_POR_TANDA, CATALOGO_EN_TROZOS.length));
    };

    // La primera espera es lo que dura la animación de entrada. Las siguientes no esperan
    // nada: el cero no es "ya mismo", es "en cuanto sueltes el turno", y ahí es donde entra
    // el toque que estaba esperando.
    reloj = setTimeout(mirar, filasADibujar === FILAS_AL_ABRIR ? ESPERA_RESTO_MS : 0);
    return () => clearTimeout(reloj);
  }, [filasADibujar]);

  function irA(cual: typeof pestana) {
    setPestana(cual);
    // Solo se toca el conjunto la primera vez: pasarlo nuevo en cada toque haría
    // que todo lo que dependa de él se rehiciera sin motivo.
    if (!vistas.has(cual)) setVistas((antes) => new Set(antes).add(cual));
  }

  /**
   * LOS ÍCONOS FAVORITOS. Se marcan con la estrella de al lado de la vista previa.
   *
   * POR QUÉ LA ESTRELLA VA ARRIBA Y NO EN CADA CASILLA
   *
   * En una casilla de 55 puntos, una estrellita en la esquina se toca sin querer
   * al elegir el dibujo. Y el toque largo se descartó en este proyecto por lo
   * mismo que se descartó para editar categorías: es invisible, y quien no lo
   * sepa no lo encuentra nunca.
   *
   * Arriba, junto al dibujo grande, la estrella se ve siempre y actúa sobre el
   * ícono que se acaba de elegir, que es justo el que se querría guardar.
   */
  const [favoritos, setFavoritosEstado] = useState<string[]>(() => getFavoritos());

  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  // LA FOTO PROPIA. Cuando hay, se dibuja en vez del icono — la misma regla que
  // sigue CategoryAvatar en el resto de la app, para que no se vea de una forma
  // aquí y de otra en Inicio.
  //
  // El icono elegido NO se borra al poner una foto: queda debajo, y quitando la
  // foto vuelve a salir. Quien prueba una foto y no le gusta no pierde lo que
  // había elegido antes.
  const [foto, setFoto] = useState<string | undefined>(() => original?.image);
  /** La imagen recién elegida, esperando a que se encuadre. */
  const [recortando, setRecortando] = useState<string | null>(null);

  /**
   * Lo que la estrella marca: la FOTO si hay una, y si no el dibujo.
   *
   * Es lo mismo que se está viendo arriba, así que no hace falta explicarlo en
   * pantalla: la estrella actúa sobre lo que se ve.
   */
  const loQueSeMarca = foto ?? icono;
  const esFav = favoritos.includes(loQueSeMarca);

  /**
   * MANTENER AL DÍA LA MARCA COMPARTIDA. Ver la nota larga de marcaActual.
   *
   * Son dos piezas y las dos hacen falta:
   *
   *  · La primera vez se APUNTA sin avisar, mientras se dibuja. Así las casillas nacen ya
   *    con la marca puesta. Avisando aquí habría dos problemas: avisar mientras React
   *    dibuja es un error, y no habría a quién avisar porque las casillas aún no existen.
   *  · Después, cada vez que cambia de verdad, se avisa. Eso cubre lo que NO viene de
   *    tocar una casilla: elegir de la lista de "Tus categorías", tomar una foto, quitarla,
   *    o abrir la pantalla para editar una que ya existe.
   */
  const primerDibujado = useRef(true);
  if (primerDibujado.current) {
    primerDibujado.current = false;
    apuntarMarca(loQueSeMarca);
  }
  useEffect(() => {
    ponerMarca(loQueSeMarca);
  }, [loQueSeMarca]);

  /**
   * Devolver la marca a su sitio cuando el dedo era un deslizón y no un toque.
   *
   * La caja es para que esta función no cambie nunca: si cambiara, las 48 filas y las 227
   * casillas se rehacían en cada dibujado de la pantalla y la memorización no valdría nada
   * — que es justo el coste que se ha estado quitando toda la tarde.
   */
  const marcaDeVerdad = useRef(loQueSeMarca);
  marcaDeVerdad.current = loQueSeMarca;
  const cancelarMarca = useCallback(() => ponerMarca(marcaDeVerdad.current), []);

  /**
   * La misma treta para elegir de la lista de "Tus categorías".
   *
   * elegirDeLaLista se escribe de nuevo en cada dibujado —como cualquier función suelta
   * dentro de un componente—, y pasarla tal cual haría que las 14 casillas se rehicieran
   * cada vez, justo lo que se está quitando. La caja guarda siempre la última versión y
   * lo que se pasa a las casillas no cambia nunca.
   */
  const elegirDeLaListaRef = useRef(elegirDeLaLista);
  elegirDeLaListaRef.current = elegirDeLaLista;
  const elegirDeLaListaEstable = useCallback((id: string) => elegirDeLaListaRef.current(id), []);

  /**
   * Las filas de los favoritos, calculadas una sola vez por lista.
   *
   * Sin esto, enFilas(favoritos) devuelve un ARRAY NUEVO en cada dibujado de la pantalla,
   * y con un array nuevo la memorización de la fila no sirve: las casillas de favoritos se
   * rehacían en cada dibujado aunque los favoritos no hubieran cambiado.
   */
  const filasDeFavoritos = useMemo(() => enFilas(favoritos), [favoritos]);

  function alternarFavorito() {
    const siguiente = alternar(favoritos, loQueSeMarca);
    setFavoritosEstado(siguiente);
    // Por el contexto y no con saveFavoritos directo: aquel escribe el disco pero
    // no avisa a nadie, y con eso marcar un favorito NO se subia a la copia de la
    // cuenta hasta que cambiara cualquier otra cosa. Ver guardarFavoritos.
    guardarFavoritos(siguiente);
    showToast(t(siguiente.includes(loQueSeMarca) ? "nuevaCat.favGuardado" : "nuevaCat.favQuitado"));
  }

  /**
   * Tocar un favorito: si es una foto se pone como foto, y si es un dibujo como
   * dibujo. Sin distinguirlo, tocar una foto guardaría su texto entero como si
   * fuera el nombre de un dibujo del catálogo, y saldría el de respaldo.
   */
  const elegirFavorito = useCallback((v: string) => {
    if (esFoto(v)) setFoto(v);
    else setIcono(v);
  }, []);

  /** Cuál se está a punto de borrar de la lista, esperando confirmación. */
  const [borrando, setBorrando] = useState<string | null>(null);

  /**
   * Borra una categoría propia SIN salir de la pantalla.
   *
   * Se queda en la lista a propósito: quien borra una de sus pruebas normalmente
   * borra tres, y volver al movimiento tras cada una obligaría a entrar otra vez.
   */
  function borrarDeLaLista(id: string) {
    borrarCategoria(id);
    showToast(t("nuevaCat.borrada"));
    setBorrando(null);
    // Si era la que estaba marcada, el formulario se queda hablando de algo que
    // ya no existe: Aplicar intentaría guardar cambios sobre una categoría
    // borrada. Se suelta y la pantalla vuelve a estar en modo "crear una nueva".
    if (elegida === id) {
      setElegida(null);
      setComoEra(null);
    }
  }

  /**
   * Tocar una de "Tus categorías": se carga arriba para poder retocarla.
   *
   * Va aquí abajo, y no junto a su estado, porque necesita setFoto: en
   * JavaScript, una función puede usar lo que se declara después de ella siempre
   * que se LLAME después, pero leerlo así obliga a comprobarlo. Declarada
   * después de todo lo que usa, no hay nada que comprobar.
   */
  function elegirDeLaLista(id: string) {
    const info = catInfo(id);
    // SU dibujo, venga de donde venga: de la personalización, de la categoría
    // propia o de la de fábrica. catInfo ya resuelve las tres y devuelve el
    // NOMBRE junto al dibujo — ver Category.iconoNombre.
    //
    // Antes se buscaba a mano en dos sitios y las de fábrica se quedaban sin
    // respuesta, así que caía en "el que ya estaba puesto": tocar "Salud"
    // cambiaba el nombre y el color, y el dibujo de arriba no se movía. Fue
    // exactamente lo que reportó el usuario el 07/08/2026.
    const suIcono = info.iconoNombre ?? icono;
    // EL NOMBRE HAY QUE TRADUCIRLO, y eso faltaba.
    //
    // El "label" de una categoría de fábrica es una CLAVE ("category.mascotas"), no
    // el nombre: quien la enseña hace t(label). Aquí se metía tal cual, así que al
    // tocar "Mascotas" la vista previa y la casilla del nombre decían
    // "category.mascotas". Lo vio el usuario en el celular el 07/08/2026.
    //
    // En una categoría propia el "label" ya es el nombre escrito a mano, y el
    // traductor devuelve tal cual lo que no reconoce: así que t() sirve para las dos
    // sin preguntar de qué tipo es.
    const suNombre = t(info.label);
    setElegida(id);
    setNombre(suNombre);
    setIcono(suIcono);
    setColor(info.color);
    setFoto(info.image);
    // Y "como era" guarda el nombre YA TRADUCIDO, el mismo que se ve. Guardando la
    // clave, al darle a Aplicar sin tocar nada la comparación diría que el nombre
    // cambió y escribiría "Mascotas" como nombre propio de esa categoría: dejaría de
    // traducirse al cambiar el idioma de la app, por no haber hecho nada.
    setComoEra({ nombre: suNombre, icono: suIcono, color: info.color, foto: info.image });
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      showToast(t("catCustom.cameraPermission"));
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    setRecortando(r.assets[0].uri);
  }

  async function elegirDeGaleria() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      showToast(t("settings.photoPermission"));
      return;
    }
    // Sin allowsEditing a propósito: el recorte que trae Android cambia de un
    // celular a otro y en algunos no deja cuadrado. Cámara y galería terminan
    // las dos en el recortador propio, así que hay UNA sola forma de encuadrar.
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    setRecortando(r.assets[0].uri);
  }

  // El lado de cada casilla sale del ancho real de la pantalla, para que las
  // cinco de una fila lleguen justo al borde. Ver constants/catalogoFilas.ts.
  const { width: anchoPantalla } = useWindowDimensions();
  const lado = LADO_DE(anchoPantalla);

  /**
   * El aspecto de las casillas, calculado UNA vez para las 236.
   *
   * Ver aspectoDeCasilla, que explica el fallo de lentitud que esto arregla. El
   * useMemo importa: sin él saldrían objetos nuevos en cada dibujado, la
   * memorización de cada casilla dejaría de valer y volveríamos a rehacer las 236
   * en cada toque — que es justo lo que se está quitando.
   */
  const { colorScheme } = useColorScheme();
  /**
   * EL GRIS Y EL DEL COLOR, POR SEPARADO. AQUI ESTA EL ARREGLO (07/08/2026 noche).
   *
   * Antes era UN solo aspecto que recibia el color, asi que cambiar de color creaba un objeto
   * nuevo, ese objeto viajaba a las 46 filas y de ahi a las 227 casillas, y las 227 se
   * rehacian. Estando en la pestaña de Color, con el catalogo ni a la vista.
   *
   * El gris no sabe nada del color, asi que cambiar de color NO lo toca: las filas y las
   * casillas no se enteran. Y el del color va por el canal de la marca, donde solo lo mira la
   * unica casilla que lo necesita.
   */
  const oscuro = colorScheme === "dark";
  const aspectoGris = useMemo(() => casillaNormal(lado, oscuro), [lado, oscuro]);
  const aspectoDelColor = useMemo(() => {
    const a = aspectoDeCasilla(color, lado, oscuro);
    return { elegida: a.elegida, tinta: a.tinta };
  }, [color, lado, oscuro]);

  /**
   * El aspecto del color, al canal de la marca.
   *
   * Igual que con la marca, son dos piezas: la PRIMERA vez se apunta sin avisar —avisar
   * mientras React dibuja es un error, y las casillas todavía no existen— y después, cada vez
   * que cambia, se avisa. Solo se entera la casilla marcada.
   */
  const primerAspecto = useRef(true);
  if (primerAspecto.current) {
    primerAspecto.current = false;
    apuntarAspectoDeLaMarca(color, aspectoDelColor);
  }
  useEffect(() => {
    ponerAspectoDeLaMarca(color, aspectoDelColor);
  }, [color, aspectoDelColor]);

  // Los títulos de los grupos, traducidos UNA vez. Pasarle la función de
  // traducir al catálogo lo redibujaría entero en cada letra escrita, que es
  // justo lo que se está evitando. El idioma no se puede cambiar sin salir de
  // aquí, así que calcularlo una vez es correcto.
  const titulos = useMemo(
    () => Object.fromEntries(TODOS_LOS_GRUPOS.map((g) => [g.titulo, t(g.titulo)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const Dibujo = iconoDe(icono);
  const limpio = sanitizeName(nombre);
  // Al editar no cuenta como repetida consigo misma — y lo mismo si se eligió de
  // la lista: tocar "Broster" y darle a Aplicar sin cambiarle nada diría "ya
  // tienes una con ese nombre", que es ella.
  const laMisma = editandoId ?? (elegida && esPropia(elegida) ? elegida : undefined);
  const repetido = nombreRepetido(categoriasPropias, limpio, tipo, laMisma);
  const puedeGuardar = limpio.length > 0 && !repetido;

  /**
   * Guarda los cambios de una categoría que YA EXISTÍA y la deja puesta.
   *
   * SOLO SE GUARDA LO QUE CAMBIÓ, y eso importa de verdad en el nombre: escribir
   * el nombre siempre dejaría "Comida" fijado en español, y al cambiar el idioma
   * de la app esa categoría se quedaría sin traducir. Un daño que nadie relaciona
   * con haber tocado un color meses antes.
   */
  function aplicarALaElegida(id: string) {
    const antes = comoEra;
    const cambios = {
      nombre: antes && limpio !== antes.nombre ? limpio : undefined,
      color: antes && color !== antes.color ? color : undefined,
      icono: antes && icono !== antes.icono ? icono : undefined,
      // La foto se distingue en tres estados: no tocada, cambiada y QUITADA. Sin
      // el null, quitarla y no tocarla serían lo mismo.
      foto: antes && foto !== antes.foto ? (foto ?? null) : undefined,
    };
    const hayCambios =
      cambios.nombre !== undefined ||
      cambios.color !== undefined ||
      cambios.icono !== undefined ||
      cambios.foto !== undefined;

    if (hayCambios) {
      if (esPropia(id)) {
        // Las propias se cambian en su propio sitio: ahí el nombre y el dibujo
        // son suyos, no un parche encima de otra cosa.
        editarCategoria(id, {
          nombre: cambios.nombre,
          color: cambios.color,
          icono: cambios.icono,
          image: cambios.foto,
        });
      } else {
        // Y las de fábrica por la personalización, la misma que usa la pantalla
        // de "Personalizar categorías". No se toca la de la app: se le pone un
        // parche encima, y quitando el parche vuelve la original.
        const anterior = categoryOverrides[id] ?? {};
        const puesto = { ...anterior };
        if (cambios.nombre !== undefined) puesto.name = cambios.nombre;
        if (cambios.color !== undefined) puesto.color = cambios.color;
        if (cambios.icono !== undefined) puesto.icono = cambios.icono;
        if (cambios.foto !== undefined) {
          if (cambios.foto === null) delete puesto.image;
          else puesto.image = cambios.foto;
        }
        updateCategoryOverrides({ ...categoryOverrides, [id]: puesto });
      }
      showToast(t("nuevaCat.guardada"));
    }
    onElegir?.(id);
  }

  function guardar() {
    if (!puedeGuardar) return;
    // UNA CATEGORÍA ELEGIDA DE LA LISTA no se duplica: se deja puesta en el
    // movimiento, con los retoques que se le hayan hecho. Antes esto no existía
    // porque tocarla volvía al movimiento en el acto.
    if (elegida) {
      aplicarALaElegida(elegida);
      return;
    }
    if (editando && editandoId) {
      // La foto va como null cuando se quitó: sin ese null, "no la toques" y
      // "bórrala" serían lo mismo y no habría forma de sacarla.
      editarCategoria(editandoId, { nombre: limpio, color, icono, image: foto ?? null });
      showToast(t("nuevaCat.guardada"));
      onCreada(editandoId);
      return;
    }
    const id = crearCategoria({ nombre: limpio, tipo, color, icono, image: foto });
    showToast(t("nuevaCat.creada"));
    onCreada(id);
  }

  function borrar() {
    if (!editandoId) return;
    borrarCategoria(editandoId);
    showToast(t("nuevaCat.borrada"));
    onBack();
  }

  // Cuántos movimientos pasarían a "Otros". Se dice ANTES de borrar, con el
  // número: "se va a borrar" no informa igual que "3 movimientos quedarán en
  // Otros", y es justo el dato que hace dudar o seguir.
  const cuantos = editandoId ? movimientosDeCategoria(editandoId) : 0;

  return (
    <Animated.View
      className="flex-1 bg-white dark:bg-noche"
      style={[{ paddingTop: insets.top }, animatedPaddingStyle]}
    >
      <View className="px-5 pt-3 pb-2 flex-row items-center gap-2">
        <TouchableOpacity onPress={onBack} className="w-9 h-9 items-center justify-center -ml-2">
          <ChevronLeft size={24} color="#94a3b8" />
        </TouchableOpacity>
        <Text className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
          {t(editando ? "nuevaCat.titleEditar" : eligiendo ? "elegirCat.title" : "nuevaCat.title")}
        </Text>
      </View>

      {/* LA VISTA PREVIA. Cambia con cada toque, y es lo que se está creando.
          Si hay foto, MANDA la foto: es la misma regla que CategoryAvatar sigue
          en el resto de la app, y saltársela aquí haría que la categoría se
          viera de una forma al crearla y de otra en Inicio. Ya pasó una vez. */}
      <View>
        <View className="items-center py-5">
          <View className="flex-row items-center gap-3">
            <View
              className={`w-20 h-20 rounded-3xl items-center justify-center overflow-hidden bg-${color}-100`}
              style={CARD_SHADOW}
            >
              {foto ? (
                <Image source={{ uri: foto }} style={{ width: 80, height: 80 }} />
              ) : (
                <Dibujo size={36} color={COLOR_HEX_600[color] || "#475569"} strokeWidth={2.2} />
              )}
            </View>
            {/* LA ESTRELLA. Marca lo que se está viendo: la foto si hay una, y
                si no el dibujo.
                Con foto NO se ofrecía, con el argumento de que un favorito es un
                dibujo del catálogo y una foto no está en el catálogo. El usuario
                lo pidió el 07/08/2026 y tenía razón: recortar una foto cuesta
                cámara, encuadre y zoom, y volver a hacerlo para la siguiente
                categoría es justo lo que un favorito evita. El argumento miraba
                de dónde sale el dibujo en vez de cuánto cuesta conseguirlo. */}
            <TouchableOpacity
              onPress={alternarFavorito}
              className={`w-10 h-10 rounded-full items-center justify-center border-[1.5px] ${
                esFav ? "bg-amber-100 border-amber-400" : "border-slate-300 dark:border-noche-borde"
              }`}
            >
              <Star
                size={19}
                color={esFav ? "#d97706" : "#94a3b8"}
                fill={esFav ? "#f59e0b" : "transparent"}
                strokeWidth={2.2}
              />
            </TouchableOpacity>
          </View>
          <Text className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2.5">
            {limpio || t("nuevaCat.sinNombre")}
          </Text>
        </View>

        <View className="px-5">
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            placeholder={t("nuevaCat.nombrePlaceholder")}
            placeholderTextColor="#94a3b8"
            maxLength={24}
            className="border-[1.5px] border-slate-200 dark:border-noche-borde rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-noche-2"
          />
          {/* Dos categorías del mismo tipo llamadas igual no se pueden
            distinguir al anotar un gasto: se elige una al azar y los totales
            quedan repartidos sin que nadie entienda por qué. */}
          {repetido && (
            <Text className="text-[11px] text-rose-500 mt-1.5">{t("nuevaCat.repetido")}</Text>
          )}
        </View>

        {/* LAS PESTAÑAS. Favoritos va EN EL MEDIO de las tres de dibujo, a
              pedido del usuario, y el número al lado dice cuántos hay sin tener
              que entrar.

              "TUS CATEGORÍAS" ES UNA PESTAÑA, Y ESO TAMBIÉN LO PIDIÓ ÉL
              (06/08/2026, señalando en azul la lista que había arriba): *"la idea
              era que solo quede la parte de abajo y todo lo que esté de azul ya
              no esté, y donde dice o crea una nueva debería decir Tus
              categorías"*.
              Estuvo arriba, suelta, y ocupaba media pantalla antes del catálogo.
              De pestaña no ocupa nada hasta que se toca, y se sigue llegando en
              un toque. Es la única forma que encontramos de que la pantalla se
              abra en el catálogo —lo que él quería— sin perder lo que se usa en
              CADA gasto: elegir una categoría que ya existe.
              Solo aparece cuando se vino a elegir. Al editar "Broster" una lista
              para elegir otra no tendría ningún sentido. */}
        <View className="flex-row mx-5 mt-5 mb-1 border-b-[1.5px] border-slate-200 dark:border-noche-borde">
          {(eligiendo
            ? (["tuyas", "icono", "favoritos", "color"] as const)
            : (["icono", "favoritos", "color"] as const)
          ).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => irA(p)}
              className={`flex-1 items-center pb-2.5 ${
                pestana === p ? "border-b-2 border-emerald-600 -mb-[1.5px]" : ""
              }`}
            >
              <Text
                numberOfLines={1}
                className={`text-sm font-bold ${
                  pestana === p ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {p === "tuyas"
                  ? t("elegirCat.tuyas")
                  : p === "icono"
                    ? t("nuevaCat.tabIcono")
                    : p === "color"
                      ? t("nuevaCat.tabColor")
                      : `${t("nuevaCat.tabFavoritos")}${favoritos.length > 0 ? ` ${favoritos.length}` : ""}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </View>

      {/* El "px-5" del contenido de las pestañas es el MARGEN_LATERAL de las
          medidas, y de ahí sale el ancho de las casillas. Cambiar uno sin el
          otro descoloca la cuadrícula.

          LAS CUATRO PESTAÑAS SE QUEDAN PUESTAS, Y SOLO SE ESCONDE LA QUE NO TOCA.
          Esto es lo que hacía que la pantalla se sintiera lenta (07/08/2026:
          "cuando le doy a elegir categoría como que se demora en entrar a la
          pestaña donde están los iconos").
          Antes cada pestaña se dibujaba solo si era la elegida, así que al volver
          a la de los dibujos se construían LAS 236 CASILLAS OTRA VEZ — y otra vez
          en cada ida y vuelta. Con "display: none" se construyen una sola vez, al
          abrir, y cambiar de pestaña ya no cuesta nada.
          Yoga saca de la cuenta lo que lleva display none, así que la parte
          deslizable mide solo lo que se está viendo: no queda hueco vacío debajo. */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {vistas.has("tuyas") && (
          <View style={pestana === "tuyas" ? PESTANA_A_LA_VISTA : PESTANA_ESCONDIDA}>
            <View className="px-5" style={{ paddingTop: 12 }}>
              <View className="flex-row flex-wrap gap-3">
                {cats.map((c) => (
                  <CasillaCategoria
                    key={c.id}
                    id={c.id}
                    color={c.color}
                    // El nombre ya traducido, no la función de traducir: la función cambia
                    // en cada dibujado y con ella la memorización no valdría de nada.
                    nombre={t(c.label)}
                    // La marcada es la que se va a aplicar: la que se acaba de tocar o, si
                    // no se ha tocado ninguna, la que el movimiento ya lleva.
                    puesta={(elegida ?? actual) === c.id}
                    onElegir={elegirDeLaListaEstable}
                  />
                ))}
              </View>

              {/* EDITAR LA PROPIA QUE ESTÉ MARCADA.
                El nombre, el dibujo y el color ya se le pueden cambiar aquí
                mismo; lo que solo está ahí dentro es BORRARLA. Por eso el enlace
                se queda: es la única puerta a eso.
                Apunta a la marcada y no a la del movimiento — si se acaba de
                tocar "Broster", es esa la que se quiere abrir.
                Se descartó el toque largo a propósito: es invisible, y quien no
                lo sepa no lo encuentra nunca. */}
              {(() => {
                const suya = elegida ?? actual;
                if (!suya) return null;
                const info = catInfo(suya);
                return (
                  <>
                    {/* QUITARLE LA FOTO.
                      Se podía desde el principio —la casilla de la foto con su ✕
                      está en la pestaña del catálogo— pero ahí no la encuentra
                      nadie que venga de esta lista: hay que saber que la foto de
                      una categoría se quita desde donde se eligen los dibujos.
                      Pedido el 07/08/2026: *"las fotos o imágenes que suba en tus
                      categorías debería haber una opción o icono para poder
                      borrarlos"*.
                      Al tocarla, la categoría queda marcada con su foto ya
                      quitada, y se guarda al darle a Aplicar — como todo lo demás
                      de esta pantalla. Nada se pierde antes de confirmar. */}
                    {info.image ? (
                      <TouchableOpacity
                        onPress={() => {
                          elegirDeLaLista(suya);
                          setFoto(undefined);
                        }}
                        className="flex-row items-center justify-center gap-1.5 mt-5"
                      >
                        <Trash2 size={13} color="#e11d48" />
                        <Text className="text-xs font-bold text-rose-600">
                          {t("nuevaCat.quitarFotoDe", { nombre: info.label })}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {/* BORRARLA, AQUÍ MISMO.
                      Se podía —dentro de "Editar «X»", al final— y el usuario no
                      lo encontró: *"no me deja eliminar los iconos, en tus
                      categorías se quedan"* (07/08/2026). Es la segunda cosa que
                      resulta estar escondida detrás de ese enlace, así que ahora
                      está donde se está mirando.
                      Y NO se sale de la pantalla al borrar: se queda en la lista.
                      Quien borra una de sus pruebas normalmente borra tres, y
                      volver al movimiento tras cada una obligaría a entrar otra
                      vez.
                      Solo las propias: "Comida" y "Otros" son de la app, y
                      borrarlas dejaría movimientos apuntando a nada. */}
                    {esPropia(suya) ? (
                      borrando === suya ? (
                        <View className="mt-5 rounded-2xl border-[1.5px] border-rose-300 bg-rose-50 dark:bg-rose-900/20 p-3.5">
                          {/* CON EL NÚMERO DELANTE. "Se va a borrar" no informa
                            igual que "tus 3 movimientos pasan a Otros", y es
                            justo el dato que hace dudar o seguir. */}
                          <Text className="text-[11px] leading-5 text-rose-700 dark:text-rose-300">
                            {movimientosDeCategoria(suya) > 0
                              ? t("nuevaCat.borrarConMovs", { count: movimientosDeCategoria(suya) })
                              : t("nuevaCat.borrarSinMovs")}
                          </Text>
                          <View className="flex-row gap-2.5 mt-3">
                            <TouchableOpacity
                              onPress={() => setBorrando(null)}
                              className="flex-1 py-2.5 rounded-xl items-center border-[1.5px] border-slate-300 dark:border-noche-borde"
                            >
                              <Text className="text-xs font-bold text-slate-600 dark:text-slate-200">
                                {t("nuevaCat.cancelar")}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => borrarDeLaLista(suya)}
                              className="flex-1 py-2.5 rounded-xl items-center bg-rose-600"
                            >
                              <Text className="text-xs font-extrabold text-white">
                                {t("nuevaCat.borrarSi")}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setBorrando(suya)}
                          className="flex-row items-center justify-center gap-1.5 mt-4"
                        >
                          <Trash2 size={13} color="#e11d48" />
                          <Text className="text-xs font-bold text-rose-600">
                            {t("nuevaCat.borrarLa", { nombre: info.label })}
                          </Text>
                        </TouchableOpacity>
                      )
                    ) : null}
                  </>
                );
              })()}
            </View>
          </View>
        )}

        {vistas.has("color") && (
          <View style={pestana === "color" ? PESTANA_A_LA_VISTA : PESTANA_ESCONDIDA}>
            <View className="px-5" style={{ paddingTop: 12 }}>
              <View className="flex-row flex-wrap gap-3">
                {COLORES.map((c) => (
                  <CasillaColor key={c} color={c} puesto={color === c} onElegir={setColor} />
                ))}
              </View>
            </View>
          </View>
        )}

        {vistas.has("favoritos") && (
          <View style={pestana === "favoritos" ? PESTANA_A_LA_VISTA : PESTANA_ESCONDIDA}>
            <View className="px-5" style={{ paddingTop: 12 }}>
              {favoritos.length === 0 ? (
                /* VACÍA, PERO NO MUDA. Una pestaña vacía sin explicación deja a la
               persona sin saber si está roto o si le falta hacer algo. Aquí se
               dice exactamente qué hacer, y con la misma estrella que hay que
               tocar. */
                <View className="items-center py-10 px-6">
                  <Star size={30} color="#cbd5e1" strokeWidth={2} />
                  <Text className="text-xs text-center leading-5 text-slate-500 dark:text-slate-400 mt-3">
                    {t("nuevaCat.favVacio")}
                  </Text>
                </View>
              ) : (
                // Las mismas filas y el mismo tamaño de casilla que el catálogo: es
                // la misma elección, así que tiene que verse igual.
                //
                // "elegido" mira la foto ANTES que el dibujo, igual que la vista
                // previa: con una foto puesta, la marcada tiene que ser la foto y no
                // el dibujo que quedó debajo.
                filasDeFavoritos.map((fila, f) => (
                  <Fila
                    key={f}
                    iconos={fila}
                    normal={aspectoGris}
                    lado={lado}
                    onElegir={elegirFavorito}
                    onCancelar={cancelarMarca}
                  />
                ))
              )}
            </View>
          </View>
        )}

        {/* LOS 236 DIBUJOS PUESTOS, TODOS. Sin lista virtual, sin cargar por
            partes, sin nada que aparezca después.

            Esto sería impensable con dibujos vectoriales —armarlos tarda cerca de
            un segundo, y por eso hubo cinco intentos de repartir ese segundo en
            algún sitio donde no se notara—. Con la tipografía cada dibujo es una
            letra, así que los 236 salen de una y ya está. El arreglo no estuvo
            nunca en cómo organizar la lista: estuvo en de qué están hechos los
            dibujos. Ver constants/iconos.tsx.

            Y desde el 07/08/2026 se quedan puestos al cambiar de pestaña: antes se
            rehacían los 236 en cada ida y vuelta. Ver la nota de arriba. */}
        {vistas.has("icono") && (
          <View style={pestana === "icono" ? PESTANA_A_LA_VISTA : PESTANA_ESCONDIDA}>
            <View className="px-5">
              {/* TU PROPIA FOTO, PRIMERO.
              Va arriba del catálogo y no en una pestaña aparte porque es otra
              forma de contestar la misma pregunta —"¿con qué dibujo?"—, y una
              pestaña más la esconde. Son casillas del mismo tamaño que las
              demás para que se lean como parte de la misma elección. */}
              <View style={{ height: ALTO_TITULO, justifyContent: "center" }}>
                <Text className="text-xs font-bold text-slate-500 dark:text-slate-300">
                  {t("nuevaCat.tuFoto")}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  height: lado,
                  gap: SEPARACION,
                  marginBottom: SEPARACION,
                }}
              >
                <TouchableOpacity
                  onPress={tomarFoto}
                  style={{ width: lado, height: lado }}
                  className="rounded-2xl items-center justify-center bg-slate-50 dark:bg-noche-2 border-[1.5px] border-dashed border-slate-300 dark:border-noche-borde"
                >
                  <Camera size={22} color="#64748b" strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={elegirDeGaleria}
                  style={{ width: lado, height: lado }}
                  className="rounded-2xl items-center justify-center bg-slate-50 dark:bg-noche-2 border-[1.5px] border-dashed border-slate-300 dark:border-noche-borde"
                >
                  <ImageIcon size={22} color="#64748b" strokeWidth={2.2} />
                </TouchableOpacity>
                {/* La foto puesta, y encima la forma de sacarla. Sin esto, quien
                pone una foto no encuentra cómo volver a un dibujo: elegir un
                icono no la quitaría, porque la foto manda. */}
                {foto && (
                  <TouchableOpacity
                    onPress={() => setFoto(undefined)}
                    style={{ width: lado, height: lado }}
                    className={`rounded-2xl items-center justify-center overflow-hidden border-2 border-${color}-500`}
                  >
                    <Image source={{ uri: foto }} style={{ width: lado, height: lado }} />
                    <View className="absolute inset-0 items-center justify-center bg-slate-900/45">
                      <X size={20} color="#ffffff" strokeWidth={2.6} />
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              {/* LOS PRIMEROS GRUPOS AL ABRIR, Y EL RESTO EN TANDAS DE DOS FILAS.
                  Ver la nota larga de filasADibujar. Llegan solas, sin deslizar. */}
              {CATALOGO_EN_TROZOS.slice(0, filasADibujar).map((trozo, f) => (
                // Un fragmento y no una vista: envolver cada fila en su propia vista
                // añadiría 46 vistas que no pintan nada, y de eso justamente se trata.
                <Fragment key={f}>
                  {trozo.titulo !== null && <TituloDeGrupo texto={titulos[trozo.titulo]} />}
                  <Fila
                    iconos={trozo.fila}
                    normal={aspectoGris}
                    lado={lado}
                    onElegir={setIcono}
                    onCancelar={cancelarMarca}
                  />
                </Fragment>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View className="px-5" style={{ paddingBottom: insets.bottom + 16 }}>
        {/* BORRAR, solo al editar.
            Se pide confirmación en el sitio, no con una ventana: la ventana
            del sistema tapa la pantalla y no deja leer cuántos movimientos
            están en juego, que es justo el dato que importa. */}
        {editando &&
          (confirmandoBorrado ? (
            <View className="mb-3 rounded-2xl border-[1.5px] border-rose-300 bg-rose-50 dark:bg-rose-900/20 p-3.5">
              <Text className="text-[11px] leading-5 text-rose-700 dark:text-rose-300">
                {cuantos > 0
                  ? t("nuevaCat.borrarConMovs", { count: cuantos })
                  : t("nuevaCat.borrarSinMovs")}
              </Text>
              <View className="flex-row gap-2.5 mt-3">
                <TouchableOpacity
                  onPress={() => setConfirmandoBorrado(false)}
                  className="flex-1 py-2.5 rounded-xl items-center border-[1.5px] border-slate-300 dark:border-noche-borde"
                >
                  <Text className="text-xs font-bold text-slate-600 dark:text-slate-200">
                    {t("nuevaCat.cancelar")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={borrar}
                  className="flex-1 py-2.5 rounded-xl items-center bg-rose-600"
                >
                  <Text className="text-xs font-extrabold text-white">
                    {t("nuevaCat.borrarSi")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setConfirmandoBorrado(true)}
              className="flex-row items-center justify-center gap-2 py-3 mb-3"
            >
              <Trash2 size={15} color="#e11d48" />
              <Text className="text-sm font-bold text-rose-600">{t("nuevaCat.borrar")}</Text>
            </TouchableOpacity>
          ))}

        <TouchableOpacity
          onPress={guardar}
          disabled={!puedeGuardar}
          className={`py-4 rounded-2xl items-center ${
            puedeGuardar ? "bg-emerald-600" : "bg-slate-200 dark:bg-noche-2"
          }`}
        >
          <Text className={`font-extrabold ${puedeGuardar ? "text-white" : "text-slate-400"}`}>
            {t(editando ? "nuevaCat.guardar" : "nuevaCat.aplicar")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* EL RECORTADOR PROPIO, el mismo para cámara y galería.
          Encima de todo y no en otra pantalla: al volver de la cámara la app
          ya está aquí, con el nombre y el color que se iban escribiendo. */}
      {recortando && (
        <ImageCropper
          uri={recortando}
          onCancel={() => setRecortando(null)}
          onDone={(r) => {
            setFoto(r.base64);
            setRecortando(null);
          }}
          labels={{
            title: t("catCustom.cropTitle"),
            hint: t("catCustom.cropHint"),
            cancel: t("common.cancel"),
            save: t("common.save"),
            error: t("catCustom.cropError"),
          }}
        />
      )}
    </Animated.View>
  );
}
