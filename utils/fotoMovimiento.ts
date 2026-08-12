// LA FOTO DE UN MOVIMIENTO: LA BOLETA, EL VOUCHER, EL PAPELITO (12/08/2026)
//
// Pedido suyo: poder tomar una foto o elegirla de la galería al anotar un gasto, verla desde la
// lista y cambiarla desde el detalle.
//
// SE GUARDA COMO ARCHIVO, Y EN EL MOVIMIENTO SOLO VA LA RUTA. ESTO NO ES UN DETALLE TÉCNICO:
// ES LO QUE EVITA PERDER TODOS LOS GASTOS.
//
// Lo natural habría sido meter la foto dentro del movimiento, convertida a texto, como ya se
// hace con los dibujos de las categorías. Y habría sido un desastre.
//
// Todo lo que se sube a la nube va en UN SOLO documento con tope de 1 MB: los movimientos, los
// presupuestos, las metas y las fotos de las categorías, todo junto. Ya está avisado en
// utils/cloudSync, y con una frase que conviene releer: **pasarse del tope no deja el documento
// a medias, lo deja SIN GUARDAR**. Con él, los movimientos.
//
// Una foto de boleta legible pesa entre 60 y 90 KB. Doce fotos y la copia de seguridad de esa
// persona deja de subir — sin error visible, sin aviso, hasta el día que cambie de celular y
// descubra que no hay nada. Perder una foto es molesto; perder los gastos de un año, grave.
//
// Con la ruta, el movimiento crece unos sesenta bytes y el tope no se toca nunca.
//
// LO QUE CUESTA, DICHO CLARO: las fotos viven SOLO en este celular. Al cambiar de teléfono los
// movimientos vuelven enteros y las fotos no. La pantalla del detalle lo dice cuando pasa, en
// vez de enseñar un hueco roto.

import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Donde viven las fotos. Dentro de la carpeta privada de la app, no en la galería. */
const CARPETA = "fotos-movimientos";

function carpeta(): Directory {
  const dir = new Directory(Paths.document, CARPETA);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Achica la foto antes de guardarla.
 *
 * 1200 px de ancho es el punto en el que una boleta se sigue leyendo y el archivo baja de un
 * par de megas a menos de cien kilobytes. Más pequeña y los números dejan de distinguirse, que
 * es justo para lo que se guarda.
 *
 * Y en JPEG, no PNG: una foto en PNG pesa cinco veces más sin verse mejor.
 */
async function achicar(uri: string): Promise<string> {
  const contexto = ImageManipulator.manipulate(uri).resize({ width: 1200 });
  const listo = await contexto.renderAsync();
  const guardado = await listo.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
  return guardado.uri;
}

/**
 * Guarda la foto y devuelve su ruta, o `null` si algo falló.
 *
 * Nunca lanza: una foto que no se pudo guardar no puede impedir que se anote el gasto. El gasto
 * es el dato; la foto es el recuerdo.
 */
export async function guardarFoto(uri: string): Promise<string | null> {
  try {
    const achicada = await achicar(uri);
    // El nombre lleva la hora exacta para que dos fotos seguidas no se pisen. Con el id del
    // movimiento no valdría: al anotar todavía no existe.
    const destino = new File(carpeta(), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
    new File(achicada).copy(destino);
    return destino.uri;
  } catch {
    return null;
  }
}

/**
 * Borra la foto de un movimiento.
 *
 * Se llama al borrar el movimiento y al cambiar la foto por otra. Sin esto, cada foto
 * reemplazada se quedaría ocupando sitio para siempre — y nadie las vería nunca.
 */
export function borrarFoto(ruta?: string): void {
  if (!ruta) return;
  try {
    const f = new File(ruta);
    if (f.exists) f.delete();
  } catch {
    // Una foto que no se pudo borrar no puede romper el borrado del movimiento.
  }
}

/**
 * ¿La foto sigue estando en este celular?
 *
 * Devuelve falso cuando el movimiento vino de la nube desde otro teléfono: la ruta viaja, el
 * archivo no. La pantalla lo usa para explicarlo en vez de enseñar un recuadro roto.
 */
export function hayFoto(ruta?: string): boolean {
  if (!ruta) return false;
  try {
    return new File(ruta).exists;
  } catch {
    return false;
  }
}
