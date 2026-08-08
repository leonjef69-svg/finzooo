// MODO NEGOCIO — LOS DATOS (V1, 07/08/2026)
//
// Pedido así: separar 🏠 Personal de 🏪 Negocio para que *"los movimientos del negocio NO se
// mezclen con los movimientos personales"*. El ejemplo que dio: una pollería que recibe un
// Yape de un cliente (negocio) y otro de un familiar (personal).
//
// POR QUÉ TODO VIVE APARTE Y NO DENTRO DE LOS MOVIMIENTOS
//
// Es la decisión de arquitectura de esta función. Se pidió que no se mezclen *"ni en los
// totales"*, y había dos formas:
//
//   · Marcar cada movimiento con su negocio y filtrar en los 16 sitios que los leen. Un
//     olvido y la plata del negocio se suma a los totales personales — y eso no se nota
//     hasta que las cuentas no cuadran.
//   · Guardarlos aparte, y que el camino personal no los vea nunca.
//
// Se eligió lo segundo. No mezclarse deja de depender de acordarse de filtrar y pasa a
// depender de que los datos no estén ahí. En una app de dinero eso vale más que la
// elegancia. El camino personal no se toca ni una línea.
//
// QUÉ NO HACE LA V1, A PROPÓSITO
//
// No adivina productos. Un Yape de S/ 15 significa *"entraron S/ 15 por Yape"* y nada más:
// *"En V1 NO quiero que el sistema diga: recibiste S/15, entonces vendiste un Broster"*. Eso
// llega en V3 con la voz. Tampoco hay inventario ni stock.

import { sanitizeName } from "@/utils/categoryCustom";
import { loadJSON, saveJSON, STORAGE_KEYS } from "@/utils/storage";

/** A dónde van los Yapes que entren mientras el negocio está activo. */
export type DestinoDeLosYapes = "personal" | "negocio";

export type Negocio = {
  id: string;
  nombre: string;
  /** Restaurante, bodega, peluquería… Texto libre elegido de una lista. */
  categoria: string;
  /**
   * La moneda de ESTE negocio, con el mismo código que usa la app ("PEN").
   *
   * Se guarda por negocio porque puede no ser la de la casa: alguien lleva sus cuentas en
   * soles y cobra en dólares. Se guarda el CÓDIGO y no el símbolo, igual que la moneda de la
   * app, y el "S/" se saca con currencySymbolFor() al mostrarlo — el código lo entiende un
   * banco, no quien abre la app.
   */
  moneda: string;
  activo: boolean;
  /**
   * QUÉ SE HACE CON UN YAPE QUE ENTRA. Empieza en "personal" A PROPÓSITO.
   *
   * Es lo que hace que activar el Modo Negocio no cambie nada de lo que ya funciona: quien
   * cree un negocio y no toque esto sigue recibiendo sus Yapes en Personal, exactamente
   * como hasta ahora. Mandarlos al negocio es una decisión explícita, no una sorpresa.
   *
   * Y no se adivina de quién viene el Yape. Se pidió que no: un cliente y un familiar
   * mandan el mismo aviso, y equivocarse metería la plata de la casa en la caja del
   * negocio.
   */
  destinoYapes: DestinoDeLosYapes;
  /** Cuándo se creó, en milisegundos. Para ordenarlos sin depender del nombre. */
  creadoEn: number;
};

export type Producto = {
  id: string;
  negocioId: string;
  nombre: string;
  precio: number;
  activo: boolean;
};

/**
 * Una línea de una venta: qué producto, a qué precio y cuántos.
 *
 * EL NOMBRE Y EL PRECIO SE COPIAN AQUÍ, no se leen del producto al mostrar la venta. Es
 * deliberado y es de las cosas que hay que hacer bien desde el primer día: si mañana sube
 * el Broster de 15 a 18, **las ventas de ayer tienen que seguir diciendo 15**. Un total
 * histórico que se mueve solo, en una app de dinero, no hay forma de explicarlo.
 *
 * El `productoId` se guarda igual, para poder agrupar "cuánto Broster se vendió" en V2.
 */
export type LineaDeVenta = {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
};

