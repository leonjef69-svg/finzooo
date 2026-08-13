// EN UN PDF, UNA CASILLA VACIA NO EXISTE (13/08/2026)
//
// Salio de un estado de cuenta de ejemplo hecho para que el probara la importacion. Al leerlo,
// esto:
//
//     05/07/2026 | ABONO SUELDO JULIO |        | 2450.00
//
// entraba como GASTO de 2450. Plata que entra anotada como plata que sale.
//
// EL MOTIVO. En un PDF no hay tabla: hay trozos de texto con una posicion. Una casilla vacia no
// deja ningun rastro — no hay celda, no hay hueco, no hay nada—. El lector pegaba los trozos de
// cada fila con un tab entre ellos, asi que esa fila llegaba con TRES campos en vez de cuatro y
// el monto del Abono caia en el sitio del Cargo.
//
// Le pasa a cualquier banco que separe Cargo y Abono en dos columnas, que son casi todos. Y es
// de los peores errores que puede tener un cuaderno de gastos: no se ve al mirar la lista —el
// monto es correcto, la fecha es correcta, la descripcion es correcta— y solo aparece semanas
// despues, cuando las cuentas no cuadran y ya no se sabe por que.
//
// AHORA SE MIRAN LAS POSICIONES. La fila con mas celdas hace de plantilla y cada celda cae en la
// columna que le toca por donde empieza. Las columnas sin nada salen vacias, pero salen.
//
// El PDF de aqui abajo se arma a mano, sin ninguna libreria: es la unica forma de comprobar el
// caso exacto —una casilla vacia en medio— sin depender de un archivo suelto.
import { extractPdfText } from "@/utils/pdfExtract";
import { parseStatement } from "@/utils/importEngine";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

/** Las cuatro columnas del estado de cuenta, en unidades de PDF. */
const COLUMNAS = [60, 130, 400, 470];

/**
 * Arma un PDF de verdad con las filas que se le den.
 *
 * Cada celda va en SU posicion, que es como escribe una tabla cualquier banco. Una celda vacia
 * simplemente no se escribe — eso es justo lo que se esta probando.
 */
function pdfCon(filas: string[][]): Uint8Array {
  const esc = (s: string) =>
    s
      .split("")
      .map((c) => (c === "(" || c === ")" || c === "\\" ? "\\" + c : c))
      .join("");

  let y = 760;
  const partes = ["BT", "/F1 11 Tf"];
  for (const fila of filas) {
    fila.forEach((texto, i) => {
      if (texto) partes.push(`1 0 0 1 ${COLUMNAS[i]} ${y} Tm (${esc(texto)}) Tj`);
    });
    y -= 16;
  }
  partes.push("ET");

  const contenido = partes.join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const posiciones: number[] = [];
  objetos.forEach((cuerpo, i) => {
    posiciones.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
  });
  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posiciones) pdf += `${String(p).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

const EXTRACTO = [
  ["BANCO EJEMPLO S.A."],
  ["Fecha", "Descripcion", "Cargo", "Abono"],
  ["02/07/2026", "YAPE ENVIADO A M. QUISPE", "45.00", ""],
  ["05/07/2026", "ABONO SUELDO JULIO", "", "2450.00"],
  ["08/07/2026", "GRIFO PRIMAX", "60.00", ""],
  ["14/07/2026", "TRANSFERENCIA RECIBIDA", "", "300.00"],
];

(async () => {
  const texto = await extractPdfText(pdfCon(EXTRACTO));
  const lineas = texto.split("\n");

  console.log("\n--- LA CASILLA VACIA DEJA SU HUECO ---");
  {
    const sueldo = lineas.find((l) => l.includes("SUELDO")) ?? "";
    ok(sueldo.includes("\t\t"), "la fila del sueldo trae el hueco del Cargo vacio");
    ok(sueldo.split("\t").length === 4, `y llega con las cuatro columnas (${sueldo.split("\t").length})`);

    // Y LAS FILAS COMPLETAS SIGUEN IGUAL. Si al arreglar lo de las vacias se rompieran las
    // normales, el arreglo costaria mas de lo que resuelve: las completas son la mayoria.
    const yape = lineas.find((l) => l.includes("QUISPE")) ?? "";
    ok(yape.split("\t")[0] === "02/07/2026", "en una fila completa, la fecha sigue primero");
    ok(yape.split("\t")[2] === "45.00", "y el monto en su columna");
  }

  console.log("\n--- Y EL SUELDO ENTRA COMO INGRESO ---");
  {
    // Esta es la comprobacion que importa. Lo de arriba explica POR QUE fallaba; esto es lo que
    // el veria: un ingreso de 2450 anotado como gasto.
    const r = parseStatement(texto);
    ok(r.ok, "el extracto se lee");
    if (r.ok) {
      ok(r.rows.length === 4, `entran los cuatro movimientos (${r.rows.length})`);
      const sueldo = r.rows.find((f) => f.description.includes("SUELDO"));
      ok(sueldo?.type === "income", "el sueldo es un INGRESO, no un gasto");
      ok(sueldo?.amount === 2450, "y por 2450");

      const transferencia = r.rows.find((f) => f.description.includes("TRANSFERENCIA"));
      ok(transferencia?.type === "income", "la transferencia recibida tambien");

      const gastos = r.rows.filter((f) => f.type === "expense");
      ok(gastos.length === 2, "y los dos gastos siguen siendo gastos");
    }
  }

  console.log("\n--- UN PDF SIN TABLA NO SE TOCA ---");
  {
    // Con una o dos columnas no hay tabla que reconstruir, y forzarla haria daño: una carta o un
    // recibo suelto acabaria partido en columnas inventadas.
    const carta = await extractPdfText(
      pdfCon([["Estimado cliente"], ["Su saldo al 31 de julio es de S/ 1200.00"]])
    );
    ok(!carta.includes("\t"), "un texto corrido se queda corrido");
    ok(carta.includes("Estimado cliente"), "y no se pierde nada por el camino");
  }

  console.log(fallos === 0 ? "\nTodo bien: un ingreso no se cuela como gasto" : `\n${fallos} fallas`);
  process.exit(fallos === 0 ? 0 : 1);
})();
