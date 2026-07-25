// CLASIFICADOR AUTOMÁTICO DE COMERCIOS
//
// Cuando llega un movimiento del banco que dice "KFC SAN MIGUEL", esto
// adivina que la categoría es "comida". Así la persona no tiene que
// clasificar 35 movimientos a mano.
//
// Tiene dos niveles:
//   1. Lo que TÚ le enseñaste (tiene prioridad).
//   2. Una lista base de comercios conocidos.
//
// Si cambias la categoría de "Primax" de Combustible a Transporte, eso se
// guarda y la próxima vez que importes un Primax, ya sale como Transporte.

import { normalizeHeader } from "@/utils/importEngine";

// Comercios conocidos → categoría de Finzo. La clave es un pedazo de
// texto que debe aparecer en el nombre del comercio (ya normalizado: en
// minúsculas y sin tildes).
const MERCHANT_RULES: { match: string; category: string }[] = [
  // Comida
  { match: "kfc", category: "comida" },
  { match: "bembos", category: "comida" },
  { match: "burger king", category: "comida" },
  { match: "mcdonald", category: "comida" },
  { match: "pizza", category: "comida" },
  { match: "papa john", category: "comida" },
  { match: "starbucks", category: "comida" },
  { match: "tambo", category: "comida" },
  { match: "rappi", category: "comida" },
  { match: "pedidosya", category: "comida" },
  { match: "don belisario", category: "comida" },
  { match: "la lucha", category: "comida" },
  { match: "norky", category: "comida" },
  { match: "popeyes", category: "comida" },
  { match: "subway", category: "comida" },

  // Combustible
  { match: "primax", category: "combustible" },
  { match: "repsol", category: "combustible" },
  { match: "petroperu", category: "combustible" },
  { match: "grifo", category: "combustible" },
  { match: "pecsa", category: "combustible" },
  { match: "gazel", category: "combustible" },

  // Suscripciones
  { match: "netflix", category: "suscripciones" },
  { match: "spotify", category: "suscripciones" },
  { match: "disney", category: "suscripciones" },
  { match: "hbo", category: "suscripciones" },
  { match: "max help", category: "suscripciones" },
  { match: "amazon prime", category: "suscripciones" },
  { match: "youtube premium", category: "suscripciones" },
  { match: "apple.com/bill", category: "suscripciones" },
  { match: "google", category: "suscripciones" },
  { match: "canva", category: "suscripciones" },
  { match: "openai", category: "suscripciones" },

  // Compras / supermercado
  { match: "plaza vea", category: "compras" },
  { match: "tottus", category: "compras" },
  { match: "metro", category: "compras" },
  { match: "wong", category: "compras" },
  { match: "vivanda", category: "compras" },
  { match: "falabella", category: "compras" },
  { match: "ripley", category: "compras" },
  { match: "oechsle", category: "compras" },
  { match: "sodimac", category: "compras" },
  { match: "promart", category: "compras" },
  { match: "aliexpress", category: "compras" },
  { match: "amazon", category: "compras" },
  { match: "mercado libre", category: "compras" },
  { match: "mercadolibre", category: "compras" },
  { match: "shopstar", category: "compras" },

  // Transporte
  { match: "uber", category: "transporte" },
  { match: "cabify", category: "transporte" },
  { match: "beat", category: "transporte" },
  { match: "didi", category: "transporte" },
  { match: "metropolitano", category: "transporte" },
  { match: "peaje", category: "transporte" },

  // Salud
  { match: "inkafarma", category: "salud" },
  { match: "mifarma", category: "salud" },
  { match: "farmacia", category: "salud" },
  { match: "boticas", category: "salud" },
  { match: "clinica", category: "salud" },

  // Servicios
  { match: "movistar", category: "servicios" },
  { match: "claro", category: "servicios" },
  { match: "entel", category: "servicios" },
  { match: "bitel", category: "servicios" },
  { match: "sedapal", category: "servicios" },
  { match: "luz del sur", category: "servicios" },
  { match: "enel", category: "servicios" },
  { match: "calidda", category: "servicios" },

  // Entretenimiento
  { match: "cineplanet", category: "entretenimiento" },
  { match: "cinemark", category: "entretenimiento" },
  { match: "cinepolis", category: "entretenimiento" },

  // Videojuegos
  { match: "steam", category: "videojuegos" },
  { match: "playstation", category: "videojuegos" },
  { match: "xbox", category: "videojuegos" },
  { match: "nintendo", category: "videojuegos" },
  { match: "riot", category: "videojuegos" },

  // Mascotas
  { match: "veterinaria", category: "mascotas" },
  { match: "petland", category: "mascotas" },
];

export type LearnedMap = Record<string, string>;

// Saca una "clave de comercio" estable a partir del texto del banco.
// "KFC SAN MIGUEL 0234" y "KFC BREÑA" deben producir la misma clave para
// que lo que aprendiste de uno sirva para el otro. Nos quedamos con las
// primeras palabras significativas (sin números ni relleno).
export function merchantKey(text: string): string {
  const normalized = normalizeHeader(text);
  const words = normalized
    .split(" ")
    .filter((w) => w.length > 1 && !/^\d+$/.test(w));
  return words.slice(0, 2).join(" ").trim();
}

// Devuelve la categoría sugerida para un movimiento del banco.
//   type      → "expense" o "income" (los ingresos van a "otro_ingreso")
//   learned   → lo que la persona ya enseñó (gana sobre las reglas base)
export function suggestCategory(
  merchantText: string,
  type: "expense" | "income",
  learned: LearnedMap
): string {
  if (type === "income") return "otro_ingreso";

  const key = merchantKey(merchantText);

  // 1. ¿La persona ya me enseñó qué es este comercio?
  if (key && learned[key]) return learned[key];

  // 2. ¿Está en la lista base de comercios conocidos?
  const normalized = normalizeHeader(merchantText);
  for (const rule of MERCHANT_RULES) {
    if (normalized.includes(rule.match)) return rule.category;
  }

  // 3. Ni idea: cae en "otros".
  return "otros";
}

// Guarda que ESTE comercio va en ESTA categoría, para la próxima vez.
// Devuelve el mapa nuevo (no modifica el que recibe).
export function learnCategory(
  merchantText: string,
  category: string,
  learned: LearnedMap
): LearnedMap {
  const key = merchantKey(merchantText);
  if (!key) return learned;
  return { ...learned, [key]: category };
}
