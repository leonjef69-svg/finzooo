// Regenera pruebas/stubs/lucide.ts con TODOS los iconos de la libreria.
//
// Se ejecuta a mano cuando se actualiza lucide-react-native:
//
//   node pruebas/stubs/generar-lucide.mjs
//
// POR QUE EXISTE
//
// El sustituto tenia escritos a mano los veinticuatro iconos que se usaban en
// su momento. Al agregar el catalogo para crear categorias propias —ciento
// ochenta y uno— cinco pruebas que ni siquiera hablan de iconos dejaron de
// compilar de golpe, con un error que no se parece en nada a lo que esas
// pruebas comprueban ("No matching export for UtensilsCrossed").
//
// Una lista escrita a mano de algo que crece se queda corta sola. Generarla
// entera cuesta un segundo y ese fallo no vuelve.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const TIPOS = path.join(
  RAIZ,
  "node_modules/lucide-react-native/dist/types/lucide-react-native.d.ts"
);
const SALIDA = path.join(RAIZ, "pruebas/stubs/lucide.ts");

if (!fs.existsSync(TIPOS)) {
  console.error("No se encuentra la libreria. Ejecutalo desde la raiz del proyecto.");
  process.exit(1);
}

const texto = fs.readFileSync(TIPOS, "utf8");
// Los nombres salen de la linea de "export { ... }", no de los "declare
// const". Ahi estan TAMBIEN los alias antiguos —Home, MoreHorizontal,
// PlusCircle— que la libreria mantiene por compatibilidad y que este mismo
// proyecto todavia usa. Sacandolos solo de los "declare", faltaban justo esos
// cuatro y las pruebas seguian sin compilar.
const bloque = texto.slice(texto.lastIndexOf("export {"));
const nombres = [
  ...new Set(
    [...bloque.matchAll(/(?:[{,]\s*)(?:[A-Za-z0-9_]+\s+as\s+)?([A-Z][A-Za-z0-9]*)/g)].map(
      (m) => m[1]
    )
  ),
].sort();

const cabecera = [
  "// Los iconos no pintan nada al probar con Node: solo tienen que existir para",
  "// que constants/categories y constants/iconos se puedan cargar.",
  "//",
  "// ESTE ARCHIVO SE GENERA, NO SE ESCRIBE A MANO.",
  "//",
  "// Antes tenia escritos los veinticuatro iconos que se usaban entonces. Al",
  "// agregar el catalogo para crear categorias propias —ciento ochenta y uno—",
  "// cinco pruebas que ni hablan de iconos dejaron de compilar de golpe, y el",
  '// motivo ("No matching export for UtensilsCrossed") no se parece en nada a',
  "// lo que esas pruebas comprueban.",
  "//",
  "// Ahora estan TODOS los de la libreria, sacados de sus tipos. Agregar un",
  "// icono al catalogo ya no puede romper nada.",
  "//",
  "// Para regenerarlo: node pruebas/stubs/generar-lucide.mjs",
  "",
  "const icono = () => null;",
  "export default new Proxy({}, { get: () => icono });",
  "",
].join("\n");

const cuerpo = "export const\n" + nombres.map((n) => "  " + n + " = icono").join(",\n") + ";\n";

fs.writeFileSync(SALIDA, cabecera + cuerpo);
console.log("Sustituto regenerado con " + nombres.length + " iconos.");
