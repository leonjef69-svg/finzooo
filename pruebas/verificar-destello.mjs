// EL DESTELLO BLANCO AL GUARDAR UN MOVIMIENTO (10/08/2026)
//
// Reportado con la app en modo oscuro: "al darle guardar aparece por un momento una pantalla
// blanca y luego me manda a Inicio".
//
// Al guardar, "Nuevo movimiento" se cierra saltandose el panel de elegir tipo —dos pantallas
// de una vez— y se cae a Inicio. En ese salto, lo que se ve un instante NO es Inicio: Inicio
// todavia no ha pintado. Lo que se ve son los fondos que React Navigation trae de fabrica, y
// esos son blancos.
//
// LAS PANTALLAS MODALES YA TENIAN SU FONDO ARREGLADO desde hace tiempo. Lo que faltaba era
// todo lo de DEBAJO, que son cuatro capas distintas. Y el destello vuelve en cuanto se
// destapa una sola, asi que las cuatro tienen que seguir puestas.
//
// ESTA PRUEBA MIRA EL CODIGO y no las cuentas, porque aqui no hay cuenta ninguna: es que no
// se olvide una capa. No se puede comprobar de otra forma sin un Android delante.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
// Los comentarios se quitan porque las explicaciones de arriba nombran justo lo que se busca,
// y la prueba pasaria sola leyendose a si misma.
const raiz = sinComentarios(fs.readFileSync(path.join(RAIZ, "app/_layout.tsx"), "utf8"));
const pestanas = sinComentarios(fs.readFileSync(path.join(RAIZ, "app/(tabs)/_layout.tsx"), "utf8"));

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- LAS CUATRO CAPAS QUE PODIAN VERSE BLANCAS ---");

// 1. EL TEMA. Pinta el hueco entre pantallas. De fabrica es blanco siempre, incluso con la
//    app en modo oscuro, porque nadie le habia dicho cual era el modo.
ok(/ThemeProvider/.test(raiz), "1. el tema de navegacion esta puesto");
ok(/DarkTheme/.test(raiz), "   y distingue el modo oscuro");
ok(/background:\s*screenBg/.test(raiz), "   con el fondo de la app, no el de fabrica");

