// Corre TODAS las pruebas y auditores de una vez.
//
// Existe porque cada prueba necesitaba su propia linea de esbuild con sus
// sustitutos, y eso solo lo sabia quien la habia escrito. Dos de ellas se
// quedaron paradas meses sin que nadie se enterara: seguian ahi, pero ya no
// compilaban contra el codigo de la app.
//
//   node pruebas/correr.mjs
//
// Se ejecuta desde la raiz del proyecto.
import { execFileSync } from "child_process";
import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const DIR = path.join(RAIZ, "pruebas");
const TMP = path.join(DIR, ".tmp");

if (!fs.existsSync(path.join(RAIZ, "app.json"))) {
  console.error("Hay que correrlo desde la raiz del proyecto.");
  process.exit(1);
}
fs.mkdirSync(TMP, { recursive: true });

const stub = (n) => path.join(DIR, "stubs", n);

// Los sustitutos que hacen falta casi siempre.
const BASE = { "react-native": stub("rn.ts"), "lucide-react-native": stub("lucide.ts") };

// Y los de las pruebas que cargan modulos de Expo.
const EXPO = {
  ...BASE,
  "expo-notifications": stub("notif.ts"),
  "expo-image-manipulator": stub("manip.ts"),
};



/**
 * Cada prueba de TypeScript con los sustitutos que necesita.
 *
 * Los sustitutos hacen falta porque estos archivos cargan codigo de la app, y
 * la app habla con Android. Aqui no hay Android: se cambian esas piezas por
 * otras que no hacen nada, para poder comprobar las CUENTAS con Node.
 */
const SUITES = [
  { archivo: "verificar-voz-exportar.ts", alias: BASE },
  { archivo: "verificar-orden-voz.ts", alias: BASE },
  { archivo: "verificar-contactos.ts", alias: BASE },
  { archivo: "verificar-categorias.ts", alias: EXPO },
  { archivo: "verificar-pdf.ts", alias: BASE },
  { archivo: "verificar-pdf-mixto.ts", alias: BASE },
  // SheetJS no funciona empaquetado como modulo moderno: pide el formato
  // antiguo. Es la unica que lo necesita.
  { archivo: "verificar-excel.ts", alias: BASE, formato: "cjs" },
  { archivo: "verificar-exportar.ts", alias: EXPO },
  { archivo: "verificar-panorama.ts", alias: BASE },
  { archivo: "verificar-fusion.ts", alias: BASE },
  { archivo: "verificar-ahorro.ts", alias: BASE },
  { archivo: "verificar-orden-movimientos.ts", alias: BASE },
  { archivo: "verificar-yapes-repetidos.ts", alias: EXPO },
  { archivo: "verificar-registro-avisos.ts", alias: EXPO },
  { archivo: "verificar-presupuesto-mensual.ts", alias: BASE },
  { archivo: "verificar-programado.ts", alias: EXPO },
];

/**
 * Las pruebas que ya son .mjs sueltos y los auditores: se corren tal cual, sin
 * empaquetar. Se descubren solas leyendo la carpeta, para que una prueba nueva
 * entre sin tener que acordarse de apuntarla en ningun sitio.
 */
const SUELTAS = fs
  .readdirSync(DIR)
  .filter((f) => /^verificar-.*\.mjs$/.test(f))
  .sort();

const AUDITORES = fs
  .readdirSync(DIR)
  .filter((f) => /^auditar-.*\.mjs$/.test(f))
  .sort();

/** Corre un .mjs suelto y cuenta si paso. */
function correrSuelto(archivo) {
  const nombre = archivo.replace(/\.mjs$/, "");
  try {
    const r = execFileSync("node", [path.join(DIR, archivo)], { stdio: "pipe" }).toString();
    const linea = r.trim().split("\n").pop();
    console.log(`  OK          ${nombre.padEnd(30)} ${linea}`);
  } catch (e) {
    console.log(`  FALLA       ${nombre}`);
    console.log(String(e.stdout || "").split("\n").slice(-8).join("\n"));
    rotas.push(nombre);
    fallos++;
  }
}

let fallos = 0;
const rotas = [];

console.log("\n=== PRUEBAS ===\n");
for (const s of SUITES) {
  const nombre = s.archivo.replace(/\.ts$/, "");
  const salida = path.join(TMP, nombre + (s.formato === "cjs" ? ".cjs" : ".mjs"));
  try {
    // Se usa la API de esbuild y no su programa suelto: lanzarlo como
    // proceso obligaba a pasar por el shell, y una ruta con espacios —la de
    // este proyecto los tiene— se partia en trozos. Node ademas ya no deja
    // ejecutar un .cmd sin shell. Asi no hay ni shell ni rutas que escapar.
    esbuild.buildSync({
      entryPoints: [path.join(DIR, s.archivo)],
      bundle: true,
      platform: "node",
      format: s.formato ?? "esm",
      alias: { "@": RAIZ, ...s.alias },
      outfile: salida,
      logLevel: "silent",
    });
  } catch (e) {
    console.log(`  NO COMPILA  ${nombre}`);
    console.log("    " + String(e.message).split("\n").slice(0, 4).join("\n    "));
    rotas.push(nombre);
    fallos++;
    continue;
  }
  try {
    const r = execFileSync("node", [salida], { stdio: "pipe" }).toString();
    const linea = r.trim().split("\n").pop();
    console.log(`  OK          ${nombre.padEnd(26)} ${linea}`);
  } catch (e) {
    console.log(`  FALLA       ${nombre}`);
    console.log(String(e.stdout || "").split("\n").filter((l) => l.includes("FALLA")).slice(0, 6).join("\n"));
    rotas.push(nombre);
    fallos++;
  }
}

for (const f of SUELTAS) correrSuelto(f);

console.log("\n=== AUDITORES ===\n");
for (const a of AUDITORES) correrSuelto(a);

console.log("");
if (fallos === 0) {
  console.log(
    `Todo bien: ${SUITES.length + SUELTAS.length} pruebas y ${AUDITORES.length} auditores\n`
  );
} else {
  console.log(`${fallos} con problemas: ${rotas.join(", ")}\n`);
}
process.exit(fallos ? 1 : 0);
