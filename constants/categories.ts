import type { ComponentType } from "react";
import {
  Utensils,
  Car,
  Fuel,
  Repeat,
  ShoppingBag,
  Film,
  Gamepad2,
  HeartPulse,
  Zap,
  GraduationCap,
  PawPrint,
  Home as HouseIcon,
  MoreHorizontal,
  Briefcase,
  Laptop,
  Gift,
  TrendingUp,
  Tag,
  PlusCircle,
  Crown,
  HandCoins,
  BarChart3,
  KeyRound,
  Coins,
} from "lucide-react-native";

export type IconComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

export type Category = {
  id: string;
  label: string;
  icon: IconComponent;
  color: string;
  emoji: string;
  extra?: boolean;
};

// "label" es una CLAVE de traducción (no el texto en sí) — se traduce con
// t() al momento de mostrarla, para que cambie de idioma sin tener que
// tocar el "id" (que es lo que de verdad se guarda en cada movimiento).
export const EXPENSE_CATS: Category[] = [
  { id: "comida", label: "category.comida", icon: Utensils, color: "rose", emoji: "🍔" },
  { id: "transporte", label: "category.transporte", icon: Car, color: "amber", emoji: "🚗" },
  { id: "compras", label: "category.compras", icon: ShoppingBag, color: "violet", emoji: "🛍️" },
  { id: "entretenimiento", label: "category.entretenimiento", icon: Film, color: "pink", emoji: "🎬" },
  { id: "videojuegos", label: "category.videojuegos", icon: Gamepad2, color: "indigo", emoji: "🎮" },
  { id: "salud", label: "category.salud", icon: HeartPulse, color: "red", emoji: "💊" },
  { id: "servicios", label: "category.servicios", icon: Zap, color: "sky", emoji: "⚡" },
  { id: "combustible", label: "category.combustible", icon: Fuel, color: "orange", emoji: "⛽", extra: true },
  { id: "suscripciones", label: "category.suscripciones", icon: Repeat, color: "fuchsia", emoji: "🔁", extra: true },
  { id: "educacion", label: "category.educacion", icon: GraduationCap, color: "cyan", emoji: "🎓", extra: true },
  { id: "mascotas", label: "category.mascotas", icon: PawPrint, color: "lime", emoji: "🐾", extra: true },
  { id: "hogar", label: "category.hogar", icon: HouseIcon, color: "orange", emoji: "🏠", extra: true },
  { id: "otros", label: "category.otros", icon: MoreHorizontal, color: "slate", emoji: "🧾", extra: true },
];

export const INCOME_CATS: Category[] = [
  { id: "salario", label: "category.salario", icon: Briefcase, color: "emerald", emoji: "💼" },
  { id: "freelance", label: "category.freelance", icon: Laptop, color: "teal", emoji: "💻" },
  { id: "regalo", label: "category.regalo", icon: Gift, color: "fuchsia", emoji: "🎁" },
  { id: "inversiones", label: "category.inversiones", icon: TrendingUp, color: "green", emoji: "📈" },
  { id: "venta", label: "category.venta", icon: Tag, color: "amber", emoji: "🏷️" },
  { id: "otro_ingreso", label: "category.otro_ingreso", icon: PlusCircle, color: "stone", emoji: "➕" },
  { id: "premios", label: "category.premios", icon: Crown, color: "amber", emoji: "🏆", extra: true },
  { id: "prestamo", label: "category.prestamo", icon: HandCoins, color: "sky", emoji: "🤝", extra: true },
  { id: "dividendos", label: "category.dividendos", icon: BarChart3, color: "indigo", emoji: "📊", extra: true },
  { id: "alquiler", label: "category.alquiler", icon: KeyRound, color: "orange", emoji: "🏘️", extra: true },
  { id: "cripto", label: "category.cripto", icon: Coins, color: "yellow", emoji: "🪙", extra: true },
  { id: "beca", label: "category.beca", icon: GraduationCap, color: "blue", emoji: "🎓", extra: true },
];

export const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];

// Índice por id, armado una sola vez al cargar la app. Antes catInfo hacía
// un .find() —recorrer la lista entera— y se la llama por CADA fila de
// Inicio, del Historial, de Reportes y del detalle: con las listas
// desplazándose, eran miles de recorridos por segundo sin necesidad.
const CATS_BY_ID = new Map(ALL_CATS.map((c) => [c.id, c]));

// Categoría de respaldo cuando el id guardado no existe (por ejemplo, un
// movimiento importado con una categoría que ya no está en la app).
// Antes el respaldo era EXPENSE_CATS[6] — que es "Servicios" ⚡, elegido
// por su posición en la lista, no a propósito: cualquier categoría
// desconocida se mostraba como un gasto de Servicios. "Otros" 🧾 es lo
// correcto, y ahora se busca por id para que no vuelva a romperse si se
// reordena la lista.
const FALLBACK_CAT = CATS_BY_ID.get("otros") ?? EXPENSE_CATS[EXPENSE_CATS.length - 1];

export function catInfo(id: string): Category {
  return CATS_BY_ID.get(id) ?? FALLBACK_CAT;
}
