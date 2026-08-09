// MODO NEGOCIO — LOS CIMIENTOS (V1, paso 1, 07/08/2026)
//
// Lo que se pidió: separar 🏠 Personal de 🏪 Negocio para que *"los movimientos del negocio NO
// se mezclen con los movimientos personales"*, **ni en los totales**.
//
// Esta prueba vigila los cimientos, que es lo que no se puede corregir después sin rehacerlo
// todo. Cuatro cosas, y cada una es un fallo que sería silencioso:
//
//   1. Que el negocio viva APARTE de los movimientos. Si mañana alguien le mete el negocio
//      dentro, la plata del negocio empieza a sumarse en los totales personales y no se nota
//      hasta que las cuentas no cuadran.
//   2. Que borre sus datos al cerrar sesión. Ya pasó el 07/08/2026 con las categorías propias:
//      la cuenta siguiente heredó las de la anterior, con sus fotos.
//   3. Que la nube del negocio sea OTRO documento, con el candado del señuelo, y que borrar
//      la cuenta borre los dos.
//   4. Que los totales de una venta salgan de sus líneas y que el precio quede copiado.
import fs from "fs";
import path from "path";
import {
  ahoraDelNegocio,
  borrarNegocio,
  borrarProducto,
  crearMovimientoNegocio,
  crearNegocio,
  crearProducto,
  crearVenta,
  productoRepetido,
  totalDeLineas,
  type DatosDelNegocio,
} from "@/utils/negocio";
import {
  enElPeriodo,
  filtrarPorPeriodo,
  historialDelNegocio,
  horaVisible,
  diferenciaConElMesPasado,
  mejorMesDe,
  mesAnteriorDe,
  productosVendidos,
  resumenPorMes,
  totalesDelNegocio,
} from "@/utils/negocioTotales";
import {
  fusionarMovimientosNegocio,
  mandarYapesA,
  negocioQueRecibeYapes,
  separarLoDelNegocio,
} from "@/utils/negocioCaptura";
import { STORAGE_KEYS } from "@/utils/storage";
import type { Transaction } from "@/types";

const RAIZ = process.cwd();

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- EL NEGOCIO VIVE APARTE DE LOS MOVIMIENTOS ---");
{
  // ES LA DECISION DE ARQUITECTURA DE TODA LA FUNCION, y la que hay que defender.
  //
  // Habia dos formas de que no se mezclen: marcar cada movimiento con su negocio y filtrar en
  // los DIECISEIS sitios que leen movimientos, o guardarlos aparte. Se eligio aparte para que
  // no mezclarse no dependa de acordarse de filtrar.
  ok(STORAGE_KEYS.negocios === "finzo:negocios", "los negocios tienen su propia clave");
  ok(STORAGE_KEYS.productos === "finzo:productos", "los productos tambien");
  ok(STORAGE_KEYS.ventas === "finzo:ventas", "y las ventas");

  // Y EL MOVIMIENTO NO SABE DE NEGOCIOS. Si aparece aqui un campo de negocio es que alguien
  // volvio a la otra forma, y con ella el riesgo de contaminar los totales personales.
  const tipos = fs.readFileSync(path.join(RAIZ, "types.ts"), "utf8");
  ok(!/negocio/i.test(tipos), "el movimiento personal no tiene ningun campo de negocio");

  // El camino personal no se toca: los totales se siguen calculando sobre la lista de
  // movimientos de siempre, sin filtro que se pueda olvidar.
  const finanzas = fs.readFileSync(path.join(RAIZ, "utils/finances.ts"), "utf8");
  ok(!/negocio/i.test(finanzas), "y los totales personales no saben que existe el negocio");
}

console.log("\n--- AL CERRAR SESION NO QUEDA NADA DEL NEGOCIO ---");
{
  // Ya paso con las categorias propias: sus claves vivian solo en su archivo, se quedaron
  // fuera del borrado, y la cuenta siguiente en ese celular heredo las categorias, los
  // nombres, los colores Y LAS FOTOS de la persona anterior. Aqui serian sus ventas y sus
  // precios.
  const almacen = fs.readFileSync(path.join(RAIZ, "utils/storage.ts"), "utf8");
  const borrado = almacen.slice(almacen.indexOf("clearAccountData"));
  for (const clave of ["negocios", "productos", "ventas"]) {
    ok(borrado.includes(`STORAGE_KEYS.${clave},`), `se borra ${clave} al cerrar sesion`);
  }
}

console.log("\n--- LA NUBE DEL NEGOCIO ES OTRO DOCUMENTO ---");
{
  // No es orden, es un limite que rompe cosas: TODO el respaldo de una cuenta vive en un solo
  // documento de Firestore y el tope es 1 MB. Las ventas de una polleria crecen rapido, y
  // pasarse de ese tope no deja el documento a medias: deja SIN GUARDAR la cuenta entera,
  // tambien lo personal, y en silencio.
  //
  // Se lee como texto y no se importa, para no arrastrar Firebase a las pruebas. Es la misma
  // forma que usan las otras pruebas de la nube.
  const nube = fs.readFileSync(path.join(RAIZ, "utils/cloudNegocio.ts"), "utf8");

  ok(/doc\(db, "negocios", uid\)/.test(nube), "el negocio se guarda en negocios/{uid}");
  ok(!/doc\(db, "users"/.test(nube), "y NO en el documento de la cuenta, que tiene tope de 1 MB");

  // EL CANDADO DEL SEÑUELO, EN LA PUERTA NUEVA.
  //
  // El de cloudSync esta puesto "en la unica puerta que da a Firestore". Esta es otra puerta:
  // sin el candado, con el señuelo puesto se subiria encima del respaldo real y —peor— se
  // bajarian las ventas y los precios de verdad para mostrarlos DENTRO del señuelo. O sea que
  // el modo hecho para esconder los datos los enseñaria.
  ok(/isDecoyActive/.test(nube), "la puerta nueva tiene el candado del modo señuelo");
  const subir = nube.slice(nube.indexOf("export function subirNegocio"));
  ok(/elSeñueloBloquea\(\)\) return Promise\.resolve\(\)/.test(subir.slice(0, 400)), "no sube con el señuelo puesto");
  const bajar = nube.slice(nube.indexOf("export async function bajarNegocio"));
  ok(/elSeñueloBloquea\(\)\) return null/.test(bajar.slice(0, 300)), "y no baja tampoco");

  // Firestore rechaza "undefined" y tira el guardado entero. La venta tiene movimientoId
  // opcional —vacio en toda la V1—, asi que sin limpiarlo el respaldo fallaria en silencio
  // desde el primer dia.
  ok(/JSON\.parse\(JSON\.stringify\(datos\)\)/.test(nube), "se limpian los campos vacios antes de subir");

  // BORRAR LA CUENTA TIENE QUE BORRAR LOS DOS DOCUMENTOS.
  //
  // Borrar un documento en Firestore NO borra otros. Sin esta linea, borrar la cuenta dejaria
  // las ventas y los precios del negocio en la nube para siempre — y el borrado diria que
  // salio bien.
  const cuenta = fs.readFileSync(path.join(RAIZ, "utils/cloudSync.ts"), "utf8");
  const borrarCuenta = cuenta.slice(cuenta.indexOf("export async function deleteCloudAccount"));
  ok(/deleteDoc\(doc\(db, "users", uid\)\)/.test(borrarCuenta), "borra el documento de la cuenta");
  ok(/borrarNegocioDeLaNube\(uid\)/.test(borrarCuenta), "Y TAMBIEN el del negocio");
}

console.log("\n--- LAS CUENTAS DE UNA VENTA ---");
{
  const lineas = [
    { productoId: "p1", nombre: "Broster", precio: 15, cantidad: 2 },
    { productoId: "p2", nombre: "Gaseosa", precio: 5, cantidad: 1 },
  ];
  ok(totalDeLineas(lineas) === 35, `dos broster y una gaseosa son 35 (${totalDeLineas(lineas)})`);

  // LOS CENTIMOS NO PUEDEN SALIR CON COLA. 15.1 x 3 da 45.299999999999996 en coma flotante, y
  // ese numero acaba impreso en un total.
  const conCentimos = [{ productoId: "p1", nombre: "Pan", precio: 15.1, cantidad: 3 }];
  ok(totalDeLineas(conCentimos) === 45.3, `15.10 x 3 son 45.30 (${totalDeLineas(conCentimos)})`);

  // El total de la venta se CALCULA, no se pasa: un total guardado que no cuadre con sus
  // lineas es un numero que nadie puede explicar.
  const venta = crearVenta({
    negocioId: "n1",
    lineas,
    metodo: "yape",
    fecha: "2026-08-07",
    hora: "19:30",
  });
  ok(venta.total === 35, "la venta calcula su total de las lineas");
  ok(venta.estado === "pagado", "y en V1 nace pagada");
  ok(venta.movimientoId === undefined, "sin vincular a ningun movimiento: eso es V2");

  // EL PRECIO QUEDA COPIADO EN LA LINEA. Si mañana sube el Broster de 15 a 18, las ventas de
  // ayer tienen que seguir diciendo 15. Un total historico que se mueve solo no hay forma de
  // explicarlo en una app de dinero.
  ok(venta.lineas[0].precio === 15 && venta.lineas[0].nombre === "Broster", "con el nombre y el precio copiados");

  // Y las lineas son una LISTA desde la V1, aunque hoy se venda de a uno: es el enganche de la
  // voz en V3 —"dos broster y una gaseosa"— sin rehacer la forma de los datos.
  ok(Array.isArray(venta.lineas) && venta.lineas.length === 2, "y varias lineas en una venta");
}

console.log("\n--- PRODUCTOS: NOMBRES Y BORRADO ---");
{
  const p1 = crearProducto("n1", "Broster", 15);
  const p2 = crearProducto("n2", "Broster", 18);
  ok(p1.activo, "un producto nace activo");

  // Dos productos con el mismo nombre en el MISMO negocio no se pueden distinguir al vender.
  ok(productoRepetido([p1], "n1", "broster"), "no se repite el nombre en el mismo negocio");
  ok(productoRepetido([p1], "n1", "  BROSTER  "), "sin importar mayusculas ni espacios");
  // Pero dos negocios pueden vender Broster los dos.
  ok(!productoRepetido([p1], "n2", "Broster"), "y dos negocios distintos si pueden repetirlo");
  ok(!productoRepetido([p1, p2], "n1", "Broster", p1.id), "y editar el suyo no choca consigo mismo");

  // BORRAR UN PRODUCTO NO BORRA SUS VENTAS. Puede parecer un descuido y es lo contrario: la
  // venta guarda el nombre y el precio copiados, asi que sigue diciendo "Broster S/ 15" aunque
  // el Broster ya no este en la carta. Borrar las ventas cambiaria el dinero que se gano.
  const restantes = borrarProducto([p1, p2], p1.id);
  ok(restantes.length === 1 && restantes[0].id === p2.id, "borrar un producto solo quita ese producto");
}