export type MetodoDeVenta = "yape" | "plin" | "efectivo" | "transferencia" | "tarjeta" | "otro";

export type Venta = {
  id: string;
  negocioId: string;
  /** "AAAA-MM-DD" */
  fecha: string;
  /** "HH:MM" */
  hora: string;
  /**
   * LAS LÍNEAS SON UNA LISTA DESDE LA V1, aunque hoy solo se venda un producto por venta.
   *
   * Es el enganche de la V3 y no cuesta nada ponerlo ahora: *"dos broster y una gaseosa"*
   * son dos líneas. Con un solo producto por venta habría que rehacer la forma de los
   * datos —y con ella todo lo que la lea— justo cuando llegue la voz.
   */
  lineas: LineaDeVenta[];
  total: number;
  metodo: MetodoDeVenta;
  /**
   * PAGADO O PENDIENTE, y en V1 siempre "pagado".
   *
   * Existe ya porque es la otra mitad del enganche de V2: para vincular un Yape con una
   * venta hace falta poder tener una venta esperando su pago. Añadirlo después obligaría a
   * decidir qué son las ventas ya guardadas que no lo tienen.
   */
  estado: "pagado" | "pendiente";
  /**
   * El movimiento automático con el que se vinculó esta venta, si se vinculó.
   *
   * Vacío en toda la V1: *"En V1 NO asumir automáticamente que ese movimiento corresponde
   * al Broster"*. Está para que vincular en V2 sea rellenar un campo y no cambiar la
   * estructura.
   */
  movimientoId?: string;
};

/**
 * UN MOVIMIENTO DEL NEGOCIO: plata que entra o sale de la caja.
 *
 * Es el equivalente del movimiento personal, pero **aparte**, que es toda la idea del Modo
 * Negocio. Aquí caen tres cosas:
 *
 *   · El gasto de insumos que se anota a mano ("S/ 50, compra de pollo").
 *   · El ingreso de una venta cobrada.
 *   · Y en el paso siguiente, el Yape que entra y se manda al negocio.
 *
 * POR QUÉ NO REUSA EL TIPO DEL MOVIMIENTO PERSONAL
 *
 * Porque el personal tiene categoría, comercio, cuenta y etiquetas —cosas de un presupuesto
 * de casa— y le falta lo único que aquí importa: de qué negocio es. Reusarlo obligaría a
 * añadirle un campo de negocio, y eso es exactamente la forma que se descartó: con el negocio
 * dentro del movimiento personal, su plata se cuela en los totales de casa en cuanto alguien
 * olvide un filtro.
 */
export type MovimientoNegocio = {
  id: string;
  negocioId: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  metodo: MetodoDeVenta;
  descripcion: string;
  /** "AAAA-MM-DD" */
  fecha: string;
  /** "HH:MM" */
  hora: string;
  /**
   * MANUAL O AUTOMÁTICO. Lo pidió con esas palabras: *"Origen del movimiento: Manual /
   * Automático"*.
   *
   * En V1 todos son manuales; el automático llega con la captura de Yape en el paso siguiente.
   */
  origen: "manual" | "automatico";
  /** La venta que lo generó, si vino de una venta. */
  ventaId?: string;
  /**
   * EL IDENTIFICADOR DEL AVISO DE ANDROID, para no registrar dos veces el mismo Yape.
   *
   * Vacío en V1 porque todavía no entran Yapes aquí. Existe ya porque es lo que evita el
   * duplicado en el paso siguiente, y añadirlo después obligaría a decidir qué son los
   * movimientos ya guardados que no lo tienen.
   */
  avisoId?: string;
};

/** Todo lo del negocio junto. Es lo que se guarda y lo que viaja a la nube. */
export type DatosDelNegocio = {
  negocios: Negocio[];
  productos: Producto[];
  ventas: Venta[];
  movimientos: MovimientoNegocio[];
};

export const NEGOCIO_VACIO: DatosDelNegocio = { negocios: [], productos: [], ventas: [], movimientos: [] };

