import type { ComponentType } from "react";
import { Text } from "react-native";
import * as Font from "expo-font";
import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import type { IconComponent } from "@/constants/categories";

/**
 * TODOS LOS DIBUJOS QUE SE PUEDEN ELEGIR AL CREAR UNA CATEGORÍA.
 *
 * TODOS SON TIPOGRAFÍA, Y ESA ES LA DECISIÓN IMPORTANTE DE ESTE ARCHIVO
 *
 * Antes los genéricos eran dibujos vectoriales (lucide), importados uno a uno.
 * Se veían muy bien y costaron cinco entregas de dolores de cabeza: armar 236
 * dibujos vectoriales tarda cerca de un segundo en un celular normal, y ese
 * segundo no se puede esconder. Se intentó de todo —memorizar, virtualizar la
 * lista, darle medidas, armar por grupos— y el usuario lo encontraba siempre,
 * porque estaba ahí:
 *
 *   "deslizo rápidamente y los iconos no cargan, los iconos ya deberían estar
 *    ahí fijos"  (05/08/2026)
 *
 * Una tipografía no se arma: se pinta, como una letra. Los 236 salen de una y
 * no hay nada que cargar nunca. Los logos de marca ya funcionaban así y nunca
 * dieron un solo problema — eso fue la pista.
 *
 * Lo que se paga: los dibujos no son idénticos a los de antes. Son de línea
 * igual y del mismo estilo, pero no los mismos trazos.
 *
 * LOS IDENTIFICADORES NO CAMBIAN. Una categoría guardada dice `icono: "Coffee"`,
 * y sigue diciéndolo. Renombrarlos habría dejado sin dibujo a todas las
 * categorías que la persona ya creó, y a las copias de nube viejas.
 *
 * ---- POR QUÉ NO HAY NI UN LOGO DE BANCO ----
 *
 * Ni bancos, ni Visa, ni Mastercard, ni PayPal, ni Yape. Y no es un olvido.
 *
 * Todo logo es marca registrada. Lo que cambia es la probabilidad de que su
 * dueño se moleste, y ahí los financieros son otro nivel: una app de dinero
 * mostrando el logo de un banco es exactamente lo que hace pensar "esto tiene
 * relación con mi banco". Es el reclamo más fácil de recibir y el más difícil
 * de defender.
 *
 * Un logo de Spotify en una categoría de gastos no confunde a nadie sobre
 * quién hizo la app. El de un banco, sí.
 *
 * Se decidió con el usuario el 03/08/2026, sabiendo que ni así el riesgo es
 * cero: si algún día alguien reclama, quitar esa marca es borrar una línea de
 * la lista de abajo. Por eso están todas juntas en un solo sitio.
 */

export type GrupoIconos = {
  /** Clave de traducción del título del grupo. */
  titulo: string;
  iconos: string[];
};

// El identificador de una marca lleva prefijo. Sin él, una marca llamada
// igual que un icono genérico taparía al otro sin que nadie lo notara.
const MARCA = "marca:";

export function esMarca(id: string): boolean {
  return id.startsWith(MARCA);
}

/**
 * El componente de un logo, con la misma forma que uno de línea.
 *
 * SE GUARDA EL QUE YA SE HIZO, Y ESO NO ES UN ADORNO
 *
 * Sin esta tabla, cada llamada devolvía un componente RECIÉN CREADO. Para
 * React eso no es "el mismo dibujo otra vez": es un componente distinto, así
 * que tira el anterior y construye el nuevo desde cero.
 *
 * En la pantalla de crear categoría se dibujan 55 logos a la vez, y esa
 * pantalla se redibuja con CADA LETRA que se escribe en el nombre. Resultado:
 * 55 componentes destruidos y creados por pulsación, y la escritura se sentía
 * pegajosa. Lo reportó el usuario el 04/08/2026.
 */
const LOGOS_HECHOS = new Map<string, IconComponent>();

function logo(nombre: string): IconComponent {
  const guardado = LOGOS_HECHOS.get(nombre);
  if (guardado) return guardado;

  // Se ignora strokeWidth: un logo es una silueta rellena, no un trazo.
  const Logo: ComponentType<{ size?: number; color?: string; strokeWidth?: number }> = ({
    size = 20,
    color = "#475569",
  }) => <FontAwesome5 name={nombre} size={size} color={color} brand />;
  Logo.displayName = "Logo" + nombre;
  LOGOS_HECHOS.set(nombre, Logo);
  return Logo;
}

