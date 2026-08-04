// El Excel que se EXPORTA: que salga con columnas y con los montos como
// numeros, no como texto. Es la diferencia con el CSV que habia antes.
import { createRequire } from "module";
const ROOT = process.cwd();
const require = createRequire(`${ROOT}/package.json`);
const XLSX = require("xlsx");

let fallos = 0;
function ok(c, m) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }

// Las mismas filas que arma filasDelReporte(): el monto va como NUMERO.
const filas = [
  ["Fecha", "Categoria", "Descripcion", "Metodo", "Monto"],
  ["3 de julio", "Comida", "salchipapa", "Efectivo", -10],
  ["31 de julio", "Otros", "teclado", "Tarjeta", -10],
  ["20 de julio", "Sueldo", "abono", "Transferencia", 1200],
  [],
  ["Total", "", "", "", 1180],
];

const wb = XLSX.utils.book_new();
const hoja = XLSX.utils.aoa_to_sheet(filas);
hoja["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 34 }, { wch: 14 }, { wch: 12 }];
XLSX.utils.book_append_sheet(wb, hoja, "Movimientos");
const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));

console.log("\n--- SALE UN EXCEL DE VERDAD ---");
ok(bytes.length > 0, "se generan bytes");
// Un .xlsx es un ZIP: empieza por PK.
ok(bytes[0] === 0x50 && bytes[1] === 0x4b, "el archivo es un .xlsx de verdad (empieza por PK), no un CSV disfrazado");

// cellStyles TRUE: sin el, la lectura no devuelve los anchos de columna
// aunque el archivo si los lleve. Es cosa de como se lee, no de como se
// escribio, y costo un rojo darse cuenta.
const leido = XLSX.read(bytes, { type: "array", cellNF: true, cellStyles: true });
ok(leido.SheetNames[0] === "Movimientos", "la hoja se llama Movimientos");

const h = leido.Sheets.Movimientos;
console.log("\n--- LOS MONTOS SON NUMEROS, NO TEXTO ---");
ok(h.E2 && h.E2.t === "n", `el monto de la fila 1 es numero (t=${h.E2?.t}), asi se puede sumar en Excel`);
ok(h.E2.v === -10, "y vale -10, con su signo");
ok(h.E4.v === 1200, "el ingreso vale 1200");
ok(h.A2.t === "s", "la fecha va como texto, tal como se lee");

console.log("\n--- LAS COLUMNAS ESTAN SEPARADAS ---");
ok(h.A1.v === "Fecha" && h.E1.v === "Monto", "cada cabecera en su celda, no todo en una");
ok(h.C2.v === "salchipapa", "la descripcion en la suya");
ok(Array.isArray(h["!cols"]) && h["!cols"].length === 5, "y con ancho puesto, para no tener que arrastrar bordes");

console.log("\n--- EL TOTAL ---");
const filasLeidas = XLSX.utils.sheet_to_json(h, { header: 1, blankrows: false });
const ultima = filasLeidas[filasLeidas.length - 1];
ok(ultima[0] === "Total", "la ultima fila es el total");
ok(ultima[4] === 1180, "y cuadra: -10 -10 +1200 = 1180");

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
