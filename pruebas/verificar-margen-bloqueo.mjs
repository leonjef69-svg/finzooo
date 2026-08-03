// EL BLOQUEO PEDIA LA HUELLA CADA VEZ QUE SE SALIA
//
// Reportado el 02/08/2026: "cada vez que salgo de la app me sale para poner
// mi huella o el codigo pin". Eran DOS causas distintas:
//
//   1. El margen era de 30 segundos, y hacer un yapeo tarda mas. Al volver
//      pedia la huella siempre. Subido a 2 minutos a peticion del usuario.
//
//   2. Y la de verdad: el Honor del usuario MATA la app al mandarla al fondo.
//      El momento de salida vivia solo en memoria, asi que al morir la app se
//      perdia y volver era arrancar desde cero — bloqueo seguro, hubieran
//      pasado veinte segundos o dos horas. Ahora se apunta en disco.
//
// EL AGUJERO QUE ABRE ESO, Y QUE ESTA PRUEBA VIGILA
//
// Si la salida se apuntara ESTANDO YA BLOQUEADO, cerrar la app desde la
// pantalla del PIN y volver a abrirla dentro del margen la dejaria entrar sin
// PIN. Es lo contrario de para lo que sirve, y no se ve mirando la pantalla.
import fs from "fs";
import path from "path";

const RAIZ = "C:/Users/User/Videos/Fino control de gastos diarios/PresupuestoApp";
const gate = fs.readFileSync(path.join(RAIZ, "components/AppLockGate.tsx"), "utf8");
const lock = fs.readFileSync(path.join(RAIZ, "utils/appLock.ts"), "utf8");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- EL MARGEN ---");
{
  const m = lock.match(/GRACE_MS = ([\d_]+)/);
  const ms = m ? Number(m[1].replace(/_/g, "")) : 0;
  ok(ms === 120000, `dos minutos (${ms} ms)`);

  // Ni cero ni eterno: con cero, volver de la camara o del microfono pediria
  // la huella; pasado de unos minutos deja de proteger el celular olvidado.
  ok(ms >= 60000 && ms <= 300000, "entre un minuto y cinco, que es lo razonable");
}

console.log("\n--- SOBREVIVE A QUE ANDROID MATE LA APP ---");
{
  ok(lock.includes("SecureStore"), "la marca va al cajon cifrado del sistema");
  ok(/export async function recordarSalida/.test(lock), "se apunta al salir");
  ok(/export async function salioHaceNada/.test(lock), "y se consulta al arrancar");

  // Sin esto, arrancar en frio bloquea siempre y el margen no sirve de nada
  // en los celulares que matan la app.
  const arranque = gate.slice(gate.indexOf("const on = await isLockEnabled()"));
  ok(arranque.slice(0, 600).includes("salioHaceNada"), "el arranque en frio mira si se acaba de salir");
}

console.log("\n--- ESTANDO BLOQUEADO NO SE APUNTA NADA ---");
{
  // El agujero. Con la app ya bloqueada, salir NO puede dejar marca: si no,
  // cerrarla desde la pantalla del PIN y volver a abrirla entraria sin PIN.
  ok(/lockedRef/.test(gate), "se sabe si el candado esta puesto ahora mismo");
  ok(
    /if \(!lockedRef\.current && !prompting\.current/.test(gate),
    "y con el candado puesto no se apunta la salida"
  );

  // El cuadro de la huella manda la app a "inactive". Sin esta marca, el
  // propio cuadro contaria como salir.
  ok(/prompting\.current/.test(gate), "el cuadro de la huella tampoco cuenta como salir");
}

console.log("\n--- ANTE LA DUDA, SE BLOQUEA ---");
{
  const fn = lock.slice(lock.indexOf("export async function salioHaceNada"));
  const cuerpo = fn.slice(0, fn.indexOf("\n}"));

  ok(/if \(!guardado\) return false/.test(cuerpo), "sin marca guardada, se bloquea");
  ok(/Number\.isFinite/.test(cuerpo), "con un numero que no lo es, se bloquea");
  ok(/catch/.test(cuerpo), "y si no se puede leer, tambien");

  // Si alguien atrasa el reloj del celular, lo pasado sale NEGATIVO y sin
  // comprobarlo pasaria por reciente para siempre.
  ok(/pasado >= 0/.test(cuerpo), "y con el reloj atrasado no se cuela");
}

console.log("\n--- LA MARCA VIEJA SE BORRA ---");
{
  ok(/export async function olvidarSalida/.test(lock), "hay forma de borrarla");
  const veces = (gate.match(/olvidarSalida\(\)/g) || []).length;
  ok(veces >= 2, `se borra al bloquear, en caliente y en frio (${veces} sitios)`);
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
