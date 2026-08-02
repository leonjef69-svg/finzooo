// Comprueba que el modo señuelo AISLA de verdad.
//
// Aqui no se prueba que la pantalla se vea bien. Se prueba lo unico que
// importa de esta funcion: que los datos reales no se toquen ni se
// revelen. Un señuelo bonito que sobrescribe el respaldo real es mucho peor
// que no tener señuelo.
//
// Se reproduce la traduccion de claves de utils/storage.ts y el candado de
// utils/cloudSync.ts, y se les pasan las secuencias que de verdad ocurren.

let decoyActivo = false;
const isDecoyActive = () => decoyActivo;
const activate = () => { decoyActivo = true; };
const deactivate = () => { decoyActivo = false; };

// Mismo actualKey() de utils/storage.ts
const actualKey = (key) =>
  isDecoyActive() ? key.replace(/^finzo:/, "finzo:decoy:") : key;

// Un AsyncStorage de mentira, para poder mirar QUE quedo escrito y donde
const disco = new Map();
const pendientes = new Map();

function saveJSON(key, value) {
  // Se traduce al ENCOLAR, no al escribir (ver el comentario del original)
  pendientes.set(actualKey(key), value);
}
function flushPendingSaves() {
  for (const [k, v] of pendientes) disco.set(k, v);
  pendientes.clear();
}
function loadJSON(key, fallback) {
  const k = actualKey(key);
  return disco.has(k) ? disco.get(k) : fallback;
}

// Mismo candado de utils/cloudSync.ts
const nube = { doc: null, subidas: 0, bajadas: 0 };
function saveCloudData(uid, data) {
  if (isDecoyActive()) return;
  nube.subidas++;
  nube.doc = data;
}
function loadCloudData(uid) {
  if (isDecoyActive()) return null;
  nube.bajadas++;
  return nube.doc;
}

const K = { transactions: "finzo:transactions", budgets: "finzo:budgets" };

let fallos = 0;
function check(n, ok, d = "") {
  console.log(`  ${ok ? "OK   " : "FALLA"} ${n.padEnd(58)} ${d}`);
  if (!ok) fallos++;
}

// ---- Punto de partida: una cuenta real con datos ----
function reiniciar() {
  decoyActivo = false;
  disco.clear();
  pendientes.clear();
  nube.doc = null;
  nube.subidas = 0;
  nube.bajadas = 0;
  saveJSON(K.transactions, [{ id: 1, amount: 1347, description: "REAL" }]);
  saveJSON(K.budgets, { "2026-07": 900 });
  flushPendingSaves();
  saveCloudData("uid", { transactions: [{ id: 1, amount: 1347, description: "REAL" }] });
  // Los contadores arrancan en cero DESPUES del montaje: lo que se cuenta
  // es lo que pasa durante la prueba, no la subida que crea el respaldo.
  nube.subidas = 0;
  nube.bajadas = 0;
}

console.log("Los datos reales siguen intactos");
{
  reiniciar();
  activate();
  saveJSON(K.transactions, [{ id: 99, amount: 6.5, description: "FALSO" }]);
  flushPendingSaves();

  check("lo falso se guarda en su propio cajon", disco.has("finzo:decoy:transactions"));
  const reales = disco.get("finzo:transactions");
  check("el cajon real no se toco", reales[0].description === "REAL", `${reales[0].description} S/${reales[0].amount}`);
  check("y sigue con su monto", reales[0].amount === 1347);

  deactivate();
  check("al salir se vuelve a ver lo real", loadJSON(K.transactions, [])[0].description === "REAL");
}

