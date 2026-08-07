import { loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";

/**
 * Los cambios que la persona le hace a sus categorías: nombre, color e
 * imagen propia.
 *
 * POR QUÉ ESTO VIVE EN UNA VARIABLE SUELTA Y NO EN EL CONTEXTO
 *
 * El nombre y el color de una categoría se muestran en 38 sitios repartidos
 * por 16 archivos: agregar movimiento, la lista de Inicio, el historial, los
 * reportes, el PDF, el escáner, la voz, la importación... Todos llaman a
 * catInfo(id), que es una función normal, no un hook.
 *
 * Si esto viviera en el contexto habría que convertir esos 38 sitios en
 * lectores del contexto. Con una variable de módulo que catInfo consulta,
 * NINGUNO cambia: todos heredan la personalización solos, y no puede quedarse
 * uno sin enterarse — que es exactamente el tipo de fallo que se arrastra
 * durante meses.
 *
 * El precio es que hay que avisar a mano cuando cambia, para que las
 * pantallas se vuelvan a dibujar. De eso se encarga el contexto.
 */

export type CategoryOverride = {
  /** El nombre que puso la persona. Manda sobre el de la app. */
  name?: string;
  /** Uno de los colores de la app ("rose", "sky"...) o un "#rrggbb". */
  color?: string;
  /** La imagen, ya recortada y guardada como texto ("data:image/jpeg;..."). */
  image?: string;
  /**
   * El dibujo elegido del catálogo. Ver constants/iconos.
   *
   * Llegó el 07/08/2026, con la pantalla de elegir categoría: ahí se puede tocar
   * "Comida", cambiarle el dibujo y darle a Aplicar. Sin este campo, el dibujo
   * nuevo se veía en la vista previa y al guardar volvía el de antes — la
   * pantalla habría prometido algo que no podía cumplir.
   */
  icono?: string;
};

export type CategoryOverrides = Record<string, CategoryOverride>;

// La clave se lee de STORAGE_KEYS y no se escribe aqui: la lista de lo que se
// borra al cerrar sesion esta alli, y una clave que solo conoce su propio archivo
// se queda fuera de ese borrado sin que nadie lo note. Ya paso con estas tres.
const STORAGE_KEY = STORAGE_KEYS.categoryCustom;

let overrides: CategoryOverrides = {};

/** Lo que catInfo consulta en cada llamada. */
export function getOverride(id: string): CategoryOverride | undefined {
  return overrides[id];
}

export function getAllOverrides(): CategoryOverrides {
  return overrides;
}

/**
 * Pone la tabla entera. La usan el arranque y la llegada de datos de la nube.
 * No guarda: guardar es cosa de quien decide, no de quien recibe.
 */
export function setOverrides(next: CategoryOverrides): void {
  overrides = next ?? {};
}

export async function loadOverrides(): Promise<CategoryOverrides> {
  const guardado = await loadJSON<CategoryOverrides>(STORAGE_KEY, {});
  overrides = guardado && typeof guardado === "object" ? guardado : {};
  return overrides;
}

export function saveOverrides(next: CategoryOverrides): void {
  overrides = next;
  saveJSON(STORAGE_KEY, next);
}

/**
 * Cambia una categoría. Pasar undefined en un campo lo DEJA COMO ESTABA;
 * pasar null lo devuelve a lo de fábrica.
 *
 * Esa diferencia importa: sin ella no habría forma de quitar una imagen sin
 * quitar también el nombre y el color.
 */
export function applyChange(
  actuales: CategoryOverrides,
  id: string,
  cambio: { name?: string | null; color?: string | null; image?: string | null }
): CategoryOverrides {
  const previo = actuales[id] ?? {};
  const nuevo: CategoryOverride = { ...previo };

  for (const campo of ["name", "color", "image"] as const) {
    const valor = cambio[campo];
    if (valor === undefined) continue;
    if (valor === null || valor === "") delete nuevo[campo];
    else nuevo[campo] = valor;
  }

  const siguiente = { ...actuales };
  // Una categoría sin ningún cambio no se guarda como un objeto vacío: se
  // borra. Así "volver a lo de fábrica" deja la tabla realmente limpia y no
  // llena de cascarones que hay que ir saltando al leer.
  if (Object.keys(nuevo).length === 0) delete siguiente[id];
  else siguiente[id] = nuevo;

  return siguiente;
}

/** ¿Tiene algún cambio esta categoría? */
export function isCustomized(id: string): boolean {
  const o = overrides[id];
  return !!o && Object.keys(o).length > 0;
}

/**
 * Deja un nombre escrito a mano en algo que se pueda enseñar.
 *
 * Se corta a 24 porque el nombre va dentro de un círculo pequeño en Agregar
 * movimiento y debajo de cada icono: más largo se recorta con puntos
 * suspensivos y no se distingue de otro que empiece igual.
 */
export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 24);
}
