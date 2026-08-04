// LA PANTALLA DE REGISTRO AUTOMATICO SE QUEDABA VIEJA
//
// Fallo reportado el 02/08/2026: se hace un yapeo, el celular lo lee en voz
// alta, el movimiento SI aparece en la lista de movimientos... y en la
// pantalla de registro automatico no sale hasta cerrar la app del todo y
// volver a entrar.
//
// POR QUE PASABA
//
// Esa lista se leia del disco UNA sola vez, al arrancar la app, y se
// guardaba entera cada vez que cambiaba. Mientras solo escribiera la app,
// bien. Pero el trabajo de fondo —el que registra el yapeo con la app en
// segundo plano— tambien escribe ahi.
//
// Resultado: el trabajo de fondo apuntaba el aviso en el disco, la app no se
// enteraba, y ademas su siguiente guardado pisaba esa entrada con la copia
// vieja que tenia en memoria.
//
// Es exactamente el mismo fallo que ya se habia arreglado para los
// MOVIMIENTOS (mergeTransactions). Nadie lo arreglo para esta lista, y es la
// pantalla a la que se recurre justo cuando se sospecha que un yapeo no
// llego: que diga que no llego cuando si llego es de lo peor que puede pasar.
import fs from "fs";
import path from "path";
import { mergeCaptureLog } from "@/utils/mergeTransactions";
import type { CaptureLogEntry } from "@/utils/autoCapture";

const RAIZ = process.cwd();

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const aviso = (at: number, texto: string): CaptureLogEntry => ({
  at,
  text: texto,
  result: "added",
  amount: 1,
});

console.log("\n--- EL FALLO REPORTADO ---");
{
  // La app lleva un rato abierta con estos dos avisos.
  const enMemoria = [aviso(1000, "yape de las 10"), aviso(2000, "yape de las 11")];
  // Y el trabajo de fondo, con la app en segundo plano, apunto uno nuevo.
  const enDisco = [...enMemoria, aviso(3000, "el yape que se acaba de hacer")];

  const junto = mergeCaptureLog(enMemoria, enDisco);
  ok(junto.length === 3, "el aviso nuevo del trabajo de fondo aparece sin reiniciar");
  ok(junto[junto.length - 1].text === "el yape que se acaba de hacer", "y queda el ultimo, que es como lo espera la pantalla");
}

console.log("\n--- NO SE PIERDE LO QUE SOLO ESTA EN MEMORIA ---");
{
  // Al reves: la app acaba de procesar un aviso que todavia no llego al
  // disco. Recoger del disco no puede borrarlo.
  const enMemoria = [aviso(1000, "viejo"), aviso(4000, "recien procesado por la app")];
  const enDisco = [aviso(1000, "viejo")];

  const junto = mergeCaptureLog(enMemoria, enDisco);
  ok(junto.length === 2, "lo que solo esta en memoria sigue ahi");
  ok(junto.some((e) => e.text === "recien procesado por la app"), "y es el que era");
}

console.log("\n--- SIN NOVEDADES, LA MISMA LISTA (NO SOLO IGUAL) ---");
{
  // Esto se llama cada ocho segundos. Si devolviera una lista nueva cada vez,
  // la pantalla se repintaria y el registro entero se volveria a cifrar y
  // guardar sin que nada hubiera cambiado.
  const enMemoria = [aviso(1000, "uno"), aviso(2000, "dos")];
  ok(mergeCaptureLog(enMemoria, [...enMemoria]) === enMemoria, "devuelve la MISMA lista, no una copia");
  ok(mergeCaptureLog(enMemoria, []) === enMemoria, "y con el disco vacio, tambien");
}

console.log("\n--- NADA SE DUPLICA ---");
{
  const uno = aviso(1000, "el mismo yape");
  const junto = mergeCaptureLog([uno], [{ ...uno }]);
  ok(junto.length === 1, "el mismo aviso desde los dos lados entra una sola vez");

  // Dos yapes iguales en segundos distintos SI son dos avisos.
  const dos = mergeCaptureLog([aviso(1000, "yape de S/ 1")], [aviso(1000, "yape de S/ 1"), aviso(2000, "yape de S/ 1")]);
  ok(dos.length === 2, "pero dos yapes iguales a horas distintas son dos");
}

console.log("\n--- EN ORDEN Y CON TOPE ---");
{
  const enMemoria = [aviso(5000, "nuevo")];
  const enDisco = [aviso(1000, "viejo"), aviso(3000, "medio")];
  const junto = mergeCaptureLog(enMemoria, enDisco);
  ok(
    junto.map((e) => e.at).join(",") === "1000,3000,5000",
    "quedan ordenados por hora aunque lleguen desordenados"
  );

  // El tope tiene que ser el mismo que usa processCaptured (40). Si aqui
  // fuera otro, la lista se recortaria distinto segun quien la escribiera.
  const muchos = Array.from({ length: 60 }, (_, i) => aviso(i * 100, "aviso " + i));
  const recortado = mergeCaptureLog([], muchos);
  ok(recortado.length === 40, "no pasa de 40, igual que processCaptured");
  ok(recortado[recortado.length - 1].text === "aviso 59", "y se quedan los mas nuevos, no los mas viejos");

  const enAutoCapture = fs.readFileSync(path.join(RAIZ, "utils/autoCapture.ts"), "utf8");
  const tope = enAutoCapture.match(/const MAX_LOG = (\d+)/);
  ok(tope?.[1] === "40", "y el tope de processCaptured sigue siendo 40");
}

console.log("\n--- Y LA APP DE VERDAD LO USA ---");
{
  // Una fusion perfecta que nadie llama no arregla nada. Esto es lo que
  // fallaba: la funcion para los movimientos existia y se usaba; para esta
  // lista no existia ninguna.
  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  const recoger = ctx.slice(ctx.indexOf("async function recogerDelDisco"));
  const cuerpo = recoger.slice(0, recoger.indexOf("async function collect"));

  ok(cuerpo.includes("STORAGE_KEYS.autoCaptureLog"), "recogerDelDisco vuelve a leer el registro del disco");
  ok(cuerpo.includes("mergeCaptureLog"), "y lo junta en vez de pisarlo");
  ok(cuerpo.includes("STORAGE_KEYS.transactions"), "sin dejar de recoger los movimientos");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
