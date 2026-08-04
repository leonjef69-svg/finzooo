// AUDITORIA DE LO QUE SE TOCA: pantallas, botones, iconos y textos.
//
// Los otros auditores miran el codigo y los textos. Este mira la INTERFAZ:
// botones que no hacen nada, pantallas a las que no se llega, textos escritos
// que ya nadie usa, e iconos puestos dos veces para lo mismo.
//
// Nada de esto rompe la app. Por eso no lo caza nada mas: son cosas que se
// quedan ahi, se acumulan, y un dia alguien toca un boton que no responde.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const problemas = [];
const fallo = (donde, que) => problemas.push(`${donde}: ${que}`);

function archivos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivos(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const rel = (f) => path.relative(RAIZ, f).replace(/\\/g, "/");
const CODIGO = ["app", "screens", "components", "contexts"].flatMap((c) =>
  archivos(path.join(RAIZ, c))
);
const TODO_EL_CODIGO = CODIGO.map((f) => fs.readFileSync(f, "utf8")).join("\n");

// ---------------------------------------------------------------------------
console.log("\n--- BOTONES QUE NO HACEN NADA ---");
{
  let n = 0;
  for (const f of CODIGO) {
    fs.readFileSync(f, "utf8")
      .split("\n")
      .forEach((l, i) => {
        // onPress={() => {}} y variantes: un boton que se puede tocar y no
        // responde. Peor que no tenerlo, porque se toca y se cree que fallo.
        if (/onPress=\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(l) || /onPress=\{undefined\}/.test(l)) {
          fallo(`${rel(f)}:${i + 1}`, "boton sin nada detras");
          n++;
        }
      });
  }
  console.log(`  ${n} encontrados`);
}

// ---------------------------------------------------------------------------
console.log("\n--- PANTALLAS A LAS QUE NO SE LLEGA ---");
{
  const pantallas = archivos(path.join(RAIZ, "screens")).map((f) => path.basename(f, ".tsx"));
  let n = 0;
  for (const p of pantallas) {
    // Se busca su import en cualquier parte. Una pantalla que nadie importa
    // es codigo que se mantiene, se traduce y se audita para nada.
    const usada = new RegExp(`screens/${p}["'\\s]`).test(TODO_EL_CODIGO);
    if (!usada) {
      fallo("screens", `${p}.tsx no lo importa nadie`);
      n++;
    }
  }
  console.log(`  ${pantallas.length} pantallas, ${n} sin usar`);
}

// ---------------------------------------------------------------------------
console.log("\n--- RUTAS A LAS QUE NO NAVEGA NADIE ---");
{
  const rutas = archivos(path.join(RAIZ, "app"))
    .map((f) => rel(f))
    .filter((f) => !f.includes("_layout"))
    .map((f) =>
      "/" +
      f
        .replace(/^app\//, "")
        .replace(/\.tsx$/, "")
        .replace(/\/index$/, "")
        .replace(/\(tabs\)\//, "")
    );
  // Las pestañas de abajo no se navegan con codigo: las abre la barra. Y la
  // raiz tampoco. Marcarlas seria avisar de lo que esta bien, y un auditor
  // que avisa de lo correcto acaba ignorandose entero.
  const PESTANAS = ["/", "/index", "/history", "/reports", "/settings"];

  let n = 0;
  for (const r of rutas) {
    if (PESTANAS.includes(r) || r.includes("[")) continue;
    // Se busca la ruta en cualquier forma: entre comillas, o dentro de un
    // texto armado con `/savings/move?id=...`. Buscando solo la cadena exacta
    // se daban por huerfanas rutas que si se usan, con parametros detras.
    const usada =
      TODO_EL_CODIGO.includes(`"${r}"`) ||
      TODO_EL_CODIGO.includes(`'${r}'`) ||
      TODO_EL_CODIGO.includes(`\`${r}`) ||
      TODO_EL_CODIGO.includes(`"${r}?`) ||
      TODO_EL_CODIGO.includes(`${r}?`);
    if (!usada) {
      fallo("rutas", `${r} existe pero nadie navega a ella`);
      n++;
    }
  }
  console.log(`  ${rutas.length} rutas, ${n} sin destino`);
}

// ---------------------------------------------------------------------------
console.log("\n--- TEXTOS ESCRITOS QUE YA NO USA NADIE ---");
{
  const i18n = fs.readFileSync(path.join(RAIZ, "constants/i18n.ts"), "utf8");
  const bloque = i18n.slice(i18n.indexOf("  es: {"), i18n.indexOf("  en: {"));
  const claves = [...bloque.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);

  const fuera = archivos(path.join(RAIZ, "utils"))
    .concat(archivos(path.join(RAIZ, "constants")))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  const todo = TODO_EL_CODIGO + fuera;

  const sinUsar = claves.filter((k) => {
    if (todo.includes(`"${k}"`)) return false;
    // Muchas se arman a trozos: "category." + id, "premium.perk" + algo.
    const raiz = k.split(".")[0];
    const sufijo = k.split(".").slice(1).join(".");
    if (new RegExp(`["'\`]${raiz}\\.["'\`+]`).test(todo)) return false;
    if (sufijo && todo.includes(`"${sufijo}"`)) return false;
    return true;
  });

  console.log(`  ${claves.length} textos, ${sinUsar.length} sin usar`);
  for (const k of sinUsar.slice(0, 25)) console.log(`     ${k}`);
  if (sinUsar.length > 25) console.log(`     ...y ${sinUsar.length - 25} mas`);
}

// ---------------------------------------------------------------------------
console.log("\n--- LA MISMA CUENTA DE DINERO EN DOS SITIOS ---");
{
  // Es EL fallo que mas ha costado en este proyecto: la misma formula escrita
  // dos veces, una se cambia y la otra no, y dos pantallas dan numeros
  // distintos del mismo mes. Paso con Reportes, con Ahorro y con el PDF.
  const formulas = [
    { nombre: "disponible del mes", re: /budget\s*\+\s*prevBalance\s*\+\s*income\s*-\s*spent/g },
    { nombre: "lo que sobra sin arrastre", re: /budget\s*\+\s*income\s*-\s*spent/g },
  ];
  const fuentes = CODIGO.concat(archivos(path.join(RAIZ, "utils")));
  for (const f of formulas) {
    const donde = [];
    for (const archivo of fuentes) {
      const txt = fs.readFileSync(archivo, "utf8");
      const veces = (txt.match(f.re) || []).length;
      if (veces > 0) donde.push(`${rel(archivo)} (x${veces})`);
    }
    if (donde.length > 1) {
      fallo("cuentas", `"${f.nombre}" esta escrita en ${donde.length} sitios: ${donde.join(", ")}`);
    }
    console.log(`  ${f.nombre}: ${donde.length} sitio(s)`);
  }
}

// ---------------------------------------------------------------------------
console.log("\n=== RESULTADO ===");
if (problemas.length === 0) console.log("Sin problemas\n");
else {
  for (const p of problemas) console.log("  FALLA " + p);
  console.log(`\n${problemas.length} problemas\n`);
}
process.exit(problemas.length ? 1 : 0);