/**
 * Un identificador propio, distinto del de los movimientos.
 *
 * Los movimientos usan números que van subiendo (utils/id). Aquí hacen falta textos: los
 * datos del negocio viajan a la nube y se pueden crear en dos celulares a la vez —uno en el
 * mostrador y otro en la cocina—, y dos números correlativos chocarían.
 */
export function nuevoId(prefijo: string): string {
  return `${prefijo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Guardado en el celular ───────────────────────────────────────────

export async function cargarNegocio(): Promise<DatosDelNegocio> {
  const [negocios, productos, ventas, movimientos] = await Promise.all([
    loadJSON<Negocio[]>(STORAGE_KEYS.negocios, []),
    loadJSON<Producto[]>(STORAGE_KEYS.productos, []),
    loadJSON<Venta[]>(STORAGE_KEYS.ventas, []),
    loadJSON<MovimientoNegocio[]>(STORAGE_KEYS.movimientosNegocio, []),
  ]);
  return {
    negocios: Array.isArray(negocios) ? negocios : [],
    productos: Array.isArray(productos) ? productos : [],
    ventas: Array.isArray(ventas) ? ventas : [],
    movimientos: Array.isArray(movimientos) ? movimientos : [],
  };
}

export function guardarNegocios(negocios: Negocio[]): void {
  saveJSON(STORAGE_KEYS.negocios, negocios);
}

export function guardarProductos(productos: Producto[]): void {
  saveJSON(STORAGE_KEYS.productos, productos);
}

export function guardarVentas(ventas: Venta[]): void {
  saveJSON(STORAGE_KEYS.ventas, ventas);
}

export function guardarMovimientosNegocio(movimientos: MovimientoNegocio[]): void {
  saveJSON(STORAGE_KEYS.movimientosNegocio, movimientos);
}

// ── Crear, editar, borrar ────────────────────────────────────────────

export function crearNegocio(datos: {
  nombre: string;
  categoria: string;
  moneda: string;
}): Negocio {
  return {
    id: nuevoId("neg"),
    nombre: sanitizeName(datos.nombre),
    categoria: datos.categoria,
    moneda: datos.moneda,
    activo: true,
    destinoYapes: "personal",
    creadoEn: Date.now(),
  };
}

export function crearProducto(negocioId: string, nombre: string, precio: number): Producto {
  return { id: nuevoId("prod"), negocioId, nombre: sanitizeName(nombre), precio, activo: true };
}

/**
 * ¿Ya hay un producto con ese nombre en ESTE negocio?
 *
 * Dos productos con el mismo nombre no se pueden distinguir al vender: se toca uno al azar
 * y las cuentas de "cuánto Broster salió" quedan repartidas entre los dos. Es el mismo
 * motivo por el que las categorías propias no admiten nombres repetidos.
 *
 * Solo dentro del mismo negocio: dos negocios pueden vender Broster los dos.
 */
export function productoRepetido(
  productos: Producto[],
  negocioId: string,
  nombre: string,
  exceptoId?: string
): boolean {
  // EL MISMO LIMPIADOR QUE LAS CATEGORIAS PROPIAS, no uno escrito aqui.
  //
  // Es lo que decide si "Broster" y "  broster " son el mismo nombre. Con dos limpiadores
  // distintos, la app acabaria aceptando en productos un nombre que rechaza en categorias, y
  // esa clase de diferencia no se descubre: simplemente un dia algo cuela.
  const buscado = sanitizeName(nombre).toLowerCase();
  if (buscado === "") return false;
  return productos.some(
    (p) => p.negocioId === negocioId && p.id !== exceptoId && sanitizeName(p.nombre).toLowerCase() === buscado
  );
}

/**
 * Borra un producto Y NO TOCA LAS VENTAS que lo incluían.
 *
 * Puede parecer un descuido y es justo lo contrario: la venta guarda el nombre y el precio
 * copiados (ver LineaDeVenta), así que una venta de ayer sigue diciendo "Broster S/ 15"
 * aunque el Broster ya no esté en la carta. Borrar las ventas cambiaría el dinero que se
 * ganó, que es lo último que puede pasar aquí.
 */
export function borrarProducto(productos: Producto[], id: string): Producto[] {
  return productos.filter((p) => p.id !== id);
}

/**
 * Borra un negocio con TODO lo suyo: sus productos y sus ventas.
 *
 * Aquí sí se borra en cascada, y la diferencia con lo de arriba es el sentido: quien borra
 * un producto quiere quitarlo de la carta, no borrar su historia; quien borra el negocio
 * quiere que no quede nada suyo. Dejar las ventas de un negocio que ya no existe las volvería
 * imposibles de ver y seguirían contando en cualquier total que se sume mañana.
 */
export function borrarNegocio(datos: DatosDelNegocio, id: string): DatosDelNegocio {
  return {
    negocios: datos.negocios.filter((n) => n.id !== id),
    productos: datos.productos.filter((p) => p.negocioId !== id),
    ventas: datos.ventas.filter((v) => v.negocioId !== id),
    movimientos: datos.movimientos.filter((m) => m.negocioId !== id),
  };
}

export function crearVenta(datos: {
  negocioId: string;
  lineas: LineaDeVenta[];
  metodo: MetodoDeVenta;
  fecha: string;
  hora: string;
}): Venta {
  return {
    id: nuevoId("ven"),
    negocioId: datos.negocioId,
    fecha: datos.fecha,
    hora: datos.hora,
    lineas: datos.lineas,
    total: totalDeLineas(datos.lineas),
    metodo: datos.metodo,
    estado: "pagado",
  };
}

/**
 * Un movimiento del negocio.
 *
 * El monto se redondea a céntimos aquí y no en cada pantalla: con dos sitios redondeando, uno
 * acaba guardando 45.299999999999996 y ese número se imprime en un total.
 */
export function crearMovimientoNegocio(datos: {
  negocioId: string;
  tipo: "ingreso" | "gasto";
  monto: number;
  metodo: MetodoDeVenta;
  descripcion: string;
  fecha: string;
  hora: string;
  origen?: "manual" | "automatico";
  ventaId?: string;
  avisoId?: string;
}): MovimientoNegocio {
  return {
    id: nuevoId("mov"),
    negocioId: datos.negocioId,
    tipo: datos.tipo,
    monto: Math.round(datos.monto * 100) / 100,
    metodo: datos.metodo,
    descripcion: sanitizeName(datos.descripcion),
    fecha: datos.fecha,
    hora: datos.hora,
    origen: datos.origen ?? "manual",
    ...(datos.ventaId ? { ventaId: datos.ventaId } : {}),
    ...(datos.avisoId ? { avisoId: datos.avisoId } : {}),
  };
}

/**
 * La fecha y la hora de AHORA, como las guarda el negocio: "AAAA-MM-DD" y "HH:MM".
 *
 * NO SE USA toISOString(), y esto no es un capricho. Esa función da la hora de Londres: en
 * Perú son cinco horas menos, así que **una venta de las 8 de la noche se guardaría con la
 * fecha de mañana**. En una pollería, las ventas de la noche son la mitad del día, y las
 * cuentas de hoy saldrían partidas en dos sin que nada dé error.
 *
 * La hora va en 24 con el cero delante ("09:05") para que los textos se ordenen solos en el
 * historial. Enseñarla en "9:05 a.m." es cosa de horaVisible(), al pintar.
 */
export function ahoraDelNegocio(ms: number = Date.now()): { fecha: string; hora: string } {
  const d = new Date(ms);
  const dos = (n: number) => String(n).padStart(2, "0");
  return {
    fecha: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
    hora: `${dos(d.getHours())}:${dos(d.getMinutes())}`,
  };
}

/**
 * El total de una venta, CALCULADO de sus líneas.
 *
 * Nunca se escribe a mano en ningún sitio: un total guardado que no cuadre con sus líneas
 * es un número que nadie puede explicar, y con cantidades es facilísimo que pase.
 */
export function totalDeLineas(lineas: LineaDeVenta[]): number {
  const suma = lineas.reduce((t, l) => t + l.precio * l.cantidad, 0);
  // A dos decimales: 15.1 × 3 da 45.299999999999996 en coma flotante, y eso acaba impreso.
  return Math.round(suma * 100) / 100;
}
