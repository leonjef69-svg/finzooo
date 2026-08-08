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
  borrarNegocio,
  borrarProducto,
  crearNegocio,
  crearProducto,
  crearVenta,
  productoRepetido,
  totalDeLineas,
  type DatosDelNegocio,
} from "@/utils/negocio";
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

console.log(fallos === 0 ? "\nTodo bien: los cimientos del Modo Negocio\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
