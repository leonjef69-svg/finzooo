import type { ComponentType } from "react";
import { getOverride } from "@/utils/categoryCustom";
import { getPropia, getPropias, type CategoriaPropia } from "@/utils/categoriasPropias";
import { iconoDe } from "@/constants/iconos";

// Los dibujos de las categorías de fábrica se piden por el MISMO identificador
// que usan las categorías propias, en vez de traerse a mano. Es lo que garantiza
// que "Comida" de fábrica y una "Broster" creada por la persona se vean del
// mismo estilo. Cuando cada una venía de su sitio, ya pasó una vez: la misma
// categoría salía con emoji al elegirla y con dibujo de línea en Inicio.

export type IconComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

export type Category = {
  id: string;
  label: string;
  icon: IconComponent;
  /**
   * EL NOMBRE del dibujo en el catálogo ("HeartPulse"), no el dibujo.
   *
   * Hace falta porque de un dibujo ya hecho no se puede volver atrás a su
   * nombre, y hay una pantalla que lo necesita: al tocar "Salud" en la lista de
   * categorías, la vista previa tiene que quedarse con SU dibujo y el catálogo
   * tiene que marcar cuál es. Sin este campo, tocar "Salud" cambiaba el nombre y
   * el color pero el dibujo se quedaba quieto — reportado el 07/08/2026.
   *
   * Va siempre junto al dibujo, y de la misma fuente: ver dibujo() abajo.
   */
  iconoNombre?: string;
  color: string;
  emoji: string;
  extra?: boolean;
  /**
   * Imagen propia, ya recortada y guardada como texto. Cuando la hay, se
   * dibuja en lugar del emoji. La pone catInfo desde la personalizacion.
   */
  image?: string;
};

/**
 * El dibujo Y su nombre, de un solo dato.
 *
 * Escritos por separado se pueden desincronizar —el dibujo de uno y el nombre de
 * otro— y sería un fallo silencioso: la categoría se vería bien en todas las
 * pantallas y solo al abrir el catálogo aparecería marcado el dibujo equivocado.
 * Con un único argumento eso no puede pasar.
 */
function dibujo(nombre: string): { icon: IconComponent; iconoNombre: string } {
  return { icon: iconoDe(nombre), iconoNombre: nombre };
}

// "label" es una CLAVE de traducción (no el texto en sí) — se traduce con
// t() al momento de mostrarla, para que cambie de idioma sin tener que
// tocar el "id" (que es lo que de verdad se guarda en cada movimiento).
export const EXPENSE_CATS: Category[] = [
  { id: "comida", label: "category.comida", ...dibujo("Utensils"), color: "green", emoji: "🍔" },
  { id: "transporte", label: "category.transporte", ...dibujo("Car"), color: "yellow", emoji: "🚗" },
  { id: "compras", label: "category.compras", ...dibujo("ShoppingBag"), color: "violet", emoji: "🛍️" },
  { id: "entretenimiento", label: "category.entretenimiento", ...dibujo("Film"), color: "pink", emoji: "🎬" },
  { id: "videojuegos", label: "category.videojuegos", ...dibujo("Gamepad2"), color: "indigo", emoji: "🎮" },
  { id: "salud", label: "category.salud", ...dibujo("HeartPulse"), color: "red", emoji: "💊" },
  { id: "servicios", label: "category.servicios", ...dibujo("Zap"), color: "blue", emoji: "⚡" },
  { id: "combustible", label: "category.combustible", ...dibujo("Fuel"), color: "orange", emoji: "⛽", extra: true },
  { id: "suscripciones", label: "category.suscripciones", ...dibujo("Repeat"), color: "fuchsia", emoji: "🔁", extra: true },
  { id: "educacion", label: "category.educacion", ...dibujo("GraduationCap"), color: "cyan", emoji: "🎓", extra: true },
  { id: "mascotas", label: "category.mascotas", ...dibujo("PawPrint"), color: "lime", emoji: "🐾", extra: true },
  { id: "hogar", label: "category.hogar", ...dibujo("House"), color: "stone", emoji: "🏠", extra: true },
  { id: "otros", label: "category.otros", ...dibujo("Ellipsis"), color: "teal", emoji: "🧾", extra: true },
];

