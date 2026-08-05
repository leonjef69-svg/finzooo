// CREAR CATEGORIAS PROPIAS
//
// Pedido el 03/08/2026: un boton "Nueva" en la cuadricula de categorias que
// abra una pantalla con icono, color y vista previa.
//
// Lo que de verdad hay que proteger no es la pantalla: es que una categoria
// creada por la persona se comporte EXACTAMENTE igual que una de fabrica en
// los 38 sitios donde se dibuja una categoria. Si en uno solo se ve como
// "Otros", eso se descubre meses despues y por casualidad.
import fs from "fs";
import path from "path";
import { catInfo, gastosDisponibles, ingresosDisponibles } from "@/constants/categories";
import { crear, borrar, editar, esPropia, nombreRepetido, setPropias, type CategoriaPropia } from "@/utils/categoriasPropias";

const RAIZ = process.cwd();

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- SE CREA Y SE COMPORTA COMO UNA DE FABRICA ---");
{
  const { lista, creada } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  setPropias(lista);

  const c = catInfo(creada.id);
  ok(c.id === creada.id, "catInfo la encuentra");
  ok(c.label === "Broster", "con su nombre tal cual, sin traducir");
  ok(c.color === "orange", "y su color");
  ok(typeof c.icon === "function" || typeof c.icon === "object", "y un dibujo de verdad");

  // Aparece donde toca y NO donde no toca.
  ok(gastosDisponibles().some((x) => x.id === creada.id), "sale en la lista de gastos");
  ok(!ingresosDisponibles().some((x) => x.id === creada.id), "y NO en la de ingresos");
  setPropias([]);
}

console.log("\n--- EL ID NO PUEDE CHOCAR CON LOS DE LA APP ---");
{
  // Sin prefijo, quien cree una "Comida" tendria el mismo id que la de
  // fabrica y una de las dos desapareceria, llevandose la categoria de todos
  // sus movimientos anteriores.
  const { creada } = crear([], { nombre: "Comida", tipo: "expense", color: "green", icono: "Utensils" });
  ok(creada.id !== "comida", "una propia llamada Comida no pisa a la de fabrica");
  ok(esPropia(creada.id), "se reconoce como propia");
  ok(!esPropia("comida"), "y las de fabrica no");

  setPropias([creada]);
  ok(catInfo("comida").label === "category.comida", "la de fabrica sigue intacta");
  setPropias([]);
}

console.log("\n--- BORRARLA NO ROMPE SUS MOVIMIENTOS ---");
{
  // Un movimiento guarda el ID de su categoria. Si al borrarla el movimiento
  // se rompiera, se perderia un gasto — que es mucho peor que perder un
  // nombre.
  const { lista, creada } = crear([], { nombre: "Gaseosas", tipo: "expense", color: "sky", icono: "CupSoda" });
  setPropias(lista);
  setPropias(borrar(lista, creada.id));

  const huerfano = catInfo(creada.id);
  ok(huerfano.id === "otros", "cae en Otros en vez de romperse");
  ok(huerfano.label === "category.otros", "con nombre de verdad, no vacio");
  setPropias([]);
}

console.log("\n--- NO SE PERMITEN DOS IGUALES DEL MISMO TIPO ---");
{
  // Dos categorias llamadas igual en la misma lista no se pueden distinguir
  // al anotar: se elige una al azar y los totales quedan repartidos entre las
  // dos sin que nadie entienda por que.
  const { lista } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  ok(nombreRepetido(lista, "Broster", "expense"), "avisa del repetido");
  ok(nombreRepetido(lista, "  broster ", "expense"), "sin importar espacios ni mayusculas");
  ok(!nombreRepetido(lista, "Broster", "income"), "pero de gasto e ingreso si pueden llamarse igual");
  ok(!nombreRepetido(lista, "Pollo", "expense"), "y otro nombre pasa");
}

