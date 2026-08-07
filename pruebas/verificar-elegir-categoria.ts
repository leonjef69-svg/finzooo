// UN SOLO BOTON "ELEGIR CATEGORIA", Y UNA SOLA PANTALLA DETRAS
//
// Pedido el 06/08/2026, con la pantalla en la mano: "quiero que solo quede un
// boton que diga Elegir categoria y todo lo que esta en azul desaparezca, que
// siga funcionando normal como esta hasta ahora". Lo azul era la cuadricula de
// doce casillas mas "Nueva", "Ver mas" y "Editar X".
//
// La primera version puso la cuadricula en una pantalla propia y el catalogo de
// dibujos en otra. El usuario lo señalo con las tres capturas: "al darle click a
// elegir categoria deberia mandarme a la 3 imagen no a la 2" — queria el
// catalogo, y la lista de por medio era un paso que no habia pedido.
//
// Borrar la lista NO era una opcion: es lo que se usa en cada gasto, y sin ella
// habria que crear una categoria nueva cada vez. Se le explico y eligio
// juntarlas. Asi que ahora hay UNA pantalla que se recorre de arriba abajo:
// las categorias que ya existen, la vista previa con el nombre, y el catalogo.
//
// LO QUE ESTA PRUEBA PROTEGE
//
// Tres cosas, y ninguna se ve leyendo el codigo de un archivo solo:
//
//  1. Que la pantalla de en medio NO vuelva. Es el fallo que el usuario
//     reporto, y volveria sin que nadie se diera cuenta si alguien decide
//     "separar responsabilidades".
//  2. Que las tres puertas que se mudaron —elegir, crear, editar— sigan
//     existiendo en su nuevo sitio.
//  3. Que la vista previa siga viendose MIENTRAS se elige dibujo y color. Esa
//     era una decision tomada y documentada, y al meter la lista encima se
//     habria perdido en silencio si no fuera por el bloque pegajoso.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

