// Personalizar categorias: el recorte de la imagen y los cambios guardados.
import fs from "fs";
import path from "path";
import { cropRect, limitarPan, limitarZoom } from "@/components/ImageCropper";
import { applyChange, sanitizeName, type CategoryOverrides } from "@/utils/categoryCustom";

let fallos = 0;
function ok(c: boolean, m: string) { console.log(`  ${c ? "OK   " : "FALLA"} ${m}`); if (!c) fallos++; }

console.log("\n--- EL RECORTE CAE DONDE SE VE ---");
{
  // Una foto de celular tipica: 3000x4000, vertical. La ventana son 240.
  const r = cropRect(3000, 4000, 1, 0, 0);
  ok(r.width === r.height, `el recorte es cuadrado (${r.width}x${r.height})`);
  ok(r.width === 3000, "sin zoom se toma el lado corto entero, que es lo que llena la ventana");
  ok(r.originX === 0, "y en horizontal no sobra nada, asi que empieza en el borde");
  ok(r.originY === 500, "en vertical se centra: sobran 1000 y se quitan 500 por arriba");
}
{
  // Con zoom se recorta MENOS imagen, no mas: se esta acercando.
  const sinZoom = cropRect(3000, 4000, 1, 0, 0);
  const conZoom = cropRect(3000, 4000, 2, 0, 0);
  ok(conZoom.width < sinZoom.width, `al acercar se recorta menos (${conZoom.width} < ${sinZoom.width})`);
  ok(conZoom.width === 1500, "al doble de zoom, la mitad de imagen");
}
{
  // Arrastrar mueve el recorte al lado contrario: si la imagen va a la
  // derecha, lo que se ve es la parte izquierda.
  const centro = cropRect(3000, 4000, 2, 0, 0);
  const movida = cropRect(3000, 4000, 2, 60, 0);
  ok(movida.originX < centro.originX, "arrastrando a la derecha se ve la parte de la izquierda");
}

console.log("\n--- EL RECORTE NUNCA SE SALE DE LA IMAGEN ---");
{
  // Pedir un recorte fuera de la imagen hace fallar la operacion ENTERA, y
  // entonces no se recorta nada y parece que la app no hizo caso.
  let bien = true;
  for (const [w, h] of [[3000, 4000], [4000, 3000], [1000, 1000], [200, 5000]]) {
    for (const zoom of [1, 1.5, 2, 2.5, 3]) {
      for (const pan of [-9999, -300, 0, 300, 9999]) {
        const r = cropRect(w, h, zoom, pan, pan);
        if (r.originX < 0 || r.originY < 0) bien = false;
        if (r.originX + r.width > w + 1) bien = false;
        if (r.originY + r.height > h + 1) bien = false;
        if (r.width <= 0 || r.height <= 0) bien = false;
      }
    }
  }
  ok(bien, "con cualquier foto, zoom y arrastre —incluso arrastrando fuera de la pantalla— el recorte cae dentro");
}
{
  // Una imagen mas pequena que la ventana no puede pedir mas pixeles de los
  // que tiene.
  const r = cropRect(100, 80, 1, 0, 0);
  ok(r.width <= 100 && r.height <= 80, `una imagen chica no pide de mas (${r.width}x${r.height})`);
}