/** Igual que los logos, pero de la tipografía de dibujos genéricos. */
const DIBUJOS_HECHOS = new Map<string, IconComponent>();

/**
 * LA LETRA Y LA TIPOGRAFÍA, PEDIDAS UNA VEZ.
 *
 * Un dibujo de esta tipografía es literalmente una letra: la tabla dice qué número
 * de letra le toca a cada nombre. Con eso se puede pintar con un texto normal.
 */
const GLIFOS = MaterialCommunityIcons.getRawGlyphMap() as Record<string, number>;
const FAMILIA = MaterialCommunityIcons.getFontFamily();

/**
 * SE PIDE LA TIPOGRAFÍA AL CARGAR ESTE ARCHIVO. NO QUITAR.
 *
 * Quien la pedía era el componente de Expo, la primera vez que se dibujaba un icono.
 * Al dejar de usarlo (ver dibujo() abajo) nadie la pediría, y entonces cada dibujo
 * caería en el camino de reserva —el componente de Expo— y no habríamos ganado nada.
 *
 * Aquí se pide una sola vez, al arrancar la app, mucho antes de que alguien pueda
 * abrir el catálogo. La tipografía viene DENTRO del APK, así que no hay descarga ni
 * espera de internet: son unos milisegundos leyendo del propio archivo de la app.
 *
 * Y no se espera el resultado a propósito: si tardara o fallara, los dibujos usan el
 * camino de reserva y se ven igual. Nada se queda en blanco por esto.
 */
void MaterialCommunityIcons.loadFont();

/**
 * ESTO NO USA EL COMPONENTE DE EXPO, Y ES EL ARREGLO DE LA LENTITUD (07/08/2026)
 *
 * El usuario midió *"2 a 3 segundos en entrar"* en la pantalla del catálogo, y tras
 * arreglar seis causas seguía lento. Al abrir el componente de Expo por dentro
 * apareció por qué, y no era ninguna suposición:
 *
 *   · Cada icono de Expo es una CLASE CON ESTADO. En su constructor pregunta si la
 *     tipografía está cargada; si no lo está, **dibuja un texto vacío**, pide la
 *     tipografía y se vuelve a dibujar con setState. Con 227 iconos eso son 227
 *     peticiones y 227 redibujados sueltos.
 *   · Y aunque ya esté cargada, cada icono son DOS componentes anidados —el de Expo
 *     y el suyo de dentro— más el texto. Por casilla salían cuatro piezas.
 *
 * Aquí se pinta el texto directamente: **una pieza en vez de tres**. El número de
 * letra se calcula UNA vez, al crear el dibujo, no en cada dibujado.
 *
 * SE COPIA EXACTAMENTE LO QUE HACE EL DE EXPO por dentro, para que se vea igual:
 * mismo peso y estilo normal (sin eso, la tipografía de dibujos hereda la negrita
 * de alrededor y sale deforme) y sin escalar con el tamaño de letra del sistema
 * (allowFontScaling en falso) — si escalara, con la letra grande de Android los
 * dibujos se saldrían de su casilla.
 *
 * Y SI LA TIPOGRAFÍA NO ESTUVIERA LISTA, se cae al componente de Expo, que sabe
 * esperarla. Es la única cosa que aquel hacía y esto no.
 */
function dibujo(id: string, nombre: string): IconComponent {
  const guardado = DIBUJOS_HECHOS.get(id);
  if (guardado) return guardado;

  const codigo = GLIFOS[nombre];
  const letra = typeof codigo === "number" ? String.fromCodePoint(codigo) : "";

  // Se ignora strokeWidth por lo mismo que en los logos: el grosor del trazo
  // viene en la tipografía y no se puede pedir aparte.
  const Dibujo: ComponentType<{ size?: number; color?: string; strokeWidth?: number }> = ({
    size = 20,
    color = "#475569",
  }) => {
    if (!letra || !Font.isLoaded(FAMILIA)) {
      return <MaterialCommunityIcons name={nombre as never} size={size} color={color} />;
    }
    return (
      <Text
        selectable={false}
        allowFontScaling={false}
        style={{
          fontFamily: FAMILIA,
          fontSize: size,
          color,
          fontWeight: "normal",
          fontStyle: "normal",
        }}
      >
        {letra}
      </Text>
    );
  };
  Dibujo.displayName = "Dibujo" + id;
  DIBUJOS_HECHOS.set(id, Dibujo);
  return Dibujo;
}

