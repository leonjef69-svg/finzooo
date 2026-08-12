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

// Comercios conocidos → categoría de Fino. La clave es un pedazo de
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

// PALABRAS DE TODOS LOS DÍAS → categoría.
//
// La lista de arriba es de MARCAS, porque nació para leer estados de
// cuenta. Pero cuando alguien dicta un gasto por voz no dice marcas: dice
// "salchipapa", "taxi", "pan". Sin esta segunda lista, todo eso caía en
// "otros" y había que corregirlo a mano.
//
// Diferencia importante: estas se comparan por PALABRA ENTERA, no por
// pedazo. Si se buscara "pan" como pedazo de texto, un "pantalón" saldría
// clasificado como comida.
//
// El ORDEN importa: gana la primera que coincida, así que las categorías
// más específicas van arriba. "comida para el perro" tiene las palabras
// "comida" y "perro"; con mascotas primero sale bien, al revés no.
const WORD_RULES: { match: string; category: string }[] = [
  // Mascotas (antes que comida, ver nota de arriba)
  { match: "perro", category: "mascotas" }, { match: "gato", category: "mascotas" },
  { match: "mascota", category: "mascotas" }, { match: "croqueta", category: "mascotas" },

  // Comida
  { match: "salchipapa", category: "comida" }, { match: "pollo", category: "comida" },
  { match: "brasa", category: "comida" }, { match: "ceviche", category: "comida" },
  { match: "cebiche", category: "comida" }, { match: "chifa", category: "comida" },
  { match: "anticucho", category: "comida" }, { match: "lomo saltado", category: "comida" },
  { match: "chaufa", category: "comida" }, { match: "menu", category: "comida" },
  { match: "almuerzo", category: "comida" }, { match: "desayuno", category: "comida" },
  { match: "cena", category: "comida" }, { match: "comida", category: "comida" },
  { match: "hamburguesa", category: "comida" }, { match: "sandwich", category: "comida" },
  { match: "empanada", category: "comida" }, { match: "tamal", category: "comida" },
  { match: "papa rellena", category: "comida" }, { match: "tallarin", category: "comida" },
  { match: "pan", category: "comida" }, { match: "panaderia", category: "comida" },
  { match: "leche", category: "comida" }, { match: "huevo", category: "comida" },
  { match: "queso", category: "comida" }, { match: "fruta", category: "comida" },
  { match: "verdura", category: "comida" }, { match: "carne", category: "comida" },
  { match: "pescado", category: "comida" }, { match: "arroz", category: "comida" },
  { match: "fideo", category: "comida" }, { match: "azucar", category: "comida" },
  { match: "aceite", category: "comida" }, { match: "menestra", category: "comida" },
  { match: "gaseosa", category: "comida" }, { match: "jugo", category: "comida" },
  { match: "chicha", category: "comida" }, { match: "cafe", category: "comida" },
  { match: "helado", category: "comida" }, { match: "chocolate", category: "comida" },
  { match: "galleta", category: "comida" }, { match: "yogurt", category: "comida" },
  { match: "mercado", category: "comida" }, { match: "bodega", category: "comida" },
  { match: "snack", category: "comida" }, { match: "postre", category: "comida" },

  // Transporte
  { match: "taxi", category: "transporte" }, { match: "micro", category: "transporte" },
  { match: "combi", category: "transporte" }, { match: "bus", category: "transporte" },
  { match: "pasaje", category: "transporte" }, { match: "mototaxi", category: "transporte" },
  { match: "moto taxi", category: "transporte" }, { match: "colectivo", category: "transporte" },
  { match: "tren", category: "transporte" }, { match: "cochera", category: "transporte" },
  { match: "estacionamiento", category: "transporte" }, { match: "pasajes", category: "transporte" },

  // Combustible
  { match: "gasolina", category: "combustible" }, { match: "petroleo", category: "combustible" },
  { match: "diesel", category: "combustible" },

  // Servicios (recibos del mes)
  { match: "luz", category: "servicios" }, { match: "agua", category: "servicios" },
  { match: "internet", category: "servicios" }, { match: "wifi", category: "servicios" },
  { match: "cable", category: "servicios" }, { match: "recibo", category: "servicios" },
  { match: "gas", category: "servicios" }, { match: "arbitrios", category: "servicios" },
  { match: "telefono", category: "servicios" }, { match: "recarga", category: "servicios" },

  // Hogar
  { match: "detergente", category: "hogar" }, { match: "jabon", category: "hogar" },
  { match: "papel higienico", category: "hogar" }, { match: "lejia", category: "hogar" },
  { match: "escoba", category: "hogar" }, { match: "limpieza", category: "hogar" },
  { match: "foco", category: "hogar" }, { match: "pintura", category: "hogar" },
  { match: "mueble", category: "hogar" }, { match: "colchon", category: "hogar" },
  { match: "olla", category: "hogar" }, { match: "alquiler", category: "hogar" },
  { match: "renta", category: "hogar" },

  // Salud
  { match: "pastilla", category: "salud" }, { match: "medicina", category: "salud" },
  { match: "medicamento", category: "salud" }, { match: "doctor", category: "salud" },
  { match: "medico", category: "salud" }, { match: "dentista", category: "salud" },
  { match: "hospital", category: "salud" }, { match: "vitamina", category: "salud" },
  { match: "jarabe", category: "salud" }, { match: "consulta", category: "salud" },
  { match: "gimnasio", category: "salud" }, { match: "gym", category: "salud" },

  // Compras
  { match: "ropa", category: "compras" }, { match: "polo", category: "compras" },
  { match: "camisa", category: "compras" }, { match: "pantalon", category: "compras" },
  { match: "zapato", category: "compras" }, { match: "zapatilla", category: "compras" },
  { match: "casaca", category: "compras" }, { match: "vestido", category: "compras" },
  { match: "mochila", category: "compras" }, { match: "celular", category: "compras" },
  { match: "audifono", category: "compras" }, { match: "cargador", category: "compras" },
  { match: "laptop", category: "compras" }, { match: "juguete", category: "compras" },
  { match: "perfume", category: "compras" }, { match: "maquillaje", category: "compras" },

  // Educación
  { match: "universidad", category: "educacion" }, { match: "colegio", category: "educacion" },
  { match: "pension", category: "educacion" }, { match: "matricula", category: "educacion" },
  { match: "curso", category: "educacion" }, { match: "libro", category: "educacion" },
  { match: "cuaderno", category: "educacion" }, { match: "utiles", category: "educacion" },
  { match: "academia", category: "educacion" }, { match: "mensualidad", category: "educacion" },

  // Entretenimiento
  { match: "cine", category: "entretenimiento" }, { match: "concierto", category: "entretenimiento" },
  { match: "fiesta", category: "entretenimiento" }, { match: "discoteca", category: "entretenimiento" },
  { match: "bar", category: "entretenimiento" }, { match: "trago", category: "entretenimiento" },
  { match: "cerveza", category: "entretenimiento" }, { match: "chela", category: "entretenimiento" },
  { match: "entrada", category: "entretenimiento" }, { match: "paseo", category: "entretenimiento" },

  // Videojuegos
  { match: "videojuego", category: "videojuegos" }, { match: "free fire", category: "videojuegos" },
  { match: "fortnite", category: "videojuegos" },
];

