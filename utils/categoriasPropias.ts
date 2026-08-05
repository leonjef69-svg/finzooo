import { loadJSON, saveJSON } from "@/utils/storage";
import { sanitizeName } from "@/utils/categoryCustom";

/**
 * Las categorías que crea la persona: "Broster", "Gaseosas", "Alquiler taller".
 *
 * POR QUÉ VIVE EN UNA VARIABLE SUELTA, IGUAL QUE LA PERSONALIZACIÓN
 *
 * Mismo motivo que en utils/categoryCustom: catInfo(id) se llama desde 38
 * sitios repartidos por 16 archivos y es una función normal, no un hook. Si
 * las categorías propias vivieran solo en el contexto, un movimiento con una
 * categoría creada por la persona se vería como "Otros" en cualquier pantalla
 * que no se acordara de consultarlo — y sería una sola, y se descubriría
 * meses después.
 *
 * El precio, también igual: hay que avisar a mano cuando cambian para que las
 * pantallas se vuelvan a dibujar. De eso se encarga el contexto.
 *
 * NUNCA SE BORRAN DE LOS MOVIMIENTOS
 *
 * Un movimiento guarda el ID de su categoría, no la categoría entera. Si se
 * borra una categoría propia que ya tiene movimientos, esos movimientos NO se
 * quedan huérfanos ni se rompen: catInfo devuelve "Otros" y siguen contando en
 * los totales. Perder el nombre es molesto; perder el gasto sería grave.
 */

export type CategoriaPropia = {
  /** Siempre empieza por el prefijo de abajo. Ver nuevaId(). */
  id: string;
  nombre: string;
  /** De gasto o de ingreso. Decide en qué lista aparece al anotar. */
  tipo: "expense" | "income";
  /** Uno de los colores de la app ("rose", "sky"...). */
  color: string;
  /** El dibujo elegido. Ver constants/iconos: un nombre de lucide o "marca:...". */
  icono: string;
  image?: string;
};

const STORAGE_KEY = "finzo:categoriasPropias";

/**
 * El prefijo NO es decorativo.
 *
 * Es lo que garantiza que una categoría creada por la persona no pueda chocar
 * nunca con una de la app. Sin él, alguien que cree "Comida" tendría el mismo
 * id que la de fábrica y uno de los dos desaparecería — llevándose por delante
 * la categoría de todos sus movimientos anteriores.
 */
const PREFIJO = "propia_";

let propias: CategoriaPropia[] = [];

/** Todas, tal cual. Lo consultan catInfo y las listas de las pantallas. */
export function getPropias(): CategoriaPropia[] {
  return propias;
}

export function getPropia(id: string): CategoriaPropia | undefined {
  if (!esPropia(id)) return undefined;
  return propias.find((c) => c.id === id);
}

/** ¿Este id es de una categoría creada por la persona? */
export function esPropia(id: string): boolean {
  return typeof id === "string" && id.startsWith(PREFIJO);
}

/**
 * Pone la lista entera. La usan el arranque y la llegada de datos de la nube.
 * No guarda: guardar es cosa de quien decide, no de quien recibe.
 */
export function setPropias(next: CategoriaPropia[]): void {
  propias = Array.isArray(next) ? next.filter(esValida) : [];
}

export async function loadPropias(): Promise<CategoriaPropia[]> {
  const guardado = await loadJSON<CategoriaPropia[]>(STORAGE_KEY, []);
  setPropias(guardado);
  return propias;
}

export function savePropias(next: CategoriaPropia[]): void {
  setPropias(next);
  saveJSON(STORAGE_KEY, propias);
}

/**
 * Una entrada que no tenga lo mínimo se descarta al leer.
 *
 * Los datos vienen del disco y de la nube, y una entrada a medias —sin id o
 * sin nombre— no se ve al guardarla: revienta después, al dibujar una lista,
 * en una pantalla que no tiene nada que ver.
 */
function esValida(c: unknown): c is CategoriaPropia {
  if (!c || typeof c !== "object") return false;
  const x = c as Partial<CategoriaPropia>;
  return (
    typeof x.id === "string" &&
    x.id.startsWith(PREFIJO) &&
    typeof x.nombre === "string" &&
    x.nombre.trim() !== "" &&
    (x.tipo === "expense" || x.tipo === "income")
  );
}

/**
 * Un identificador que no se repite.
 *
 * Lleva la hora y un trozo al azar. Solo con la hora, crear dos categorías en
 * el mismo milisegundo —copiar y pegar, un doble toque— daría el mismo id.
 */
export function nuevaId(): string {
  return `${PREFIJO}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Crea una y la devuelve junto a la lista nueva. */
export function crear(
  actuales: CategoriaPropia[],
  datos: {
    nombre: string;
    tipo: "expense" | "income";
    color: string;
    icono?: string;
    /** Foto propia, ya recortada. Cuando la hay, se dibuja en vez del icono. */
    image?: string;
  }
): { lista: CategoriaPropia[]; creada: CategoriaPropia } {
  const creada: CategoriaPropia = {
    id: nuevaId(),
    nombre: sanitizeName(datos.nombre),
    tipo: datos.tipo,
    color: datos.color,
    // Una etiqueta: sirve para cualquier cosa y no promete nada.
    icono: datos.icono ?? "Tag",
  };
  // Solo si hay: un `image: undefined` suelto viaja a la nube como campo vacío.
  if (datos.image) creada.image = datos.image;
  return { lista: [...actuales, creada], creada };
}

/** Cambia una. Los campos que no se pasen se dejan como estaban. */
export function editar(
  actuales: CategoriaPropia[],
  id: string,
  cambio: { nombre?: string; color?: string; icono?: string; image?: string | null }
): CategoriaPropia[] {
  return actuales.map((c) => {
    if (c.id !== id) return c;
    const siguiente: CategoriaPropia = { ...c };
    if (cambio.nombre !== undefined) siguiente.nombre = sanitizeName(cambio.nombre) || c.nombre;
    if (cambio.color !== undefined) siguiente.color = cambio.color;
    if (cambio.icono !== undefined) siguiente.icono = cambio.icono;
    if (cambio.image !== undefined) {
      if (cambio.image === null || cambio.image === "") delete siguiente.image;
      else siguiente.image = cambio.image;
    }
    return siguiente;
  });
}

export function borrar(actuales: CategoriaPropia[], id: string): CategoriaPropia[] {
  return actuales.filter((c) => c.id !== id);
}

/**
 * ¿Ya existe una con ese nombre, del mismo tipo?
 *
 * Dos categorías llamadas igual en la misma lista no se pueden distinguir al
 * anotar un gasto: se elige una al azar y los totales quedan repartidos entre
 * las dos sin que nadie entienda por qué.
 */
export function nombreRepetido(
  actuales: CategoriaPropia[],
  nombre: string,
  tipo: "expense" | "income",
  ignorarId?: string
): boolean {
  const limpio = sanitizeName(nombre).toLowerCase();
  if (limpio === "") return false;
  return actuales.some(
    (c) => c.id !== ignorarId && c.tipo === tipo && c.nombre.toLowerCase() === limpio
  );
}