console.log("\n--- LO GUARDADO A MEDIAS NO ENTRA ---");
{
  // Los datos vienen del disco y de la nube. Una entrada rota no se ve al
  // guardarla: revienta despues, al dibujar una lista, en una pantalla que no
  // tiene nada que ver.
  setPropias([
    { id: "propia_ok", nombre: "Buena", tipo: "expense", color: "red", icono: "Tag" },
    { id: "sin_prefijo", nombre: "Mala", tipo: "expense", color: "red", icono: "Tag" },
    { id: "propia_x", nombre: "", tipo: "expense", color: "red", icono: "Tag" },
    { id: "propia_y", nombre: "Sin tipo", color: "red", icono: "Tag" } as unknown as CategoriaPropia,
    null as unknown as CategoriaPropia,
  ]);
  const quedan = gastosDisponibles().filter((c) => esPropia(c.id));
  ok(quedan.length === 1, `solo entra la buena (entraron ${quedan.length})`);
  setPropias([]);
}

console.log("\n--- EDITAR NO BORRA LO QUE NO SE TOCA ---");
{
  const { lista, creada } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  const despues = editar(lista, creada.id, { color: "red" })[0];
  ok(despues.color === "red", "cambia lo que se pide");
  ok(despues.nombre === "Broster", "y deja el nombre");
  ok(despues.icono === "Drumstick", "y el dibujo");
}

