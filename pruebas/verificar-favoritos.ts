// LOS ÍCONOS FAVORITOS
//
// Pedido el 06/08/2026: una tercera pestaña, EN EL MEDIO entre Ícono y Color,
// con los dibujos que la persona marque. Son 236 en el catálogo, y quien usa
// siempre los mismos cinco no debería buscarlos entre todos cada vez.
//
// Lo que se comprueba aquí es lo que rompe una lista guardada en el disco: un
// repetido que sale dos veces en la cuadrícula, un valor raro de una versión
// anterior que la deja en blanco, y el tope que evita que los últimos queden
// fuera de la pantalla sin forma de llegar a ellos.
import fs from "fs";
import path from "path";
import { alternar, esFavorito, getFavoritos, MAX_FAVORITOS, setFavoritos } from "@/utils/iconosFavoritos";
import { enFilas, POR_FILA } from "@/constants/catalogoFilas";

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- MARCAR Y DESMARCAR ---");
{
  ok(alternar([], "Coffee").join() === "Coffee", "marcar uno lo añade");
  ok(alternar(["Coffee"], "Coffee").length === 0, "y volver a tocarlo lo quita");
  // El recién marcado va PRIMERO: el último que interesó es el que más
  // probablemente se vuelva a usar, y así no hay que buscarlo entre los viejos.
  ok(alternar(["Car", "Pizza"], "Coffee").join() === "Coffee,Car,Pizza", "el nuevo va primero");
  // Marcar dos veces el mismo no puede dejarlo repetido: saldría dos veces en la
  // cuadrícula y tocar uno de los dos no se sabría cuál es.
  ok(alternar(alternar([], "Coffee"), "Coffee").length === 0, "no se puede repetir marcando dos veces");
}

console.log("\n--- EL TOPE ---");
{
  // La pestaña no se desliza: con ochenta marcados, los últimos quedarían fuera
  // de la pantalla y sin forma de llegar a ellos.
  const muchos = Array.from({ length: MAX_FAVORITOS }, (_, i) => `icono${i}`);
  const conUnoMas = alternar(muchos, "elNuevo");
  ok(conUnoMas.length === MAX_FAVORITOS, `nunca pasa de ${MAX_FAVORITOS} (hay ${conUnoMas.length})`);
  ok(conUnoMas[0] === "elNuevo", "el nuevo entra");
  // Y se cae el MÁS VIEJO, no se rechaza el nuevo: un "no caben más" obligaría a
  // ir a borrar uno antes de poder guardar el que importa ahora.
  ok(!conUnoMas.includes(`icono${MAX_FAVORITOS - 1}`), "y sale el más viejo, no se niega a guardar");
}

console.log("\n--- LO QUE LLEGA DEL DISCO ---");
{
  // La lista llega de un archivo, y ahí pudo quedar cualquier cosa: una versión
  // anterior, una copia a medio escribir, o algo que no es un identificador. Un
  // valor raro no puede dejar la pestaña en blanco.
  setFavoritos(["Coffee", "Coffee", "", "Car"] as string[]);
  ok(getFavoritos().join() === "Coffee,Car", "se quitan repetidos y vacíos");

  setFavoritos([1, null, "Pizza", { a: 1 }] as unknown as string[]);
  ok(getFavoritos().join() === "Pizza", "y lo que no es texto se descarta, sin reventar");

  setFavoritos("no soy una lista" as unknown as string[]);
  ok(getFavoritos().length === 0, "si no es ni una lista, queda vacía");

  setFavoritos(Array.from({ length: 99 }, (_, i) => `x${i}`));
  ok(getFavoritos().length === MAX_FAVORITOS, "y el tope también se aplica a lo que venía guardado");

  setFavoritos(["Coffee"]);
  ok(esFavorito("Coffee"), "esFavorito reconoce el que está");
  ok(!esFavorito("Pizza"), "y no el que no está");
  setFavoritos([]);
}

console.log("\n--- SE VEN IGUAL QUE EL CATÁLOGO ---");
{
  // Los favoritos se dibujan con las MISMAS filas que el catálogo. Con dos
  // repartos distintos, saldrían de otro tamaño que los de al lado.
  const filas = enFilas(["a", "b", "c"]);
  ok(filas.length === 1, "tres dibujos caben en una fila");
  ok(filas[0].length === POR_FILA, `y la fila se rellena hasta ${POR_FILA}`);
  ok(filas[0][3] === null && filas[0][4] === null, "los huecos son espacio vacío, no dibujos");

  const seis = enFilas(["a", "b", "c", "d", "e", "f"]);
  ok(seis.length === 2, "seis dibujos son dos filas");
  ok(seis[1][0] === "f" && seis[1][1] === null, "y la segunda lleva el que sobra más huecos");

  ok(enFilas([]).length === 0, "sin favoritos no hay ninguna fila");
}

console.log("\n--- LA PANTALLA: LA PESTAÑA VA EN EL MEDIO ---");
{
  const pant = fs.readFileSync(path.join(process.cwd(), "screens/NuevaCategoria.tsx"), "utf8");
  // El usuario lo pidió así de explícito: "en el centro de icono y color".
  ok(
    /\["icono", "favoritos", "color"\]/.test(pant),
    "el orden de las pestañas es Ícono, Favoritos, Color"
  );

  // La estrella va junto a la vista previa, NO en cada casilla ni con toque
  // largo. En una casilla de 55 puntos la estrellita se toca sin querer al
  // elegir, y el toque largo ya se descartó en este proyecto por invisible.
  ok(/onPress=\{alternarFavorito\}/.test(pant), "hay una estrella que marca y desmarca");
  ok(!/onLongPress/.test(pant), "y no se usa el toque largo, que nadie descubre");

  // Con foto no hay estrella: un favorito es un ícono del catálogo, y una foto
  // propia no está en el catálogo — no habría a dónde volver.
  ok(/!foto && \(/.test(pant), "con una foto propia no se ofrece marcar favorito");

  // Una pestaña vacía sin explicación deja sin saber si está roto o falta algo.
  ok(pant.includes("nuevaCat.favVacio"), "la pestaña vacía dice qué hacer");

  // Y se guarda en el disco, o se perderían al cerrar la app.
  ok(/saveFavoritos\(/.test(pant), "marcar guarda en el celular");
  const ctx = fs.readFileSync(path.join(process.cwd(), "contexts/AppDataContext.tsx"), "utf8");
  ok(/loadFavoritos\(\)/.test(ctx), "y se leen al arrancar la app");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
