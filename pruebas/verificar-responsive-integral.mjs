/**
 * Evita que vuelvan los recortes encontrados en la auditoría Android + iOS.
 *
 * Esta prueba mira las protecciones de estructura, no colores ni un rediseño:
 * desplazamiento en aperturas y formularios, zonas seguras, números largos,
 * controles que sí existen en cada sistema y una salida visible al cargar.
 */
import fs from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();
const leer = (ruta) => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
let fallos = 0;

function ok(condicion, mensaje) {
  console.log(`  ${condicion ? "OK   " : "FALLA"} ${mensaje}`);
  if (!condicion) fallos++;
}

console.log("\n--- PRIMERA APERTURA Y ACCESO ---");
{
  const inicio = leer("app/index.tsx");
  const contexto = leer("contexts/AppDataContext.tsx");
  ok(/ActivityIndicator/.test(inicio), "la carga inicial nunca queda como una pantalla vacía");
  ok(/init\(\)\.catch\(/.test(contexto) && /setReady\(true\)/.test(contexto), "un dato local dañado no bloquea el arranque para siempre");

  for (const [ruta, nombre] of [
    ["screens/Onboarding.tsx", "Bienvenida"],
    ["screens/SetupBudget.tsx", "Configuración inicial"],
    ["screens/VerifyEmail.tsx", "Verificación de correo"],
  ]) {
    const texto = leer(ruta);
    ok(/ScrollView/.test(texto), `${nombre} se puede desplazar en una pantalla baja`);
    ok(/useSafeAreaInsets/.test(texto), `${nombre} respeta cámara, notch y barra inferior`);
  }
}

console.log("\n--- TECLADO, MODALES Y CONTENIDO LARGO ---");
{
  const bloqueo = leer("components/AppLockGate.tsx");
  const dialogo = leer("components/ConfirmDialog.tsx");
  const selectorMeta = leer("screens/GoalPickerSheet.tsx");
  const metas = leer("screens/SavingsList.tsx");
  ok(/ScrollView/.test(bloqueo), "el bloqueo se alcanza completo al girar o aumentar la letra");
  ok(/<Modal/.test(dialogo) && /ScrollView/.test(dialogo), "las confirmaciones caben y aíslan correctamente la interacción");
  ok(/ScrollView|FlatList/.test(selectorMeta), "el selector de metas no esconde las últimas opciones");
  ok(/ScrollView/.test(metas), "la lista de ahorro permite llegar a todas las metas");

  for (const [ruta, patron, nombre] of [
    ["screens/SavingsList.tsx", /goals\.slice\(0, goalLimit\)/, "metas"],
    ["screens/Family.tsx", /visibles\.slice\(0, movementLimit\)/, "movimientos familiares"],
    ["screens/Cajas.tsx", /visibles\.slice\(0, movementLimit\)/, "movimientos de cajas"],
    ["screens/SharedBoxes.tsx", /visibles\.slice\(0, movementLimit\)/, "movimientos compartidos"],
  ]) {
    ok(patron.test(leer(ruta)), `${nombre} se cargan por grupos y no todos de golpe`);
  }

  for (const ruta of [
    "screens/Family.tsx",
    "screens/Cajas.tsx",
    "screens/SharedBoxes.tsx",
    "screens/Settings.tsx",
  ]) {
    ok(/automaticallyAdjustKeyboardInsets/.test(leer(ruta)), `${ruta} deja visibles sus campos con el teclado`);
  }
  for (const ruta of ["screens/CategoryBudgets.tsx", "screens/NuevaCategoria.tsx"]) {
    ok(/animatedPaddingStyle/.test(leer(ruta)), `${ruta} sube sus acciones junto con el teclado sin duplicar el espacio`);
  }
}

console.log("\n--- ANDROID, IOS Y TAMAÑOS EXTREMOS ---");
{
  const app = JSON.parse(leer("app.json")).expo;
  const agregar = leer("screens/AddChooser.tsx");
  const ajustes = leer("screens/Settings.tsx");
  const totales = leer("components/SpaceMovementControls.tsx");
  const recorte = leer("components/ImageCropper.tsx");
  const telegram = leer("app/telegram.tsx");
  const googleNativo = leer("utils/googleSignInNative.ts");
  const rutaVoz = leer("app/voice.tsx");
  ok(app.ios?.bundleIdentifier === app.android?.package, "iOS y Android identifican la misma aplicación");
  ok(app.ios?.supportsTablet === false, "iPad no se promete hasta probarlo de forma real");
  ok(app.plugins?.includes("./plugins/with-google-signin-android"), "Google nativo se configura solo donde existe la credencial");
  ok(/Platform\.OS === "android"/.test(agregar), "iOS no ofrece el escáner nativo de Android");
  ok((ajustes.match(/Platform\.OS === "android"/g) || []).length >= 2, "iOS no ofrece captura ni widget exclusivos de Android");
  ok(/useWindowDimensions/.test(totales) && /fontScale/.test(totales), "los totales se apilan si el ancho o la letra no alcanzan");
  ok(/useWindowDimensions/.test(recorte), "el recorte de imagen se adapta al ancho y al alto disponibles");
  ok(/insets\.bottom \+ 24/.test(telegram), "Telegram no queda debajo del indicador inferior del iPhone");
  ok(/getGoogleSignInNative/.test(googleNativo) && /require\("@react-native-google-signin/.test(googleNativo), "Expo Go no carga Google nativo antes de necesitarlo");
  ok(!/import VoiceEntry/.test(rutaVoz) && /require\("@\/screens\/VoiceEntry"\)/.test(rutaVoz), "Expo Go no carga el micrófono nativo al inspeccionar las rutas");
}

console.log("\n--- ACCESIBILIDAD BÁSICA ---");
{
  for (const ruta of [
    "components/BackButton.tsx",
    "components/ThemeToggleButton.tsx",
    "components/AuthField.tsx",
    "components/FAB.tsx",
    "components/Row.tsx",
  ]) {
    const texto = leer(ruta);
    ok(/accessibility(Label|Role)/.test(texto), `${ruta} comunica su función al lector de pantalla`);
  }
}

console.log(fallos ? `\n${fallos} protecciones responsivas faltan` : "\nTodo bien: protecciones Android + iOS completas");
process.exit(fallos ? 1 : 0);
