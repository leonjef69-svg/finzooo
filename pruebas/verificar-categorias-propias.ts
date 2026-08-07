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
import { setOverrides } from "@/utils/categoryCustom";
import { crear, borrar, editar, esPropia, nombreRepetido, setPropias, type CategoriaPropia } from "@/utils/categoriasPropias";

const RAIZ = process.cwd();

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

/**
 * El mismo archivo sin comentarios, para las comprobaciones de "esto NO debe
 * estar".
 *
 * Existe porque cuatro aserciones se cayeron por su propia explicacion: el
 * comentario que cuenta por que se quito algo contiene su nombre (Catalogo,
 * dibujar, removeClippedSubviews, allowsEditing). Una prueba que castiga
 * documentar el motivo acaba haciendo que se borre el motivo.
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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

console.log("\n--- SE LE PUEDE CAMBIAR EL DIBUJO A UNA DE FABRICA ---");
{
  // Desde el 07/08/2026 la pantalla de elegir categoria deja tocar "Comida",
  // cambiarle el dibujo y darle a Aplicar. Sin que catInfo lea ese campo, el
  // dibujo nuevo se veria en la vista previa y al guardar volveria el de antes:
  // la pantalla prometiendo algo que no puede cumplir.
  const deFabrica = catInfo("comida").icon;

  setOverrides({ comida: { icono: "Coffee" } });
  ok(catInfo("comida").icon !== deFabrica, "el dibujo puesto a mano manda sobre el de la app");
  // Y lo demas de esa categoria no se toca: cambiar el dibujo no puede cambiarle
  // el nombre ni el color de rebote.
  ok(catInfo("comida").label === "category.comida", "sin tocarle el nombre");

  // Sin dibujo puesto, vuelve el de la app. Es lo que hace que quitar el parche
  // devuelva la categoria original en vez de dejarla a medias.
  setOverrides({ comida: { color: "sky" } });
  ok(catInfo("comida").icon === deFabrica, "y sin ponerle ninguno, queda el de siempre");
  ok(catInfo("comida").color === "sky", "mientras el color si cambia");

  // Tambien vale para las propias: ahi el dibujo es suyo, pero el parche manda
  // igual — es lo que ya pasaba con el nombre y el color.
  const { lista, creada } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  setPropias(lista);
  const suyo = catInfo(creada.id).icon;
  setOverrides({ [creada.id]: { icono: "Coffee" } });
  ok(catInfo(creada.id).icon !== suyo, "en una propia el parche tambien manda");

  setOverrides({});
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

  const codigo = sinComentarios(pant);

  ok(pant.includes("memo(function Dibujito"), "cada dibujo esta memorizado");
  ok(pant.includes("memo(function Fila"), "y las filas");
  // Recibir la funcion de traducir bastaba para que memo no sirviera de nada:
  // cambia en cada dibujado del padre.
  ok(pant.includes("titulos[grupo.titulo]"), "los titulos llegan traducidos, no la funcion de traducir");

  // LOS DIBUJOS SE QUEDAN PUESTOS. ESTO NO ES UN DESCUIDO, ES EL PEDIDO.
  //
  // Hubo aqui una FlatList, que es lo recomendado para listas largas y aqui
  // estuvo mal. Arma y suelta segun lo que se ve, y por mas reserva que se le
  // diera —se probo windowSize 2, 3 y 5, tandas de 4 y de 8, quitar
  // removeClippedSubviews y darle las medidas con getItemLayout— un deslizon
  // fuerte le ganaba siempre y se veia la pantalla en blanco. Cuatro entregas.
  //
  // El usuario lo dijo tal cual: "los iconos ya deberian estar ahi fijos, no
  // deberian cargar recien cuando yo deslizo". Asi que se arman los 236 una vez
  // y no se sueltan. Si alguien vuelve a meter una lista virtual aqui creyendo
  // que optimiza, vuelve el fallo.
  ok(!codigo.includes("FlatList"), "el catalogo NO va en una lista que arma y suelta");
  ok(!codigo.includes("getItemLayout"), "ni hace falta adivinarle las medidas");
  ok(!codigo.includes("windowSize"), "ni hay reserva que un deslizon pueda agotar");
  ok(!codigo.includes("memo(function Catalogo"), "y tampoco vuelve el catalogo que los armaba todos de golpe");

  // Y NO SE CARGA POR PARTES. Hubo un escalonado que metia los grupos de a uno
  // tras abrir, y hacia falta mientras los dibujos eran vectores: armarlos todos
  // tardaba casi un segundo. Con la tipografia cada dibujo es una letra y no
  // hace falta repartir nada; el escalonado solo dejaria huecos que se ven si se
  // desliza en ese instante, que es lo que se estaba arreglando.
  ok(!codigo.includes("gruposArmados"), "no se cargan por partes: estan los 236 desde el principio");
  ok(!codigo.includes("altoDeLasFilas"), "ni hay huecos reservados que llenar despues");

  // 05/08/2026, con foto: "esta disparejo los iconos". Al pasar a filas de
  // cinco quedaron con ancho fijo, asi que no llegaban al borde y sobraba un
  // vacio a la derecha. Se comprueba con numeros mas abajo, en su seccion.
  //
  // Se mira SOLO dentro de la casilla del catalogo, y no el archivo entero: desde
  // el 06/08/2026 la misma pantalla lleva arriba la lista de categorias, y esas
  // casillas si son de tamaño fijo con toda la razon —son cuatro por fila con su
  // nombre debajo, no parte de la cuadricula de dibujos—. Mirando el archivo
  // completo, esta prueba se caia por algo que esta bien.
  const casilla = /const Dibujito = memo\([\s\S]*?\n\}\);/.exec(codigo)?.[0] ?? "";
  ok(casilla.length > 0, "la casilla del catalogo sigue siendo su propia pieza");
  ok(!/w-\d+ h-\d+/.test(casilla), "ninguna casilla del catalogo lleva ancho fijo");
  ok(/width: lado, height: lado/.test(casilla), "su lado sale del ancho de la pantalla");
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
  // Ojo con la diferencia: los grupos que entran de a uno NO son esto. Lo que se
  // ve al abrir esta completo desde el primer instante; lo que entra despues
  // esta fuera de pantalla. Aquello hacia esperar a lo que se estaba mirando.
  ok(!codigo.includes("InteractionManager"), "lo que se ve no espera a nada para salir");
  ok(!/\bdibujar\b/.test(codigo), "ni sale la casilla vacia primero y el dibujo despues");

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

console.log("\n--- SE PUEDE PONER UNA FOTO PROPIA, Y QUITARLA ---");
{
  // Pedido el 05/08/2026: "agregale una opcion un icono para tomar foto o una
  // imagen de galeria". El dato ya existia (CategoriaPropia.image, catInfo,
  // CategoryAvatar); lo que faltaba era la forma de elegirla.
  const FOTO = "data:image/jpeg;base64,xxxx";

  const { lista, creada } = crear([], {
    nombre: "Broster",
    tipo: "expense",
    color: "orange",
    icono: "Drumstick",
    image: FOTO,
  });
  setPropias(lista);
  ok(creada.image === FOTO, "se crea con la foto puesta");
  // Lo importante no es que la guarde: es que LLEGUE a las 38 pantallas que
  // dibujan una categoria, y todas pasan por catInfo.
  ok(catInfo(creada.id).image === FOTO, "y catInfo la reparte a toda la app");

  // Sin foto NO tiene que quedar la clave suelta. La copia de nube es un solo
  // documento con un tope de 1 MB, y un `image: undefined` viaja como campo.
  const sinFoto = crear([], { nombre: "Taxi", tipo: "expense", color: "sky", icono: "Car" }).creada;
  ok(!("image" in sinFoto), "sin foto no queda ni la clave vacia");

  // Quitarla. El null es lo que distingue "no la toques" de "borrala": sin el,
  // no habria forma de volver a un dibujo, porque la foto siempre manda.
  const quitada = editar(lista, creada.id, { image: null })[0];
  ok(!("image" in quitada), "el null la borra de verdad");
  const intacta = editar(lista, creada.id, { nombre: "Broster pollos" })[0];
  ok(intacta.image === FOTO, "y cambiar el nombre no se la lleva");

  // El icono sigue debajo: quien prueba una foto y no le gusta no pierde lo que
  // habia elegido antes.
  ok(quitada.icono === "Drumstick", "al quitar la foto vuelve a salir su dibujo");
  setPropias([]);
}

console.log("\n--- Y LA PANTALLA LA SABE PEDIR DE LAS DOS FORMAS ---");
{
  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");

  ok(/launchCameraAsync/.test(pant), "la camara");
  ok(/launchImageLibraryAsync/.test(pant), "y la galeria");
  // Cada una pide SU permiso. El de camara no sirve para la galeria ni al
  // contrario, y sin permiso la app se queda sin decir nada.
  ok(/requestCameraPermissionsAsync/.test(pant), "pidiendo permiso de camara");
  ok(/requestMediaLibraryPermissionsAsync/.test(pant), "y permiso de fotos");
  ok(pant.includes("catCustom.cameraPermission"), "y avisando si lo niegan (camara)");
  ok(pant.includes("settings.photoPermission"), "y si lo niegan (galeria)");

  // LAS DOS terminan en el recortador propio. El recorte que trae Android
  // cambia de un celular a otro y en algunos no deja cuadrado, asi que hay UNA
  // sola forma de encuadrar.
  const veces = [...pant.matchAll(/setRecortando\(r\.assets\[0\]\.uri\)/g)].length;
  ok(veces === 2, `camara y galeria terminan las dos en el recortador (${veces} de 2)`);
  ok(!/allowsEditing/.test(sinComentarios(pant)), "sin usar el recorte de Android");
  ok(/<ImageCropper/.test(pant), "y el recortador esta puesto");

  // La foto manda sobre el dibujo, igual que en el resto de la app. Si aqui se
  // viera al contrario, la categoria saldria de una forma al crearla y de otra
  // en Inicio — ya paso con los emojis.
  ok(/foto \? \(/.test(pant), "la vista previa ensena la foto si la hay");
  ok(/<Image source=\{\{ uri: foto \}\}/.test(pant), "dibujandola de verdad");
  ok(/overflow-hidden/.test(pant), "recortada a la forma del cuadrito");

  // Y tiene que haber forma de sacarla: elegir un icono no la quita, porque la
  // foto manda. Sin esto se entra en un callejon sin salida.
  ok(/setFoto\(undefined\)/.test(pant), "y se puede quitar");
  // Al guardar, la foto quitada viaja como null. Si viajara como undefined, la
  // de antes se quedaria puesta y "quitar" no haria nada.
  ok(/image: foto \?\? null/.test(pant), "y al guardar la quitada se borra de verdad");
}

console.log("\n--- LOS 173 NOMBRES DE LA TIPOGRAFIA EXISTEN DE VERDAD ---");
{
  // Los dibujos genericos pasaron de vectores (lucide) a tipografia
  // (MaterialCommunityIcons) el 05/08/2026, porque armar 236 vectores tarda
  // cerca de un segundo y ese segundo no se puede esconder — se intento cinco
  // veces. Una tipografia se pinta como una letra.
  //
  // El riesgo nuevo: un nombre mal escrito NO DA ERROR. La casilla sale vacia y
  // nadie se entera. Asi que se comparan con la lista real de la tipografia.
  const glifos = JSON.parse(
    fs.readFileSync(
      path.join(
        RAIZ,
        "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json"
      ),
      "utf8"
    )
  ) as Record<string, number>;
  ok(Object.keys(glifos).length > 1000, `la tipografia trae ${Object.keys(glifos).length} dibujos`);

  const { NOMBRES_EN_TIPOGRAFIA: nombres, TODOS_LOS_GRUPOS: grupos, iconoDe: resolver2 } =
    require("@/constants/iconos") as typeof import("@/constants/iconos");

  const inventados = Object.entries(nombres).filter(([, v]) => !(v in glifos));
  ok(
    inventados.length === 0,
    `los ${Object.keys(nombres).length} nombres existen en la tipografia${
      inventados.length ? " — no existen: " + inventados.map(([k, v]) => `${k}->${v}`).join(", ") : ""
    }`
  );

  // Y al reves: todo id que se pueda ELEGIR tiene que tener su nombre. Sin el,
  // esa casilla del catalogo sale con los puntos suspensivos de respaldo.
  const idsElegibles = grupos.flatMap((g) => g.iconos).filter((id) => !id.startsWith("marca:"));
  const sinNombre = idsElegibles.filter((id) => !nombres[id]);
  ok(
    sinNombre.length === 0,
    `los ${idsElegibles.length} dibujos del catalogo tienen nombre${sinNombre.length ? " — sin nombre: " + sinNombre.join(", ") : ""}`
  );

  // El respaldo tiene que existir, o iconoDe se cae justo cuando llega un id
  // desconocido: el unico caso para el que el respaldo existe.
  const respaldo = resolver2("esto-no-existe-en-ningun-sitio");
  ok(typeof respaldo === "function", "un id desconocido devuelve un dibujo, no un hueco");
  ok(respaldo === resolver2("Ellipsis"), "y es el de los puntos suspensivos");

  // Dos ids con el MISMO dibujo se ven identicos en la cuadricula y no hay forma
  // de saber cual se eligio. En el catalogo de elegir eso no puede pasar.
  const porGlifo = new Map<string, string[]>();
  for (const id of idsElegibles) {
    const n = nombres[id];
    porGlifo.set(n, [...(porGlifo.get(n) ?? []), id]);
  }
  const gemelos = [...porGlifo].filter(([, ids]) => ids.length > 1);
  ok(
    gemelos.length === 0,
    `ningun dibujo sale dos veces${gemelos.length ? " — repetidos: " + gemelos.map(([n, ids]) => `${n} (${ids.join("/")})`).join(", ") : ""}`
  );
}

console.log("\n--- LAS MEDIDAS DE LA CUADRICULA CUADRAN ---");
{
  // Estas cuentas son la parte fragil: de ellas sale el hueco que se reserva
  // para los grupos que todavia no estan armados. Si un hueco mide de menos, el
  // contenido crece bajo el dedo y la pantalla salta sola. Por eso se comprueban
  // con numeros y no leyendo el codigo.
  const {
    ALTO_FILA_DE: altoFilaDe,
    CATALOGO_EN_FILAS: catalogo,
    LADO_DE: ladoDe,
    MARGEN_LATERAL: margen,
    POR_FILA: porFila,
    SEPARACION: sep,
    altoDeLasFilas,
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
    ok(altoFilaDe(ancho) === lado + sep, `y la fila mide la casilla mas su hueco en ${ancho}`);
  }

  // 2. TODAS las filas tienen las mismas casillas. Una fila corta se reparte el
  //    ancho de otra forma y sus dibujos salen mas grandes: eso fue "disparejo".
  const filas = catalogo.flatMap((g) => g.filas);
  ok(filas.length > 0, "hay filas que comprobar");
  ok(
    filas.every((f) => f.length === porFila),
    `las ${filas.length} filas tienen ${porFila} casillas exactas`
  );

  // 3. Ni un dibujo perdido ni uno repetido al partir en filas. Es donde se
  //    pierde un icono sin que nadie lo note: el catalogo sigue "funcionando".
  const enGrupos = grupos.flatMap((g) => g.iconos);
  const enFilas = filas.flat().filter((x) => x !== null);
  ok(enFilas.length === enGrupos.length, `los ${enGrupos.length} dibujos estan todos, ni uno mas`);
  ok(new Set(enGrupos).size === enGrupos.length, "y ninguno esta repetido en el catalogo");
  ok(catalogo.length === grupos.length, "y estan los mismos grupos");
  ok(
    catalogo.every((g, i) => g.titulo === grupos[i].titulo),
    "en el mismo orden"
  );

  // 4. LA CAUSA RAIZ DE UN BUG DE DOS DIAS, encontrada por esta prueba el
  //    05/08/2026: dos grupos se llamaban "iconos.servicios" —el de luz, agua e
  //    internet, y el de Uber, Airbnb y Dropbox—. El titulo "Servicios" salia
  //    dos veces en la pantalla, y los dos grupos compartian clave. Existio
  //    desde que nacio el catalogo, sin que se notara.
  const titulos = grupos.map((g) => g.titulo);
  const titulosRepes = titulos.filter((tt, i) => titulos.indexOf(tt) !== i);
  ok(titulosRepes.length === 0, `ningun grupo repite nombre${titulosRepes.length ? " — " + titulosRepes.join(", ") : ""}`);

  // 5. Cada grupo tiene las filas justas para sus dibujos: ni una de sobra
  //    (dejaria una fila vacia) ni una de menos (perderia dibujos).
  const altoFila = altoFilaDe(412);
  let cuadran = true;
  for (const g of catalogo) {
    const suyos = g.filas.flat().filter((x) => x !== null).length;
    if (g.filas.length !== Math.ceil(suyos / porFila)) cuadran = false;
    if (altoDeLasFilas(g, altoFila) !== g.filas.length * altoFila) cuadran = false;
  }
  ok(cuadran, "cada grupo tiene las filas justas para sus dibujos");
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
  ok(add.includes("categoriaRecienCreada"), "y la deja elegida al volver");

  // La cuadricula salio de la pantalla de agregar el 06/08/2026 y se fue a la
  // MISMA pantalla del catalogo de dibujos: se elige una de las que hay, o se
  // baja y se crea. Se comprueba alli, no aqui, pero se sigue comprobando: sin
  // esa puerta no habria forma de crear una.
  const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");
  ok(pant.includes("gastosDisponibles"), "la pantalla de crear tambien lista las propias");
  ok(add.includes("/nueva-categoria"), "y se llega a ella desde el movimiento");

  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(ctx.includes("savePropias"), "el contexto las guarda en disco");
  ok(ctx.includes("loadPropias"), "y las lee al arrancar");
}

console.log("\n--- EDITAR Y BORRAR SE PUEDEN ALCANZAR ---");
{
  // Sin una puerta visible, quien cree una categoria con el icono equivocado
  // se queda con ella para siempre. Se descarto el toque largo: es invisible,
  // y quien no lo sepa no lo encuentra nunca.
  // Vive junto a la lista de categorias desde el 06/08/2026, que se mudo a la
  // pantalla del catalogo. Lo que se protege es lo mismo de siempre: que la
  // puerta EXISTA.
  const pant0 = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");
  ok(pant0.includes("esPropia(suya)"), "el enlace de editar solo sale con una propia elegida");
  ok(pant0.includes("nuevaCat.editarEsta"), "y dice cual se va a editar");
  const ruta = fs.readFileSync(path.join(RAIZ, "app/nueva-categoria.tsx"), "utf8");
  ok(/params: \{ tipo: suTipo, id: suId \}/.test(ruta), "pasandole su id");

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