console.log("\n--- LOS 236 DIBUJOS NO SE REHACEN EN CADA LETRA ---");
{
  // Reportado el 04/08/2026: "al usar la categoria, poner nueva y mas, se pone
  // lento". Eran dos cosas, y las dos medibles:
  //
  //   1. iconoDe devolvia un componente RECIEN CREADO para cada logo. Para
  //      React eso no es "el mismo dibujo otra vez": es otro componente, asi
  //      que tiraba el anterior y lo construia de cero. 55 logos por pulsacion.
  //   2. La cuadricula entera se redibujaba con cada letra del nombre.
  const iconos = fs.readFileSync(path.join(RAIZ, "constants/iconos.tsx"), "utf8");
  ok(iconos.includes("LOGOS_HECHOS"), "los logos se guardan y se reutilizan");
  ok(/LOGOS_HECHOS\.get\(nombre\)/.test(iconos), "se busca el ya hecho antes de crear otro");

  // Comprobacion de verdad, no de texto: dos llamadas seguidas tienen que
  // devolver EL MISMO componente. Si devuelven distintos, el fallo volvio.
  const { iconoDe: resolver } = require("@/constants/iconos") as {
    iconoDe: (id: string) => unknown;
  };
  ok(resolver("marca:youtube") === resolver("marca:youtube"), "el mismo logo dos veces es el MISMO objeto");
  ok(resolver("Utensils") === resolver("Utensils"), "y lo mismo con los de linea");
  ok(resolver("marca:youtube") !== resolver("marca:spotify"), "pero dos logos distintos son distintos");

  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");

  // La misma pantalla SIN COMENTARIOS, para las comprobaciones de "esto ya no
  // debe existir". Tres aserciones se cayeron por su propia explicacion: el
  // comentario que cuenta por que se quito algo contiene su nombre. Una prueba
  // que castiga documentar el motivo termina haciendo que se borre el motivo.
  const codigo = pant.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  ok(pant.includes("memo(function Dibujito"), "cada dibujo esta memorizado");
  ok(pant.includes("memo(function Fila"), "y las filas, que son lo que la lista recicla");
  // Recibir la funcion de traducir bastaba para que memo no sirviera de nada:
  // cambia en cada dibujado del padre.
  ok(pant.includes("titulos[item.clave]"), "los titulos llegan traducidos, no la funcion de traducir");

  // 04/08/2026, DESPUES de publicar lo de arriba: "ya actualize sigue lento".
  // Memorizar evita REHACER los dibujos, no TENERLOS. El coste real era montar
  // los 236 de golpe en una pantalla donde caben veinte, y cada uno es un
  // dibujo vectorial, no una letra. Ahora la lista solo construye lo visible.
  //
  // Ya existio un "memo(function Catalogo" que dibujaba todos los grupos sin
  // condicion: si vuelve, la lentitud vuelve con el.
  ok(!codigo.includes("memo(function Catalogo"), "ya no hay un catalogo que dibuje los 236 de golpe");
  ok(/<FlatList/.test(pant), "el catalogo va en una lista que solo construye lo que se ve");
  ok(pant.includes("initialNumToRender"), "y se le limita cuanto construye al abrir");

  // Una lista dentro de una pantalla deslizable cree que tiene sitio infinito
  // y construye TODO: seria volver al fallo con mas codigo. Por eso el
  // ScrollView que queda es solo el de los colores, y va en la otra rama.
  // Se mide el anidamiento de verdad: cuantos ScrollView quedan ABIERTOS en el
  // punto donde empieza la lista. "Aparece un ScrollView antes" no sirve — los
  // colores usan uno, y son la otra rama del mismo if, no un envoltorio.
  const antesDeLaLista = pant.slice(0, pant.indexOf("<FlatList"));
  const abiertos = (antesDeLaLista.match(/<ScrollView[\s>]/g) ?? []).length;
  const cerrados = (antesDeLaLista.match(/<\/ScrollView>/g) ?? []).length;
  ok(abiertos === cerrados, "la lista NO va dentro de un ScrollView");

  // 05/08/2026, con foto: "esta disparejo los iconos". Al pasar a filas de
  // cinco quedaron con ancho fijo, asi que no llegaban al borde y sobraba un
  // vacio a la derecha. Se comprueba con numeros mas abajo, en su seccion.
  ok(!/w-12 h-12 rounded-2xl/.test(codigo), "ninguna casilla lleva ancho fijo");
  ok(/style=\{\{ width: lado, height: lado \}\}/.test(pant), "el lado sale del ancho de la pantalla");
  ok(pant.includes('key={"hueco"'), "y las filas cortas se rellenan con espacio vacio");

  // Mismo reporte: "se siente feo al abrirlo". Se intento dos veces APARTAR el
  // dibujado de la animacion de entrada, y las dos salieron peor:
  //
  //   1. No dibujar nada hasta que la animacion acabara -> "luego de 1 segundo
  //      aparece los iconos como si estuviera cargando".
  //   2. Igual pero solo los dibujos, con la cuadricula vacia ya puesta -> se
  //      seguia viendo el momento en que aparecian. "Ni bien entro deberia ya
  //      estar los iconos".
  //
  // Esperar nunca era el arreglo, y estas dos aserciones existen para que no
  // vuelva a intentarse: el arreglo era construir MENOS (ver windowSize abajo).
  ok(!codigo.includes("InteractionManager"), "los dibujos no esperan a nada para salir");
  ok(!/\bdibujar\b/.test(codigo), "ni sale la casilla vacia primero y el dibujo despues");

  // LO QUE DECIDE SI ABRIR PESA es la PRIMERA pasada, y solo esa: es la unica
  // que ocurre mientras la pantalla entra. Aqui va el tope, porque es el numero
  // que se sube "por si acaso" y el que se paga al abrir.
  const primeros = Number(/initialNumToRender=\{(\d+)\}/.exec(pant)?.[1] ?? "999");
  ok(primeros <= 8, `initialNumToRender es ${primeros}: la primera pasada se mantiene corta`);

  // Y AQUI ESTUVO UN ERROR MIO, que esta prueba existe para no repetir: se le
  // puso tope a windowSize (2) creyendo que era la causa de la lentitud al
  // abrir. No lo era —windowSize se llena DESPUES, en tandas— y el tope trajo
  // otro fallo: "cuando deslizo para abajo estan recien apareciendo los iconos
  // como si estuvieran cargando". La reserva tiene que ser holgada.
  const ventana = Number(/windowSize=\{(\d+)\}/.exec(pant)?.[1] ?? "0");
  ok(ventana >= 4, `windowSize es ${ventana}: hay reserva de sobra para deslizar`);

  // Y las tandas tienen que llenarse mas rapido que el dedo, o el hueco se ve
  // igual aunque la reserva sea grande.
  const tanda = Number(/maxToRenderPerBatch=\{(\d+)\}/.exec(pant)?.[1] ?? "0");
  ok(tanda >= 8, `maxToRenderPerBatch es ${tanda}: las tandas no van mas lentas que el dedo`);

  // 05/08/2026, con foto de la pantalla ENTERA en blanco: "cuando deslizo
  // rapido para abajo o para arriba se pone asi". Reserva y tandas ayudan, pero
  // no alcanzan a un deslizon fuerte: sin las medidas dadas, la lista tiene que
  // dibujar cada fila para averiguar cuanto mide, asi que no sabe que mostrar
  // hasta que ya llego. Con getItemLayout lo sabe de antemano y va directo.
  ok(pant.includes("getItemLayout="), "la lista sabe de antemano donde esta cada fila");

  // removeClippedSubviews suelta las vistas que salen de pantalla: en Android es
  // una causa conocida de celdas en blanco, porque al volver hay que rehacerlas.
  // Con 236 casillas la memoria no es el problema; los huecos si lo eran.
  ok(!codigo.includes("removeClippedSubviews"), "no suelta las vistas que salen de pantalla");

  // Con los iconos ya al instante, lo que quedaba era el cambio de pantalla en
  // si: "podrias agregarle una transicion suave, se ve brusco al momento de
  // cambiar". Sin declarar la ruta tomaba la animacion por defecto de Android y
  // ademas pintaba el fondo nativo blanco un instante — las dos mitades de lo
  // brusco. La animacion la corre el sistema, no nuestro codigo, asi que sigue
  // suave aunque la pantalla este armando sus iconos.
  const layout = fs.readFileSync(path.join(RAIZ, "app/_layout.tsx"), "utf8");
  const suya = /name="nueva-categoria"[\s\S]{0,300}?\/>/.exec(layout)?.[0] ?? "";
  ok(suya.length > 0, "la ruta de nueva categoria esta declarada en el layout");
  // Se probo el fundido y el usuario lo quito el mismo dia: sobre el papel es
  // mas suave, pero al usarlo la pantalla aparece de la nada y se nota como un
  // parpadeo. Queda el deslizamiento. Se guarda la eleccion concreta, no un
  // generico "que haya animacion": es gusto suyo y no se deduce del codigo.
  ok(/animation: "slide_from_right"/.test(suya), "y entra deslizandose, no de golpe");
  ok(!/animation: "fade"/.test(suya), "sin el fundido, que se probo y no gusto");
  ok(/backgroundColor: screenBg/.test(suya), "con el fondo del tema, para que no destelle blanco");
}