/**
 * De identificador guardado al nombre en la tipografía.
 *
 * La izquierda son los identificadores de siempre y NO se tocan: es lo que hay
 * guardado en las categorías de la persona y en sus copias de nube. La derecha
 * es el nombre del dibujo dentro de la tipografía, y esos 172 nombres se
 * comprobaron uno por uno contra la lista real antes de escribirlos aquí — hay
 * una prueba que lo vuelve a comprobar, porque un nombre inventado no da error:
 * simplemente no dibuja nada y la casilla sale vacía.
 */
const GENERICOS: Record<string, string> = {
  Utensils: "silverware-fork-knife", UtensilsCrossed: "silverware", Coffee: "coffee-outline",
  Pizza: "pizza", Beef: "food-steak", Sandwich: "hamburger", IceCreamCone: "ice-cream",
  CakeSlice: "cake-variant-outline", Apple: "food-apple-outline", Carrot: "carrot",
  Fish: "fish", EggFried: "egg-fried", Beer: "beer-outline", Wine: "glass-wine",
  CupSoda: "cup-outline", Milk: "bottle-soda-outline", Croissant: "food-croissant",
  Soup: "bowl-mix-outline", Salad: "leaf", Cookie: "cookie-outline", Popcorn: "popcorn",
  Candy: "candy-outline", Ham: "pig-variant-outline", Drumstick: "food-drumstick-outline",

  Car: "car-outline", Bus: "bus", TrainFront: "train", Plane: "airplane", Bike: "bike",
  Fuel: "gas-station-outline", CircleParking: "parking", TramFront: "tram", Ship: "ferry",
  Truck: "truck-outline", CarTaxiFront: "taxi", Footprints: "shoe-print",
  Sailboat: "sail-boat", Caravan: "rv-truck", Ambulance: "ambulance",

  ShoppingBag: "shopping-outline", ShoppingCart: "cart-outline", ShoppingBasket: "basket-outline",
  Store: "store-outline", Tag: "tag-outline", Tags: "tag-multiple-outline", Gift: "gift-outline",
  Package: "package-variant-closed", Shirt: "tshirt-crew-outline", Watch: "watch",
  Glasses: "glasses", Gem: "diamond-stone", Backpack: "bag-personal-outline", Baby: "baby-carriage",

  Film: "movie-outline", Gamepad2: "gamepad-variant-outline", Music: "music", Tv: "television",
  Ticket: "ticket-outline", Drama: "drama-masks", Guitar: "guitar-acoustic",
  Headphones: "headphones", PartyPopper: "party-popper", Dices: "dice-multiple-outline",
  Puzzle: "puzzle-outline", Clapperboard: "movie-open-outline", Radio: "radio",
  Mic: "microphone-outline", Camera: "camera-outline", BookOpen: "book-open-outline",
  Palette: "palette-outline",

  House: "home-outline", Sofa: "sofa-outline", Bed: "bed-outline", Lamp: "lamp-outline",
  Refrigerator: "fridge-outline", WashingMachine: "washing-machine", ShowerHead: "shower-head",
  Toilet: "toilet", Armchair: "seat-outline", DoorOpen: "door-open", Wrench: "wrench-outline",
  Hammer: "hammer", PaintRoller: "format-paint", Plug: "power-plug-outline",
  Trash2: "trash-can-outline", Flower2: "flower-outline", TreePine: "pine-tree", Blinds: "blinds",

  HeartPulse: "heart-pulse", Pill: "pill", Stethoscope: "stethoscope", Syringe: "needle",
  Cross: "medical-bag", Activity: "pulse", Brain: "brain", Eye: "eye-outline",
  Bandage: "bandage", Thermometer: "thermometer", Hospital: "hospital-building",

  GraduationCap: "school-outline", Book: "book-outline", Library: "bookshelf",
  Pencil: "pencil-outline", NotebookPen: "notebook-edit-outline", School: "town-hall",
  Calculator: "calculator", Microscope: "microscope", Ruler: "ruler",

  Briefcase: "briefcase-outline", Laptop: "laptop", TrendingUp: "trending-up",
  Crown: "crown-outline", HandCoins: "hand-coin-outline", Key: "key-outline",
  Coins: "cash-multiple", Wallet: "wallet-outline", CreditCard: "credit-card-outline",
  Banknote: "cash", PiggyBank: "piggy-bank-outline", Receipt: "receipt", Landmark: "bank-outline",
  ChartColumn: "chart-bar", ChartPie: "chart-pie", Handshake: "handshake-outline",
  Percent: "percent-outline", Trophy: "trophy-outline", Medal: "medal-outline",
  BadgeDollarSign: "cash-check",

  Zap: "flash-outline", Droplet: "water-outline", Flame: "fire", Wifi: "wifi",
  Phone: "phone-outline", Smartphone: "cellphone", Signal: "signal", Cloud: "cloud-outline",
  Repeat: "repeat", CalendarClock: "calendar-clock-outline", Router: "router-wireless",
  MonitorSmartphone: "monitor-cellphone",

  PawPrint: "paw-outline", Dog: "dog", Cat: "cat", Bird: "bird", Bone: "bone",
  Rabbit: "rabbit", Turtle: "turtle",

  Dumbbell: "dumbbell", Volleyball: "volleyball", WavesHorizontal: "waves",
  Mountain: "image-filter-hdr", Tent: "tent", Target: "target", Timer: "timer-outline",

  Ellipsis: "dots-horizontal", Star: "star-outline", Heart: "heart-outline",
  Bookmark: "bookmark-outline", Flag: "flag-outline", MapPin: "map-marker-outline",
  Calendar: "calendar-blank-outline", Clock: "clock-outline", Users: "account-group-outline",
  User: "account-outline", Shield: "shield-outline", Sparkles: "auto-fix",
  Lightbulb: "lightbulb-outline", Rocket: "rocket-outline", Anchor: "anchor",
  Umbrella: "umbrella-outline", Snowflake: "snowflake", Sun: "white-balance-sunny",

  // No sale en el catálogo de elegir, pero lo usa la categoría de fábrica
  // "Otro ingreso". Estar aquí es lo que la deja del mismo estilo que el resto.
  PlusCircle: "plus-circle-outline",
};

