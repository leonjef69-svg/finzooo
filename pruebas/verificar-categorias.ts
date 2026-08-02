// Personalizar categorias: el recorte de la imagen y los cambios guardados.
import { cropRect } from "@/components/ImageCropper";
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