/**
 * El archivo sin comentarios, para las comprobaciones de "esto NO debe estar".
 *
 * Mismo motivo que en verificar-categorias-propias: el comentario que explica
 * POR QUE se quito algo contiene su nombre, y una prueba que se cae por su
 * propia explicacion acaba haciendo que se borre la explicacion.
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const add = fs.readFileSync(path.join(RAIZ, "screens/AddSheet.tsx"), "utf8");
const addLimpio = sinComentarios(add);
const pant = fs.readFileSync(path.join(RAIZ, "screens/NuevaCategoria.tsx"), "utf8");
const pantLimpia = sinComentarios(pant);
const ruta = fs.readFileSync(path.join(RAIZ, "app/nueva-categoria.tsx"), "utf8");
const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");

console.log("\n--- EN NUEVO MOVIMIENTO SOLO QUEDA EL BOTON ---");
{
  ok(addLimpio.includes("addSheet.chooseCategory"), "hay un boton que dice Elegir categoria");
  ok(
    /pathname: "\/nueva-categoria",\s*\r?\n?\s*params: \{ tipo: type, actual: category \}/.test(addLimpio),
    "y abre la pantalla pasandole la categoria que lleva puesta"
  );

  // Lo que tenia que desaparecer, una por una. Son las cuatro piezas que el
  // usuario marco en azul.
  ok(!/cats\s*\n?\s*\.filter\(/.test(addLimpio), "la cuadricula de casillas ya no esta");
  ok(!addLimpio.includes("showAllCats"), "ni el Ver mas que escondia la mitad");
  ok(!addLimpio.includes("nuevaCat.boton"), "ni el cuadrito Nueva");
  ok(!addLimpio.includes("nuevaCat.editarEsta"), "ni el enlace de editar");

  // El boton dice QUE categoria lleva el movimiento. Sin eso habria que abrirlo
  // para saberlo, y elegir pasaria de un toque a tres solo para mirar.
  ok(
    /cats\.find\(\(c\) => c\.id === category\)/.test(addLimpio),
    "el boton enseña la categoria que esta puesta ahora"
  );
  ok(/CategoryAvatar id=\{category\}/.test(addLimpio), "con su dibujo, igual que en el resto de la app");

  // "Ver mas" y "Ver menos" se quedaron sin dueño al irse la cuadricula. Un
  // texto guardado que nadie usa es lo que hace que dentro de un año nadie sepa
  // si se puede tocar.
  ok(!i18n.includes("addSheet.seeMore"), "y los textos del Ver mas se fueron con el");
  ok(!i18n.includes("addSheet.seeLess"), "los dos, no solo uno");
}

console.log("\n--- Y DETRAS HAY UNA SOLA PANTALLA, NO DOS ---");
{
  // ESTE es el fallo que el usuario reporto. Con una pantalla de por medio,
  // llegar al catalogo eran dos pasos y el primero no lo habia pedido nadie.
  ok(
    !fs.existsSync(path.join(RAIZ, "app/elegir-categoria.tsx")),
    "no hay una ruta aparte para elegir"
  );
  ok(
    !fs.existsSync(path.join(RAIZ, "screens/ElegirCategoria.tsx")),
    "ni una pantalla aparte que la dibuje"
  );
  const layout = sinComentarios(fs.readFileSync(path.join(RAIZ, "app/_layout.tsx"), "utf8"));
  ok(!layout.includes("elegir-categoria"), "ni queda declarada en el layout");

  // La pantalla no navega a ningun sitio por su cuenta: si "Nueva" volviera a
  // abrir otra pantalla, volveria el paso de mas por la puerta de atras.
  ok(!pantLimpia.includes("router."), "y la pantalla misma no abre ninguna otra");

  // Una sola parte deslizable. Dos anidadas es la forma clasica de dejar el
  // catalogo sin poder desplazarse, o desplazandose a saltos.
  //
  // El espacio tras el nombre no sobra: sin el, tambien contaba el ScrollView del
  // useRef —que no dibuja nada, solo dice de que tipo es la caja— y la cuenta
  // salia en dos con una sola parte deslizable de verdad.
  const cuantas = (pant.match(/<ScrollView\s/g) ?? []).length;
  ok(cuantas === 1, `una sola parte deslizable en toda la pantalla (hay ${cuantas})`);
}

console.log("\n--- ARRIBA SE ELIGE UNA DE LAS QUE YA HAY ---");
{
  ok(
    pantLimpia.includes("gastosDisponibles") && pantLimpia.includes("ingresosDisponibles"),
    "estan las de gasto y las de ingreso"
  );
  ok(pantLimpia.includes("categoriasPropias"), "y las propias aparecen en cuanto se crean");
  ok(/onPress=\{\(\) => onElegir\?\.\(c\.id\)\}/.test(pantLimpia), "tocar una la elige");
  ok(pantLimpia.includes("elegirCat.tuyas"), "con un titulo que dice que son las tuyas");

  // La lista NO sale al editar: quien viene a cambiarle el nombre a "Broster" no
  // viene a elegir otra, y una lista ahi solo confunde.
  ok(
    /const eligiendo = !!onElegir && !editando/.test(pantLimpia),
    "y no aparece cuando se viene a editar una"
  );

  // "Nueva" BAJA hasta el formulario, no abre nada. Es el mismo gesto de antes
  // en el mismo sitio, sin cambiar de pantalla.
  ok(
    /scrollRef\.current\?\.scrollTo\(\{ y: yDelFormulario/.test(pantLimpia),
    "y Nueva baja hasta el catalogo en la misma pantalla"
  );
  ok(pantLimpia.includes("nuevaCat.boton"), "sigue estando la casilla de Nueva");
  ok(pantLimpia.includes("nuevaCat.editarEsta"), "y el enlace para editar la propia puesta");

  // Todas a la vista. El "Ver mas" existia porque no habia sitio; aqui sobra.
  ok(!pantLimpia.includes("showAllCats"), "se ven todas, sin Ver mas");
  // El toque largo se descarto en este proyecto por invisible.
  ok(!pantLimpia.includes("onLongPress"), "sin toque largo, que nadie descubre");
}

console.log("\n--- LA VISTA PREVIA SE QUEDA PEGADA ARRIBA ---");
{
  // La decision es de cuando se creo la pantalla: elegir dibujo y color sin ver
  // el resultado obliga a guardar para descubrir que no pegaban. Antes se
  // conseguia teniendola FUERA de la parte deslizable; con la lista encima, se
  // consigue pegandola. Si esto se cae, se cae en silencio: la pantalla sigue
  // funcionando, solo que se decide a ciegas.
  ok(pantLimpia.includes("stickyHeaderIndices={[1]}"), "el bloque de la vista previa se pega arriba");

  // Y es el hijo 1 SIEMPRE. El de arriba se dibuja aunque este vacio justo para
  // que este numero no baile segun el caso — con un numero equivocado se pegaria
  // el bloque que no toca, que es peor que no pegar ninguno.
  ok(
    /stickyHeaderIndices=\{\[1\]\}[\s\S]{0,400}?\{eligiendo && \(/.test(pantLimpia),
    "y antes va un hijo que existe siempre, para que el numero no cambie"
  );

  // Sin fondo propio, el catalogo se veria pasar por debajo de la vista previa.
  // Se comprueba por el nombre y no por las clases: "bg-white dark:bg-slate-900"
  // esta tambien en la pantalla entera, asi que buscar el texto no distinguiria
  // si el bloque pegado se quedo sin el.
  ok(/const FONDO_PEGAJOSO = /.test(pant), "el fondo del bloque pegado tiene nombre propio");
  ok(pantLimpia.includes("className={FONDO_PEGAJOSO}"), "y el bloque lo lleva puesto");

  // Y se mide dónde acaba la lista, NO dónde empieza el bloque pegado: a un
  // bloque pegado lo envuelve React en una caja propia, asi que su "y" sale 0 y
  // la casilla "Nueva" subiria al principio en vez de bajar al catalogo.
  ok(
    /layout\.y \+ e\.nativeEvent\.layout\.height/.test(pantLimpia),
    "y se mide donde ACABA la lista, que es donde empieza lo de crear"
  );
}

console.log("\n--- LA ELEGIDA VUELVE AL MOVIMIENTO ---");
{
  // Son dos pantallas distintas: no hay propiedad por la que devolver el dato.
  // Va por el contexto, el mismo canal por el que ya volvia una recien creada.
  ok(ruta.includes("elegirCategoriaEnMovimiento"), "la ruta avisa cual se eligio");
  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(ctx.includes("elegirCategoriaEnMovimiento"), "el contexto lo lleva");
  ok(add.includes("categoriaRecienCreada"), "y la pantalla de agregar lo recoge");
  // Recogerlo sin soltarlo dejaria la categoria pegada: al cambiar de gasto a
  // ingreso volveria a ponerse la de antes.
  ok(add.includes("olvidarCategoriaRecienCreada()"), "y lo suelta despues, para que no se repita");

  // Sin "actual" no hay lista, asi que no se ofrece elegir. Es lo que separa
  // "vengo a poner la categoria de este gasto" de "vengo a crear una".
  ok(/actual\s*\r?\n?\s*\? \(elegida\) =>/.test(ruta), "solo se puede elegir si se vino a eso");

  // Editar REEMPLAZA la pantalla en vez de apilarse: al guardar, el atras deja
  // en el movimiento. Y se descarto encadenar dos router.back() seguidos — dos
  // ordenes de navegacion en el mismo instante es lo que funciona en la
  // computadora y falla a medias en el celular.
  ok(/onEditar=\{[\s\S]{0,200}?router\.replace/.test(ruta), "editar reemplaza, no se apila encima");
  // Hay dos router.back() y los dos estan bien: uno cierra al crear y otro al
  // elegir. Lo que no puede haber es dos SEGUIDOS, que es la forma de cerrar dos
  // pantallas de una y lo que fallaria a medias en el celular.
  ok(
    !/router\.back\(\);\s*\r?\n?\s*router\.back\(\)/.test(ruta),
    "y no se encadenan dos atras seguidos"
  );
}

console.log("\n--- LOS TEXTOS, EN LOS TRES IDIOMAS ---");
{
  // Una clave que falta no revienta: el traductor devuelve la clave, y en
  // pantalla sale "elegirCat.tuyas". Se descubre solo si alguien mira la app en
  // ese idioma.
  for (const clave of ["elegirCat.title", "elegirCat.tuyas", "elegirCat.oCrea", "addSheet.chooseCategory"]) {
    const veces = (i18n.match(new RegExp(`"${clave.replace(".", "\\.")}":`, "g")) ?? []).length;
    ok(veces === 3, `${clave} esta en los tres idiomas (${veces})`);
  }
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