console.log("\n--- LAS MEDIDAS DE LA CUADRICULA CUADRAN ---");
{
  // Estas cuentas son lo unico fragil de la pantalla: la lista da por hechas las
  // alturas para poder adelantarse al dedo, asi que si una no coincide con lo
  // que se dibuja, las filas se montan unas sobre otras o quedan separadas. Y
  // eso se ve PEOR que el hueco que se estaba arreglando. Por eso se comprueban
  // con numeros y no leyendo el codigo.
  const {
    ALTO_TITULO: altoTitulo,
    LADO_DE: ladoDe,
    MARGEN_LATERAL: margen,
    POR_FILA: porFila,
    RENGLONES: renglones,
    SEPARACION: sep,
    medidasDe,
  } = require("@/constants/catalogoFilas") as typeof import("@/constants/catalogoFilas");
  // Los grupos vienen de su propio archivo: hubo un momento en que existieron
  // dos "TODOS_LOS_GRUPOS", uno en cada sitio. Dos listas de lo mismo es una
  // que se queda atras.
  const { TODOS_LOS_GRUPOS: grupos } = require("@/constants/iconos") as typeof import("@/constants/iconos");

  // 1. Las cinco casillas mas los huecos mas los margenes llenan JUSTO el ancho.
  //    Si sobra, se ve el vacio a la derecha que el usuario reporto; si falta,
  //    la quinta casilla se sale.
  for (const ancho of [320, 360, 393, 412, 480, 600]) {
    const lado = ladoDe(ancho);
    const ocupado = lado * porFila + sep * (porFila - 1) + margen * 2;
    ok(Math.abs(ocupado - ancho) < 0.001, `en ${ancho} de ancho las cinco casillas llenan justo`);
    ok(lado > 0, `y el lado sale positivo en ${ancho}`);
  }

  // 2. TODAS las filas tienen las mismas casillas. Una fila corta se reparte el
  //    ancho de otra forma y sus dibujos salen mas grandes: eso fue "disparejo".
  const filas = renglones.filter((r) => r.clase === "fila");
  ok(filas.length > 0, "hay filas que comprobar");
  ok(
    filas.every((r) => r.clase === "fila" && r.iconos.length === porFila),
    `las ${filas.length} filas tienen ${porFila} casillas exactas`
  );

  // 3. Ni un dibujo perdido ni uno repetido al aplanar. Aplanar es donde se
  //    pierde un icono sin que nadie lo note: el catalogo sigue "funcionando".
  const enGrupos = grupos.flatMap((g) => g.iconos);
  const enFilas = filas.flatMap((r) => (r.clase === "fila" ? r.iconos : [])).filter((x) => x !== null);
  ok(enFilas.length === enGrupos.length, `los ${enGrupos.length} dibujos estan todos, ni uno mas`);
  ok(new Set(enGrupos).size === enGrupos.length, "y ninguno esta repetido en el catalogo");

  // 4a. LA CAUSA RAIZ, encontrada por esta prueba el 05/08/2026: dos grupos se
  //     llamaban "iconos.servicios" —el de luz, agua e internet, y el de Uber,
  //     Airbnb y Dropbox—. Hacia dos danos a la vez: el titulo "Servicios" salia
  //     dos veces en la pantalla, y los renglones de los dos grupos quedaban con
  //     la misma clave. Existio desde que nacio el catalogo, sin que se notara.
  const titulos = grupos.map((g) => g.titulo);
  const titulosRepes = titulos.filter((tt, i) => titulos.indexOf(tt) !== i);
  ok(titulosRepes.length === 0, `ningun grupo repite nombre${titulosRepes.length ? " — " + titulosRepes.join(", ") : ""}`);

  // 4b. Y la consecuencia, medida aparte: dos renglones con la misma clave es
  //     justo de lo que se agarra la lista para saber que dibujar donde.
  const claves = renglones.map((r) => r.clave);
  const cuantas = new Map<string, number>();
  for (const c of claves) cuantas.set(c, (cuantas.get(c) ?? 0) + 1);
  const repes = [...cuantas].filter(([, n]) => n > 1).map(([c, n]) => `${c} x${n}`);
  ok(
    repes.length === 0,
    `las ${claves.length} claves de renglon son distintas${repes.length ? " — repetidas: " + repes.join(", ") : ""}`
  );

  // 5. Las posiciones son la suma corrida de las alturas. Es la cuenta que la
  //    lista usa para saltar directo a donde el dedo la lleva.
  const altoFila = ladoDe(412) + sep;
  const { altos, desde, total } = medidasDe(altoFila);
  ok(altos.length === renglones.length, "hay una altura por renglon");
  let acumulado = 0;
  let cuadran = true;
  renglones.forEach((r, i) => {
    if (desde[i] !== acumulado) cuadran = false;
    const esperado = r.clase === "titulo" ? altoTitulo : altoFila;
    if (altos[i] !== esperado) cuadran = false;
    acumulado += altos[i];
  });
  ok(cuadran, "cada renglon empieza donde acaba el anterior, y mide lo que le toca");
  ok(total === acumulado, "y el total es la suma de todos");
}