/**
 * La misma tabla, para las pruebas.
 *
 * Está expuesta porque un nombre de tipografía mal escrito NO da error: la
 * casilla sale vacía y nadie se entera hasta que alguien la mira. La prueba los
 * compara con la lista real de nombres de la tipografía, uno por uno.
 *
 * Para dibujar se usa iconoDe, no esto.
 */
export const NOMBRES_EN_TIPOGRAFIA: Readonly<Record<string, string>> = GENERICOS;

/** Se usa cuando el identificador guardado ya no existe. Ver iconoDe. */
const DE_RESPALDO = "Ellipsis";

/**
 * El dibujo que corresponde a un identificador guardado.
 *
 * ANTE LA DUDA DEVUELVE ALGO. Un identificador que ya no existe —porque se
 * quitó una marca, o porque llegó de una copia de nube más nueva— no puede
 * dejar la pantalla en blanco: se cae en los puntos suspensivos y se sigue.
 */
export function iconoDe(id: string): IconComponent {
  if (esMarca(id)) return logo(id.slice(MARCA.length));
  const nombre = GENERICOS[id];
  if (nombre) return dibujo(id, nombre);
  return dibujo(DE_RESPALDO, GENERICOS[DE_RESPALDO]);
}

/** Los genéricos, agrupados como se enseñan en la pantalla de elegir. */
// Sin "export": el unico consumidor es TODOS_LOS_GRUPOS, mas abajo. Cuando los
// dos grupos se exportaban, alguien (yo) armo una SEGUNDA lista juntandolos en
// otro archivo, y dos listas de lo mismo es una que se queda atras.
const GRUPOS_GENERICOS: GrupoIconos[] = [
  { titulo: "iconos.comida", iconos: ["Utensils","UtensilsCrossed","Coffee","Pizza","Beef","Sandwich","IceCreamCone","CakeSlice","Apple","Carrot","Fish","EggFried","Beer","Wine","CupSoda","Milk","Croissant","Soup","Salad","Cookie","Popcorn","Candy","Ham","Drumstick"] },
  { titulo: "iconos.transporte", iconos: ["Car","Bus","TrainFront","Plane","Bike","Fuel","CircleParking","TramFront","Ship","Truck","CarTaxiFront","Footprints","Sailboat","Caravan","Ambulance"] },
  { titulo: "iconos.compras", iconos: ["ShoppingBag","ShoppingCart","ShoppingBasket","Store","Tag","Tags","Gift","Package","Shirt","Watch","Glasses","Gem","Backpack","Baby"] },
  { titulo: "iconos.ocio", iconos: ["Film","Gamepad2","Music","Tv","Ticket","Drama","Guitar","Headphones","PartyPopper","Dices","Puzzle","Clapperboard","Radio","Mic","Camera","BookOpen","Palette"] },
  { titulo: "iconos.hogar", iconos: ["House","Sofa","Bed","Lamp","Refrigerator","WashingMachine","ShowerHead","Toilet","Armchair","DoorOpen","Wrench","Hammer","PaintRoller","Plug","Trash2","Flower2","TreePine","Blinds"] },
  { titulo: "iconos.salud", iconos: ["HeartPulse","Pill","Stethoscope","Syringe","Cross","Activity","Brain","Eye","Bandage","Thermometer","Hospital"] },
  { titulo: "iconos.educacion", iconos: ["GraduationCap","Book","Library","Pencil","NotebookPen","School","Calculator","Microscope","Ruler"] },
  { titulo: "iconos.dinero", iconos: ["Briefcase","Laptop","TrendingUp","Crown","HandCoins","Key","Coins","Wallet","CreditCard","Banknote","PiggyBank","Receipt","Landmark","ChartColumn","ChartPie","Handshake","Percent","Trophy","Medal","BadgeDollarSign"] },
  { titulo: "iconos.servicios", iconos: ["Zap","Droplet","Flame","Wifi","Phone","Smartphone","Signal","Cloud","Repeat","CalendarClock","Router","MonitorSmartphone"] },
  { titulo: "iconos.mascotas", iconos: ["PawPrint","Dog","Cat","Bird","Bone","Rabbit","Turtle"] },
  { titulo: "iconos.deporte", iconos: ["Dumbbell","Volleyball","WavesHorizontal","Mountain","Tent","Target","Timer"] },
  { titulo: "iconos.otros", iconos: ["Ellipsis","Star","Heart","Bookmark","Flag","MapPin","Calendar","Clock","Users","User","Shield","Sparkles","Lightbulb","Rocket","Anchor","Umbrella","Snowflake","Sun"] },
];