console.log("\n--- BORRAR UN NEGOCIO SE LLEVA LO SUYO, Y SOLO LO SUYO ---");
{
  const a = crearNegocio({ nombre: "Mi Polleria", categoria: "Restaurante", moneda: "S/" });
  const b = crearNegocio({ nombre: "La Bodega", categoria: "Bodega", moneda: "S/" });
  const datos: DatosDelNegocio = {
    negocios: [a, b],
    productos: [crearProducto(a.id, "Broster", 15), crearProducto(b.id, "Arroz", 4)],
    ventas: [
      crearVenta({ negocioId: a.id, lineas: [], metodo: "efectivo", fecha: "2026-08-07", hora: "10:00" }),
      crearVenta({ negocioId: b.id, lineas: [], metodo: "efectivo", fecha: "2026-08-07", hora: "11:00" }),
    ],
    movimientos: [],
  };

  const quedan = borrarNegocio(datos, a.id);
  ok(quedan.negocios.length === 1 && quedan.negocios[0].id === b.id, "se va el negocio borrado");
  // En cascada, y aqui SI es lo correcto: quien borra el negocio quiere que no quede nada
  // suyo. Dejar sus ventas las volveria imposibles de ver y seguirian contando en cualquier
  // total que se sume mañana.
  ok(quedan.productos.length === 1 && quedan.productos[0].negocioId === b.id, "y sus productos con el");
  ok(quedan.ventas.length === 1 && quedan.ventas[0].negocioId === b.id, "y sus ventas");
  // Y NO SE LLEVA LO DEL OTRO NEGOCIO. Es la mitad que se olvida al borrar en cascada.
  ok(quedan.productos.every((p) => p.negocioId === b.id), "sin tocar nada del otro negocio");
}

console.log("\n--- UN NEGOCIO NUEVO NO CAMBIA NADA DE LO QUE YA FUNCIONA ---");
{
  const n = crearNegocio({ nombre: "  Mi Polleria  ", categoria: "Restaurante", moneda: "S/" });
  ok(n.nombre === "Mi Polleria", "el nombre se guarda sin espacios de sobra");
  ok(n.activo, "nace activo");

  // LA MAS IMPORTANTE DE ESTE ARCHIVO PARA NO ROMPER NADA: los Yapes siguen yendo a Personal.
  //
  // Crear un negocio no puede cambiar donde caen los Yapes que ya se estaban registrando bien.
  // Mandarlos al negocio tiene que ser una decision explicita, no una sorpresa por haber
  // creado el negocio. Y no se adivina de quien viene el Yape: un cliente y un familiar mandan
  // el mismo aviso, y equivocarse meteria la plata de la casa en la caja del negocio.
  ok(n.destinoYapes === "personal", "y los Yapes siguen yendo a Personal hasta que se diga lo contrario");

  // Identificadores de texto y no numeros correlativos: los datos del negocio viajan a la nube
  // y se pueden crear en dos celulares a la vez —el del mostrador y el de la cocina—, y dos
  // numeros correlativos chocarian.
  const otro = crearNegocio({ nombre: "Otro", categoria: "Bodega", moneda: "S/" });
  ok(n.id !== otro.id, "dos negocios nunca comparten identificador");
  ok(n.id.startsWith("neg_"), "y se ve de un vistazo que es un negocio");
}

console.log("\n--- EL NEGOCIO ESTA ENGANCHADO POR LOS CUATRO LADOS ---");
{
  // Guardar en el celular, subir, BAJAR y soltar al cerrar sesion. Son cuatro, y que falte
  // una es un fallo silencioso distinto cada vez. La que mas duele es BAJAR: el 07/08/2026
  // pasó exactamente eso con las categorias propias y la personalizacion — se subian bien y
  // aqui no se leian, asi que entrar desde otro celular las hacia desaparecer con la copia
  // correcta a salvo en la nube. Y no dio ningun error.
  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");

  ok(/cargarNegocio\(\)/.test(ctx), "1. al arrancar se lee del celular");
  ok(/guardarVentas\(datosNegocio\.ventas\)/.test(ctx), "2. al cambiar se guarda en el celular");
  ok(/subirNegocio\(uid, datosNegocio\)/.test(ctx), "3. y se sube a la nube");
  ok(/const negocioDeLaNube = await bajarNegocio\(userUid\)/.test(ctx), "4. Y SE BAJA al entrar desde otro celular");
  // Bajar y no escribirlo en el celular seria peor que no bajarlo: la pantalla lo mostraria y
  // al reiniciar la app volveria a estar vacio.
  ok(/guardarVentas\(negocioDeLaNube\.ventas\)/.test(ctx), "y lo bajado se escribe en el celular");

  // Al cerrar sesion y al borrar la cuenta se suelta DEL ESTADO. El disco ya lo borra
  // clearAccountData, pero el estado en memoria sobrevive: sin esto, la cuenta siguiente veria
  // el negocio de la anterior hasta reiniciar la app.
  const veces = (ctx.match(/setDatosNegocio\(NEGOCIO_VACIO\)/g) ?? []).length;
  ok(veces >= 2, `se suelta al cerrar sesion y al borrar la cuenta (${veces})`);

  // LA SUBIDA DEL NEGOCIO VA EN SU PROPIO EFECTO, no dentro del de la cuenta: es otro
  // documento de Firestore, no un campo de ese. Y sus dependencias tienen que incluir los
  // datos del negocio, o crear uno no dispararia ninguna subida y se quedaria solo en el
  // celular — el mismo fallo que tuvieron los favoritos.
  const desdeLaSubida = ctx.slice(ctx.lastIndexOf("subirNegocio(uid, datosNegocio);"));
  const deps = /\}, \[[\s\S]*?\]\);/.exec(desdeLaSubida)?.[0] ?? "";
  ok(deps.includes("datosNegocio"), "y crear o cambiar algo del negocio dispara la subida");
}

