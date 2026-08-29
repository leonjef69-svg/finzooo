// EL COBRO DE PREMIUM (preparado el 08/08/2026, apagado hasta que exista la cuenta)
//
// El botón "ADQUIRIR" se quitó el 07/08/2026 (7ago-32) porque lo que hacía era `setIsPremium(true)`:
// **regalaba Premium** bajo un precio. Google lo trata como afirmación engañosa y era el bloqueo
// número uno para publicar. Desde entonces la pantalla dice "Llega pronto" y la forma honesta de
// ver las funciones es la prueba de 24 horas.
//
// Este archivo es la puerta por la que vuelve ese botón, pero ya conectado a un cobro de verdad.
//
// ---- POR QUÉ ESTO NO SE PUEDE TERMINAR HOY, Y NO ES POR PEREZA ----
//
// Google Play Billing **no se puede ni probar** sin tres cosas que no dependen del código:
//
//   1. Una cuenta de Play Console ($25, verificación de días).
//   2. Los productos de suscripción creados AHÍ, con sus identificadores.
//   3. La app subida a una prueba interna y firmada con la misma llave.
//
// Sin eso, la librería de cobro devuelve "producto no encontrado" y no hay forma de distinguir
// un fallo de código de un producto que todavía no existe. Por eso aquí están los
// identificadores vacíos y `comprasDisponibles()` en false: **el botón no aparece**, y la
// pantalla sigue diciendo la verdad, que es lo que dice hoy.
//
// Es el mismo criterio de Dropbox, OneDrive y los anuncios: media función que se puede tocar y
// siempre falla manda a buscar un fallo en el celular cuando lo que falta es un trámite.
//
// ---- Y HACE FALTA UN APK NUEVO ----
//
// La librería de cobro es código de Android, así que NO viaja por actualización. Se compila una
// vez, junto con los anuncios si para entonces también están, para no gastar dos APK en lo mismo.

/**
 * Los identificadores de los productos, tal y como se creen en Play Console.
 *
 * **VACÍOS HASTA QUE EXISTAN ALLÍ.** Se escriben una vez en Play Console → Monetizar →
 * Suscripciones, y tienen que coincidir **letra por letra** con lo que se ponga aquí: si no
 * coinciden, la app pide un producto que no existe y Google contesta con un error que no dice
 * cuál de los dos nombres está mal.
 *
 * Los precios de cada plan NO se ponen aquí: los fija Play Console por país y la app los lee de
 * la tienda. Ver PRECIOS en constants/precios.ts, que es lo que costaría y sirve para la
 * pantalla mientras no haya tienda — pero **el precio que se cobra manda siempre**.
 */
export const PRODUCTOS = {
  /** La suscripción mensual. */
  mensual: "",
  /** La anual, que sale más barata por mes. */
  anual: "",
} as const;

export type PlanDeCompra = keyof typeof PRODUCTOS;

/**
 * ¿Se puede cobrar en esta versión de la app?
 *
 * Falso mientras falten los identificadores. Un solo sitio que lo decida, para que ninguna
 * pantalla se invente su propia condición — que es como acaba apareciendo un botón de compra en
 * una versión que no puede cobrar.
 */
export function comprasDisponibles(): boolean {
  return PRODUCTOS.mensual !== "" && PRODUCTOS.anual !== "";
}

/**
 * LO QUE HAY QUE HACER EL DÍA QUE EXISTA LA CUENTA, en orden y sin saltarse nada.
 *
 * Está escrito aquí y no solo en ESTADO.md porque es donde se va a mirar: quien venga a
 * conectar el cobro abre este archivo.
 *
 * 1. Crear las dos suscripciones en Play Console y pegar sus identificadores arriba.
 * 2. Instalar la librería de cobro y compilar un APK. Ojo con las dos trampas del prebuild
 *    —`gradle.properties` pierde la memoria y hay que revisar el canal de actualizaciones—,
 *    están explicadas en ESTADO.md.
 * 3. **RESTAURAR COMPRAS ES OBLIGATORIO.** Google rechaza las apps de suscripción que no lo
 *    tienen: quien cambia de celular o reinstala tiene que poder recuperar lo que pagó sin
 *    volver a pagarlo. Ya está el botón en la pantalla, esperando a esta función.
 * 4. **Premium tiene que salir de la TIENDA, no del disco.** Hoy `isPremium` se guarda en el
 *    celular; con cobro de verdad, el disco solo puede ser un reflejo. Si manda el disco,
 *    cualquiera que sepa editarlo tiene Premium gratis — y, lo que pasa más a menudo, alguien
 *    que canceló seguiría teniéndolo para siempre.
 * 5. Probarlo con una cuenta de prueba de Play Console, **nunca con la del dueño**: una compra
 *    de verdad se cobra de verdad.
 * 6. **EL PRECIO QUE SE ENSEÑA TIENE QUE VENIR DE LA TIENDA.** Hoy la pantalla pinta
 *    `PRECIOS` de constants/precios.ts, que es lo que *costaría*, y sirve mientras no haya
 *    tienda. Pero Play Console fija el precio **por país y con su moneda**, y lo cambia cuando
 *    el dueño quiera: dejar el número escrito aquí acabaría enseñando S/ 9.90 a alguien a
 *    quien Google le va a cobrar otra cosa. Un precio anunciado que no es el que se cobra no
 *    es un descuido de pantalla — es lo que hace que alguien pida su plata de vuelta.
 */
/** No se puede comprar todavía: faltan los identificadores de Play Console. */
export class CompraNoDisponible extends Error {
  constructor() {
    super("sin-tienda");
    this.name = "CompraNoDisponible";
  }
}

/**
 * Compra un plan. **Todavía no hace nada y es a propósito.**
 *
 * Existe con su forma final para que el día que llegue la librería sea rellenar este cuerpo, sin
 * tocar la pantalla. Y **no devuelve `true` a la ligera**: lo único peor que no poder cobrar es
 * dar Premium sin haber cobrado, que es exactamente lo que se quitó el 07/08/2026.
 */
export async function comprarPlan(_plan: PlanDeCompra): Promise<never> {
  throw new CompraNoDisponible();
}

/**
 * Recupera una compra ya pagada. **Tampoco hace nada todavía.**
 *
 * Es obligatoria para Google, no opcional: sin esto, alguien que cambia de celular tendría que
 * pagar dos veces por lo mismo.
 */
export async function restaurarCompra(): Promise<never> {
  throw new CompraNoDisponible();
}
