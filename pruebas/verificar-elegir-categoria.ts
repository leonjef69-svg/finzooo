// UN SOLO BOTON "ELEGIR CATEGORIA"
//
// Pedido el 06/08/2026, con la pantalla en la mano: "quiero que solo quede un
// boton que diga Elegir categoria y todo lo que esta en azul desaparezca, que
// siga funcionando normal como esta hasta ahora". Lo azul era la cuadricula de
// doce casillas mas "Nueva", "Ver mas" y "Editar esta".
//
// LO QUE ESTA PRUEBA PROTEGE DE VERDAD
//
// No es que el boton exista: eso se ve de un golpe de vista al abrir la app. Es
// la segunda mitad de la frase, "que siga funcionando normal". Mover media
// pantalla de sitio es exactamente el caso en que se cae algo por el camino y no
// se nota hasta que alguien lo necesita: la puerta para crear una categoria, el
// enlace para editar la propia, o el canal por el que la elegida vuelve al
// movimiento. Cada una de esas tres se comprueba aqui EN SU NUEVO SITIO.
//
// Y se comprueba tambien que la cuadricula ya NO este en la pantalla de agregar:
// dejarla ahi por descuido daria dos formas de elegir categoria que pueden
// discrepar, que es el tipo de fallo que este proyecto ya ha pagado varias
// veces.
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
const eleg = fs.readFileSync(path.join(RAIZ, "screens/ElegirCategoria.tsx"), "utf8");
const ruta = fs.readFileSync(path.join(RAIZ, "app/elegir-categoria.tsx"), "utf8");
const layout = fs.readFileSync(path.join(RAIZ, "app/_layout.tsx"), "utf8");
const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");

console.log("\n--- EN NUEVO MOVIMIENTO SOLO QUEDA EL BOTON ---");
{
  ok(addLimpio.includes("addSheet.chooseCategory"), "hay un boton que dice Elegir categoria");
  ok(addLimpio.includes('pathname: "/elegir-categoria"'), "y abre la pantalla del selector");

  // Lo que tenia que desaparecer, una por una. Son las cuatro piezas que el
  // usuario marco en azul.
  ok(!/cats\s*\n?\s*\.filter\(/.test(addLimpio), "la cuadricula de casillas ya no esta");
  ok(!addLimpio.includes("showAllCats"), "ni el Ver mas que escondia la mitad");
  ok(!addLimpio.includes("nuevaCat.boton"), "ni el cuadrito Nueva");
  ok(!addLimpio.includes("nuevaCat.editarEsta"), "ni el enlace de editar");
  // Si quedara suelto, seria un boton muerto: la pantalla de crear ya no se
  // abre desde aqui.
  ok(!addLimpio.includes("/nueva-categoria"), "y no queda ningun camino viejo a crear");

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

console.log("\n--- Y NO SE PERDIO NADA: TODO ESTA EN EL SELECTOR ---");
{
  // Las MISMAS listas que usaba la pantalla de agregar. Con otra fuente
  // podrian discrepar, y ya paso en este proyecto con los grupos de iconos y
  // con los constructores de reportes.
  ok(eleg.includes("gastosDisponibles") && eleg.includes("ingresosDisponibles"), "estan las de gasto y las de ingreso");
  ok(eleg.includes("categoriasPropias"), "y las propias aparecen en cuanto se crean");

  ok(eleg.includes("nuevaCat.boton"), "esta la casilla para crear una nueva");
  ok(eleg.includes("nuevaCat.editarEsta"), "y el enlace para editar la propia elegida");
  ok(eleg.includes("esPropia(actual)"), "que solo sale con una propia, para no estorbar");

  // TODAS a la vista. El "Ver mas" existia porque no habia sitio; aqui sobra, y
  // con el se va el problema de que las propias vivieran escondidas detras.
  ok(!eleg.includes("showAllCats") && !eleg.includes("extra)"), "se ven todas, sin Ver mas");

  // El toque largo se descarto en este proyecto por invisible, y no se puede
  // colar de vuelta por la puerta de atras.
  ok(!eleg.includes("onLongPress"), "sin toque largo, que nadie descubre");
}

console.log("\n--- LA ELEGIDA VUELVE AL MOVIMIENTO ---");
{
  // Son dos pantallas distintas: no hay propiedad por la que devolver el dato.
  // Va por el contexto, el mismo canal por el que ya volvia una recien creada.
  ok(eleg.includes("elegirCategoriaEnMovimiento"), "el selector avisa cual se eligio");
  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(ctx.includes("elegirCategoriaEnMovimiento"), "el contexto lo lleva");
  ok(add.includes("categoriaRecienCreada"), "y la pantalla de agregar lo recoge");
  // Recogerlo sin soltarlo dejaria la categoria pegada: al cambiar de gasto a
  // ingreso volveria a ponerse la de antes.
  ok(add.includes("olvidarCategoriaRecienCreada()"), "y lo suelta despues, para que no se repita");

  // Elegir cierra la pantalla. Sin esto habria que tocar "atras" a mano, que es
  // pedir una confirmacion de algo que ya se decidio.
  ok(/elegirCategoriaEnMovimiento\(id\);\s*\r?\n\s*onBack\(\);/.test(eleg), "y al elegir se vuelve solo");
}

console.log("\n--- CREAR NO DEJA A MEDIO CAMINO ---");
{
  // Con push haria falta un "atras" de mas: la recien creada ya queda elegida,
  // asi que volver al selector solo obligaria a cerrarlo. Con replace, el
  // "atras" de la pantalla de crear deja directamente en el movimiento.
  //
  // Y se descarto encadenar dos router.back() seguidos: dos ordenes de
  // navegacion en el mismo instante es justo lo que funciona en la computadora
  // y falla a medias en el celular.
  ok(ruta.includes("router.replace"), "crear ocupa el lugar del selector, no se apila encima");
  ok(!ruta.includes("router.push"), "asi no hacen falta dos atras seguidos");
  ok((ruta.match(/router\.back\(\)/g) ?? []).length === 0, "y no se encadenan dos ordenes de navegacion");
}

console.log("\n--- LA PANTALLA ESTA DECLARADA Y SE VE COMO LA OTRA ---");
{
  const suya = /name="elegir-categoria"[\s\S]{0,300}?\/>/.exec(layout)?.[0] ?? "";
  ok(suya.length > 0, "la ruta esta declarada en el layout");
  // La misma animacion que "Nueva categoria", que se eligio con el usuario el
  // 05/08/2026 tras probar el fundido y quitarlo. Si una se deslizara y la otra
  // no, pasar de una a la otra se sentiria como dos apps distintas.
  ok(/animation: "slide_from_right"/.test(suya), "y entra deslizandose, igual que la de crear");
  ok(/backgroundColor: screenBg/.test(suya), "con el fondo del tema, para que no destelle blanco");
}

console.log("\n--- LOS TEXTOS, EN LOS TRES IDIOMAS ---");
{
  // Una clave que falta no revienta: el traductor devuelve la clave, y en
  // pantalla sale "elegirCat.title". Se descubre solo si alguien mira la app en
  // ese idioma.
  for (const clave of ["elegirCat.title", "addSheet.chooseCategory"]) {
    const veces = (i18n.match(new RegExp(`"${clave.replace(".", "\\.")}":`, "g")) ?? []).length;
    ok(veces === 3, `${clave} esta en los tres idiomas (${veces})`);
  }
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
