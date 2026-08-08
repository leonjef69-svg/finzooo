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
import { historialDelNegocio, horaVisible, totalesDelNegocio } from "@/utils/negocioTotales";
import { STORAGE_KEYS } from "@/utils/storage";

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
  ok(/router\.push\("\/negocio"\)/.test(ajustes), "se llega desde Ajustes");
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
  ok(/totalesDelNegocio\(negocioId, ventas, movimientosNegocio\)/.test(pant), "el panel pide sus cuentas hechas");
  ok(/historialDelNegocio\(negocioId, ventas, movimientosNegocio\)/.test(pant), "y el historial tambien");
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

console.log(fallos === 0 ? "\nTodo bien: los cimientos del Modo Negocio\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