/**
 * Las marcas. NINGUNA financiera — ver la explicación de arriba.
 *
 * Para quitar una: se borra de aquí y desaparece de la pantalla. Los que ya la
 * tuvieran puesta caen en los puntos suspensivos, sin romperse nada.
 */
const GRUPOS_MARCAS: GrupoIconos[] = [
  { titulo: "iconos.streaming", iconos: ["marca:youtube","marca:spotify","marca:soundcloud","marca:deezer","marca:itunes","marca:napster","marca:audible","marca:vimeo","marca:dailymotion","marca:imdb"] },
  { titulo: "iconos.juegos", iconos: ["marca:steam","marca:playstation","marca:xbox","marca:twitch","marca:itch-io","marca:battle-net","marca:unity","marca:discord"] },
  { titulo: "iconos.redes", iconos: ["marca:instagram","marca:facebook","marca:whatsapp","marca:telegram","marca:tiktok","marca:twitter","marca:snapchat","marca:reddit","marca:pinterest","marca:linkedin"] },
  { titulo: "iconos.tiendas", iconos: ["marca:amazon","marca:ebay","marca:shopify","marca:etsy","marca:google-play","marca:app-store"] },
  // "iconos.apps", NO "iconos.servicios": ese nombre ya lo usa el grupo de luz,
  // agua e internet de arriba. Compartirlo hacia dos cosas malas a la vez — el
  // titulo "Servicios" salia dos veces en la pantalla, y los renglones de los
  // dos grupos quedaban con la misma clave, que es de lo que se agarra la lista
  // para saber que dibujar donde.
  { titulo: "iconos.apps", iconos: ["marca:uber","marca:airbnb","marca:dropbox","marca:patreon","marca:kickstarter","marca:goodreads","marca:wordpress"] },
  { titulo: "iconos.tecnologia", iconos: ["marca:apple","marca:android","marca:windows","marca:microsoft","marca:google","marca:chrome","marca:firefox","marca:github","marca:gitlab","marca:figma","marca:slack","marca:trello","marca:ubuntu","marca:docker"] },
];

export const TODOS_LOS_GRUPOS: GrupoIconos[] = [...GRUPOS_GENERICOS, ...GRUPOS_MARCAS];
