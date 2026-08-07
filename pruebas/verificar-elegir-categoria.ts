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

console.log("\n--- LA PANTALLA SE ABRE EN EL CATALOGO ---");
{
  // Es lo que el usuario pidio tres veces: "al darle click a elegir categoria
  // deberia mandarme a la 3 imagen no a la 2". Nada suelto encima del catalogo.
  ok(
    /useState<"tuyas" \| "icono" \| "favoritos" \| "color">\("icono"\)/.test(pantLimpia),
    "arranca en la pestaña del catalogo, no en la lista"
  );

  // La lista estuvo suelta arriba unas horas y ocupaba media pantalla antes del
  // catalogo. Que no vuelva: es el fallo que se reporto.
  ok(!pantLimpia.includes("elegirCat.oCrea"), "no queda la raya de o crea una nueva");
  ok(!pantLimpia.includes("stickyHeaderIndices"), "ni el bloque pegado que hizo falta con ella");
  ok(!pantLimpia.includes("scrollTo("), "ni el salto hasta el formulario");
}

console.log("\n--- Y ELEGIR UNA QUE YA EXISTE SIGUE ESTANDO, EN SU PESTAÑA ---");
{
  // Sin esto la app quedaria inservible: habria que crear una categoria nueva en
  // cada gasto, y los reportes acabarian repartidos entre veinte "Comida". Se le
  // advirtio dos veces antes de mover nada.
  ok(
    pantLimpia.includes("gastosDisponibles") && pantLimpia.includes("ingresosDisponibles"),
    "estan las de gasto y las de ingreso"
  );
  ok(pantLimpia.includes("categoriasPropias"), "y las propias aparecen en cuanto se crean");
  // TOCAR UNA LA MARCA, NO CIERRA LA PANTALLA.
  //
  // Antes volvía al movimiento en el acto, y con eso las pestañas de dibujo y
  // color no servían para nada sobre una categoría que ya existe: no había manera
  // de tenerla elegida y retocarla. El usuario lo pidió al revés el 07/08/2026:
  // "debería yo seleccionar el icono y recién cuando le doy aplicar mandarme
  // [al movimiento], aparte podría cambiarle el color".
  ok(/onPress=\{\(\) => elegirDeLaLista\(c\.id\)\}/.test(pantLimpia), "tocar una la marca");

  // Y EL NOMBRE SE TRADUCE AL CARGARLO.
  //
  // El "label" de una categoria de fabrica es una CLAVE ("category.mascotas"), no el
  // nombre: quien la enseña hace t(label). Se metia tal cual, asi que al tocar
  // "Mascotas" la vista previa y la casilla del nombre decian "category.mascotas".
  // Lo vio el usuario en el celular el 07/08/2026.
  ok(/const suNombre = t\(info\.label\)/.test(pantLimpia), "el nombre se traduce al cargarlo");
  // Y "como era" guarda el YA TRADUCIDO, el mismo que se ve. Guardando la clave, dar
  // a Aplicar sin tocar nada escribiria "Mascotas" como nombre propio de esa
  // categoria, y dejaria de traducirse al cambiar el idioma — por no hacer nada.
  ok(/nombre: suNombre,/.test(pantLimpia), "y se compara contra el mismo que se ve");
  ok(!/setNombre\(info\.label\)/.test(pantLimpia), "nunca la clave cruda");
  ok(
    !/onPress=\{\(\) => onElegir\?\.\(/.test(pantLimpia),
    "y NO cierra la pantalla de golpe, que era el fallo"
  );
  // La vuelta al movimiento pasa por Aplicar, y por ningún otro sitio.
  ok(
    /function aplicarALaElegida\([\s\S]{0,2000}?onElegir\?\.\(id\);/.test(pantLimpia),
    "solo Aplicar la deja puesta y vuelve"
  );
  ok(/if \(elegida\) \{\s*\r?\n\s*aplicarALaElegida\(elegida\);/.test(pantLimpia), "y Aplicar la reconoce");

  // LO QUE SE LE HAYA CAMBIADO SE GUARDA, pero SOLO lo que cambió. Escribiendo el
  // nombre siempre, "Comida" quedaría fijado en español y esa categoría dejaría de
  // traducirse al cambiar el idioma: un daño que nadie relaciona con haber tocado
  // un color meses antes.
  ok(/limpio !== antes\.nombre \? limpio : undefined/.test(pantLimpia), "solo se guarda lo que cambió");
  ok(/color !== antes\.color/.test(pantLimpia), "el color");
  ok(/icono !== antes\.icono/.test(pantLimpia), "y el dibujo");
  // Las de fábrica por la personalización; las propias en su propio sitio.
  ok(/updateCategoryOverrides\(/.test(pantLimpia), "las de fábrica se cambian con un parche encima");
  ok(/esPropia\(id\)[\s\S]{0,120}?editarCategoria\(id,/.test(pantLimpia), "y las propias en su sitio");
  ok(/\["tuyas", "icono", "favoritos", "color"\]/.test(pantLimpia), "la pestaña va primera");
  ok(pantLimpia.includes("elegirCat.tuyas"), "y se llama Tus categorias, como lo pidio");

  // La pestaña NO sale al editar: quien viene a cambiarle el nombre a "Broster"
  // no viene a elegir otra, y una lista ahi solo confunde.
  ok(
    /const eligiendo = !!onElegir && !editando/.test(pantLimpia),
    "no aparece cuando se viene a editar una"
  );
  ok(
    /eligiendo\s*\r?\n?\s*\? \(\["tuyas"/.test(pantLimpia),
    "y es esa misma condicion la que decide si la pestaña esta"
  );

  // BORRARLA, desde la lista. Estaba dentro de "Editar «X»" y el usuario la
  // reporto como imposible: "no me deja eliminar los iconos, en tus categorias se
  // quedan" (07/08/2026). Era la segunda cosa escondida detras de ese enlace, asi
  // que el enlace se fue y sus dos funciones estan aqui, a la vista.
  ok(pantLimpia.includes("nuevaCat.borrarLa"), "esta el boton de borrar la marcada");
  ok(!pantLimpia.includes("nuevaCat.editarEsta"), "y ya no hace falta pasar por Editar");

  // QUITARLE LA FOTO, desde aqui.
  //
  // Se podia desde el principio —la casilla de la foto con su ✕ esta en la pestaña
  // del catalogo— pero ahi no la encuentra nadie que venga de esta lista: hay que
  // saber que la foto de una categoria se quita desde donde se eligen los dibujos.
  // Pedido el 07/08/2026.
  ok(pantLimpia.includes("nuevaCat.quitarFotoDe"), "y el de quitarle la foto");
  ok(
    /elegirDeLaLista\(suya\);\s*\r?\n\s*setFoto\(undefined\);/.test(pantLimpia),
    "que la deja marcada y sin foto, para guardarla con Aplicar"
  );
  // Solo sale si de verdad tiene foto: un enlace que no hace nada es peor que no
  // tenerlo, porque se toca y no se entiende por que no pasa nada.
  ok(/info\.image \? \(/.test(pantLimpia), "solo cuando esa categoria tiene foto");

  // Todas a la vista. El "Ver mas" existia porque no habia sitio; aqui sobra.
  ok(!pantLimpia.includes("showAllCats"), "se ven todas, sin Ver mas");
  // El toque largo se descarto en este proyecto por invisible.
  ok(!pantLimpia.includes("onLongPress"), "sin toque largo, que nadie descubre");
}

console.log("\n--- LA VISTA PREVIA SIGUE VIENDOSE AL ELEGIR DIBUJO Y COLOR ---");
{
  // Decision de cuando se creo la pantalla: sin verla, se elige a ciegas y se
  // descubre al guardar que no pegaban. Se consigue teniendola FUERA de la parte
  // deslizable — que es tambien la razon por la que la lista de categorias no
  // podia ir suelta encima: la empujaba dentro.
  //
  // Si esto se cae, se cae en silencio: la pantalla seguiria funcionando.
  const deslizable = pant.indexOf("<ScrollView");
  ok(deslizable > 0, "hay una parte deslizable");
  ok(
    pant.indexOf("nuevaCat.sinNombre") < deslizable,
    "la vista previa queda FUERA de ella, arriba"
  );
  ok(
    pant.indexOf("nuevaCat.nombrePlaceholder") < deslizable,
    "y el nombre tambien, para escribirlo sin perderlo de vista"
  );
  ok(pant.indexOf("nuevaCat.tabIcono") < deslizable, "y las pestañas, para cambiar sin subir");
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
  for (const clave of ["elegirCat.title", "elegirCat.tuyas", "addSheet.chooseCategory"]) {
    const veces = (i18n.match(new RegExp(`"${clave.replace(".", "\\.")}":`, "g")) ?? []).length;
    ok(veces === 3, `${clave} esta en los tres idiomas (${veces})`);
  }
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