console.log("\nLa nube: ni sube ni baja");
{
  reiniciar();
  activate();
  // La sincronizacion automatica dispara sola cada vez que algo cambia
  saveCloudData("uid", { transactions: [{ id: 99, description: "FALSO" }] });
  saveCloudData("uid", { transactions: [{ id: 98, description: "FALSO" }] });
  check("no subio nada", nube.subidas === 0, `${nube.subidas} subidas`);
  check("el respaldo real sigue entero", nube.doc.transactions[0].description === "REAL");

  // Y al reves: bajar enseñaria los datos reales DENTRO del señuelo
  const bajado = loadCloudData("uid");
  check("no bajo nada", bajado === null);
  check("ni siquiera lo intento", nube.bajadas === 0);
}

console.log("\nCerrar sesion desde el señuelo no destruye el respaldo");
{
  reiniciar();
  activate();
  // logout() sube TODO explicitamente antes de salir. Sin el candado, esta
  // sola linea borraria la copia real y sustituiria por la inventada.
  saveCloudData("uid", { transactions: [{ id: 99, description: "FALSO" }] });
  check("el respaldo real sobrevive", nube.doc.transactions[0].description === "REAL");
}

console.log("\nLos guardados en cola no se cuelan de un lado al otro");
{
  reiniciar();
  // Un cambio real queda encolado justo antes de entrar al señuelo
  saveJSON(K.transactions, [{ id: 2, amount: 50, description: "REAL NUEVO" }]);
  // enterDecoyMode() escribe la cola ANTES de encender el interruptor
  flushPendingSaves();
  activate();
  saveJSON(K.transactions, [{ id: 99, description: "FALSO" }]);
  flushPendingSaves();

  check("el cambio real acabo en el cajon real",
    disco.get("finzo:transactions")[0].description === "REAL NUEVO");
  check("y no en el del señuelo",
    disco.get("finzo:decoy:transactions")[0].description === "FALSO");
}

console.log("\nEl señuelo es estable entre revisiones");
{
  reiniciar();
  activate();
  // Primera vez: se siembra
  let vistos = loadJSON(K.transactions, []);
  if (vistos.length === 0) {
    saveJSON(K.transactions, [{ id: 99, amount: 6.5, description: "Menú del día" }]);
    flushPendingSaves();
  }
  const primera = JSON.stringify(loadJSON(K.transactions, []));

  // Se cierra la app y se vuelve a abrir con el mismo PIN señuelo
  deactivate();
  activate();
  vistos = loadJSON(K.transactions, []);
  if (vistos.length === 0) {
    saveJSON(K.transactions, [{ id: 100, amount: 99, description: "OTRA COSA" }]);
    flushPendingSaves();
  }
  const segunda = JSON.stringify(loadJSON(K.transactions, []));

  // Unos movimientos que cambian solos entre una revision y otra delatan
  // que estan inventados.
  check("se ve lo mismo la segunda vez", primera === segunda);
}

console.log("\nBorrar la cuenta desde el señuelo solo borra lo falso");
{
  reiniciar();
  activate();
  saveJSON(K.transactions, [{ id: 99, description: "FALSO" }]);
  flushPendingSaves();
  // clearAccountData() aplica actualKey a cada clave
  for (const key of Object.values(K)) disco.delete(actualKey(key));

  check("lo falso se borro", !disco.has("finzo:decoy:transactions"));
  check("lo real sigue ahi", disco.get("finzo:transactions")[0].description === "REAL");
}

console.log("\nSin señuelo, todo funciona como siempre");
{
  reiniciar();
  saveJSON(K.transactions, [{ id: 3, description: "REAL 3" }]);
  flushPendingSaves();
  saveCloudData("uid", { transactions: [{ id: 3, description: "REAL 3" }] });
  check("se guarda sin prefijo", disco.has("finzo:transactions"));
  check("no se creo ningun cajon de señuelo",
    ![...disco.keys()].some((k) => k.includes("decoy")), [...disco.keys()].join(", "));
  check("la nube sigue subiendo", nube.subidas > 0, `${nube.subidas} subidas`);
  check("y bajando", loadCloudData("uid") !== null);
}

console.log(fallos === 0 ? "\nTodo correcto" : `\n${fallos} fallos`);
if (fallos) process.exitCode = 1;