// 2. EL FONDO POR DEFECTO DE LAS PANTALLAS que no declaran el suyo. Inicio es una de ellas,
//    y es justo a donde se cae al guardar.
ok(
  /screenOptions=\{\{[^}]*contentStyle:\s*\{\s*backgroundColor:\s*screenBg/.test(raiz),
  "2. las pantallas sin fondo propio heredan el del tema"
);

// 3. LA VENTANA DE ANDROID, por debajo de todo lo demas.
ok(/SystemUI\.setBackgroundColorAsync/.test(raiz), "3. la ventana de Android lleva el color del tema");

// 4. EL FONDO DE LAS PESTAÑAS, por debajo de lo que pinta cada pantalla.
ok(/sceneStyle:\s*\{\s*backgroundColor:/.test(pestanas), "4. las pestañas tienen fondo propio");

console.log("\n--- Y LO QUE YA ESTABA, QUE NO SE PUEDE PERDER ---");
{
  // Nuevo movimiento usa una ruta transparente, y el propio AddSheet dibuja el panel y el
  // fondo oscuro. Mantener ambas mitades evita la pantalla vacía entre navegación y dibujo.
  const inicioAlta = raiz.indexOf('name="transaction/new"');
  const finAlta = raiz.indexOf('name="transaction/[id]/edit"', inicioAlta);
  const alta = raiz.slice(inicioAlta, finAlta);
  ok(/presentation:\s*"transparentModal"/.test(alta), "nuevo movimiento conserva Inicio detrás del panel");
  ok(
    /contentStyle:\s*\{\s*backgroundColor:\s*"transparent"\s*\}/.test(alta),
    "la ruta no tapa el panel con un fondo opaco"
  );
  const add = sinComentarios(fs.readFileSync(path.join(RAIZ, "screens/AddSheet.tsx"), "utf8"));
  ok(
    /absolute inset-0 justify-end/.test(add) && /bg-slate-900\/45/.test(add),
    "el formulario dibuja su panel inferior y oscurece Inicio"
  );
  ok(
    /maxHeight:\s*keyboardVisible\s*\?\s*"90%"\s*:\s*"64%"/.test(add)
      && /rounded-t-\[28px\]/.test(add)
      && /h-1 w-10 self-center/.test(add)
      && /: "w-full overflow-hidden rounded-t-\[28px\]/.test(add)
      && /transaction \? \{ flex: 1, minHeight: 0 \} : \{ flexShrink: 1, minHeight: 0 \}/.test(add)
      && /transaction \? \{ minHeight: 0 \} : \{ flexGrow: 0, flexShrink: 1 \}/.test(add),
    "el panel inferior se ajusta a sus campos, elimina el hueco bajo Notas y crece si hace falta con el teclado"
  );
  ok(
    /onLayout=\{\(e\) => setDescriptionY\(e\.nativeEvent\.layout\.y\)\} className="min-w-0 flex-1"[\s\S]*?t\("addSheet\.description"\)[\s\S]*?className="min-w-0 flex-1"[\s\S]*?t\("detail\.method"\)/.test(add)
      && /t\("detail\.category"\)[\s\S]*?className="min-w-0 flex-1"[\s\S]*?t\("detail\.date"\)/.test(add),
    "Descripción/Método y Categoría/Fecha comparten filas con campos de igual ancho"
  );
  ok(
    !/showNotes|setShowNotes/.test(add)
      && /t\("addSheet\.notesOptional"\)[\s\S]*?value=\{notes\}[\s\S]*?placeholder=\{t\("addSheet\.notesPlaceholder"\)\}/.test(add),
    "Notas permanece visible, sin control para desplegarla"
  );
  ok(
    /COUNTRIES\.find\(\(country\) => country\.id === userCountry\)/.test(add)
      && /currencySymbolFor\(userCurrency\)\s*\}\s*·\s*\{userCurrency\}/.test(add)
      && !/accessibilityRole="button"[^>]*>\s*\{countryFlag\}/.test(add),
    "la bandera y moneda decorativas reflejan la configuración y no abren otra acción"
  );
  ok(
    add.indexOf('accessibilityLabel={t("common.save")}') >= 0
      && add.indexOf('accessibilityLabel={t("common.save")}') < add.indexOf("<Animated.View")
      && /onPress=\{\(\) => handleSave\(createMovement\(\)\)\}/.test(add)
      && /<Check size=\{19\} color="#ffffff"/.test(add)
      && !/<Text[^>]*>\{t\("common\.save"\)\}<\/Text>/.test(add)
      && !/<Text[^>]*>\{t\("common\.cancel"\)\}<\/Text>/.test(add),
    "Guardar es un botón de icono fijo en la cabecera, sin botones de texto abajo"
  );
  ok(
    /name="transaction\/\[id\]\/edit"\s+options=\{\{\s*presentation:\s*"modal",\s*contentStyle:\s*\{\s*backgroundColor:\s*screenBg\s*\}\s*\}\}/.test(raiz),
    "editar un movimiento conserva su pantalla completa"
  );
}

console.log("\n--- Y QUE EL CAMBIO A INICIO NO SE SIENTA COMO UN CORTE (10/08/2026) ---");
{
  // Quitado el destello, quedaba lo otro que dijo: "se siente muy brusco al pasar de la
  // pantalla de gasto a Inicio".
  //
  // El panel de elegir tipo se APILABA debajo de "Nuevo movimiento", asi que al guardar habia
  // que deshacer DOS pantallas de una vez (dismissTo) para caer en Inicio. Android no sabe
  // animar eso: las quita de golpe. Poniendo el panel EN SU LUGAR en vez de encima, solo queda
  // una hoja que cerrar y la baja el sistema con su animacion.
  const elegir = sinComentarios(fs.readFileSync(path.join(RAIZ, "app/transaction/choose.tsx"), "utf8"));
  const nuevo = sinComentarios(fs.readFileSync(path.join(RAIZ, "app/transaction/new.tsx"), "utf8"));
  const inicioElegir = raiz.indexOf('name="transaction/choose"');
  const finElegir = raiz.indexOf("/>", inicioElegir);
  const opcionesElegir = raiz.slice(inicioElegir, finElegir);

  ok(/presentation:\s*"transparentModal"/.test(opcionesElegir), "el selector conserva Inicio visible detrás del panel");
  ok(/animation:\s*"slide_from_bottom"/.test(opcionesElegir), "el selector del botón + entra desde abajo como una hoja");
  ok(/router\.replace\(`\/transaction\/new/.test(elegir), "el panel se cambia por la hoja, no se apila debajo");
  ok(!/router\.push\(/.test(elegir), "y no queda ningun push en el panel");
  ok(!/dismissTo/.test(nuevo), "guardar cierra UNA pantalla, sin deshacer dos de golpe");
}

console.log(fallos === 0 ? "\nTodo bien: ninguna capa se ve blanca" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);