console.log("\n--- LO QUE SE VE EN EL MARCO ES LO QUE SE GUARDA ---");
{
  // Reportado el 05/08/2026: "que se aparezca el espacio de todo lo que
  // aparecera en el icono y se pueda acortar, meterle zoom".
  //
  // Al mirarlo salio un fallo de fondo: el ARRASTRE de la pantalla no tenia
  // tope, pero el RECORTE si. Arrastrando de mas se veia la imagen corrida
  // —hasta con un borde vacio— y al guardar salia otra cosa, porque el recorte
  // se habia topado por su cuenta. La promesa del marco es "lo que ves es lo
  // que se guarda", y solo se cumple si los dos usan el MISMO tope.
  let iguales = true;
  for (const [w, h] of [
    [3000, 4000],
    [4000, 3000],
    [1000, 1000],
    [200, 5000],
  ]) {
    for (const zoom of [1, 1.25, 2, 3, 4]) {
      for (const pan of [-9999, -300, -40, 0, 40, 300, 9999]) {
        const topado = limitarPan(w, h, zoom, pan, pan);
        // Recortar con el arrastre topado y con el sin topar tiene que dar lo
        // mismo: es lo que demuestra que el recorte respeta el mismo limite.
        const conTope = cropRect(w, h, zoom, topado.x, topado.y);
        const sinTope = cropRect(w, h, zoom, pan, pan);
        if (JSON.stringify(conTope) !== JSON.stringify(sinTope)) iguales = false;
      }
    }
  }
  ok(iguales, "el arrastre topado y el recorte llegan al mismo sitio, con cualquier foto y zoom");

  // Y esta es la que vigila el fallo de verdad. La de arriba no lo habria
  // cazado: cropRect YA topaba por su cuenta, asi que consigo mismo siempre
  // cuadraba. Lo que no topaba era la PANTALLA, y eso solo se ve mirando que el
  // arrastre pase por el mismo limitador.
  const cropper = fs.readFileSync(path.join(process.cwd(), "components/ImageCropper.tsx"), "utf8");

  // Esto miraba "setPan(limitarPan(" hasta el 13/08/2026, cuando el arrastre dejo de pasar por
  // un estado de React para no hacer temblar la imagen. La forma cambio; lo que se vigila, no:
  // que la posicion que se pinta salga SIEMPRE del limitador, y nunca del dedo en crudo.
  const moviendo = cropper.slice(
    cropper.indexOf("onPanResponderMove"),
    cropper.indexOf("onPanResponderRelease")
  );
  ok(/limitarPan\(/.test(moviendo), "el arrastre de la pantalla pasa por el tope");
  ok(
    !/colocar\(\s*gesto\.pan\.x/.test(moviendo) && !/colocar\(g\.dx/.test(moviendo),
    "y ya no se mueve libre como antes"
  );
}

console.log("\n--- LAS MEDIDAS Y LOS PIXELES SALEN DEL MISMO SITIO ---");
{
  // Reportado con fotos el 05/08/2026: en el marco entraba la taza entera y en
  // el icono salia un pedazo del borde, ampliado.
  //
  // La causa: se medía con Image.getSize y se recortaba con el manipulador de
  // imagenes, y en una foto de camara los dos NO coinciden — el archivo suele
  // guardarse tumbado con una marca de "girame al mostrar". Se pedia el recorte
  // en un sistema de medidas y se aplicaba en otro: se salia de la imagen,
  // quedaba la parte que cabia, y al agrandarla a 256 salia un trozo ampliado.
  //
  // Estas son comprobaciones de texto y no de calculo a proposito: el fallo NO
  // estaba en las cuentas —cropRect siempre estuvo bien— sino en de donde venian
  // los numeros. Eso no se puede pillar con una cuenta.
  const cropper = fs.readFileSync(path.join(process.cwd(), "components/ImageCropper.tsx"), "utf8");
  const codigo = cropper.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  ok(!/Image\.getSize/.test(codigo), "ya no se mide con Image.getSize, que no ve la rotacion");
  ok(/manipulate\(uri\)\.renderAsync\(\)/.test(codigo), "se pasa la imagen por el manipulador al abrir");
  ok(/setFuente\(\{ uri: normal\.uri/.test(codigo), "y se trabaja con esa copia");

  // Las tres tienen que apuntar a la copia. Si una sola apunta al original,
  // vuelve el desajuste: enseñar una cosa y recortar otra.
  ok(/source=\{\{ uri: fuente\.uri \}\}/.test(codigo), "se ENSEÑA la copia");
  ok(/manipulate\(fuente\.uri\)/.test(codigo), "se RECORTA la copia");
  ok(/cropRect\(fuente\.w, fuente\.h/.test(codigo), "y se MIDE la copia");
  // El original solo se usa para HACER la copia, en ningun otro sitio. Se cuenta
  // el nombre suelto —ni "fuente.uri" ni "uri:" cuentan—: son el prop, la
  // llamada al manipulador y la dependencia del efecto, y nada mas.
  const usosDelOriginal = [...codigo.matchAll(/(?<![.\w])uri\b(?!\s*:)/g)].length;
  ok(
    usosDelOriginal === 3,
    `el archivo original solo se usa para hacer la copia (${usosDelOriginal} usos, se esperan 3)`
  );
}

console.log("\n--- EL MARCO TIENE LA FORMA DEL ICONO ---");
{
  // Era un circulo, heredado de cuando las categorias se dibujaban redondas.
  // Son cuadrados de esquinas redondeadas desde el 03/08/2026, asi que el marco
  // ensenaba una forma y el resultado salia en otra: encuadrabas una cara en un
  // circulo y en la lista aparecia con las esquinas puestas. Lo pidio el usuario
  // el 05/08/2026: "que se aparezca el espacio de todo lo que aparecera".
  const cropper = fs.readFileSync(path.join(process.cwd(), "components/ImageCropper.tsx"), "utf8");
  ok(!/borderRadius: VENTANA \/ 2/.test(cropper), "el marco ya no es un circulo");
  ok(/borderRadius: VENTANA \* REDONDEO/.test(cropper), "sino la forma de la casilla");
  // La proporcion sale de las casillas reales: 16 de redondeo en una de ~55, y
  // 24 en la vista previa de 80. Si se va lejos de eso, deja de ser un anticipo.
  const redondeo = Number(/const REDONDEO = ([\d.]+)/.exec(cropper)?.[1] ?? "0");
  ok(redondeo >= 0.2 && redondeo <= 0.4, `el redondeo (${redondeo}) es el de las casillas`);

  // Y la pinza de dos dedos, que es la otra mitad del pedido.
  ok(/nativeEvent\.touches/.test(cropper), "se miran los dos dedos");
  ok(/Math\.hypot/.test(cropper), "se mide cuanto se separan");
  // Al cambiar el numero de dedos hay que volver a tomar la referencia, o la
  // imagen salta justo al apoyar o levantar el segundo dedo.
  ok(/dedos\.length !== gesto\.dedos/.test(cropper), "y la imagen no salta al apoyar o levantar un dedo");
  // Los botones siguen: con una mano ocupada no se puede pellizcar.
  ok(/cambiarZoom\(/.test(cropper), "y quedan los botones para quien no pueda pellizcar");
}
{
  // El tope no puede dejar hueco: con la imagen dentro del marco, moverse hasta
  // el limite tiene que seguir cubriendolo entero.
  const { x, y } = limitarPan(3000, 4000, 1, 9999, 9999);
  ok(x === 0, "sin zoom no se puede mover a lo ancho: el lado corto llena el marco justo");
  ok(y > 0, "pero si a lo alto, que es donde sobra imagen");

  const cerca = limitarPan(3000, 4000, 2, 9999, 9999);
  ok(cerca.x > 0, "y al acercar ya se puede mover en las dos direcciones");
  ok(cerca.y > y, "con mas recorrido que antes, porque hay mas imagen fuera del marco");
}
{
  // El zoom se topa por los dos lados. Sin tope por abajo, alejando se dejaria
  // un borde vacio; sin tope por arriba, se pediria un recorte de pocos pixeles
  // que al agrandarlo a 256 sale como una mancha.
  ok(limitarZoom(0.2) === 1, "no se puede alejar mas alla de llenar el marco");
  ok(limitarZoom(99) === 4, "ni acercar mas de 4x");
  ok(limitarZoom(2.5) === 2.5, "y en medio se respeta lo que se pida");
  // La pinza divide una separacion por otra: si los dos dedos caen en el mismo
  // punto sale una division por cero, y un NaN de zoom borra la imagen.
  ok(limitarZoom(NaN) === 1, "y una cuenta imposible no rompe la pantalla");
}

console.log("\n--- LOS CAMBIOS DE UNA CATEGORIA ---");
{
  let o: CategoryOverrides = {};
  o = applyChange(o, "comida", { name: "Almuerzos" });
  ok(o.comida?.name === "Almuerzos", "se guarda el nombre");
  o = applyChange(o, "comida", { color: "sky" });
  ok(o.comida?.name === "Almuerzos" && o.comida?.color === "sky", "poner el color NO borra el nombre");
  o = applyChange(o, "comida", { image: "data:image/jpeg;base64,AAA" });
  ok(!!o.comida?.image, "y la imagen se suma a los otros dos");
}
{
  // Quitar SOLO la imagen. Sin la diferencia entre "no lo toques" y "quitalo",
  // no habria forma de hacerlo sin perder el nombre y el color.
  let o: CategoryOverrides = { comida: { name: "Almuerzos", color: "sky", image: "x" } };
  o = applyChange(o, "comida", { image: null });
  ok(!o.comida?.image, "la imagen se va");
  ok(o.comida?.name === "Almuerzos" && o.comida?.color === "sky", "y el nombre y el color se quedan");
}
{
  // Volver a lo de fabrica deja la tabla limpia, sin cascarones vacios que
  // haya que ir saltando al leer.
  let o: CategoryOverrides = { comida: { name: "Almuerzos", color: "sky" } };
  o = applyChange(o, "comida", { name: null, color: null, image: null });
  ok(!("comida" in o), "sin ningun cambio, la categoria desaparece de la tabla");
  ok(Object.keys(o).length === 0, "y la tabla queda vacia de verdad");
}
{
  // Un cambio no puede pisar a las demas categorias.
  let o: CategoryOverrides = { comida: { name: "Almuerzos" }, transporte: { color: "red" } };
  o = applyChange(o, "comida", { color: "lime" });
  ok(o.transporte?.color === "red", "cambiar Comida no toca Transporte");
}

console.log("\n--- EL NOMBRE ---");
ok(sanitizeName("  Almuerzos  ") === "Almuerzos", "se recortan los espacios de los extremos");
ok(sanitizeName("Comida   del   mes") === "Comida del mes", "los espacios de dentro se juntan en uno");
ok(sanitizeName("x".repeat(60)).length === 24, "se corta a 24: mas largo no cabe bajo el icono");
ok(sanitizeName("   ") === "", "solo espacios se queda en nada, y entonces vuelve el nombre de la app");

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
