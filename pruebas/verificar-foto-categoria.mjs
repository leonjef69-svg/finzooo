// LA FOTO DE UNA CATEGORIA TIENE QUE VERSE EN TODA LA APP
//
// Reportado el 03/08/2026 comparando dos capturas: al elegir categoria salia
// la foto que el usuario le habia puesto a "Comida", y en la lista de
// movimientos salia el tenedor generico.
//
// La causa: la app dibuja las categorias de DOS maneras y solo una miraba la
// foto.
//
//   CategoryAvatar → foto, o emoji.   Se usa al agregar, en el microfono,
//                                     en el escaner y en personalizar.
//   IconBadge      → icono de lineas. Se usa en Inicio, Historial, Detalle
//                                     y Presupuesto por categoria.
//
// O sea: se personalizaba la categoria y media app lo ignoraba. Cada pantalla
// por separado se veia bien; el fallo solo aparece comparando dos.
//
// Se decidio que IconBadge use la foto cuando la haya y siga con el icono de
// lineas cuando no. El emoji NO entra aqui a proposito: en una lista larga
// los iconos de lineas se leen mejor. Lo roto era la foto, no el estilo.
import fs from "fs";
import path from "path";

const RAIZ = "C:/Users/User/Videos/Fino control de gastos diarios/PresupuestoApp";

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const badge = fs.readFileSync(path.join(RAIZ, "components/IconBadge.tsx"), "utf8");

console.log("\n--- EL CUADRITO SABE ENSEÑAR UNA FOTO ---");
{
  ok(/image\?: string/.test(badge), "acepta la foto de la categoria");
  ok(/<Image source=\{\{ uri: image \}\}/.test(badge), "y la dibuja");
  ok(/image \? \(/.test(badge), "solo si la hay");
  ok(/<Icon size=/.test(badge), "y si no, sigue el icono de lineas de siempre");

  // Sin esto la foto se sale de las esquinas redondeadas y se ve un cuadrado
  // encima de un cuadrito redondeado.
  ok(/overflow-hidden/.test(badge), "la foto se recorta a la forma del cuadrito");
}

console.log("\n--- Y TODAS LAS PANTALLAS SE LA PASAN ---");
{
  // Aqui esta la gracia: el fallo no era que IconBadge no supiera, era que
  // NADIE le pasaba la foto. Arreglar el componente y olvidar una pantalla
  // deja el mismo fallo en esa pantalla, y se descubre por casualidad.
  const pantallas = [
    ["screens/Home.tsx", "Inicio"],
    ["screens/History.tsx", "Historial"],
    ["screens/Detail.tsx", "Detalle"],
    ["screens/CategoryBudgets.tsx", "Presupuesto por categoria"],
  ];
  for (const [archivo, nombre] of pantallas) {
    const t = fs.readFileSync(path.join(RAIZ, archivo), "utf8");
    const usos = [...t.matchAll(/<IconBadge[^/]*\/>/g)].map((m) => m[0]);
    ok(usos.length > 0, `${nombre}: usa el cuadrito`);
    ok(
      usos.every((u) => u.includes("image=")),
      `${nombre}: le pasa la foto en TODOS sus usos (${usos.length})`
    );
  }
}

console.log("\n--- NO SE TOCO LO QUE YA FUNCIONABA ---");
{
  // CategoryAvatar ya enseñaba foto o emoji. Si alguien "unifica" los dos
  // componentes sin querer, las pantallas de elegir categoria perderian el
  // emoji y se llenarian de iconos grises.
  const avatar = fs.readFileSync(path.join(RAIZ, "components/CategoryAvatar.tsx"), "utf8");
  ok(/c\.emoji/.test(avatar), "al elegir categoria se sigue viendo el emoji");
  ok(/c\.image/.test(avatar), "y la foto cuando la hay");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
