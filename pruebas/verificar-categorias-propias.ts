// CREAR CATEGORIAS PROPIAS
//
// Pedido el 03/08/2026: un boton "Nueva" en la cuadricula de categorias que
// abra una pantalla con icono, color y vista previa.
//
// Lo que de verdad hay que proteger no es la pantalla: es que una categoria
// creada por la persona se comporte EXACTAMENTE igual que una de fabrica en
// los 38 sitios donde se dibuja una categoria. Si en uno solo se ve como
// "Otros", eso se descubre meses despues y por casualidad.
import fs from "fs";
import path from "path";
import { catInfo, gastosDisponibles, ingresosDisponibles } from "@/constants/categories";
import { crear, borrar, editar, esPropia, nombreRepetido, setPropias, type CategoriaPropia } from "@/utils/categoriasPropias";

const RAIZ = process.cwd();

let fallos = 0;
function ok(c: boolean, m: string) {
  console.log(`  ${c ? "OK   " : "FALLA"} ${m}`);
  if (!c) fallos++;
}

console.log("\n--- SE CREA Y SE COMPORTA COMO UNA DE FABRICA ---");
{
  const { lista, creada } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  setPropias(lista);

  const c = catInfo(creada.id);
  ok(c.id === creada.id, "catInfo la encuentra");
  ok(c.label === "Broster", "con su nombre tal cual, sin traducir");
  ok(c.color === "orange", "y su color");
  ok(typeof c.icon === "function" || typeof c.icon === "object", "y un dibujo de verdad");

  // Aparece donde toca y NO donde no toca.
  ok(gastosDisponibles().some((x) => x.id === creada.id), "sale en la lista de gastos");
  ok(!ingresosDisponibles().some((x) => x.id === creada.id), "y NO en la de ingresos");
  setPropias([]);
}

console.log("\n--- EL ID NO PUEDE CHOCAR CON LOS DE LA APP ---");
{
  // Sin prefijo, quien cree una "Comida" tendria el mismo id que la de
  // fabrica y una de las dos desapareceria, llevandose la categoria de todos
  // sus movimientos anteriores.
  const { creada } = crear([], { nombre: "Comida", tipo: "expense", color: "green", icono: "Utensils" });
  ok(creada.id !== "comida", "una propia llamada Comida no pisa a la de fabrica");
  ok(esPropia(creada.id), "se reconoce como propia");
  ok(!esPropia("comida"), "y las de fabrica no");

  setPropias([creada]);
  ok(catInfo("comida").label === "category.comida", "la de fabrica sigue intacta");
  setPropias([]);
}

console.log("\n--- BORRARLA NO ROMPE SUS MOVIMIENTOS ---");
{
  // Un movimiento guarda el ID de su categoria. Si al borrarla el movimiento
  // se rompiera, se perderia un gasto — que es mucho peor que perder un
  // nombre.
  const { lista, creada } = crear([], { nombre: "Gaseosas", tipo: "expense", color: "sky", icono: "CupSoda" });
  setPropias(lista);
  setPropias(borrar(lista, creada.id));

  const huerfano = catInfo(creada.id);
  ok(huerfano.id === "otros", "cae en Otros en vez de romperse");
  ok(huerfano.label === "category.otros", "con nombre de verdad, no vacio");
  setPropias([]);
}

console.log("\n--- NO SE PERMITEN DOS IGUALES DEL MISMO TIPO ---");
{
  // Dos categorias llamadas igual en la misma lista no se pueden distinguir
  // al anotar: se elige una al azar y los totales quedan repartidos entre las
  // dos sin que nadie entienda por que.
  const { lista } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  ok(nombreRepetido(lista, "Broster", "expense"), "avisa del repetido");
  ok(nombreRepetido(lista, "  broster ", "expense"), "sin importar espacios ni mayusculas");
  ok(!nombreRepetido(lista, "Broster", "income"), "pero de gasto e ingreso si pueden llamarse igual");
  ok(!nombreRepetido(lista, "Pollo", "expense"), "y otro nombre pasa");
}

console.log("\n--- LO GUARDADO A MEDIAS NO ENTRA ---");
{
  // Los datos vienen del disco y de la nube. Una entrada rota no se ve al
  // guardarla: revienta despues, al dibujar una lista, en una pantalla que no
  // tiene nada que ver.
  setPropias([
    { id: "propia_ok", nombre: "Buena", tipo: "expense", color: "red", icono: "Tag" },
    { id: "sin_prefijo", nombre: "Mala", tipo: "expense", color: "red", icono: "Tag" },
    { id: "propia_x", nombre: "", tipo: "expense", color: "red", icono: "Tag" },
    { id: "propia_y", nombre: "Sin tipo", color: "red", icono: "Tag" } as unknown as CategoriaPropia,
    null as unknown as CategoriaPropia,
  ]);
  const quedan = gastosDisponibles().filter((c) => esPropia(c.id));
  ok(quedan.length === 1, `solo entra la buena (entraron ${quedan.length})`);
  setPropias([]);
}

console.log("\n--- EDITAR NO BORRA LO QUE NO SE TOCA ---");
{
  const { lista, creada } = crear([], { nombre: "Broster", tipo: "expense", color: "orange", icono: "Drumstick" });
  const despues = editar(lista, creada.id, { color: "red" })[0];
  ok(despues.color === "red", "cambia lo que se pide");
  ok(despues.nombre === "Broster", "y deja el nombre");
  ok(despues.icono === "Drumstick", "y el dibujo");
}

console.log("\n--- NI UN LOGO DE BANCO EN EL CATALOGO ---");
{
  // Una app de dinero mostrando el logo de un banco es lo que hace pensar
  // "esto tiene relacion con mi banco": el reclamo mas facil de recibir y el
  // mas dificil de defender. Se decidio con el usuario el 03/08/2026.
  const cat = fs.readFileSync(path.join(RAIZ, "constants/iconos.tsx"), "utf8");
  const prohibidas = ["paypal", "visa", "mastercard", "cc-", "stripe", "bitcoin", "btc", "amex", "discover", "bancomat"];
  const coladas = prohibidas.filter((p) => cat.includes('marca:' + p));
  ok(coladas.length === 0, `sin marcas financieras${coladas.length ? ": " + coladas.join(", ") : ""}`);

  // Y las que si estan, todas en un solo sitio: quitar una si alguien reclama
  // tiene que ser borrar una linea, no buscar por el proyecto.
  const otros = fs.readdirSync(path.join(RAIZ, "constants"))
    .filter((f) => f !== "iconos.tsx")
    .filter((f) => fs.readFileSync(path.join(RAIZ, "constants", f), "utf8").includes("marca:"));
  ok(otros.length === 0, `las marcas viven en un solo archivo${otros.length ? " (tambien en " + otros.join(", ") + ")" : ""}`);
}

console.log("\n--- Y LA APP DE VERDAD LO USA ---");
{
  // Un motor perfecto que ninguna pantalla llama no sirve de nada.
  const add = fs.readFileSync(path.join(RAIZ, "screens/AddSheet.tsx"), "utf8");
  ok(add.includes("gastosDisponibles"), "la pantalla de agregar usa las listas con las propias");
  ok(add.includes("/nueva-categoria"), "y tiene el boton para crear una");
  ok(add.includes("categoriaRecienCreada"), "y la deja elegida al volver");

  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(ctx.includes("savePropias"), "el contexto las guarda en disco");
  ok(ctx.includes("loadPropias"), "y las lee al arrancar");
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
