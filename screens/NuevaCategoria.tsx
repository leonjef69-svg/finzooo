import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check, ChevronLeft, ImageIcon, Star, Trash2, X } from "lucide-react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import ImageCropper from "@/components/ImageCropper";
import { catInfo, gastosDisponibles, ingresosDisponibles } from "@/constants/categories";
import {
  ALTO_TITULO,
  CATALOGO_EN_FILAS,
  enFilas,
  GRUPOS_AL_ABRIR,
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
 * EL MEDIDOR DEL TOQUE. ES TEMPORAL: se quita en cuanto sepamos dónde está el retraso.
 *
 * Por qué existe. Se arreglaron SIETE causas de lentitud razonando sobre el código, y
 * el toque sigue sin sentirse instantáneo (07/08/2026: *"tocar un icono, ¿se marca al
 * instante? no"*). Buscar una octava leyendo sería el mismo error por octava vez: lo
 * que falta es un NÚMERO sacado del propio celular.
 *
 * LA PRIMERA VERSIÓN DE ESTE MEDIDOR MEDÍA MAL, y conviene dejarlo escrito porque el
 * error es fácil de repetir: contaba desde que el dedo se APOYA hasta que la casilla
 * está pintada. Pero la marca se decide cuando el dedo se LEVANTA, así que dentro de
 * ese número estaba el rato que la persona tuvo el dedo encima — que no es la app. Dio
 * 262 ms y no se podía saber cuánto era de cada uno.
 *
 * Ahora son tres datos, y cada uno señala un culpable distinto:
 *
 * - **dedo**: de apoyar a levantar. Es la persona, no el programa. Está aquí para poder
 *   restarlo, y para ver de un golpe si el resto es grande o chico al lado suyo.
 * - **app**: de levantar el dedo al cuadro en que ya se ve. ESTE es el único que
 *   podemos arreglar. Si sale de unas decenas de milisegundos, no hay nada que arreglar
 *   por el lado de la velocidad.
 * - **filas**: cuántas se rehicieron. Tienen que ser DOS. Si salen 48, la memorización
 *   no funciona en el celular — y eso no se puede ver leyendo, porque el código parece
 *   correcto. En la primera medición salieron 2, así que esa parte está bien.
 */
const MEDIDOR = { abajo: 0, suelta: 0, filas: 0 };

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
function aspectoDeCasilla(color: string, lado: number, oscuro: boolean): AspectoCasilla {
  const medida = { width: lado, height: lado, borderRadius: 16 } as const;
  return {
    normal: {
      ...medida,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: oscuro ? "#1e293b" : "#f8fafc",
      borderWidth: 1.5,
      borderColor: oscuro ? "#334155" : "#e2e8f0",
    },
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
  elegido,
  aspecto,
  lado,
  onElegir,
}: {
  id: string;
  elegido: boolean;
  aspecto: AspectoCasilla;
  /** Medida del cuadrado, calculada del ancho de la pantalla. Ver LADO_DE. */
  lado: number;
  onElegir: (id: string) => void;
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
   * Ahora la casilla se marca ella misma en cuanto la tocan, sin preguntarle a nadie:
   * no se rehace ninguna fila, no hay nada que esperar, aparece en el mismo cuadro.
   * Cuando el dedo se levanta llega la marca de verdad —"elegido"— y como ya estaba
   * pintada, no se ve ningún cambio.
   *
   * Los tres cabos que hay que atar, y que son el motivo de que esto tenga tres piezas
   * en vez de una:
   *
   *  1. Si el dedo era el principio de un DESLIZÓN y no un toque, no se eligió nada:
   *     hay que despintarla. Eso lo dice "onPressOut sin onPress".
   *  2. Si sí se eligió, NO se despinta al levantar el dedo, o parpadearía en el hueco
   *     entre soltarlo y que llegue la marca de verdad.
   *  3. Y cuando se elige OTRA casilla, esta tiene que despintarse aunque nadie la
   *     toque. De eso se encarga el efecto: mira cuándo deja de ser la elegida.
   */
  const [tocada, setTocada] = useState(false);
  const eligio = useRef(false);
  useEffect(() => {
    if (!elegido) setTocada(false);
  }, [elegido]);
  const marcada = elegido || tocada;

  return (
    // SE PROBÓ CAMBIARLO POR PRESSABLE Y ROMPIÓ LA CUADRÍCULA. NO REPETIRLO.
    //
    // La idea era buena: TouchableOpacity trae dentro una vista animada para bajar
    // la opacidad al tocarla, y eran 236 valores animados creados al abrir sin que
    // ninguno haga nada hasta que se toca uno.
    //
    // Pero para dar ese aviso con Pressable hay que pasar la medida en una FUNCIÓN
    // —style={({pressed}) => [...]}— y ahí se rompe: las clases de NativeWind también
    // se aplican por "style", y con una función de por medio el ancho y el alto no
    // llegan. Las casillas salieron como pastillas altas y estrechas en vez de
    // cuadrados. Lo vio el usuario en el celular el 07/08/2026: "no quiero que se
    // vea así, estaba bien como estaba antes".
    //
    // El ahorro que sí valía era otro y se quedó: las pestañas ya no se rehacen al
    // cambiar (ver la nota del display) y solo recortan las casillas con foto.
    <TouchableOpacity
      onPressIn={() => {
        // Se pinta YA. Ver la nota de "tocada": esto es todo el arreglo del toque.
        eligio.current = false;
        setTocada(true);
        // MEDIDOR TEMPORAL: el instante en que el toque llega al código.
        MEDIDOR.abajo = Date.now();
        MEDIDOR.filas = 0;
      }}
      onPress={() => {
        eligio.current = true;
        // MEDIDOR TEMPORAL: el instante en que se levantó el dedo. Lo de antes es la
        // persona; lo de después, la app. Ver MEDIDOR.
        MEDIDOR.suelta = Date.now();
        onElegir(id);
      }}
      onPressOut={() => {
        // Era el principio de un deslizón, no un toque: no se eligió nada.
        if (!eligio.current) setTocada(false);
      }}
      // SIN NINGUNA CLASE, y ahí está el arreglo. Ver aspectoDeCasilla: el aspecto
      // ya viene calculado y las 236 comparten el mismo objeto.
      //
      // El recorte solo cuando hay foto: obliga a Android a darle a esa casilla su
      // propia capa para cortar lo que sobresale, y un dibujo de la tipografía cabe
      // dentro y no sobresale de nada.
      style={
        foto
          ? [marcada ? aspecto.elegida : aspecto.normal, { overflow: "hidden" }]
          : marcada
            ? aspecto.elegida
            : aspecto.normal
      }
    >
      {D ? (
        <D size={22} color={marcada ? aspecto.tinta : "#64748b"} strokeWidth={2.2} />
      ) : (
        <Image source={{ uri: id }} style={{ width: lado, height: lado }} />
      )}
    </TouchableOpacity>
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
 * Pasando nulo a las filas que no contienen al elegido, esas filas reciben lo mismo
 * que antes (nulo) y la memorización las deja fuera. Solo se rehacen DOS: la que
 * suelta la marca y la que la toma.
 */
const Fila = memo(function Fila({
  iconos,
  elegido,
  aspecto,
  lado,
  onElegir,
}: {
  iconos: (string | null)[];
  /** El dibujo elegido SI está en esta fila; si no, nulo. */
  elegido: string | null;
  aspecto: AspectoCasilla;
  lado: number;
  onElegir: (id: string) => void;
}) {
  // MEDIDOR TEMPORAL: cada vez que una fila se rehace, se cuenta. Ver MEDIDOR arriba.
  MEDIDOR.filas++;
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
            elegido={elegido === id}
            aspecto={aspecto}
            lado={lado}
            onElegir={onElegir}
          />
        ),
      )}
    </View>
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
   *   · Esto son DOS tandas. La primera llena más de tres pantallas, así que lo que
   *     se ve está completo desde el primer instante; la segunda trae TODO el resto
   *     de una vez, fuera de la vista.
   *
   * La espera es lo que dura la animación de entrada. Antes se acaba y el trabajo la
   * atropella; mucho después y un deslizón muy rápido podría llegar al final de lo
   * dibujado.
   */
  const [gruposADibujar, setGruposADibujar] = useState(GRUPOS_AL_ABRIR);
  useEffect(() => {
    if (gruposADibujar >= CATALOGO_EN_FILAS.length) return;
    const reloj = setTimeout(() => setGruposADibujar(CATALOGO_EN_FILAS.length), ESPERA_RESTO_MS);
    return () => clearTimeout(reloj);
  }, [gruposADibujar]);

  /**
   * EL MEDIDOR TEMPORAL, la mitad que para el cronómetro. Ver MEDIDOR arriba.
   *
   * El requestAnimationFrame es lo que hace que el número signifique algo: este efecto
   * corre cuando el cambio ya está hecho, pero ANTES de que la pantalla lo muestre. Lo
   * que se quiere medir es hasta que se VE, así que se espera al siguiente cuadro.
   */
  const [medida, setMedida] = useState<string | null>(null);
  useEffect(() => {
    if (!MEDIDOR.abajo || !MEDIDOR.suelta) return;
    const dedo = MEDIDOR.suelta - MEDIDOR.abajo;
    const suelta = MEDIDOR.suelta;
    const filas = MEDIDOR.filas;
    MEDIDOR.abajo = 0;
    MEDIDOR.suelta = 0;
    const cuadro = requestAnimationFrame(() =>
      setMedida(`dedo ${dedo} · app ${Date.now() - suelta} ms · ${filas}`)
    );
    return () => cancelAnimationFrame(cuadro);
  }, [icono]);
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
  const aspecto = useMemo(
    () => aspectoDeCasilla(color, lado, colorScheme === "dark"),
    [color, lado, colorScheme],
  );

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
    <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
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
                esFav ? "bg-amber-100 border-amber-400" : "border-slate-300 dark:border-slate-600"
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
            className="border-[1.5px] border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
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
        <View className="flex-row mx-5 mt-5 mb-1 border-b-[1.5px] border-slate-200 dark:border-slate-700">
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

        {/* EL NÚMERO DEL MEDIDOR. TEMPORAL, se quita con el resto. Ver MEDIDOR.
            Se pone aquí y no escondido en un registro porque el que tiene que leerlo
            es él, en su celular, y contármelo. Dice los milisegundos y cuántas filas
            se rehicieron; deberían ser 2. */}
        {medida !== null && (
          <Text className="text-[10px] text-slate-400 text-center mt-1">
            {t("nuevaCat.medida", { medida })}
          </Text>
        )}
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
          <View style={{ display: pestana === "tuyas" ? "flex" : "none" }}>
            <View className="px-5" style={{ paddingTop: 12 }}>
              <View className="flex-row flex-wrap gap-3">
                {cats.map((c) => {
                  // La marcada es la que se va a aplicar: la que se acaba de tocar
                  // o, si no se ha tocado ninguna, la que el movimiento ya lleva.
                  const puesta = (elegida ?? actual) === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      // Tocarla la ELIGE, no cierra la pantalla. Ver elegirDeLaLista:
                      // volver de golpe dejaba las otras pestañas sin poder usarse
                      // sobre una categoría que ya existe.
                      onPress={() => elegirDeLaLista(c.id)}
                      className="items-center gap-1.5"
                      style={{ width: "21%" }}
                    >
                      <View
                        className={`w-12 h-12 rounded-2xl items-center justify-center bg-${c.color}-100 ${
                          puesta ? `border-2 border-${c.color}-500` : ""
                        }`}
                      >
                        <CategoryAvatar id={c.id} size={20} />
                      </View>
                      <Text
                        className={`text-xs font-bold text-center ${
                          puesta ? `text-${c.color}-600` : "text-slate-600 dark:text-slate-200"
                        }`}
                        numberOfLines={1}
                      >
                        {t(c.label)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
                              className="flex-1 py-2.5 rounded-xl items-center border-[1.5px] border-slate-300 dark:border-slate-600"
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
          <View style={{ display: pestana === "color" ? "flex" : "none" }}>
            <View className="px-5" style={{ paddingTop: 12 }}>
              <View className="flex-row flex-wrap gap-3">
                {COLORES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setColor(c)}
                    className={`w-12 h-12 rounded-full items-center justify-center ${
                      color === c ? "border-[3px] border-slate-900 dark:border-white" : ""
                    }`}
                    style={{ backgroundColor: COLOR_HEX_600[c] }}
                  >
                    {color === c && <Check size={18} color="#ffffff" />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {vistas.has("favoritos") && (
          <View style={{ display: pestana === "favoritos" ? "flex" : "none" }}>
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
                enFilas(favoritos).map((fila, f) => (
                  <Fila
                    key={f}
                    iconos={fila}
                    elegido={fila.includes(loQueSeMarca) ? loQueSeMarca : null}
                    aspecto={aspecto}
                    lado={lado}
                    onElegir={elegirFavorito}
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
          <View style={{ display: pestana === "icono" ? "flex" : "none" }}>
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
                  className="rounded-2xl items-center justify-center bg-slate-50 dark:bg-slate-800 border-[1.5px] border-dashed border-slate-300 dark:border-slate-600"
                >
                  <Camera size={22} color="#64748b" strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={elegirDeGaleria}
                  style={{ width: lado, height: lado }}
                  className="rounded-2xl items-center justify-center bg-slate-50 dark:bg-slate-800 border-[1.5px] border-dashed border-slate-300 dark:border-slate-600"
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

              {/* LOS PRIMEROS GRUPOS AL ABRIR, EL RESTO JUSTO DESPUÉS Y DE UNA VEZ.
                  Ver la nota larga de gruposADibujar: no es cargar por partes, son
                  DOS tandas, y la primera llena tres pantallas. */}
              {CATALOGO_EN_FILAS.slice(0, gruposADibujar).map((grupo) => (
                <View key={grupo.titulo}>
                  <View style={{ height: ALTO_TITULO, justifyContent: "center" }}>
                    <Text className="text-xs font-bold text-slate-500 dark:text-slate-300">
                      {titulos[grupo.titulo]}
                    </Text>
                  </View>
                  {grupo.filas.map((fila, f) => (
                    <Fila
                      key={f}
                      iconos={fila}
                      elegido={fila.includes(icono) ? icono : null}
                      aspecto={aspecto}
                      lado={lado}
                      onElegir={setIcono}
                    />
                  ))}
                </View>
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
                  className="flex-1 py-2.5 rounded-xl items-center border-[1.5px] border-slate-300 dark:border-slate-600"
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
            puedeGuardar ? "bg-emerald-600" : "bg-slate-200 dark:bg-slate-800"
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
    </View>
  );
}
