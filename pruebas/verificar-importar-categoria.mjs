// LA CATEGORIA DEL ARCHIVO SE TIRABA (12/08/2026)
//
// Lo vio el con su propio Excel: la fila decia "Transporte" y el movimiento entro como "Otros".
//
// El comentario que habia en ImportSheet decia "si el archivo ya trae una categoria reconocible
// la respetamos" — y la linea de debajo adivinaba SIEMPRE por la descripcion. La columna se
// leia, se guardaba en categoryRaw y ahi se quedaba. matchCategory existia y no la llamaba
// nadie: estaba escrita, probada por nadie y muerta.
//
// Un comentario que dice lo contrario del codigo es peor que no tener comentario: hace que
// quien lo lee de por hecho que ya esta resuelto y no mire.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
const sinComentarios = (f) =>
  leer(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- LA COLUMNA DEL ARCHIVO SE USA ---");
{
  const importar = sinComentarios("screens/ImportSheet.tsx");
  ok(/matchCategory\(raw\.categoryRaw/.test(importar), "se lee la categoria que trae el archivo");
  // Y MANDA SOBRE LA ADIVINANZA. El orden importa: lo que escribio una persona primero, lo que
  // supone la app despues.
  ok(/generica\s*\?[\s\S]{0,160}suggestCategory/.test(importar), "y solo se adivina cuando el archivo no dice nada util");
}

console.log("\n--- LOS NOMBRES QUE LA GENTE ESCRIBE DE VERDAD ---");
{
  // Solo se reconocian los nombres EXACTOS de Fino. Pero nadie escribe "comida" en su hoja de
  // calculo: escribe "alimentacion", que es lo que traia su Excel.
  const motor = leer("utils/importEngine.ts");
  for (const [escrito, esperado] of [
    ["alimentacion", "comida"],
    ["movilidad", "transporte"],
    ["trabajo", "salario"],
    ["farmacia", "salud"],
  ]) {
    ok(new RegExp(`${escrito}: "${esperado}"`).test(motor), `"${escrito}" cuenta como ${esperado}`);
  }

  // Y UN SINONIMO NO PUEDE SALTAR DE TIPO. "venta" es categoria de ingreso: un gasto que dijera
  // "venta" acabaria en una categoria de ingreso, y eso descuadra los totales sin que se vea.
  ok(
    /cats\.some\(\(c\) => c\.id === porSinonimo\)/.test(motor),
    "un sinonimo solo vale si es del tipo que toca (gasto o ingreso)"
  );
}

console.log("\n--- Y BORRAR TODO EL MES PIDE CONFIRMACION (12/08/2026) ---");
{
  // Pedido suyo despues de importar dos veces el mismo archivo y quedarse con dieciseis
  // movimientos: quitarlos de uno en uno era el unico camino.
  const home = sinComentarios("screens/Home.tsx");
  ok(/function borrarTodoElMes/.test(home), "se puede borrar todo el mes");
  ok(/setConfirmandoBorrarTodo\(true\)/.test(home), "y no borra al primer toque: abre un cartel");

  // EL CARTEL TIENE QUE DECIR CUANTOS Y DE QUE MES. Esto no se puede deshacer, y "¿borrar
  // todo?" a secas no da para decidir nada — sobre todo no deja ver si uno esta en el mes que
  // cree, que es justo el error que se paga caro aqui.
  const i18n = leer("constants/i18n.ts");
  ok(/deleteAllTitle[^\n]*\{count\}/.test(i18n), "el cartel dice cuantos son");
  ok(/deleteAllTitle[^\n]*\{month\}/.test(i18n), "y de que mes");
  ok(/no se puede deshacer/.test(i18n), "y avisa de que no se puede deshacer");
  for (const clave of ["home.deleteAll", "home.deleteAllTitle", "home.deleteAllMessage"]) {
    const veces = (i18n.match(new RegExp('"' + clave.replace(".", "\.") + '":', "g")) ?? []).length;
    ok(veces === 3, clave + " esta en los tres idiomas (" + veces + ")");
  }

  // SOLO EL MES QUE SE ESTA VIENDO. Borrar meses que no se ven seria otra cosa y mucho mas
  // grave: nadie puede confirmar lo que no tiene delante.
  ok(/onBulkDelete\(monthTx\.map/.test(home), "solo borra los del mes que se esta viendo");
}
console.log(fallos === 0 ? "\nTodo bien: lo tuyo no se tira, y borrar todo avisa" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);