console.log("\n--- LA PANTALLA, Y QUE EL MODO NEGOCIO ES PREMIUM ---");
{
  // Decision suya del 07/08/2026: es Premium. El candado va en la puerta de la pantalla, igual
  // que en importar, exportar, metas y los limites por categoria — el patron de la app.
  const ruta = fs.readFileSync(path.join(RAIZ, "app/negocio/index.tsx"), "utf8");
  ok(/if \(!isPremium\)/.test(ruta), "sin Premium no se entra");
  ok(/PremiumLocked/.test(ruta), "y se explica con la pantalla de siempre, no con una nueva");

  const pant = fs.readFileSync(path.join(RAIZ, "screens/Negocios.tsx"), "utf8");
  // Borrar un negocio se lleva sus ventas: eso hay que DECIRLO antes, no descubrirlo despues.
  ok(/negocios\.borrarAviso/.test(pant), "al borrar se avisa de que se van sus ventas");
  // Y la confirmacion va en la propia fila, no en una ventana del sistema: la ventana tapa la
  // pantalla y no deja leer de que negocio se trata, que es el dato que hace dudar.
  ok(/borrando === n\.id/.test(pant), "y se confirma en la propia fila");
  // Lo que la V1 todavia no hace, dicho en la pantalla. Es la leccion de la pantalla de
  // exportar: un limite que no se dice se toma por un fallo y se busca durante horas.
  ok(/negocios\.proximoPaso/.test(pant), "se dice que los productos llegan en el paso siguiente");

  // Y se llega desde Ajustes, o la pantalla no existiria para nadie.
  const ajustes = fs.readFileSync(path.join(RAIZ, "screens/Settings.tsx"), "utf8");
  // Se sigue llegando desde Ajustes, pero ya no siempre a la lista: con un solo negocio se
  // entra directo a su panel. Lo que esta comprobacion vigila es lo de siempre —que exista la
  // puerta— y no a cual de las dos pantallas da.
  ok(/router\.push\([\s\S]{0,160}"\/negocio"/.test(ajustes), "se llega desde Ajustes");
  ok(/negocios\.rowLabel/.test(ajustes), "con su nombre traducido");

  // Los textos, en los tres idiomas. Una clave que falte no da error: sale su nombre en
  // pantalla, que es peor que nada.
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["title", "crear", "borrarAviso", "vacioTitulo", "proximoPaso", "lockedDescription"]) {
    const veces = (i18n.match(new RegExp(`"negocios\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"${clave}" esta en los tres idiomas (${veces})`);
  }
  // Y las categorias de negocio, todas: una sin texto saldria como "negocios.cat.bodega".
  for (const cat of ["restaurante", "bodega", "belleza", "servicios", "ropa", "otro"]) {
    const veces = (i18n.match(new RegExp(`"negocios\\.cat\\.${cat}":`, "g")) ?? []).length;
    ok(veces === 3, `la categoria ${cat} esta traducida (${veces})`);
  }
}

console.log("\n--- PRODUCTOS: ENGANCHE Y PANTALLA (paso 3) ---");
{
  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(/function guardarProducto\(/.test(ctx), "se puede crear y editar un producto");
  ok(/function quitarProducto\(/.test(ctx), "y borrarlo");
  ok(/productos: datosNegocio\.productos,/.test(ctx), "y la pantalla los recibe");

  // GUARDAR Y EDITAR SON LA MISMA FUNCION, a proposito: con dos, basta que una olvide un campo
  // para que editar pierda lo que crear si guardaba.
  const laFuncion = ctx.slice(ctx.indexOf("function guardarProducto("), ctx.indexOf("function quitarProducto("));
  ok(/yaEstaba\s*$|const yaEstaba/m.test(laFuncion), "guardar sirve para crear y para editar");

  const pant = fs.readFileSync(path.join(RAIZ, "screens/Productos.tsx"), "utf8");

  // EL PRECIO SE ESCRIBE COMO TEXTO Y SE CONVIERTE UNA SOLA VEZ, al guardar. Guardado como
  // numero, escribir "12." o "12,5" se convertiria a medias mientras se teclea y el campo daria
  // saltos bajo el dedo.
  ok(/const \[precioTexto, setPrecioTexto\] = useState\(""\)/.test(pant), "el precio se teclea como texto");
  // Y LA COMA VALE: en Peru se escribe "12,50" tanto como "12.50", y rechazarlo seria rechazar
  // la forma en que la mitad de la gente escribe un precio.
  ok(/precioTexto\.replace\(",", "\."\)/.test(pant), "y la coma vale como el punto");
  // A dos decimales, o un precio con cola de coma flotante acaba impreso en un total.
  ok(/Math\.round\(precio \* 100\) \/ 100/.test(pant), "y se redondea a centimos");
  // Un precio de cero o negativo no es un precio.
  ok(/precio <= 0/.test(pant), "no se admite precio cero ni negativo");

  // NOMBRES REPETIDOS, NO: dos productos con el mismo nombre no se pueden distinguir al vender.
  ok(/productoRepetido\(productos, negocioId, nombre, enEdicion\.id\)/.test(pant), "no se repiten nombres");

  // SOLO LOS DE ESTE NEGOCIO. Sin el filtro, la polleria veria los productos de la bodega.
  ok(/p\.negocioId === negocioId/.test(pant), "solo se ven los productos de ese negocio");

  // ACTIVAR Y DESACTIVAR SIN ABRIR NADA: es lo que se hace a diario cuando se acaba un
  // producto, y meterlo dentro de "editar" lo esconde.
  ok(/<Toggle[\s\S]{0,200}activo: v/.test(pant), "se activa y desactiva desde la propia fila");
  // Y el desactivado TIENE QUE VERSE desactivado, o nadie entiende por que no sale al vender.
  ok(/productos\.desactivado/.test(pant), "y se ve que esta desactivado");

  // AL BORRAR SE DICE LO QUE **NO** PASA. Sin esto, quien borre un producto puede pensar que se
  // le van las ventas de la semana, y no se le van.
  ok(/productos\.borrarAviso/.test(pant), "al borrar se dice que las ventas no se tocan");

  // La ruta: con candado, y sin negocio no se dibuja una pantalla vacia.
  const ruta = fs.readFileSync(path.join(RAIZ, "app/negocio/productos.tsx"), "utf8");
  ok(/if \(!isPremium\)/.test(ruta), "los productos tambien son Premium");
  ok(/if \(!negocio\)/.test(ruta), "y sin negocio se vuelve, no se dibuja una lista huerfana");

  // Y se llega desde la lista de negocios.
  const lista = fs.readFileSync(path.join(RAIZ, "screens/Negocios.tsx"), "utf8");
  ok(/pathname: "\/negocio\/productos"/.test(lista), "se llega desde cada negocio");

  // Los textos, en los tres idiomas.
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["title", "crear", "precio", "repetido", "borrarAviso", "desactivado", "faltaPrecio"]) {
    const veces = (i18n.match(new RegExp(`"productos\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"productos.${clave}" esta en los tres idiomas (${veces})`);
  }
}

console.log("\n--- LAS CUENTAS DEL PANEL (paso 4) ---");
{
  // SON DINERO, ASI QUE SE COMPRUEBAN CON NUMEROS. Escritas dentro de la pantalla, la unica
  // forma de saber si el saldo esta bien seria abrir la app y mirar. Por eso viven en
  // utils/negocioTotales.
  const venta = (id: string, negocioId: string, total: number, fecha: string, hora: string) => ({
    id,
    negocioId,
    fecha,
    hora,
    lineas: [{ productoId: "p1", nombre: "Broster", precio: total, cantidad: 1 }],
    total,
    metodo: "yape" as const,
    estado: "pagado" as const,
  });
  const mov = (
    id: string,
    negocioId: string,
    tipo: "ingreso" | "gasto",
    monto: number,
    origen: "manual" | "automatico",
    hora = "12:00"
  ) => ({
    // El id se pone a mano ENCIMA del que genera crearMovimientoNegocio, para poder nombrar
    // cada movimiento en las comprobaciones de abajo. Se pasa por la funcion de verdad y no se
    // escribe el objeto a pelo: asi la prueba se entera si manana cambia lo que guarda.
    ...crearMovimientoNegocio({
      negocioId,
      tipo,
      monto,
      metodo: "efectivo",
      descripcion: "Compra de pollo",
      fecha: "2026-08-08",
      hora,
      origen,
    }),
    id,
  });

  const ventas = [
    venta("v1", "n1", 35, "2026-08-08", "19:30"),
    venta("v2", "n1", 15, "2026-08-08", "09:05"),
    // LA DEL OTRO NEGOCIO. Si aparece en las cuentas de n1, la polleria estaria sumando lo
    // de la bodega y nadie lo notaria hasta que las cuentas no cuadren.
    venta("v3", "n2", 999, "2026-08-08", "10:00"),
  ];
  const movimientos = [
    mov("m1", "n1", "gasto", 20, "manual", "08:00"),
    mov("m2", "n1", "ingreso", 50, "automatico", "20:00"),
    mov("m3", "n2", "gasto", 777, "manual"),
  ];

  const tot = totalesDelNegocio("n1", ventas, movimientos);
  ok(tot.ventas === 50, `las ventas del negocio suman 50 (${tot.ventas})`);
  ok(tot.cantidadVentas === 2, `y son 2 ventas (${tot.cantidadVentas})`);
  ok(tot.ingresosAutomaticos === 50, `lo que entro solo suma 50 (${tot.ingresosAutomaticos})`);
  ok(tot.gastos === 20, `y los gastos 20 (${tot.gastos})`);
  // EL DOBLE CONTEO DE LA V1, A PROPOSITO Y CON AVISO EN PANTALLA: la venta cobrada por Yape
  // suma como venta Y como ingreso automatico. Descontarlo a ojo seria adivinar que Yape era
  // de que venta, que es justo lo que el prohibio hasta la V2.
  ok(tot.saldo === 80, `el saldo son 50 + 50 - 20 = 80 (${tot.saldo})`);
  // Y NADA DEL OTRO NEGOCIO se cuela: la venta de 999 y el gasto de 777 no aparecen por
  // ningun lado.
  ok(tot.ventas !== 1049 && tot.gastos !== 797, "sin nada del otro negocio");

  // LOS CENTIMOS NO PUEDEN SALIR CON COLA. 0.1 + 0.2 dan 0.30000000000000004 en coma
  // flotante, y ese numero acaba impreso en un total de dinero.
  const conColas = totalesDelNegocio(
    "n1",
    [venta("v1", "n1", 0.1, "2026-08-08", "10:00"), venta("v2", "n1", 0.2, "2026-08-08", "11:00")],
    []
  );
  ok(conColas.ventas === 0.3, `0.10 + 0.20 son 0.30 (${conColas.ventas})`);
  ok(conColas.saldo === 0.3, `y el saldo tambien (${conColas.saldo})`);

  // Un negocio sin nada da ceros, no rompe ni deja huecos.
  const vacio = totalesDelNegocio("n9", ventas, movimientos);
  ok(vacio.ventas === 0 && vacio.saldo === 0 && vacio.cantidadVentas === 0, "un negocio sin nada da ceros");

  const hist = historialDelNegocio("n1", ventas, movimientos);
  ok(hist.length === 4, `el historial junta ventas y movimientos (${hist.length})`);
  // LO ULTIMO ARRIBA, Y ORDENADO POR LA HORA DE LA VENTA y no por cuando se guardo: una venta
  // que se cobro a las 7 y se anoto a las 9 tiene que caer en su sitio.
  ok(hist[0].id === "m2", `lo mas nuevo arriba: las 8 p.m. (${hist[0].id})`);
  ok(hist[hist.length - 1].id === "m1", `y lo mas viejo abajo: las 8 a.m. (${hist[hist.length - 1].id})`);
  // Y NADA DEL OTRO NEGOCIO tampoco aqui.
  ok(!hist.some((f) => f.id === "v3" || f.id === "m3"), "y no se cuela nada del otro negocio");
  ok(hist.find((f) => f.id === "m2")?.automatico === true, "se sabe cual lo registro la app sola");
  ok(hist.find((f) => f.id === "m1")?.clase === "gasto", "y cual es un gasto");

  // EL DETALLE SALE DE LO COPIADO EN LA VENTA, no de la lista de productos de hoy: si el
  // Broster sube de 15 a 18 o se borra de la carta, la venta de ayer sigue diciendo lo que se
  // vendio ayer.
  const conDosLineas = historialDelNegocio(
    "n1",
    [
      {
        ...venta("v1", "n1", 35, "2026-08-08", "19:30"),
        lineas: [
          { productoId: "p1", nombre: "Broster", precio: 15, cantidad: 2 },
          { productoId: "p2", nombre: "Gaseosa", precio: 5, cantidad: 1 },
        ],
      },
    ],
    []
  );
  ok(conDosLineas[0].detalle === "2 × Broster · 1 × Gaseosa", `"${conDosLineas[0].detalle}"`);

  // LA HORA SE GUARDA EN 24 Y SE LEE EN 12, y las dos mitades hacen falta: en 24 los textos se
  // ordenan solos (el historial de arriba depende de eso), y en 12 es como se dice la hora en
  // Peru — "19:30" obliga a hacer la resta mentalmente.
  ok(horaVisible("19:30") === "7:30 p.m.", `19:30 se lee 7:30 p.m. (${horaVisible("19:30")})`);
  ok(horaVisible("09:05") === "9:05 a.m.", `09:05 se lee 9:05 a.m. (${horaVisible("09:05")})`);
  // La medianoche son las 12 a.m., no las 0 a.m.: eso no lo dice nadie.
  ok(horaVisible("00:15") === "12:15 a.m.", `00:15 se lee 12:15 a.m. (${horaVisible("00:15")})`);
  ok(horaVisible("12:00") === "12:00 p.m.", `12:00 se lee 12:00 p.m. (${horaVisible("12:00")})`);
  // Y una hora dañada se enseña tal cual en vez de tumbar la pantalla: es un dato ya guardado,
  // asi que reventar aqui reventaria en cada arranque.
  ok(horaVisible("") === "", "una hora vacia no rompe la pantalla");
}

console.log("\n--- EL PANEL: ENGANCHE, PANTALLA Y RUTA (paso 4) ---");
{
  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(/function guardarVenta\(/.test(ctx), "se puede registrar una venta");
  // UNA VENTA SE TIENE QUE PODER BORRAR: se registra con el cliente delante y en dos toques.
  // Sin borrarla, el unico arreglo seria registrar otra al reves y el historial contaria una
  // historia que no paso.
  ok(/function quitarVenta\(/.test(ctx), "y borrarla");
  ok(/function guardarMovimientoNegocio\(/.test(ctx), "y anotar plata que entra o sale de la caja");
  ok(/ventas: datosNegocio\.ventas,/.test(ctx), "la pantalla recibe las ventas");
  ok(/movimientosNegocio: datosNegocio\.movimientos,/.test(ctx), "y los movimientos del negocio");

  // ESTA FALTABA Y ERA UN FALLO DE VERDAD: los movimientos del negocio se guardaban en el
  // estado y NO en el celular. Al reiniciar la app, los gastos anotados desaparecian sin dar
  // ningun error. Es el mismo agujero que tuvieron las categorias propias.
  ok(
    /guardarMovimientosNegocio\(datosNegocio\.movimientos\)/.test(ctx),
    "los movimientos del negocio se guardan en el celular"
  );
  ok(
    /guardarMovimientosNegocio\(negocioDeLaNube\.movimientos\)/.test(ctx),
    "y lo que baja de la nube tambien se escribe"
  );

  // Al cerrar sesion tampoco puede quedar nada. Esta clave ya estaba en el borrado desde el
  // primer commit del Modo Negocio —PASA CONTRA LA VERSION ANTERIOR, y se deja escrita
  // porque ahora si hay datos que borrar ahi.
  const almacen = fs.readFileSync(path.join(RAIZ, "utils/storage.ts"), "utf8");
  const borrado = almacen.slice(almacen.indexOf("clearAccountData"));
  ok(borrado.includes("STORAGE_KEYS.movimientosNegocio,"), "y se borran al cerrar sesion (ya estaba)");

  const pant = fs.readFileSync(path.join(RAIZ, "screens/PanelNegocio.tsx"), "utf8");

  // LAS CUENTAS NO SE ESCRIBEN EN LA PANTALLA. Es EL fallo que mas ha costado en este
  // proyecto: la misma formula en dos sitios, se cambia una y la otra no, y dos pantallas dan
  // numeros distintos del mismo mes.
  // Las listas que se le pasan llevan "DelPeriodo" desde la V2 —hoy, este mes o todo— pero lo
  // que se vigila aqui es lo de siempre: que las cuentas se PIDAN hechas y no se escriban en
  // la pantalla. Es EL fallo que mas ha costado en este proyecto: la misma formula en dos
  // sitios, se cambia una y la otra no, y dos pantallas dan numeros distintos del mismo mes.
  ok(/totalesDelNegocio\(negocioId, /.test(pant), "el panel pide sus cuentas hechas");
  ok(/historialDelNegocio\(negocioId, /.test(pant), "y el historial tambien");
  ok(!/\.reduce\(/.test(pant), "y no suma dinero por su cuenta");

  // EL DOBLE CONTEO, DICHO EN LA PANTALLA. Sin el aviso, el saldo parece equivocado — y un
  // numero de dinero que parece equivocado no se vuelve a mirar.
  ok(/panel\.avisoDoble/.test(pant), "se avisa de que un Yape puede contarse dos veces");

  // LA MARCA DEL NEGOCIO EN CADA FILA, para que ni una linea se confunda con un movimiento
  // personal. Con el dibujo de la tienda y no con un emoji: los emojis se quitaron de la app
  // entera el 03/08/2026 porque la misma cosa se veia de dos maneras.
  ok(/<Store size=\{10\}/.test(pant), "cada fila lleva la marca del negocio");
  ok(!/[\u{1F300}-\u{1FAFF}]/u.test(pant), "y ningun emoji, como en el resto de la app");

  // EL SIMBOLO DE LA MONEDA DEL NEGOCIO, no el de la app: el negocio guarda la suya desde el
  // primer dia porque puede no ser la misma.
  ok(/currencySymbolFor\(negocio\?\.moneda/.test(pant), "el dinero se escribe con la moneda del negocio");

  // Se puede borrar una fila, y se confirma en la propia fila como en el resto de la app.
  ok(/borrando === f\.id/.test(pant), "se confirma el borrado en la propia fila");

  // La ruta: con candado, y sin negocio se vuelve en vez de enseñar totales de la nada.
  const ruta = fs.readFileSync(path.join(RAIZ, "app/negocio/[id].tsx"), "utf8");
  ok(/if \(!isPremium\)/.test(ruta), "el panel tambien es Premium");
  ok(/if \(!negocio\)/.test(ruta), "y sin negocio se vuelve");

  // Y SE LLEGA A EL. Una pantalla a la que no se llega no existe para nadie. La flecha esta
  // ahi para que el toque no sea invisible: el toque escondido ya se descarto al editar
  // categorias.
  const lista = fs.readFileSync(path.join(RAIZ, "screens/Negocios.tsx"), "utf8");
  ok(/router\.push\(`\/negocio\/\$\{n\.id\}`\)/.test(lista), "se entra tocando el negocio");
  ok(/ChevronRight/.test(lista), "y se ve que se puede tocar");

  // Los textos, en los tres idiomas. Una clave que falte no da error: sale su nombre en
  // pantalla, que es peor que nada.
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["title", "saldo", "ventas", "gastos", "avisoDoble", "historial", "vacioTitulo", "proximoPaso"]) {
    const veces = (i18n.match(new RegExp(`"panel\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"panel.${clave}" esta en los tres idiomas (${veces})`);
  }
  // Y los metodos de pago del negocio, todos: uno sin texto saldria como "venta.metodo.plin"
  // en medio de una fila de dinero.
  for (const m of ["yape", "plin", "efectivo", "transferencia", "tarjeta", "otro"]) {
    const veces = (i18n.match(new RegExp(`"venta\\.metodo\\.${m}":`, "g")) ?? []).length;
    ok(veces === 3, `el metodo ${m} esta traducido (${veces})`);
  }
}

console.log("\n--- REGISTRAR UNA VENTA (paso 4) ---");
{
  // LA FECHA Y LA HORA SON DEL CELULAR, NO DE LONDRES.
  //
  // Es el fallo silencioso de esta pantalla: toISOString() da la hora de Londres, y en Peru
  // son cinco horas menos. Una venta de las 8 de la noche se habria guardado con la fecha de
  // MANANA, y en una polleria las ventas de la noche son la mitad del dia: las cuentas de hoy
  // saldrian partidas en dos sin que nada de error.
  //
  // Se construye una fecha LOCAL y se exige que salga esa misma fecha local: asi la prueba
  // vale en cualquier pais y no depende de donde se corra.
  const laNoche = new Date(2026, 7, 8, 20, 30).getTime();
  const ahora = ahoraDelNegocio(laNoche);
  ok(ahora.fecha === "2026-08-08", `una venta de las 8 de la noche es de HOY (${ahora.fecha})`);
  ok(ahora.hora === "20:30", `y son las 20:30 (${ahora.hora})`);
  // Con el cero delante, que es lo que deja ordenar el historial comparando textos.
  const temprano = ahoraDelNegocio(new Date(2026, 7, 8, 9, 5).getTime());
  ok(temprano.hora === "09:05", `las nueve y cinco se guardan "09:05" (${temprano.hora})`);
  ok(ahoraDelNegocio(new Date(2026, 0, 3, 0, 0).getTime()).fecha === "2026-01-03", "y el mes y el dia tambien llevan cero");

  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaVenta.tsx"), "utf8");

  // SOLO LOS PRODUCTOS ACTIVOS. Es todo el sentido de "desactivar" en vez de "borrar": la
  // gaseosa que se acabo deja de salir al vender y vuelve manana con su precio y su historia.
  ok(/p\.negocioId === negocioId && p\.activo/.test(pant), "solo salen los productos activos de ese negocio");

  // EL NOMBRE Y EL PRECIO SE COPIAN EN LA LINEA. Si manana sube el Broster de 15 a 18, esta
  // venta tiene que seguir diciendo 15.
  ok(/nombre: p\.nombre,\s*\n\s*precio: p\.precio,/.test(pant), "la venta copia el nombre y el precio");

  // EL TOTAL NO SE ESCRIBE A MANO EN NINGUN SITIO: sale de totalDeLineas, la misma funcion que
  // usa crearVenta al guardar. Asi el numero que se ve antes de registrar y el que queda
  // guardado no pueden ser distintos.
  ok(/const total = totalDeLineas\(lineas\)/.test(pant), "el total se calcula, no se teclea");
  ok(!/\.reduce\(/.test(pant), "y la pantalla no suma dinero por su cuenta");

  // Sin nada tocado no se registra: una venta de cero no es una venta.
  ok(/lineas\.length === 0/.test(pant), "no se registra una venta vacia");

  // BAJAR A CERO QUITA EL PRODUCTO de la venta. Dejar un "0 x Broster" obligaria a acordarse
  // de filtrarlo en cada sitio que lea las lineas.
  ok(/if \(nueva <= 0\) delete copia\[id\]/.test(pant), "bajar a cero quita el producto");

  // SIN PRODUCTOS NO SE PUEDE VENDER, y se dice con la salida delante: quien llega y ve una
  // lista vacia no tiene por que saber que los productos se ponen en otra pantalla.
  ok(/venta\.vacioTitulo/.test(pant), "sin productos activos se explica");
  ok(/pathname: "\/negocio\/productos"/.test(pant), "y se ofrece ir a ponerlos");

  // EL DOBLE CONTEO SE DICE TAMBIEN AQUI, no solo en el panel: es donde se elige "Yape".
  ok(/venta\.avisoYape/.test(pant), "se avisa del Yape contado dos veces");

  // La ruta: con candado, y sin negocio se vuelve. Guardar una venta de un negocio que ya no
  // existe la dejaria huerfana: contando en ningun sitio y sin forma de verla ni de borrarla.
  const ruta = fs.readFileSync(path.join(RAIZ, "app/negocio/venta.tsx"), "utf8");
  ok(/if \(!isPremium\)/.test(ruta), "registrar una venta tambien es Premium");
  ok(/if \(!negocio\)/.test(ruta), "y sin negocio se vuelve");

  // Y SE LLEGA DESDE EL PANEL, que es donde se mira el negocio.
  const panel = fs.readFileSync(path.join(RAIZ, "screens/PanelNegocio.tsx"), "utf8");
  ok(/pathname: "\/negocio\/venta"/.test(panel), "se entra a vender desde el panel");

  // Los textos, en los tres idiomas.
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["title", "total", "registrar", "registrada", "faltaProducto", "vacioTitulo", "avisoYape", "metodoTitulo"]) {
    const veces = (i18n.match(new RegExp(`"venta\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"venta.${clave}" esta en los tres idiomas (${veces})`);
  }
}

console.log("\n--- ANOTAR UN GASTO O UN INGRESO EN LA CAJA (paso 4) ---");
{
  // EL MONTO SE REDONDEA A CENTIMOS EN UN SOLO SITIO, dentro de crearMovimientoNegocio. Con dos
  // sitios redondeando, uno acaba guardando 45.299999999999996 y ese numero se imprime.
  const m = crearMovimientoNegocio({
    negocioId: "n1",
    tipo: "gasto",
    monto: 45.299999999999996,
    metodo: "efectivo",
    descripcion: "  Compra de pollo  ",
    fecha: "2026-08-08",
    hora: "08:00",
  });
  ok(m.monto === 45.3, `el monto se guarda a centimos (${m.monto})`);
  ok(m.descripcion === "Compra de pollo", "y la descripcion sin espacios de sobra");
  // A MANO SALVO QUE SE DIGA LO CONTRARIO: el automatico es el Yape del paso siguiente, y el
  // panel los enseña en lineas distintas porque no son lo mismo.
  ok(m.origen === "manual", "lo anotado a mano nace como manual");
  // Sin venta y sin aviso detras: esos dos huecos son de V2 y del paso 5.
  ok(m.ventaId === undefined && m.avisoId === undefined, "sin venta ni aviso detras");

  const pant = fs.readFileSync(path.join(RAIZ, "screens/MovimientoNegocio.tsx"), "utf8");

  // EL MONTO SE TECLEA COMO TEXTO y se convierte una sola vez al guardar, igual que el precio
  // de un producto: como numero, escribir "12." o "12,5" daria saltos bajo el dedo.
  ok(/const \[montoTexto, setMontoTexto\] = useState\(""\)/.test(pant), "el monto se teclea como texto");
  // Y LA COMA VALE COMO EL PUNTO: en Peru se escribe "12,50" tanto como "12.50".
  ok(/montoTexto\.replace\(",", "\."\)/.test(pant), "y la coma vale como el punto");
  // Cero o negativo no es un monto.
  ok(/monto <= 0/.test(pant), "no se admite cero ni negativo");

  // SALE O ENTRA, LAS DOS. Sin la de entrar, la linea de "ingresos anotados a mano" del panel
  // seria un numero que no puede cambiar nunca — la clase de promesa vacia que se ha estado
  // limpiando.
  ok(/setTipo\("gasto"\)/.test(pant) && /setTipo\("ingreso"\)/.test(pant), "se puede anotar lo que sale y lo que entra");

  // QUE ESTO NO TOCA LO PERSONAL, DICHO EN LA PANTALLA. Es lo que hace falta para fiarse: la
  // compra de pollo no va a aparecer entre los gastos de casa.
  ok(/caja\.avisoSeparado/.test(pant), "se dice que no toca los gastos personales");

  // Y ES VERDAD, NO SOLO UN TEXTO: esta pantalla no puede tocar los movimientos personales.
  // Si algun dia alguien mete aqui addOrUpdateTransaction, el gasto del negocio empezaria a
  // sumar en el presupuesto de casa y el aviso de arriba pasaria a ser mentira.
  ok(!/addOrUpdateTransaction/.test(pant), "y no toca los movimientos personales por ningun lado");

  // La fecha y la hora, del celular. Ver ahoraDelNegocio.
  ok(/ahoraDelNegocio\(\)/.test(pant), "la fecha y la hora salen del celular");

  const ruta = fs.readFileSync(path.join(RAIZ, "app/negocio/movimiento.tsx"), "utf8");
  ok(/if \(!isPremium\)/.test(ruta), "anotar en la caja tambien es Premium");
  ok(/if \(!negocio\)/.test(ruta), "y sin negocio se vuelve");

  const panel = fs.readFileSync(path.join(RAIZ, "screens/PanelNegocio.tsx"), "utf8");
  ok(/pathname: "\/negocio\/movimiento"/.test(panel), "se entra a anotar desde el panel");

  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["title", "gasto", "ingreso", "monto", "descripcion", "faltaMonto", "gastoGuardado", "avisoSeparado"]) {
    const veces = (i18n.match(new RegExp(`"caja\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"caja.${clave}" esta en los tres idiomas (${veces})`);
  }
}

console.log("\n--- Y LO PERSONAL SIGUE SIN ENTERARSE DE QUE EXISTE EL NEGOCIO ---");
{
  // LA COMPROBACION QUE PROTEGE LA DECISION DE TODA LA FUNCION, ahora que ya hay ventas y
  // gastos de verdad guardandose. Se pidio que no se mezclen NI EN LOS TOTALES, y se eligio
  // guardarlos aparte para que eso no dependa de acordarse de filtrar en los DIECISEIS sitios
  // que leen movimientos.
  //
  // types.ts y utils/finances.ts ya se vigilan arriba, en la primera seccion. Lo que falta es
  // la PANTALLA que enseña los totales de casa: es donde se veria la plata del negocio si
  // algun dia se colara, y es el sitio donde alguien la anadiria "para que se vea todo junto".
  //
  // PASA CONTRA LA VERSION ANTERIOR y se deja escrita a proposito: no descubre nada hoy,
  // guarda una puerta. Va marcada para que nadie la cuente como prueba de lo que se acaba de
  // hacer.
  const inicio = fs.readFileSync(path.join(RAIZ, "screens/Home.tsx"), "utf8");
  ok(!/negocio/i.test(inicio), "la pantalla de Inicio no sabe que existe el negocio (ya estaba)");
}

console.log("\n--- EL YAPEO QUE ENTRA AL NEGOCIO (paso 5) ---");
{
  // ES EL UNICO PASO DE LA V1 QUE TOCA UN CAMINO QUE YA FUNCIONABA: el registro automatico de
  // yapeos, que es de lo mas probado de la app y de lo que mas ha costado arreglar. Asi que lo
  // primero que se comprueba no es lo nuevo: es que lo viejo siga igual.
  const receptor = { ...crearNegocio({ nombre: "Mi Polleria", categoria: "restaurante", moneda: "PEN" }), destinoYapes: "negocio" as const };
  const apagado = crearNegocio({ nombre: "La Bodega", categoria: "bodega", moneda: "PEN" });

  const entra = (id: number, monto: number): Transaction => ({
    id,
    type: "income",
    amount: monto,
    category: "otros",
    date: "2026-08-08",
    method: "yape",
    description: "Juan Perez",
    notes: "",
    time: "7:30 p.m.",
    account: "yape",
    origin: "auto",
  });
  const sale = (id: number, monto: number): Transaction => ({ ...entra(id, monto), type: "expense" });
  // La hora del aviso en milisegundos, que es de donde salen la fecha y la hora del negocio.
  const avisos = { 1: new Date(2026, 7, 8, 19, 30).getTime(), 2: new Date(2026, 7, 8, 20, 0).getTime() };

  // 1. SIN NEGOCIO QUE RECIBA, NO CAMBIA NADA. Es la linea que protege todo lo demas: con el
  //    interruptor apagado —que es como esta por defecto— la app se comporta igual que antes
  //    de que este archivo existiera.
  const comoSiempre = separarLoDelNegocio([entra(1, 15), sale(2, 8)], avisos, undefined, []);
  ok(comoSiempre.personales.length === 2, "sin negocio receptor, todo sigue en lo personal");
  ok(comoSiempre.delNegocio.length === 0, "y no se crea nada en ninguna caja");

  // 2. Y CON UN NEGOCIO QUE NO RECIBE, TAMPOCO. Crear un negocio no puede cambiar donde caian
  //    los yapeos que ya se registraban bien: destinoYapes nace en "personal".
  ok(negocioQueRecibeYapes([apagado]) === undefined, "un negocio nuevo NO recibe los yapeos");
  const conNegocioApagado = separarLoDelNegocio([entra(1, 15)], avisos, negocioQueRecibeYapes([apagado]), []);
  ok(conNegocioApagado.personales.length === 1, "con el interruptor apagado, el yapeo sigue siendo personal");

  // 3. ENCENDIDO: lo que ENTRA va al negocio y lo que SALE se queda en lo personal. Un yapeo
  //    que TU pagas lo pagaste con tu plata; mandarlo a la caja meteria tu almuerzo entre los
  //    gastos del local.
  const repartido = separarLoDelNegocio([entra(1, 15), sale(2, 8)], avisos, receptor, []);
  ok(repartido.delNegocio.length === 1, `entra uno a la caja (${repartido.delNegocio.length})`);
  ok(repartido.delNegocio[0].monto === 15, "con su monto");
  ok(repartido.delNegocio[0].tipo === "ingreso", "como ingreso");
  ok(repartido.delNegocio[0].origen === "automatico", "y marcado como automatico, no a mano");
  ok(repartido.delNegocio[0].metodo === "yape", "cobrado por Yape");
  ok(repartido.delNegocio[0].negocioId === receptor.id, "y en el negocio que recibe");
  ok(repartido.personales.length === 1 && repartido.personales[0].type === "expense", "lo que TU pagas sigue siendo personal");

  // LA FECHA Y LA HORA SON LAS DEL AVISO, no las de ahora: si la app estuvo dos dias sin
  // abrirse, el yapeo es del dia que llego. Y en formato "HH:MM", para que el historial se
  // ordene solo.
  ok(repartido.delNegocio[0].fecha === "2026-08-08", `la fecha es la del aviso (${repartido.delNegocio[0].fecha})`);
  ok(repartido.delNegocio[0].hora === "19:30", `y la hora tambien (${repartido.delNegocio[0].hora})`);

  // 4. NO SE REGISTRA DOS VECES EL MISMO YAPEO. Para eso existe avisoId desde el primer
  //    commit del Modo Negocio. Un ingreso duplicado en una caja no se ve: solo infla el saldo.
  ok(!!repartido.delNegocio[0].avisoId, "el movimiento queda marcado con su aviso");
  const otraVez = separarLoDelNegocio([entra(1, 15)], avisos, receptor, repartido.delNegocio);
  ok(otraVez.delNegocio.length === 0, "el mismo yapeo no entra dos veces");
  // Y TAMPOCO CAE EN LO PERSONAL al descartarlo: ya esta registrado, en la caja.
  ok(otraVez.personales.length === 0, "y al descartarlo no se cuela en lo personal");

  // 5. SIN LA MARCA DEL AVISO SE QUEDA EN PERSONAL, que es donde estaria hoy. Meterlo en la
  //    caja sin poder marcarlo lo dejaria expuesto a entrar otra vez manana.
  const sinMarca = separarLoDelNegocio([entra(9, 15)], {}, receptor, []);
  ok(sinMarca.personales.length === 1 && sinMarca.delNegocio.length === 0, "sin marca de aviso se queda en personal");

  // 6. SOLO UN NEGOCIO PUEDE RECIBIR. Con dos, el mismo yapeo tendria dos destinos posibles y
  //    la respuesta dependeria del orden de la lista, o sea del azar.
  const dos = mandarYapesA([receptor, apagado], apagado.id, true);
  ok(dos.filter((n) => n.destinoYapes === "negocio").length === 1, "encender uno apaga los demas");
  ok(dos.find((n) => n.id === apagado.id)?.destinoYapes === "negocio", "y queda encendido el que se toco");
  // Apagar el suyo no toca a nadie mas.
  const ninguno = mandarYapesA(dos, apagado.id, false);
  ok(ninguno.every((n) => n.destinoYapes === "personal"), "y apagarlo los deja a todos en personal");

  // 7. UN NEGOCIO CERRADO NO RECIBE NADA.
  ok(negocioQueRecibeYapes([{ ...receptor, activo: false }]) === undefined, "un negocio inactivo no recibe yapeos");

  // 8. LA CAPTURA DEVUELVE DE QUE AVISO VINO CADA MOVIMIENTO. Sin eso no hay marca, y sin
  //    marca no hay forma de evitar el duplicado. Se comprueba en el archivo porque montar una
  //    notificacion de verdad aqui seria copiar medio parser.
  const captura = fs.readFileSync(path.join(RAIZ, "utils/autoCapture.ts"), "utf8");
  ok(/avisoDe\[id\] = n\.postedAt/.test(captura), "la captura apunta de que aviso vino cada movimiento");
  ok(/return \{ toAdd, log: log\.slice\(-MAX_LOG\), avisoDe \}/.test(captura), "y lo devuelve");
  // Y LA CAPTURA SIGUE SIN SABER QUE EXISTEN LOS NEGOCIOS: la marca del aviso va como un dato
  // aparte, no como un campo del movimiento personal, y el reparto ocurre DESPUES, fuera.
  //
  // Se mira que no IMPORTE nada del negocio, no que no aparezca la palabra: la palabra sale en
  // los comentarios que explican por que la marca existe, y esos comentarios son justo lo que
  // hay que conservar. Una prueba que prohibiera nombrarlo obligaria a borrar la explicacion.
  ok(!/from "@\/utils\/negocio/.test(captura), "y la captura no importa nada del negocio");

  // 9. EL ENGANCHE EN EL CONTEXTO, que es donde se reparte de verdad.
  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(/separarLoDelNegocio\(\s*toAdd,/.test(ctx), "al recoger un yapeo se reparte");
  ok(/setTransactions\(\(prev\) => \[\.\.\.personales, \.\.\.prev\]\)/.test(ctx), "lo personal va a los movimientos de siempre");
  ok(/movimientos: \[\.\.\.antes\.movimientos, \.\.\.delNegocio\]/.test(ctx), "y lo del negocio a su caja");
  // EL NEGOCIO TIENE QUE IR EN captureInputs. La recogida corre desde un escuchador montado
  // una vez: leyendo el estado ahi dentro, un yapeo acabaria en el bolsillo que estaba elegido
  // al abrir la app y no en el de ahora.
  ok(/captureInputs\.current = \{ transactions, merchantLearned, t, negocio: datosNegocio \}/.test(ctx), "y se usa el negocio de AHORA, no el de al abrir la app");

  // 10. EL INTERRUPTOR, EN EL PANEL Y NO ESCONDIDO. Es lo que decide donde cae tu plata todos
  //     los dias: en "editar el negocio" no lo encontraria nadie.
  const panel = fs.readFileSync(path.join(RAIZ, "screens/PanelNegocio.tsx"), "utf8");
  ok(/mandarYapesAlNegocio\(negocioId, v\)/.test(panel), "el interruptor esta en el panel");
  ok(/panel\.yapesExplicacion/.test(panel), "y se explica que hace");
  // Si otro negocio los estaba recibiendo, se dice ANTES de quitarselos.
  ok(/panel\.yapesOtroNegocio/.test(panel), "y se avisa si se los quitas a otro negocio");

  // 11. EL AGUJERO GORDO DE ESTE PASO: LA APP CERRADA.
  //
  // Hay DOS caminos que registran un yapeo. El del contexto corre con Finzo abierta; el de
  // utils/capturaEnFondo corre con la app CERRADA, despertado por Android, y escribe directo
  // en el disco. Sin repartir tambien ahi, encender "los yapeos entran a mi negocio" habria
  // funcionado solo con la app abierta — y con la app cerrada, que es cuando mas yapeos
  // llegan, la plata del negocio habria seguido cayendo en las cuentas de casa. Sin ningun
  // error: solo cuentas que no cuadran.
  const fondo = fs.readFileSync(path.join(RAIZ, "utils/capturaEnFondo.ts"), "utf8");
  ok(/separarLoDelNegocio\(/.test(fondo), "con la app CERRADA tambien se reparte");
  ok(/negocioQueRecibeYapes\(/.test(fondo), "y se lee que negocio recibe");
  ok(/loadJSON<MovimientoNegocio\[\]>\(STORAGE_KEYS\.movimientosNegocio/.test(fondo), "leyendo la caja del disco, que es lo unico que hay con la app cerrada");
  ok(/saveJSON\(STORAGE_KEYS\.movimientosNegocio, \[\.\.\.caja, \.\.\.delNegocio\]\)/.test(fondo), "y lo del negocio se escribe en su caja");
  ok(/mergeTransactions\(personales, guardadas\)/.test(fondo), "y en los movimientos personales solo va lo personal");

  // 12. Y LA OTRA MITAD: que la app no PISE lo que se escribio con ella cerrada.
  //
  // Es el mismo fallo que ya tuvieron los movimientos y el registro de avisos: la app guarda
  // la lista entera cada vez que cambia algo, asi que vuelve con su lista vieja en memoria y
  // el siguiente guardado se lleva por delante el yapeo que entro por fuera.
  const enMemoria = [crearMovimientoNegocio({ negocioId: "n1", tipo: "gasto", monto: 10, metodo: "efectivo", descripcion: "Gas", fecha: "2026-08-08", hora: "08:00" })];
  const delDisco = [...enMemoria, crearMovimientoNegocio({ negocioId: "n1", tipo: "ingreso", monto: 15, metodo: "yape", descripcion: "Juan", fecha: "2026-08-08", hora: "19:30", origen: "automatico", avisoId: "aviso_1" })];
  const juntos = fusionarMovimientosNegocio(enMemoria, delDisco);
  ok(juntos.length === 2, `se queda con lo de los dos lados (${juntos.length})`);
  ok(juntos.some((m) => m.avisoId === "aviso_1"), "y no se pierde el yapeo que entro con la app cerrada");
  // NO DUPLICA lo que ya estaba en los dos sitios.
  ok(juntos.filter((m) => m.id === enMemoria[0].id).length === 1, "sin duplicar lo que ya estaba");
  // Y DEVUELVE LA MISMA LISTA si no hay nada nuevo: esto corre cada ocho segundos, y una lista
  // nueva cada vez volveria a guardar y a SUBIR A LA NUBE el negocio entero sin motivo.
  ok(fusionarMovimientosNegocio(enMemoria, enMemoria) === enMemoria, "y si no hay nada nuevo devuelve la misma lista, sin repintar ni subir nada");

  const ctxFusion = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(/fusionarMovimientosNegocio\(antes\.movimientos, cajaDelDisco\)/.test(ctxFusion), "y la app junta la caja del disco al recoger");
  // Y AL REPARTIR SE MIRAN LAS DOS: la de memoria y la que se acaba de leer del disco. El
  // estado no esta listo hasta el siguiente dibujo, asi que un yapeo que el trabajo de fondo
  // acabara de anotar volveria a entrar si solo se mirara el estado.
  ok(
    /fusionarMovimientosNegocio\(datosDelNegocio\.movimientos, cajaDelDisco\)/.test(ctxFusion),
    "y no se registra dos veces uno que el trabajo de fondo acabe de anotar"
  );

  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["yapesTitulo", "yapesAqui", "yapesPersonal", "yapesExplicacion", "yapesOtroNegocio", "yapesActivado"]) {
    const veces = (i18n.match(new RegExp(`"panel\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"panel.${clave}" esta en los tres idiomas (${veces})`);
  }
  const avisoNegocio = (i18n.match(/"autoCapture\.toastNegocio":/g) ?? []).length;
  ok(avisoNegocio === 3, `el aviso de "entro a tu negocio" esta en los tres idiomas (${avisoNegocio})`);
}

console.log("\n--- V2: LO DE HOY, LO DEL MES Y TODO ---");
{
  // En la V1 el panel sumaba TODO lo registrado desde el primer dia. Un negocio no se lleva
  // asi: al cerrar se pregunta "cuanto hice hoy", y a fin de mes "cuanto hice este mes".
  const HOY = "2026-08-08";

  // SE COMPARA EL TEXTO DE LA FECHA, sin restar dias con Date. De las restas de fechas salen
  // los errores del dia 1 y los saltos de hora; aqui no hay ninguna resta.
  ok(enElPeriodo("2026-08-08", "hoy", HOY), "lo de hoy entra en hoy");
  ok(!enElPeriodo("2026-08-07", "hoy", HOY), "lo de ayer no");
  ok(enElPeriodo("2026-08-01", "mes", HOY), "el dia 1 entra en este mes");
  ok(enElPeriodo("2026-08-31", "mes", HOY), "y el 31 tambien");
  ok(!enElPeriodo("2026-07-31", "mes", HOY), "pero el ultimo dia del mes pasado no");
  ok(!enElPeriodo("2025-08-08", "mes", HOY), "ni el mismo mes de OTRO año");
  ok(enElPeriodo("2020-01-01", "todo", HOY), "y en 'todo' entra hasta lo mas viejo");

  const venta = (id: string, fecha: string, total: number) => ({
    id,
    negocioId: "n1",
    fecha,
    hora: "12:00",
    lineas: [{ productoId: "p1", nombre: "Broster", precio: total, cantidad: 1 }],
    total,
    metodo: "efectivo" as const,
    estado: "pagado" as const,
  });
  const ventas = [venta("v1", "2026-08-08", 10), venta("v2", "2026-08-07", 20), venta("v3", "2026-07-30", 100)];
  const gastoDeHoy = crearMovimientoNegocio({
    negocioId: "n1",
    tipo: "gasto",
    monto: 4,
    metodo: "efectivo",
    descripcion: "Gas",
    fecha: HOY,
    hora: "08:00",
  });
  const gastoViejo = { ...gastoDeHoy, id: "otro", fecha: "2026-07-30" };

  // LOS TOTALES DEL PERIODO, CON NUMEROS.
  const deHoy = totalesDelNegocio(
    "n1",
    filtrarPorPeriodo(ventas, "hoy", HOY),
    filtrarPorPeriodo([gastoDeHoy, gastoViejo], "hoy", HOY)
  );
  ok(deHoy.ventas === 10, `hoy se vendieron 10 (${deHoy.ventas})`);
  ok(deHoy.cantidadVentas === 1, `y fue 1 venta (${deHoy.cantidadVentas})`);
  ok(deHoy.gastos === 4, `y se gastaron 4 (${deHoy.gastos})`);
  ok(deHoy.saldo === 6, `asi que el dia deja 6 (${deHoy.saldo})`);

  const delMes = totalesDelNegocio(
    "n1",
    filtrarPorPeriodo(ventas, "mes", HOY),
    filtrarPorPeriodo([gastoDeHoy, gastoViejo], "mes", HOY)
  );
  ok(delMes.ventas === 30, `este mes van 30 (${delMes.ventas})`);
  ok(delMes.cantidadVentas === 2, `en 2 ventas (${delMes.cantidadVentas})`);
  // Y NO SE CUELA LO DEL MES PASADO, que es el fallo que haria que el mes nunca empezara de
  // cero y nadie entendiera por que su "mes" no cuadra con lo que vendio.
  ok(delMes.ventas !== 130, "sin arrastrar lo del mes pasado");

  const todo = totalesDelNegocio("n1", filtrarPorPeriodo(ventas, "todo", HOY), [gastoDeHoy, gastoViejo]);
  ok(todo.ventas === 130 && todo.cantidadVentas === 3, "y en 'todo' esta todo");
  // "todo" devuelve LA MISMA lista, sin copiarla: el panel lo llama en cada dibujo.
  ok(filtrarPorPeriodo(ventas, "todo", HOY) === ventas, "y 'todo' no copia la lista para nada");

  // EL HISTORIAL MIRA EL MISMO PERIODO QUE LOS TOTALES. Con dos filtros distintos, la pantalla
  // podria enseñar un saldo de hoy encima de una lista de la semana pasada — y eso no se ve
  // mirando: se ve cuando las cuentas no cuadran.
  const pant = fs.readFileSync(path.join(RAIZ, "screens/PanelNegocio.tsx"), "utf8");
  ok(/totalesDelNegocio\(negocioId, ventasDelPeriodo, movimientosDelPeriodo\)/.test(pant), "los totales son del periodo elegido");
  ok(/historialDelNegocio\(negocioId, ventasDelPeriodo, movimientosDelPeriodo\)/.test(pant), "y el historial, del MISMO periodo");
  // EMPIEZA EN HOY: es la pregunta que se hace al cerrar el dia.
  ok(/useState<PeriodoDelPanel>\("hoy"\)/.test(pant), "el panel abre en 'hoy'");
  // Y el dia de hoy sale del celular, no de la hora de Londres.
  ok(/ahoraDelNegocio\(\)\.fecha/.test(pant), "y 'hoy' es el dia del celular");
  // El nombre del numero grande cambia con el periodo: decir "saldo del negocio" encima de lo
  // de hoy seria mentir.
  ok(/panel\.saldo\.\$\{periodo\}/.test(pant), "el numero grande dice de que periodo es");
  // Y el vacio dice de que periodo esta vacio, o parece que se perdio lo de ayer.
  ok(/panel\.vacio\.\$\{periodo\}/.test(pant), "y el vacio tambien");

  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["periodo.hoy", "periodo.mes", "periodo.todo", "saldo.hoy", "saldo.mes", "vacio.hoy", "vacio.mes"]) {
    const veces = (i18n.match(new RegExp(`"panel\\.${clave.replace(".", "\\.")}":`, "g")) ?? []).length;
    ok(veces === 3, `"panel.${clave}" esta en los tres idiomas (${veces})`);
  }
}

console.log("\n--- V2: CUANTO BROSTER SALIO ---");
{
  const conLineas = (id: string, fecha: string, hora: string, lineas: { productoId: string; nombre: string; precio: number; cantidad: number }[]) => ({
    id,
    negocioId: "n1",
    fecha,
    hora,
    lineas,
    total: 0,
    metodo: "efectivo" as const,
    estado: "pagado" as const,
  });

  const ventas = [
    conLineas("v1", "2026-08-08", "12:00", [
      { productoId: "p1", nombre: "Broster", precio: 15, cantidad: 2 },
      { productoId: "p2", nombre: "Gaseosa", precio: 5, cantidad: 1 },
    ]),
    conLineas("v2", "2026-08-08", "13:00", [{ productoId: "p2", nombre: "Gaseosa", precio: 5, cantidad: 3 }]),
    // La del OTRO negocio no puede contar.
    { ...conLineas("v3", "2026-08-08", "14:00", [{ productoId: "p1", nombre: "Broster", precio: 15, cantidad: 99 }]), negocioId: "n2" },
  ];

  const vendidos = productosVendidos("n1", ventas);
  ok(vendidos.length === 2, `salen los dos productos vendidos (${vendidos.length})`);
  // POR PLATA Y NO POR CANTIDAD: cuatro gaseosas son mas unidades que dos brosters, pero lo que
  // sostiene el negocio son los 30 soles del broster contra los 20 de la gaseosa.
  ok(vendidos[0].nombre === "Broster", `manda el que mas plata trae (${vendidos[0].nombre})`);
  ok(vendidos[0].cantidad === 2 && vendidos[0].total === 30, `2 brosters, 30 soles (${vendidos[0].cantidad}, ${vendidos[0].total})`);
  // SE SUMAN LAS LINEAS DE VENTAS DISTINTAS: la gaseosa salio en dos ventas.
  ok(vendidos[1].cantidad === 4 && vendidos[1].total === 20, `4 gaseosas de dos ventas, 20 soles (${vendidos[1].cantidad}, ${vendidos[1].total})`);
  ok(!vendidos.some((p) => p.cantidad === 99), "y no se cuela lo del otro negocio");

  // SE AGRUPA POR PRODUCTO, NO POR NOMBRE. Si un dia se renombra "Broster" a "Broster de
  // pollo", agrupando por nombre saldrian dos filas del mismo producto y ninguna diria la
  // verdad. Y el nombre que se enseña es el de la venta MAS RECIENTE: la lista de "lo que mas
  // vendes" con el nombre de hace tres meses no la reconoceria nadie.
  const renombrado = productosVendidos("n1", [
    conLineas("v1", "2026-08-01", "12:00", [{ productoId: "p1", nombre: "Broster", precio: 15, cantidad: 1 }]),
    conLineas("v2", "2026-08-08", "12:00", [{ productoId: "p1", nombre: "Broster de pollo", precio: 15, cantidad: 1 }]),
  ]);
  ok(renombrado.length === 1, `un producto renombrado sigue siendo uno (${renombrado.length})`);
  ok(renombrado[0].cantidad === 2, "con sus dos ventas juntas");
  ok(renombrado[0].nombre === "Broster de pollo", `y con el nombre de ahora (${renombrado[0].nombre})`);

  // LOS CENTIMOS NO PUEDEN SALIR CON COLA en una lista de dinero.
  const conColas = productosVendidos("n1", [
    conLineas("v1", "2026-08-08", "12:00", [{ productoId: "p1", nombre: "Pan", precio: 0.1, cantidad: 3 }]),
  ]);
  ok(conColas[0].total === 0.3, `0.10 x 3 son 0.30 (${conColas[0].total})`);

  const pant = fs.readFileSync(path.join(RAIZ, "screens/PanelNegocio.tsx"), "utf8");
  // DEL MISMO PERIODO QUE TODO LO DEMAS: una lista de "lo que mas vendes" de todos los tiempos
  // debajo de unos totales de hoy seria dos respuestas a preguntas distintas en la misma
  // pantalla.
  ok(/productosVendidos\(negocioId, ventasDelPeriodo\)/.test(pant), "lo mas vendido es del periodo elegido");
  ok(/panel\.vendidosCantidad/.test(pant), "y cada fila dice cuantos salieron");

  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["vendidos", "vendidosCantidad"]) {
    const veces = (i18n.match(new RegExp(`"panel\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"panel.${clave}" esta en los tres idiomas (${veces})`);
  }
}

console.log("\n--- QUE NO PAREZCA QUE UN YAPEO SE PERDIO ---");
{
  // EL FALLO QUE ESTO EVITA, Y QUE ESTE PROYECTO YA HA TENIDO TRES VECES: la pantalla que
  // existe para diagnosticar tiene la respuesta y no la enseña. Paso con la voz y con el
  // lector de avisos.
  //
  // Desde que un negocio puede quedarse con los yapeos, "no me aparecio el yapeo en Inicio"
  // tiene una respuesta nueva: SI entro, pero a la caja del negocio. Si la pantalla de
  // Registro automatico no lo dice, se busca un fallo que no existe.
  const auto = fs.readFileSync(path.join(RAIZ, "screens/AutoCapture.tsx"), "utf8");
  ok(/autoCapture\.vanAlNegocio/.test(auto), "el registro automatico dice que los yapeos van al negocio");
  ok(/n\.activo && n\.destinoYapes === "negocio"/.test(auto), "y mira si de verdad hay uno recibiendo");
  ok(/router\.push\(`\/negocio\/\$\{negocioQueRecibe\.id\}`\)/.test(auto), "y deja ir a verlo de un toque");

  // Y EN AJUSTES, SIN ENTRAR A NADA. Si se apagara sin querer, aqui se nota.
  const ajustes = fs.readFileSync(path.join(RAIZ, "screens/Settings.tsx"), "utf8");
  ok(/negocios\.rowYapes/.test(ajustes), "y Ajustes lo dice sin tener que entrar");

  // CON UN SOLO NEGOCIO SE ENTRA DIRECTO A SU PANEL: la lista con un solo negocio es una
  // pantalla que solo sirve para tocar la unica fila que tiene.
  ok(/negocios\.length === 1 \? `\/negocio\/\$\{negocios\[0\]\.id\}` : "\/negocio"/.test(ajustes), "con un solo negocio se entra directo a su panel");
  // Y LA LISTA SIGUE ALCANZABLE desde el panel, o crear el segundo negocio —o editar el
  // nombre, o borrarlo— se volveria imposible de encontrar.
  const panel = fs.readFileSync(path.join(RAIZ, "screens/PanelNegocio.tsx"), "utf8");
  ok(/router\.push\("\/negocio"\)/.test(panel), "y desde el panel se vuelve a la lista de negocios");

  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ['"negocios\\.rowYapes"', '"autoCapture\\.vanAlNegocio"', '"autoCapture\\.vanAlNegocioTexto"', '"panel\\.misNegocios"']) {
    const veces = (i18n.match(new RegExp(`${clave}:`, "g")) ?? []).length;
    ok(veces === 3, `${clave.replace(/\\\\/g, "")} esta en los tres idiomas (${veces})`);
  }
}

console.log("\n--- V2: MES A MES (julio contra agosto) ---");
{
  // Lo pidio asi: "una comparativa por ejemplo del mes de julio y mes de agosto para saber
  // cuanto se gano ese mes".

  // EL SALTO DE ENERO, QUE ES DONDE ESTO SE ROMPE: el mes anterior a "2026-01" es "2025-12",
  // no "2026-00". Es el error de una linea que dejaria la comparacion vacia justo en enero.
  ok(mesAnteriorDe("2026-08") === "2026-07", `antes de agosto va julio (${mesAnteriorDe("2026-08")})`);
  ok(mesAnteriorDe("2026-01") === "2025-12", `y antes de enero, diciembre del año anterior (${mesAnteriorDe("2026-01")})`);
  ok(mesAnteriorDe("2026-10") === "2026-09", `y el cero delante no se pierde (${mesAnteriorDe("2026-10")})`);

  const venta = (id: string, fecha: string, total: number) => ({
    id,
    negocioId: "n1",
    fecha,
    hora: "12:00",
    lineas: [{ productoId: "p1", nombre: "Broster", precio: total, cantidad: 1 }],
    total,
    metodo: "efectivo" as const,
    estado: "pagado" as const,
  });
  const gasto = (id: string, fecha: string, monto: number) => ({
    ...crearMovimientoNegocio({
      negocioId: "n1",
      tipo: "gasto",
      monto,
      metodo: "efectivo",
      descripcion: "Pollo",
      fecha,
      hora: "08:00",
    }),
    id,
  });

  const resumen = resumenPorMes(
    "n1",
    [
      venta("v1", "2026-08-08", 100),
      venta("v2", "2026-08-01", 50),
      venta("v3", "2026-07-15", 200),
      // La del OTRO negocio no puede contar.
      { ...venta("v4", "2026-08-08", 999), negocioId: "n2" },
    ],
    [gasto("m1", "2026-08-02", 30), gasto("m2", "2026-07-10", 20)]
  );

  ok(resumen.length === 2, `salen los dos meses (${resumen.length})`);
  // EL MAS NUEVO PRIMERO, que es como se lee: se mira este mes y se compara con el de antes.
  ok(resumen[0].mes === "2026-08" && resumen[1].mes === "2026-07", "el mas nuevo arriba");
  ok(resumen[0].entro === 150 && resumen[0].salio === 30, `agosto: entraron 150, salieron 30 (${resumen[0].entro}, ${resumen[0].salio})`);
  ok(resumen[0].queda === 120, `y quedaron 120 (${resumen[0].queda})`);
  ok(resumen[1].queda === 180, `julio dejo 180 (${resumen[1].queda})`);
  ok(!resumen.some((m) => m.entro === 999), "y no se cuela lo del otro negocio");

  // UN MES EN ROJO ES POSIBLE Y TIENE QUE SALIR EN ROJO, no en cero: un mes en el que se
  // compro mas de lo que se vendio es informacion, no un error.
  const enRojo = resumenPorMes("n1", [], [gasto("m1", "2026-08-02", 30)]);
  ok(enRojo[0].queda === -30, `un mes puede quedar en rojo (${enRojo[0].queda})`);

  // EL TOPE: dos años de negocio serian 24 filas que nadie mira, y el que importa esta arriba.
  const muchos = resumenPorMes(
    "n1",
    Array.from({ length: 12 }, (_, i) => venta(`v${i}`, `2026-${String(i + 1).padStart(2, "0")}-05`, 10)),
    []
  );
  ok(muchos.length === 6, `no salen mas de 6 meses (${muchos.length})`);
  ok(muchos[0].mes === "2026-12", "y son los 6 mas nuevos");

  // LOS CENTIMOS, sin cola, tambien aqui.
  const conColas = resumenPorMes("n1", [venta("v1", "2026-08-08", 0.1), venta("v2", "2026-08-09", 0.2)], []);
  ok(conColas[0].entro === 0.3, `0.10 + 0.20 son 0.30 (${conColas[0].entro})`);

  const pant = fs.readFileSync(path.join(RAIZ, "screens/PanelNegocio.tsx"), "utf8");
  // MIRA TODAS LAS VENTAS, NO LAS DEL PERIODO. Es la unica parte de la pantalla que no obedece
  // al boton de arriba, y tiene que ser asi: comparar agosto con julio con "Hoy" puesto daria
  // una sola columna.
  ok(/resumenPorMes\(negocioId, ventas, movimientosNegocio\)/.test(pant), "el mes a mes mira todos los meses, no solo el periodo elegido");
  // LA RESTA LA HACE LA APP. Si hay que hacerla de cabeza mirando dos numeros, no se hace.
  ok(/panel\.comparaMas/.test(pant) && /panel\.comparaMenos/.test(pant), "y dice cuanto mas o menos que el mes pasado");
  // Y LA RESTA SE PIDE HECHA, no se escribe en la pantalla. Restar dos saldos parece
  // inofensivo y es por donde vuelve el fallo de siempre: una cuenta de plata dentro de una
  // pantalla no se puede comprobar sin abrir la app y mirar.
  ok(/diferenciaConElMesPasado\(meses, hoy\.slice\(0, 7\)\)/.test(pant), "y la resta se pide hecha, no se escribe en la pantalla");

  // LA DIFERENCIA, CON NUMEROS. Y null cuando falta el mes pasado: "no hay con que comparar"
  // y "quedo igual" son dos frases distintas, y enseñar la segunda cuando es la primera seria
  // inventar.
  ok(diferenciaConElMesPasado(resumen, "2026-08") === -60, `agosto va 60 por debajo de julio (${diferenciaConElMesPasado(resumen, "2026-08")})`);
  ok(diferenciaConElMesPasado(resumen, "2026-07") === null, "sin mes pasado no se compara nada");
  // Y la barra se mide contra el mejor mes, con suelo en cero: si todos quedaron en rojo, sin
  // ese suelo saldrian los anchos al reves y el peor mes tendria la barra mas larga.
  ok(mejorMesDe(resumen) === 180, `el mejor mes fue 180 (${mejorMesDe(resumen)})`);
  ok(mejorMesDe(enRojo) === 0, `con todos en rojo, el suelo es cero (${mejorMesDe(enRojo)})`);
  // Con un solo mes no hay nada que comparar: seria un titulo con una fila que repite lo de
  // arriba.
  ok(/meses\.length > 1/.test(pant), "no sale con un solo mes");

  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  for (const clave of ["mesAMes", "mesDetalle", "comparaMas", "comparaMenos", "comparaIgual"]) {
    const veces = (i18n.match(new RegExp(`"panel\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"panel.${clave}" esta en los tres idiomas (${veces})`);
  }
}

console.log("\n--- NADA QUE SEA UN CERO PERMANENTE ---");
{
  // LO QUE VIO EL EN SU CELULAR EL 08/08/2026, con Chelito ya funcionando: un saldo de S/ 2
  // que entro solo por Yape, y debajo "0 ventas registradas", una linea de "Ventas S/ 0.00", y
  // media pantalla de aviso explicando que un Yape puede contarse dos veces.
  //
  // Con SU forma de usar la app —solo la plata, sin registrar ventas— esos tres nunca pueden
  // cambiar, y el aviso describe un problema que no puede ocurrir. Es exactamente la clase de
  // promesa vacia que se ha estado limpiando de esta app todo el proyecto.
  //
  // No se borro nada: todo vuelve solo en cuanto haya una venta registrada.
  const pant = fs.readFileSync(path.join(RAIZ, "screens/PanelNegocio.tsx"), "utf8");

  ok(/const usaVentas = useMemo/.test(pant), "el panel sabe si este negocio registra ventas");
  // Se mira en TODAS las ventas y no en las del periodo: si registro ventas el mes pasado y
  // este no, la linea tiene que seguir ahi — un cero que PUEDE cambiar si informa.
  ok(/ventas\.some\(\(v\) => v\.negocioId === negocioId\)/.test(pant), "y lo mira en todas, no solo en el periodo");

  ok(/usaVentas && \(\s*<Text[\s\S]{0,200}panel\.cantidadVentas/.test(pant), "el contador de ventas solo sale si las hay");
  ok(/usaVentas && \(\s*<Linea[\s\S]{0,200}panel\.ventas/.test(pant), "la linea de Ventas tambien");
  // El aviso son varias lineas, asi que se comprueba de otra forma: que entre "usaVentas" y el
  // texto del aviso no haya nada que cierre el bloque. Contar caracteres a ojo daria una prueba
  // que se rompe sola cada vez que alguien reescriba una linea del aviso.
  const antesDelAviso = pant.slice(0, pant.indexOf("panel.avisoDoble"));
  const ultimaGuarda = antesDelAviso.lastIndexOf("{usaVentas && (");
  ok(ultimaGuarda !== -1, "y el aviso del doble conteo, que sin ventas es imposible");

  // EL BOTON GRANDE ES EL QUE SE USA. Sin ventas, "Registrar venta" grande y verde es el que
  // nunca se toca, encima del que si: anotar un gasto.
  ok(/usaVentas \?/.test(pant), "el boton grande cambia segun como se lleve el negocio");
  // Y NINGUNO DE LOS TRES DESAPARECE: el que no sube arriba baja a la fila de abajo.
  ok(/pathname: "\/negocio\/venta"/.test(pant), "registrar venta sigue alcanzable");
  ok(/pathname: "\/negocio\/movimiento"/.test(pant), "y anotar un gasto tambien");
  ok(/pathname: "\/negocio\/productos"/.test(pant), "y los productos");

  // EL OJO DUPLICABA AL INTERRUPTOR. Estaban el ojo abierto Y el interruptor encendido, uno al
  // lado del otro, contando lo mismo dos veces — y el ojo no se puede tocar, asi que ademas
  // invitaba a tocarlo. Apagado si aporta: explica por que ese producto no sale al vender.
  const prod = fs.readFileSync(path.join(RAIZ, "screens/Productos.tsx"), "utf8");
  ok(!/<Eye /.test(prod), "el ojo abierto ya no repite lo que dice el interruptor");
  ok(/!p\.activo && \(/.test(prod), "y el apagado se sigue viendo, que es el que informa");
  ok(/productos\.desactivado/.test(prod), "con su texto, como antes");
}

console.log(fallos === 0 ? "\nTodo bien: los cimientos del Modo Negocio\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
