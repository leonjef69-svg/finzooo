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
  ok(!pant.includes("memo(function Catalogo"), "ya no hay un catalogo que dibuje los 236 de golpe");
  ok(/<FlatList/.test(pant), "el catalogo va en una lista que solo construye lo que se ve");
  ok(pant.includes("initialNumToRender"), "y se le limita cuanto construye al abrir");
  ok(pant.includes("removeClippedSubviews"), "y suelta lo que sale de pantalla");

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
  // vacio a la derecha. Ahora el ancho lo reparte la fila.
  ok(/flex-1 aspect-square/.test(pant), "el ancho de cada casilla lo reparte la fila");
  ok(!/w-12 h-12 rounded-2xl/.test(pant), "ya no tiene un ancho fijo que deje hueco al borde");
  // Y la ultima fila de cada grupo hay que rellenarla: si no, sus dibujos se
  // estiran para llenar el ancho y salen mas grandes que los de arriba. Ese es
  // el mismo "disparejo" por el otro lado.
  ok(/while \(trozo\.length < POR_FILA\) trozo\.push\(null\)/.test(pant), "las filas incompletas se rellenan");
  ok(pant.includes('key={"hueco"'), "y el relleno es espacio vacio, no un dibujo");

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
  ok(!pant.includes("InteractionManager"), "los dibujos no esperan a nada para salir");
  // Se busca el PROP, no la palabra: "dibujar" aparece en los comentarios que
  // explican por que ya no existe, y una prueba que se cae por su propia
  // explicacion invita a borrar la explicacion.
  ok(!/dibujar=\{|dibujar: boolean/.test(pant), "ni sale la casilla vacia primero y el dibujo despues");

  // Y aqui esta lo que de verdad costaba el segundo. windowSize se cuenta en
  // PANTALLAS: con 3, la lista levantaba la que se ve mas una arriba y otra
  // abajo, unos 175 dibujos donde caben 60. Es el numero mas facil de subir
  // "por si acaso" y el que mas cuesta, asi que se vigila con tope.
  const ventana = Number(/windowSize=\{(\d+)\}/.exec(pant)?.[1] ?? "999");
  ok(ventana <= 2, `windowSize es ${ventana}: no construye mas de una pantalla y algo`);

  // Y la primera pasada ocurre MIENTRAS la pantalla se abre: pedir de mas ahi
  // es justo lo que la hacia abrir a tirones.
  const primeros = Number(/initialNumToRender=\{(\d+)\}/.exec(pant)?.[1] ?? "999");
  ok(primeros <= 8, `initialNumToRender es ${primeros}: la primera pasada se mantiene corta`);

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
