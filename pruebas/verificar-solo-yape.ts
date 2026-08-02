// SOLO YAPE
//
// Decision del usuario el 02/08/2026: el registro automatico se queda con
// Yape y nada mas. Los otros quince —Plin, BCP, Interbank, BBVA, Scotiabank,
// Pichincha, cajas, Ripley...— nunca se probaron con un movimiento de verdad:
// sus palabras estaban escritas segun como SUELEN redactar sus avisos.
//
// Y mientras tanto estorbaban: el aviso de Scotiabank "Operacion en curso.
// Hemos generado y autocompletado la clave" se capturaba, se guardaba y salia
// en la pantalla de diagnostico. Un aviso de seguridad de un banco que Finzo
// no necesita ni mirar.
//
// POR QUE ESTA PRUEBA
//
// La lista esta en DOS sitios: el servicio de Android (Kotlin, dentro del APK)
// y la app (JavaScript, que viaja por actualizacion). Tienen que decir lo
// mismo. Si se separan, el servicio captura avisos que la app tira —o al
// reves— y desde fuera se ve como que el registro falla sin motivo.
//
// Ya paso hoy con la voz: dos listas que decian casi lo mismo y una diferencia
// minuscula entre ellas dejo el celular mudo con un yapeo real.
import fs from "fs";
import path from "path";
import { parseNotification } from "@/utils/notificationParser";

const RAIZ = "C:/Users/User/Videos/Fino control de gastos diarios/PresupuestoApp";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const aviso = (pkg: string, texto: string) => ({
  package: pkg,
  title: "Confirmación de Pago",
  text: texto,
  postedAt: Date.now(),
});

console.log("\n--- YAPE SIGUE ENTRANDO ---");
{
  // El paquete de verdad de Yape. Contiene "bcp", asi que tambien comprueba
  // que la comparacion por "contiene" no lo deje fuera.
  const r = parseNotification(
    aviso("com.bcp.innovacxion.yapeapp", "Yape! JEFFERSON GIOVANNI LEON CARLOS te envió un pago por S/ 1")
  );
  ok(r.ok, "el yapeo real se sigue registrando");
  if (r.ok) {
    ok(r.row.amount === 1 && r.row.type === "income", "con su monto y como ingreso");
  }
}

console.log("\n--- LOS DEMAS BANCOS YA NO ---");
{
  // Los mismos textos que ANTES se registraban. Ahora no, por la app que los
  // manda, no por lo que digan.
  const fuera: [string, string][] = [
    ["com.scotiabank.pe", "Te transfirieron S/ 50.00 de Juan Pérez"],
    ["com.bcp.bank.bcp", "Te depositaron S/ 120.00"],
    ["pe.interbank.mobilebanking", "Recibiste un abono de S/ 900"],
    ["com.bbva.pe", "Pagaste S/ 35.00 en METRO"],
    ["pe.plin.app", "Te plinearon S/ 30"],
    ["com.tunki.app", "Te enviaron S/ 20"],
  ];
  for (const [pkg, texto] of fuera) {
    const r = parseNotification(aviso(pkg, texto));
    ok(!r.ok, `descartado: ${pkg}`);
  }
}

console.log("\n--- Y EL AVISO DE CLAVE DEL BANCO, MENOS TODAVIA ---");
{
  // El que salia en la pantalla de diagnostico y que disparo esta decision.
  const r = parseNotification(
    aviso("com.scotiabank.pe", "Operación en curso. Hemos generado y autocompletado la clave")
  );
  ok(!r.ok, "el aviso de clave de Scotiabank ni se mira");
}

console.log("\n--- LAS DOS LISTAS DICEN LO MISMO ---");
{
  // La del servicio de Android (dentro del APK) y la de la app (que viaja por
  // actualizacion). Separarlas es el fallo que esta prueba existe para cazar.
  const kt = fs.readFileSync(
    path.join(RAIZ, "modules/notification-reader/android/src/main/java/com/finzo/notificationreader/FinzoNotificationListener.kt"),
    "utf8"
  );
  const ts = fs.readFileSync(path.join(RAIZ, "utils/notificationParser.ts"), "utf8");

  const enKotlin = [...(kt.slice(kt.indexOf("MONEY_APP_HINTS = listOf(")).match(/listOf\(([^)]*)\)/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const enApp = [...(ts.slice(ts.indexOf("const APPS_ACEPTADAS = [")).match(/\[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  ok(enKotlin.length > 0 && enApp.length > 0, `se leyeron las dos listas (${enKotlin.join(",")} / ${enApp.join(",")})`);
  ok(
    enKotlin.slice().sort().join(",") === enApp.slice().sort().join(","),
    "el servicio y la app vigilan exactamente las mismas apps"
  );
  ok(enApp.join(",") === "yape", "y hoy es solo Yape");
}

console.log("\n--- LA COMPROBACION VA EN LOS DOS LADOS ---");
{
  // La del servicio no basta: viaja dentro del APK y solo cambia
  // reinstalando. La de la app hace efecto por actualizacion y ademas tapa el
  // hueco de quien tenga un APK anterior instalado.
  const ts = fs.readFileSync(path.join(RAIZ, "utils/notificationParser.ts"), "utf8");
  const fn = ts.slice(ts.indexOf("export function parseNotification"));
  ok(fn.slice(0, 900).includes("APPS_ACEPTADAS"), "parseNotification comprueba la app que manda el aviso");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