// De dónde vino la plata que entró. Antes TODO ingreso caía en "otro
// ingreso"; con esto, "recibí 500 de sueldo" ya sale como salario.
const INCOME_WORD_RULES: { match: string; category: string }[] = [
  { match: "sueldo", category: "salario" }, { match: "salario", category: "salario" },
  { match: "planilla", category: "salario" }, { match: "quincena", category: "salario" },
  { match: "gratificacion", category: "salario" }, { match: "cts", category: "salario" },
  { match: "freelance", category: "freelance" }, { match: "trabajo", category: "freelance" },
  { match: "proyecto", category: "freelance" }, { match: "servicio", category: "freelance" },
  { match: "regalo", category: "regalo" }, { match: "propina", category: "regalo" },
  { match: "venta", category: "venta" }, { match: "vendi", category: "venta" },
  { match: "alquiler", category: "alquiler" }, { match: "renta", category: "alquiler" },
  { match: "prestamo", category: "prestamo" }, { match: "premio", category: "premios" },
  { match: "beca", category: "beca" }, { match: "dividendo", category: "dividendos" },
  { match: "interes", category: "inversiones" }, { match: "inversion", category: "inversiones" },
];

// ¿Aparece esta palabra ENTERA en el texto? Se prueba también con "s" y
// "es" al final, porque hablando sale igual de natural "una gaseosa" que
// "unas gaseosas", y ahí es la misma categoría.
function hasWord(padded: string, term: string): boolean {
  return (
    padded.includes(` ${term} `) ||
    padded.includes(` ${term}s `) ||
    padded.includes(` ${term}es `)
  );
}

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
  const normalized = normalizeHeader(merchantText);
  const padded = ` ${normalized} `;

  if (type === "income") {
    for (const rule of INCOME_WORD_RULES) {
      if (hasWord(padded, rule.match)) return rule.category;
    }
    return "otro_ingreso";
  }

  const key = merchantKey(merchantText);

  // 1. ¿La persona ya me enseñó qué es este comercio?
  if (key && learned[key]) return learned[key];

  // 2. ¿Es una palabra de todos los días? ("salchipapa" → comida)
  //    Va ANTES que las marcas porque compara por palabra entera, que es
  //    más seguro: buscar marcas por pedazo de texto puede engancharse con
  //    una palabra corriente que la contenga por casualidad.
  for (const rule of WORD_RULES) {
    if (hasWord(padded, rule.match)) return rule.category;
  }

  // 3. ¿Está en la lista de comercios conocidos?
  for (const rule of MERCHANT_RULES) {
    if (normalized.includes(rule.match)) return rule.category;
  }

  // 4. Ni idea: cae en "otros".
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
