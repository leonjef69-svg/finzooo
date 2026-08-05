import type { ComponentType } from "react";
import { FontAwesome5 } from "@expo/vector-icons";
import {
  Utensils, UtensilsCrossed, Coffee, Pizza, Beef, Sandwich, IceCreamCone, CakeSlice,
  Apple, Carrot, Fish, EggFried, Beer, Wine, CupSoda, Milk, Croissant, Soup, Salad,
  Cookie, Popcorn, Candy, Ham, Drumstick,
  Car, Bus, TrainFront, Plane, Bike, Fuel, CircleParking, TramFront, Ship, Truck,
  CarTaxiFront, Footprints, Sailboat, Caravan, Ambulance,
  ShoppingBag, ShoppingCart, ShoppingBasket, Store, Tag, Tags, Gift, Package, Shirt,
  Watch, Glasses, Gem, Backpack, Baby,
  Film, Gamepad2, Music, Tv, Ticket, Drama, Guitar, Headphones, PartyPopper, Dices,
  Puzzle, Clapperboard, Radio, Mic, Camera, BookOpen, Palette,
  House, Sofa, Bed, Lamp, Refrigerator, WashingMachine, ShowerHead, Toilet, Armchair,
  DoorOpen, Wrench, Hammer, PaintRoller, Plug, Trash2, Flower2, TreePine, Blinds,
  HeartPulse, Pill, Stethoscope, Syringe, Cross, Activity, Brain, Eye, Bandage,
  Thermometer, Hospital,
  GraduationCap, Book, Library, Pencil, NotebookPen, School, Calculator, Microscope, Ruler,
  Briefcase, Laptop, TrendingUp, Crown, HandCoins, Key, Coins, Wallet, CreditCard,
  Banknote, PiggyBank, Receipt, Landmark, ChartColumn, ChartPie, Handshake, Percent,
  Trophy, Medal, BadgeDollarSign,
  Zap, Droplet, Flame, Wifi, Phone, Smartphone, Signal, Cloud, Repeat, CalendarClock,
  Router, MonitorSmartphone,
  PawPrint, Dog, Cat, Bird, Bone, Rabbit, Turtle,
  Dumbbell, Volleyball, WavesHorizontal, Mountain, Tent, Target, Timer,
  Ellipsis, Star, Heart, Bookmark, Flag, MapPin, Calendar, Clock, Users, User, Shield,
  Sparkles, Lightbulb, Rocket, Anchor, Umbrella, Snowflake, Sun,
} from "lucide-react-native";
import type { IconComponent } from "@/constants/categories";

/**
 * TODOS LOS DIBUJOS QUE SE PUEDEN ELEGIR AL CREAR UNA CATEGORÍA.
 *
 * Son dos clases y se guardan distinto a propósito:
 *
 *   GENÉRICOS  — dibujos de línea (lucide). Se importan uno a uno arriba, y
 *                eso NO es descuido: importar la librería entera metería 1.749
 *                iconos en la app para usar ciento y pico.
 *
 *   MARCAS     — logos (FontAwesome). Van por NOMBRE, no importados: es una
 *                tipografía, así que agregar una marca más no pesa nada.
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

const GENERICOS: Record<string, IconComponent> = {
  Utensils, UtensilsCrossed, Coffee, Pizza, Beef, Sandwich, IceCreamCone, CakeSlice,
  Apple, Carrot, Fish, EggFried, Beer, Wine, CupSoda, Milk, Croissant, Soup, Salad,
  Cookie, Popcorn, Candy, Ham, Drumstick,
  Car, Bus, TrainFront, Plane, Bike, Fuel, CircleParking, TramFront, Ship, Truck,
  CarTaxiFront, Footprints, Sailboat, Caravan, Ambulance,
  ShoppingBag, ShoppingCart, ShoppingBasket, Store, Tag, Tags, Gift, Package, Shirt,
  Watch, Glasses, Gem, Backpack, Baby,
  Film, Gamepad2, Music, Tv, Ticket, Drama, Guitar, Headphones, PartyPopper, Dices,
  Puzzle, Clapperboard, Radio, Mic, Camera, BookOpen, Palette,
  House, Sofa, Bed, Lamp, Refrigerator, WashingMachine, ShowerHead, Toilet, Armchair,
  DoorOpen, Wrench, Hammer, PaintRoller, Plug, Trash2, Flower2, TreePine, Blinds,
  HeartPulse, Pill, Stethoscope, Syringe, Cross, Activity, Brain, Eye, Bandage,
  Thermometer, Hospital,
  GraduationCap, Book, Library, Pencil, NotebookPen, School, Calculator, Microscope, Ruler,
  Briefcase, Laptop, TrendingUp, Crown, HandCoins, Key, Coins, Wallet, CreditCard,
  Banknote, PiggyBank, Receipt, Landmark, ChartColumn, ChartPie, Handshake, Percent,
  Trophy, Medal, BadgeDollarSign,
  Zap, Droplet, Flame, Wifi, Phone, Smartphone, Signal, Cloud, Repeat, CalendarClock,
  Router, MonitorSmartphone,
  PawPrint, Dog, Cat, Bird, Bone, Rabbit, Turtle,
  Dumbbell, Volleyball, WavesHorizontal, Mountain, Tent, Target, Timer,
  Ellipsis, Star, Heart, Bookmark, Flag, MapPin, Calendar, Clock, Users, User, Shield,
  Sparkles, Lightbulb, Rocket, Anchor, Umbrella, Snowflake, Sun,
};

/**
 * El dibujo que corresponde a un identificador guardado.
 *
 * ANTE LA DUDA DEVUELVE ALGO. Un identificador que ya no existe —porque se
 * quitó una marca, o porque llegó de una copia de nube más nueva— no puede
 * dejar la pantalla en blanco: se cae en los puntos suspensivos y se sigue.
 */
export function iconoDe(id: string): IconComponent {
  if (esMarca(id)) return logo(id.slice(MARCA.length));
  return GENERICOS[id] ?? Ellipsis;
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