console.log("\n--- NI UN LOGO DE BANCO EN EL CATALOGO ---");
{
  // Una app de dinero mostrando el logo de un banco es lo que hace pensar
  // "esto tiene relacion con mi banco": el reclamo mas facil de recibir y el
  // mas dificil de defender. Se decidio con el usuario el 03/08/2026.
  const cat = fs.readFileSync(path.join(RAIZ, "constants/iconos.tsx"), "utf8");
  const prohibidas = ["paypal", "visa", "mastercard", "cc-", "stripe", "bitcoin", "btc", "amex", "discover", "bancomat"];
  const coladas = prohibidas.filter((p) => cat.includes('marca:' + p));
  ok(coladas.length === 0, `sin marcas financieras${coladas.length ? ": " + coladas.join(", ") : ""}`);

  // Y las que si estan, todas en un solo sitio: quitar una si alguien reclama
  // tiene que ser borrar una linea, no buscar por el proyecto.
  const otros = fs.readdirSync(path.join(RAIZ, "constants"))
    .filter((f) => f !== "iconos.tsx")
    .filter((f) => fs.readFileSync(path.join(RAIZ, "constants", f), "utf8").includes("marca:"));
  ok(otros.length === 0, `las marcas viven en un solo archivo${otros.length ? " (tambien en " + otros.join(", ") + ")" : ""}`);
}

console.log("\n--- Y LA APP DE VERDAD LO USA ---");
{
  // Un motor perfecto que ninguna pantalla llama no sirve de nada.
  const add = fs.readFileSync(path.join(RAIZ, "screens/AddSheet.tsx"), "utf8");
  ok(add.includes("gastosDisponibles"), "la pantalla de agregar usa las listas con las propias");
  ok(add.includes("/nueva-categoria"), "y tiene el boton para crear una");
  ok(add.includes("categoriaRecienCreada"), "y la deja elegida al volver");

  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(ctx.includes("savePropias"), "el contexto las guarda en disco");
  ok(ctx.includes("loadPropias"), "y las lee al arrancar");
}

