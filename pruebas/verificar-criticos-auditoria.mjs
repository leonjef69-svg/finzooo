import fs from "node:fs";

const leer = (ruta) => fs.readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
const exigir = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};

const familia = leer("utils/cloudFamilia.ts");
const cajasCompartidas = leer("utils/cloudCajasCompartidas.ts");
const cajas = leer("screens/Cajas.tsx");
const ajustesCaja = leer("app/box-settings.tsx");
const contexto = leer("contexts/AppDataContext.tsx");
const inicio = leer("app/index.tsx");
const almacenamiento = leer("utils/storage.ts");

const unionFamilia = familia.slice(familia.indexOf("export async function unirseAFamilia"), familia.indexOf("export async function listarMiembrosFamilia"));
const unionCaja = cajasCompartidas.slice(cajasCompartidas.indexOf("export async function unirseACaja"), cajasCompartidas.indexOf("export async function listarMovimientosCajaCompartida"));

exigir(!unionFamilia.includes("transaction.get(familyRef)"), "Familia vuelve a leer el espacio antes de crear la membresía");
exigir(!unionCaja.includes("transaction.get(boxRef)"), "Caja vuelve a leer el espacio antes de crear la membresía");
exigir(unionFamilia.indexOf("transaction.set(doc(db, \"familySpaces\"") < unionFamilia.indexOf("getDoc(familyRef)"), "Familia debe leer el espacio solo después de crear la membresía");
exigir(unionCaja.indexOf("transaction.set(memberRef") < unionCaja.lastIndexOf("getDoc(doc(db, \"boxSpaces\""), "Caja debe leer el espacio solo después de crear la membresía");

exigir(cajas.includes("!canCloseLinkedSpace(datos.movimientos.filter"), "La lista de Cajas no protege aportes consumidos al borrar");
exigir(ajustesCaja.includes("!canCloseLinkedSpace(movimientosCaja)"), "Ajustes de Caja no protege aportes consumidos al borrar");
exigir(cajas.includes("if (!ready || !cloudReady) return;"), "Cajas repara transferencias antes de terminar la carga de la nube");

for (const marca of [
  "setCategoryOverridesState({})",
  "setCategoriasPropiasState([])",
  "setIconosFavoritosState([])",
  "setPagosProgramados([])",
  "setAutoCaptureLog([])",
  "limpiarCajasEnMemoria()",
  "desconectarDropbox()",
  "disableLock()",
  "notificationReader.clear()",
]) exigir(contexto.includes(marca), `Cerrar sesión no limpia: ${marca}`);

for (const clave of [
  "finzo:scheduledExport",
  "finzo:carpetaExportacion",
  "finzo:capturaPendiente",
]) exigir(almacenamiento.includes(`\"${clave}\"`), `Cerrar sesión no borra ${clave}`);

exigir(inicio.includes("needsEmailVerification") && inicio.includes("/verify-email"), "Una cuenta sin verificar todavía puede reabrir Inicio");

console.log("Bloqueantes de unión, cambio de cuenta, Cajas y correo sin verificar protegidos.");