export const INCOME_CATS: Category[] = [
  { id: "salario", label: "category.salario", ...dibujo("Briefcase"), color: "lime", emoji: "💼" },
  { id: "freelance", label: "category.freelance", ...dibujo("Laptop"), color: "teal", emoji: "💻" },
  { id: "regalo", label: "category.regalo", ...dibujo("Gift"), color: "fuchsia", emoji: "🎁" },
  { id: "inversiones", label: "category.inversiones", ...dibujo("TrendingUp"), color: "green", emoji: "📈" },
  { id: "venta", label: "category.venta", ...dibujo("Tag"), color: "red", emoji: "🏷️" },
  { id: "otro_ingreso", label: "category.otro_ingreso", ...dibujo("PlusCircle"), color: "stone", emoji: "➕" },
  { id: "premios", label: "category.premios", ...dibujo("Crown"), color: "pink", emoji: "🏆", extra: true },
  { id: "prestamo", label: "category.prestamo", ...dibujo("HandCoins"), color: "cyan", emoji: "🤝", extra: true },
  { id: "dividendos", label: "category.dividendos", ...dibujo("ChartColumn"), color: "violet", emoji: "📊", extra: true },
  { id: "alquiler", label: "category.alquiler", ...dibujo("Key"), color: "orange", emoji: "🏘️", extra: true },
  { id: "cripto", label: "category.cripto", ...dibujo("Coins"), color: "yellow", emoji: "🪙", extra: true },
  { id: "beca", label: "category.beca", ...dibujo("GraduationCap"), color: "blue", emoji: "🎓", extra: true },
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

/**
 * La categoría, ya con los cambios que le haya hecho la persona.
 *
 * Aquí es donde se aplican el nombre, el color y la imagen propios. Se hace
 * en este único sitio a propósito: la categoría se dibuja en 38 lugares
 * repartidos por 16 archivos, y si cada uno tuviera que acordarse de mirar
 * la personalización, alguno se quedaría sin hacerlo — y ese fallo se
 * arrastra meses porque solo se nota cuando alguien renombra justo esa.
 *
 * SOBRE EL NOMBRE
 *
 * "label" es una clave de traducción y quien la muestra hace t(label). El
 * traductor, cuando no encuentra una clave, devuelve la clave tal cual — así
 * que poner aquí el nombre escrito a mano hace que salga sin tocar ninguno de
 * los 38 sitios.
 *
 * El único caso raro sería llamar a una categoría exactamente igual que una
 * clave interna ("category.comida"), y entonces se vería el nombre traducido
 * en vez del escrito. Se asume: las claves son palabras técnicas con punto y
 * sin espacios, y nadie llama así a sus gastos.
 */
/**
 * Las que creó la persona, con la misma forma que las de la app.
 *
 * Se convierten aquí y no en cada pantalla: así "Broster" se dibuja igual que
 * "Comida" en los 38 sitios, sin que ninguno tenga que saber que existen dos
 * clases de categoría.
 *
 * El icono es el de "Otros": las propias se distinguen por su emoji o por su
 * foto, y el icono de línea solo se usa donde no cabe ninguno de los dos.
 */
function comoCategoria(p: CategoriaPropia): Category {
  return {
    id: p.id,
    // El nombre va TAL CUAL, no como clave de traducción. El traductor
    // devuelve la clave cuando no la encuentra, así que un nombre escrito a
    // mano sale escrito a mano. Igual que en la personalización.
    label: p.nombre,
    ...dibujo(p.icono),
    color: p.color,
    // Las propias ya no tienen emoji: se eligió el dibujo de un catálogo.
    // El campo sigue en el tipo porque las de fábrica lo usan en un texto del
    // micrófono; aquí se deja vacío en vez de inventar uno.
    emoji: "",
    image: p.image,
  };
}

/** Las de gasto: las de la app más las que creó la persona. */
export function gastosDisponibles(): Category[] {
  return [...EXPENSE_CATS, ...getPropias().filter((p) => p.tipo === "expense").map(comoCategoria)];
}

/** Las de ingreso, igual. */
export function ingresosDisponibles(): Category[] {
  return [...INCOME_CATS, ...getPropias().filter((p) => p.tipo === "income").map(comoCategoria)];
}

/** Todas, en el mismo orden en que se enseñan. */
export function todasDisponibles(): Category[] {
  return [...gastosDisponibles(), ...ingresosDisponibles()];
}

export function catInfo(id: string): Category {
  // PRIMERO las propias: su id nunca choca con las de la app —llevan su
  // prefijo— así que buscar aquí no puede tapar ninguna de fábrica.
  const propia = getPropia(id);
  if (propia) {
    const suyo = comoCategoria(propia);
    const cambio = getOverride(id);
    // La personalización manda también sobre las propias: quien le puso una
    // foto a "Broster" desde la pantalla de personalizar espera verla.
    if (!cambio) return suyo;
    return {
      ...suyo,
      label: cambio.name ?? suyo.label,
      color: cambio.color ?? suyo.color,
      image: cambio.image ?? suyo.image,
      // El dibujo y su nombre van SIEMPRE juntos: si se cambiara uno solo, el
      // catálogo marcaría un dibujo distinto del que se está viendo.
      ...(cambio.icono ? dibujo(cambio.icono) : {}),
    };
  }

  const base = CATS_BY_ID.get(id) ?? FALLBACK_CAT;
  const custom = getOverride(id);
  if (!custom) return base;

  return {
    ...base,
    label: custom.name ?? base.label,
    color: custom.color ?? base.color,
    image: custom.image,
    // El dibujo también se puede cambiar, incluso en las de fábrica: se elige en
    // la pantalla de elegir categoría y se aplica en los 38 sitios donde se
    // dibuja una categoría, igual que el color y el nombre.
    ...(custom.icono ? dibujo(custom.icono) : {}),
  };
}