console.log("\n--- EDITAR Y BORRAR SE PUEDEN ALCANZAR ---");
{
  // Sin una puerta visible, quien cree una categoria con el icono equivocado
  // se queda con ella para siempre. Se descarto el toque largo: es invisible,
  // y quien no lo sepa no lo encuentra nunca.
  const add = fs.readFileSync(path.join(RAIZ, "screens/AddSheet.tsx"), "utf8");
  ok(add.includes("esPropia(category)"), "el enlace de editar solo sale con una propia elegida");
  ok(add.includes("nuevaCat.editarEsta"), "y dice cual se va a editar");
  ok(add.includes("id: category"), "pasandole su id");

  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");
  ok(pant.includes("editandoId"), "la pantalla sabe editar, no solo crear");
  ok(pant.includes("borrarCategoria"), "y borrar");

  // Los valores se leen UNA vez, al abrir. Leidos en cada dibujado, cada toque
  // en el catalogo pisaria lo que la persona acaba de elegir.
  ok(
    pant.includes("useState(() => original?.icono"),
    "y arranca con lo que la categoria ya tenia, sin pisarlo despues"
  );
}

console.log("\n--- VIAJAN A LA COPIA DE LA NUBE ---");
{
  // Sin esto, cambiar de celular las pierde: los movimientos vuelven de la
  // nube pero con la categoria en "Otros", y no hay forma de recuperar los
  // nombres. Se descubre justo cuando mas duele.
  const cloud = fs.readFileSync(path.join(RAIZ, "utils/cloudSync.ts"), "utf8");
  ok(cloud.includes("categoriasPropias?:"), "el documento de la nube las contempla");
  ok(/categoriasPropias\?:/.test(cloud), "y como opcional, para no romper cuentas viejas");

  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");

  // TODOS los sitios que suben, no "alguno": olvidar uno hace que se pierdan
  // solo en ese camino —al cerrar sesion, por ejemplo— y eso no se nota
  // probando.
  const subidas = [...ctx.matchAll(/saveCloudData\(uid, \{/g)].map((m) => m.index ?? 0);
  const conPropias = subidas.filter((i) => ctx.slice(i, i + 900).includes("categoriasPropias"));
  ok(
    subidas.length > 0 && conPropias.length === subidas.length,
    `las suben los ${subidas.length} sitios que escriben en la nube (${conPropias.length} lo hacen)`
  );

  // Y al bajarlas hay que ponerlas en los DOS sitios: la variable de modulo
  // que consulta catInfo y el estado. Solo con el estado, un movimiento con
  // categoria propia se veria como "Otros" hasta el siguiente arranque.
  const bajada = ctx.slice(ctx.indexOf("cloud.categoryOverrides ?? {}"));
  ok(bajada.slice(0, 800).includes("setPropias(cloud.categoriasPropias"), "al bajarlas, van a catInfo");
  ok(
    bajada.slice(0, 800).includes("setCategoriasPropiasState(cloud.categoriasPropias"),
    "y al estado que redibuja"
  );
}

console.log("\n--- ANTES DE BORRAR SE DICE QUE PASA CON LOS MOVIMIENTOS ---");
{
  // "Se va a borrar" no informa igual que "3 movimientos quedaran en Otros", y
  // ese numero es justo lo que hace dudar o seguir. Con dinero, el aviso tiene
  // que traer el dato.
  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");
  ok(pant.includes("movimientosDeCategoria"), "se cuentan los movimientos afectados");
  ok(pant.includes("nuevaCat.borrarConMovs"), "y se avisa con el numero");
  ok(pant.includes("nuevaCat.borrarSinMovs"), "o que no hay ninguno, si es el caso");
  ok(pant.includes("confirmandoBorrado"), "y se confirma antes, no se borra de un toque");

  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  const aviso = i18n.slice(i18n.indexOf('"nuevaCat.borrarConMovs"'));
  const linea = aviso.slice(0, aviso.indexOf("\n"));
  ok(linea.includes("{count}"), "el aviso lleva el numero de verdad, no un 'algunos'");
  ok(/NO se borran/.test(linea), "y deja claro que los movimientos NO se pierden");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
