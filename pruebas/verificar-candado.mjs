// VER LO TUYO ES GRATIS. CREAR COSAS NUEVAS ES PREMIUM. (08/08/2026)
//
// EL PROBLEMA QUE ESTO ARREGLA, y por eso hay una prueba entera para vigilarlo:
//
// Alguien activa la prueba de 24 horas, crea su bodega, mete sus productos y anota las ventas
// de todo un dia. Al dia siguiente se acaba la prueba y NO PUEDE ABRIR SU PROPIA BODEGA. Y
// tampoco puede pagar para recuperarla, porque el cobro todavia no existe.
//
// Eso no se siente como "no tengo las funciones extra": se siente como que la app le secuestro
// su trabajo. Esa persona no paga, desinstala.
//
// LO QUE ESTA PRUEBA TIENE QUE VIGILAR SON LAS DOS MITADES, y una sola no sirve:
//
//   1. Que se pueda VER lo propio sin Premium. Si esto se rompe, vuelve el secuestro.
//   2. Que NO se pueda crear ni cambiar sin Premium. Si esto se rompe, Premium se regala.
//
// La segunda es la que se rompe sin que nadie lo note: un candado que deja pasar no da error.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

console.log("\n--- LAS TRES RESPUESTAS DEL CANDADO ---");
{
  const candado = leer("utils/candado.ts");

  // SON TRES Y NO DOS, y el tercero es el que se olvida: sin datos no hay nada que enseñar, asi
  // que dejar entrar seria una pantalla vacia en vez de la explicacion de para que sirve
  // Premium. Ahi el candado hace su trabajo —vender— y no le quita nada a nadie.
  ok(/"abierto" \| "soloLectura" \| "cerrado"/.test(candado), "hay tres respuestas: abierto, solo lectura y cerrado");
  ok(/if \(esPremium\) return "abierto"/.test(candado), "con Premium, todo");
  ok(/tieneDatos \? "soloLectura" : "cerrado"/.test(candado), "sin Premium: se mira si hay datos que enseñar");

  // puedeTocar EXISTE PARA NO COMPARAR TEXTOS EN CADA BOTON. Las pantallas preguntan esto
  // decenas de veces, y ahi es donde se cuela un "!== cerrado" donde iba un "=== abierto" — y
  // con eso alguien sin Premium podria registrar ventas.
  ok(/return estado === "abierto"/.test(candado), "y tocar algo exige Premium, no solo 'no estar cerrado'");
}

console.log("\n--- SE PUEDE VER LO PROPIO SIN PREMIUM ---");
{
  // Las tres pantallas donde la persona CREA datos suyos. Las demas funciones Premium
  // —importar, exportar, la exportacion automatica, el bloqueo y el panorama— son acciones, no
  // datos guardados: ahi no hay nada de nadie que se quede encerrado, y siguen cerradas enteras.
  for (const [ruta, nombre] of [
    ["app/negocio/[id].tsx", "el panel del negocio"],
    ["app/savings/index.tsx", "las metas de ahorro"],
    ["app/category-budgets.tsx", "los limites por categoria"],
  ]) {
    const txt = leer(ruta);
    ok(/candadoPremium\(isPremium, /.test(txt), `${nombre} usa el candado de tres respuestas`);
    // Y EL CANDADO SOLO SE CIERRA SI NO HAY NADA. Si esta linea vuelve a ser "if (!isPremium)",
    // volvimos al secuestro.
    ok(/estado === "cerrado"/.test(txt), `y ${nombre} solo se cierra si no hay datos`);
    ok(!/if \(!isPremium\)/.test(txt), `y ya no echa a nadie de ${nombre} por no tener Premium`);
    ok(/soloLectura=\{!puedeTocar\(estado\)\}/.test(txt), `y avisa a la pantalla de que es solo lectura`);
  }
}

console.log("\n--- Y NO SE PUEDE CREAR NI CAMBIAR NADA ---");
{
  // La mitad que se rompe en silencio. Un candado que deja pasar no da error: solo regala.
  const panel = leer("screens/PanelNegocio.tsx");
  ok(/soloLectura \? null : usaVentas \?/.test(panel), "sin Premium no sale el boton grande de registrar");
  ok(/usaVentas && !soloLectura/.test(panel), "ni los de gasto y productos");
  ok(/!usaVentas && !soloLectura/.test(panel), "ni el enlace gris de registrar una venta");
  ok(/if \(soloLectura\) return;/.test(panel), "y el interruptor de los yapeos no cambia nada");
  ok(/\) : soloLectura \? null : \(/.test(panel), "y no se puede borrar del historial");

  const metas = leer("screens/SavingsList.tsx");
  ok(/tab === "metas" && !soloLectura/.test(metas), "no se crea una meta nueva");
  ok(/libre > 0 && !soloLectura/.test(metas), "ni se mueve plata a una meta");

  const limites = leer("screens/CategoryBudgets.tsx");
  // AQUI EL PORTERO ESTA DENTRO DE LA FUNCION, no solo en el boton: esconder no es impedir, y
  // el dato se protege en el sitio donde se escribe.
  ok(/if \(soloLectura\) return;/.test(limites), "y guardar un limite no hace nada en solo lectura");
  ok(/editable=\{!soloLectura\}/.test(limites), "ni se puede escribir en la casilla");
  ok(/\{!soloLectura && \(/.test(limites), "y el boton de guardar no esta");
}

console.log("\n--- Y SE DICE POR QUE, QUE ES LO QUE LO SEPARA DE UN FALLO ---");
{
  // Sin el aviso, esto no es una limitacion: es una app rota. Alguien entra a su negocio, no ve
  // los botones, y lo unico que puede pensar es que se estropeo. La diferencia entre una
  // limitacion y un fallo es que la limitacion SE DICE — la misma leccion de la pantalla de
  // exportar y de la del Modo Negocio.
  const aviso = leer("components/AvisoSoloLectura.tsx");
  ok(/candado\.soloVerTitulo/.test(aviso), "hay un aviso que lo explica");
  // Y LLEVA LA SALIDA AL LADO: un aviso que dice lo que no se puede hacer y no dice como
  // arreglarlo deja a la persona igual de atascada, solo que informada.
  ok(/router\.push\("\/premium"\)/.test(aviso), "y lleva a Premium desde ahi mismo");

  for (const [ruta, nombre] of [
    ["screens/PanelNegocio.tsx", "el panel"],
    ["screens/SavingsList.tsx", "las metas"],
    ["screens/CategoryBudgets.tsx", "los limites"],
  ]) {
    ok(/soloLectura && <AvisoSoloLectura \/>/.test(leer(ruta)), `${nombre} lo enseña`);
  }

  // Y EL TEXTO TIENE QUE DECIR QUE NO SE PIERDE NADA. Es lo primero que piensa quien ve un
  // candado encima de sus datos, y callarlo deja el susto puesto.
  const i18n = leer("constants/i18n.ts");
  ok(/no se pierde/.test(i18n), "y dice que lo guardado no se pierde");
  for (const clave of ["soloVerTitulo", "soloVerTexto", "verPremium"]) {
    const veces = (i18n.match(new RegExp(`"candado\\.${clave}":`, "g")) ?? []).length;
    ok(veces === 3, `"candado.${clave}" esta en los tres idiomas (${veces})`);
  }
}

console.log(fallos === 0 ? "\nTodo bien: nadie se queda fuera de lo suyo\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
