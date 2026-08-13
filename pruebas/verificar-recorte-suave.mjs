// LA IMAGEN TEMBLABA AL ARRASTRARLA (13/08/2026)
//
// Palabras suyas: *"por que no puedo mover la imagen libremente lo muevo y sale como temblores"*.
// Pantalla de recortar la foto de una categoria.
//
// EL MOTIVO. La posicion y el zoom vivian en useState, y se cambiaban en cada milimetro de dedo.
// Cada cambio de estado redibuja la pantalla ENTERA en el hilo de JavaScript —sesenta veces por
// segundo, con la imagen dentro—, y eso no da abasto: se ve a tirones.
//
// AHORA la imagen se mueve por su cuenta, sin pasar por React, con valores compartidos. El unico
// estado que queda es el del texto "1.0x", y solo se toca cuando ese numero cambia de verdad.
//
// LO QUE MAS SE VIGILA AQUI NO ES LA SUAVIDAD, sino que las cuentas sigan siendo las mismas. Lo
// que se ve en el marco y lo que se guarda salen de dos cuentas distintas que tienen que dar
// identico; si se separan, el recorte cae donde no se ve — y eso no se nota hasta despues de
// guardar, mirando una foto mal encuadrada que ya no se puede deshacer.
import fs from "fs";
import path from "path";

const RAIZ = process.cwd();
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
const sinComentarios = (f) =>
  leer(f).replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

let fallos = 0;
function ok(c, m) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

const RECORTE = "components/ImageCropper.tsx";
const codigo = sinComentarios(RECORTE);

console.log("\n--- ARRASTRAR YA NO REDIBUJA LA PANTALLA ---");
{
  ok(/useSharedValue\(0\)/.test(codigo), "la posicion va en valores compartidos");
  ok(/useAnimatedStyle/.test(codigo), "y la imagen se coloca desde ahi");
  ok(/Animated\.Image/.test(codigo), "con una imagen que sabe moverse sola");

  // NI UN setState EN EL CAMINO DEL DEDO. Es la comprobacion que importa: basta con que alguien
  // vuelva a poner uno "para que se vea el zoom" y el temblor esta de vuelta entero.
  const arrastre = codigo.slice(
    codigo.indexOf("onPanResponderMove"),
    codigo.indexOf("onPanResponderRelease")
  );
  ok(arrastre.length > 0, "se encuentra el manejador del arrastre");
  ok(!/setPan\(|setZoom\(/.test(arrastre), "y no cambia ningun estado de React mientras se mueve");
}

console.log("\n--- Y LAS CUENTAS SIGUEN SIENDO LAS MISMAS ---");
{
  // El recorte se topa con limitarPan, igual que el arrastre. Si el arrastre dejara mover mas
  // alla de donde el recorte puede llegar, lo que se ve y lo que se guarda dejarian de coincidir.
  ok(/limitarPan\(/.test(codigo), "el arrastre se sigue topando con limitarPan");
  ok(
    /cropRect\(fuente\.w, fuente\.h, zoomRef\.current, panRef\.current\.x, panRef\.current\.y\)/.test(codigo),
    "y lo que se guarda se lee de las referencias, no de un estado que va con retraso"
  );

  // LA MISMA FORMULA EN LOS DOS SITIOS. Se compara letra por letra lo que mueve la imagen con lo
  // que se usaba antes: es la unica forma de saber que el paso a valores compartidos no cambio
  // el encuadre por el camino.
  ok(
    /transform: \[\s*\{ translateX: panSV\.x\.value - \(anchoReal \* escala - VENTANA\) \/ 2 \}/.test(codigo),
    "la imagen se coloca con la formula de siempre"
  );
}

console.log("\n--- EL TEXTO DEL ZOOM NO VUELVE A ROMPERLO ---");
{
  // Es la puerta de atras por la que esto se estropea: alguien quiere que "1.0x" siga al dedo,
  // pone un setZoom por movimiento y devuelve el temblor sin tocar nada del arrastre.
  ok(
    /Math\.round\(nuevoZoom \* 10\) !== Math\.round\(zoom \* 10\)/.test(codigo),
    "el texto solo se actualiza cuando el numero cambia de verdad"
  );
}

console.log(fallos === 0 ? "\nTodo bien: la imagen se mueve sin temblar" : `\n${fallos} fallas`);
process.exit(fallos ? 1 : 0);
