// Comprueba que el panorama del mes sale de datos REALES y que sus cifras
//
// NOTA: aqui habia tambien las pruebas de la linea de tendencia (el
// componente Sparkline). Se quitaron cuando ese componente desaparecio de
// la app: probaban codigo que ya no existe. Lo que queda son las cuentas de
// Reportes, que siguen siendo las mismas que se ensenan en pantalla.
// coinciden con las que ya enseña Inicio.
//
// Es la peticion literal: "que todos los datos esten conectados, datos reales
// de la app, no suponer, no inventar". Asi que lo que se comprueba aqui no es
// solo que las cuentas den bien, sino que NO se inventa nada cuando faltan
// datos: sin presupuesto no se opina sobre la salud, y sin mes anterior no se
// enseña ningun porcentaje.
import {
  availableBalance,
  budgetLeft,
  budgetUsed,
  changeVsPrevious,
  dailyTotals,
  daysInMonthOf,
  health,
  previousMonthKey,
  totalsForMonth,
  visibleRange,
} from "@/utils/finances";

let fallos = 0;
function ok(cond: boolean, msg: string) {
  console.log(`  ${cond ? "OK   " : "FALLA"} ${msg}`);
  if (!cond) fallos++;
}

type Tx = { date: string; type: "expense" | "income"; amount: number };

console.log("\n--- EL DISPONIBLE ES EL MISMO QUE EN INICIO ---");
{
  // Esta es la formula que Inicio tenia escrita a mano antes de moverla a
  // utils/finances.ts. Se deja aqui copiada A PROPOSITO: si alguien cambia la
  // funcion sin querer, esta prueba lo delata.
  const comoLoHaciaInicio = (b: number, p: number, i: number, s: number) => b + p + i - s;

  const casos = [
    { budget: 500, prevBalance: 0, income: 200, spent: 300 },
    { budget: 500, prevBalance: 120, income: 200, spent: 300 },   // con arrastre
    { budget: 0, prevBalance: 0, income: 800, spent: 250 },        // sin presupuesto
    { budget: 300, prevBalance: -80, income: 0, spent: 500 },      // arrastre negativo
    { budget: 1000, prevBalance: 0, income: 0, spent: 0 },         // mes recien empezado
  ];
  for (const c of casos) {
    const mio = availableBalance(c);
    const suyo = comoLoHaciaInicio(c.budget, c.prevBalance, c.income, c.spent);
    ok(mio === suyo, `presupuesto ${c.budget}, arrastre ${c.prevBalance} -> ${mio}`);
  }
}
{
  // El arrastre NO se puede olvidar. Es el error facil: usar el autoSavings
  // del contexto (budget + income - spent), que no lo incluye. Con arrastre,
  // Reportes e Inicio darian numeros distintos del mismo mes.
  const c = { budget: 500, prevBalance: 120, income: 200, spent: 300 };
  const sinArrastre = c.budget + c.income - c.spent;
  ok(availableBalance(c) !== sinArrastre, "el arrastre cuenta: no se usa la formula que lo ignora");
  ok(availableBalance(c) === 520, "500 + 120 + 200 - 300 = 520");
}

console.log("\n--- EL PRESUPUESTO UTILIZADO ---");
{
  const c = { budget: 500, prevBalance: 0, income: 200, spent: 300 };
  ok(Math.round(budgetUsed(c) * 100) === 60, "300 de 500 es el 60%");
  ok(budgetLeft(c) === 200, "quedan 200 por gastar");
}
{
  // Pasarse del presupuesto tiene que poder decirse, no taparse.
  const c = { budget: 500, prevBalance: 0, income: 0, spent: 650 };
  ok(budgetLeft(c) === -150, "pasado de presupuesto, el restante es negativo (-150)");
  ok(budgetUsed(c) > 1, "y el porcentaje pasa del 100%");
  ok(Math.min(100, Math.round(budgetUsed(c) * 100)) === 100, "pero la barra se topa en 100 y no se sale del recuadro");
}
{
  // Sin presupuesto no se divide entre cero ni se inventa un 0%.
  const c = { budget: 0, prevBalance: 0, income: 500, spent: 200 };
  ok(budgetUsed(c) === 0, "sin presupuesto, el uso es 0 y no un infinito");
  ok(budgetLeft(c) === 0, "y no quedan 'menos 200' de un presupuesto que no existe");
}

console.log("\n--- LA SALUD NO SE OPINA SIN DATOS ---");
{
  ok(health({ budget: 0, prevBalance: 0, income: 0, spent: 0 }) === "unknown",
    "sin presupuesto NO se dice que la salud sea buena: no hay contra que medir");
  ok(health({ budget: 500, prevBalance: 0, income: 0, spent: 300 }) === "good", "600 de 1000 gastado -> buena");
  ok(health({ budget: 500, prevBalance: 0, income: 0, spent: 440 }) === "tight", "al 88% -> vas justo");
  ok(health({ budget: 500, prevBalance: 0, income: 0, spent: 501 }) === "over", "pasado -> te pasaste");
  ok(health({ budget: 500, prevBalance: 0, income: 0, spent: 500 }) === "tight",
    "justo en el 100% todavia no es 'te pasaste'");
}

console.log("\n--- EL PORCENTAJE CONTRA EL MES PASADO ---");
{
  ok(changeVsPrevious(300, 200) === 0.5, "de 200 a 300 es +50%");
  ok(changeVsPrevious(150, 300) === -0.5, "de 300 a 150 es -50%");
  ok(changeVsPrevious(200, 200) === 0, "igual que el mes pasado es 0%");
  // Lo importante: NO inventar una comparacion que no existe.
  ok(changeVsPrevious(300, 0) === null, "de 0 a 300 no es '+100%': no hay comparacion posible");
  ok(changeVsPrevious(0, 0) === null, "de 0 a 0 tampoco");
}

console.log("\n--- LOS TOTALES SALEN DE LOS MOVIMIENTOS ---");
{
  const txs: Tx[] = [
    { date: "2026-07-03", type: "expense", amount: 100 },
    { date: "2026-07-15", type: "expense", amount: 50 },
    { date: "2026-07-20", type: "income", amount: 800 },
    { date: "2026-06-30", type: "expense", amount: 999 }, // otro mes
    { date: "2026-08-01", type: "income", amount: 999 },  // otro mes
  ];
  const julio = totalsForMonth(txs, "2026-07");
  ok(julio.spent === 150, "julio gasta 150, sin colarse junio ni agosto");
  ok(julio.income === 800, "julio ingresa 800");
  const junio = totalsForMonth(txs, "2026-06");
  ok(junio.spent === 999 && junio.income === 0, "junio se lee aparte y correctamente");
}

console.log("\n--- EL MES ANTERIOR ---");
{
  ok(previousMonthKey("2026-07") === "2026-06", "julio -> junio");
  ok(previousMonthKey("2026-01") === "2025-12", "enero -> diciembre del ano anterior");
  ok(previousMonthKey("2026-03") === "2026-02", "marzo -> febrero");
}
{
  ok(daysInMonthOf("2026-02") === 28, "febrero de 2026 tiene 28 dias");
  ok(daysInMonthOf("2024-02") === 29, "febrero de 2024 (bisiesto) tiene 29");
  ok(daysInMonthOf("2026-07") === 31, "julio tiene 31");
  ok(daysInMonthOf("2026-04") === 30, "abril tiene 30");
}

console.log("\n--- LA CUENTA QUE SE ENSENA TIENE QUE CERRAR ---");
{
  // Este era el fallo que se vio en pantalla: se ensenaban presupuesto,
  // gastos, ingresos y disponible, y NO sumaban entre si porque faltaba el
  // arrastre. 100 - 50 + 3 da 53, pero abajo ponia 284. Cuatro numeros
  // correctos que no cuadran a la vista se leen como inventados.
  const caso = { budget: 100, prevBalance: 231, income: 3, spent: 50 };

  // Lo que se enseñaba antes (sin el arrastre) NO cerraba.
  const sinArrastre = caso.budget + caso.income - caso.spent;
  ok(sinArrastre !== availableBalance(caso), `sin el arrastre la cuenta daba ${sinArrastre} y abajo ponia 284`);

  // Lo que se enseña ahora SI cierra.
  const lineas = [caso.prevBalance, caso.budget, caso.income, -caso.spent];
  const suma = lineas.reduce((a, b) => a + b, 0);
  ok(suma === availableBalance(caso), `las lineas suman ${suma} y el total es ${availableBalance(caso)}`);
  ok(suma === 284, "y da los 284 que se ven en la pantalla");
}
{
  // Tiene que cerrar SIEMPRE, no solo en ese caso.
  const casos = [
    { budget: 500, prevBalance: 0, income: 200, spent: 300 },
    { budget: 0, prevBalance: 0, income: 800, spent: 250 },
    { budget: 300, prevBalance: -80, income: 0, spent: 500 },
    { budget: 100, prevBalance: 231, income: 3, spent: 50 },
    { budget: 1200, prevBalance: 45.5, income: 33.33, spent: 999.99 },
  ];
  let todas = true;
  for (const c of casos) {
    const suma = c.prevBalance + c.budget + c.income - c.spent;
    if (Math.abs(suma - availableBalance(c)) > 1e-9) todas = false;
  }
  ok(todas, "la cuenta cierra en todos los casos, tambien con arrastre negativo y con centimos");
}
{
  // Cuando no hay arrastre, esa linea no se enseña — y la cuenta sigue
  // cerrando sin ella.
  const c = { budget: 500, prevBalance: 0, income: 200, spent: 300 };
  ok(c.budget + c.income - c.spent === availableBalance(c), "sin arrastre, las tres lineas visibles ya cierran solas");
}

console.log("\n--- LA BARRA SE MUEVE CON LOS DATOS ---");
{
  // La barra usa budgetUsed. Se comprueba que reacciona de verdad y que no
  // se sale del riel cuando alguien se pasa del presupuesto.
  const tope = (p: number) => Math.max(0, Math.min(1, p));
  const c50 = { budget: 100, prevBalance: 0, income: 0, spent: 50 };
  const c70 = { ...c50, spent: 70 };
  ok(Math.round(budgetUsed(c50) * 100) === 50, "gastando 50 de 100, la barra va al 50%");
  ok(Math.round(budgetUsed(c70) * 100) === 70, "y al pasar a 70, la barra va al 70%");
  ok(budgetUsed(c70) > budgetUsed(c50), "es decir, cambia con los gastos, no es fija");
  const pasado = { budget: 100, prevBalance: 0, income: 0, spent: 175 };
  ok(tope(budgetUsed(pasado)) === 1, "pasado del presupuesto, la barra se queda en el tope y no se desborda");
  ok(budgetLeft(pasado) === -75, "pero el texto sigue diciendo la verdad: se paso por 75");
}

console.log("\n--- LOS CUATRO ESTADOS DEL TEXTO ---");
{
  const estado = (b: number, s: number) => {
    const r = budgetLeft({ budget: b, prevBalance: 0, income: 0, spent: s });
    if (b <= 0) return "sinPresupuesto";
    return r > 0 ? "quedan" : r === 0 ? "justo" : "pasado";
  };
  ok(estado(100, 50) === "quedan", "quedando dinero -> 'aun te quedan'");
  ok(estado(100, 88) === "quedan", "quedando poco, sigue siendo 'aun te quedan'");
  ok(estado(100, 100) === "justo", "justo en el limite -> 'has utilizado todo tu presupuesto'");
  ok(estado(100, 125) === "pasado", "pasandose -> 'has excedido tu presupuesto'");
  // El caso del limite exacto es el que faltaba: antes decia "aun te quedan
  // S/ 0.00", que suena a error, o "te pasaste por 0", que es falso.
  ok(budgetLeft({ budget: 100, prevBalance: 0, income: 0, spent: 100 }) === 0, "en el limite exacto no queda nada ni se paso nadie");
}

console.log("\n--- LA TARJETA VERDE DEL SALDO SE VE IGUAL EN LAS DOS PANTALLAS ---");
{
  // Hay dos: la de Inicio y la del Panorama en Reportes. Ensenan el MISMO numero
  // con el MISMO titulo, asi que son la misma tarjeta en dos sitios.
  //
  // Estaban distintas y se veia. El usuario mando las dos capturas juntas el
  // 07/08/2026: "redondea las esquinas y los bordes emparejalos al igual que los
  // demas, y ponle un color que vaya de acorde, no ese aparente blanco que se ve
  // feo". El aspecto estaba escrito a mano en cada pantalla, se arreglo en una, y
  // la otra se quedo atras — el fallo que este proyecto repite.
  const fs = await import("fs");
  const path = await import("path");
  const RAIZ = process.cwd();
  const estilo = fs.readFileSync(path.join(RAIZ, "constants/style.ts"), "utf8");
  const inicio = fs.readFileSync(path.join(RAIZ, "screens/Home.tsx"), "utf8");
  const reportes = fs.readFileSync(path.join(RAIZ, "screens/Reports.tsx"), "utf8");

  // EL RECORTE ES EL ARREGLO DE VERDAD, no el color: sin recortar, en Android el
  // degradado se pinta con las esquinas cuadradas y el borde blanco se dibuja
  // redondeado encima. En cada esquina asoma el arco claro del borde con el verde
  // saliendose por fuera, y eso era el "aparente blanco".
  ok(/overflow: "hidden"/.test(estilo), "la tarjeta recorta su degradado a las esquinas");
  ok(/borderRadius: 32/.test(estilo), "con la esquina de siempre");
  ok(/rgba\(255,255,255,0\.45\)/.test(estilo), "y el contorno que se ve sobre verde");

  // Y VA EN MEDIDAS, NO EN CLASES. El primer intento compartio el texto de las
  // clases desde aqui y NO FUNCIONO SIN DAR NINGUN ERROR: Tailwind genera las
  // clases leyendo los archivos, y solo lee app/, screens/ y components/. Un
  // "rounded-[32px]" escrito en constants/ no existe, asi que las dos tarjetas se
  // quedaron sin esquina — tambien la que ya estaba bien. Lo vio el usuario en el
  // celular antes que nosotros.
  // Sin comentarios: la explicacion de arriba nombra "rounded-[32px]", y una prueba
  // que se cae por su propia explicacion acaba haciendo que se borre la explicacion.
  // Es la cuarta vez que pasa en este proyecto.
  const estiloLimpio = estilo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(!/rounded-\[/.test(estiloLimpio), "sin clases de Tailwind aqui, que no se generan");

  for (const [nombre, fuente] of [["Inicio", inicio], ["Reportes", reportes]] as const) {
    ok(fuente.includes("style={SALDO_TARJETA}"), `${nombre} usa el aspecto compartido`);
    ok(fuente.includes("SALDO_VERDE"), `${nombre} usa el verde compartido`);
    // Y ninguna puede volver a escribir ESE verde a mano: es como se separaron.
    // Se miran los cuatro tonos que tuvieron las dos versiones, no cualquier
    // color: la tarjeta de Fino IA tiene su propio degradado oscuro y ahi esta
    // bien escrito donde se usa, porque solo hay una.
    const suVerde = ["#059669", "#0f766e", "#065f46", "#047857"].filter((c) =>
      new RegExp(`colors=\\{\\[[^\\]]*${c}`).test(fuente)
    );
    ok(suVerde.length === 0, `${nombre} no lleva el verde del saldo escrito a mano`);
  }
}

console.log("\n--- NINGUNA CLASE DE TAILWIND FUERA DE DONDE SE LEEN ---");
{
  // LA TRAMPA, y por eso se comprueba en general y no solo en la tarjeta del saldo.
  //
  // Tailwind genera las clases LEYENDO archivos, y la lista de carpetas que lee
  // esta en tailwind.config.js. Una clase escrita fuera de esas carpetas
  // simplemente NO SE GENERA: no hay error, no hay aviso, y en el celular ese
  // trozo de aspecto no esta. Pasó el 07/08/2026 al mover el aspecto de la tarjeta
  // del saldo a constants/: se quedaron sin esquina las dos, incluida la que ya
  // estaba bien.
  //
  // Se buscan las clases con valor entre corchetes —rounded-[32px], w-[80px]—
  // porque son las que no pueden existir por casualidad. Una como "overflow-hidden"
  // puede colarse igual y funcionar de rebote, solo porque otra pantalla la usa; y
  // eso es peor, porque funciona hasta que esa otra pantalla cambia.
  const fs = await import("fs");
  const path = await import("path");
  const RAIZ = process.cwd();
  const config = fs.readFileSync(path.join(RAIZ, "tailwind.config.js"), "utf8");
  const leidas = [...config.matchAll(/\.\/([a-z]+)\/\*\*/g)].map((m) => m[1]);
  ok(leidas.length > 0, `se leyo la lista de carpetas de tailwind.config (${leidas.join(", ")})`);

  const sospechosas: string[] = [];
  for (const carpeta of ["constants", "utils", "contexts", "modules"]) {
    if (leidas.includes(carpeta)) continue;
    const dir = path.join(RAIZ, carpeta);
    if (!fs.existsSync(dir)) continue;
    const pila = [dir];
    while (pila.length > 0) {
      const actual = pila.pop() as string;
      for (const entrada of fs.readdirSync(actual, { withFileTypes: true })) {
        const completo = path.join(actual, entrada.name);
        // Sin entrar en lo compilado: ahi hay clases de sobra y no son nuestras.
        if (entrada.isDirectory()) {
          if (entrada.name !== "build" && entrada.name !== "node_modules") pila.push(completo);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entrada.name)) continue;
        const texto = fs.readFileSync(completo, "utf8");
        // Sin comentarios: la explicacion de este fallo nombra "rounded-[32px]".
        const codigo = texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        if (/\b[a-z-]+-\[[^\]]+\]/.test(codigo)) {
          sospechosas.push(path.relative(RAIZ, completo));
        }
      }
    }
  }
  ok(
    sospechosas.length === 0,
    `ningun archivo fuera de esas carpetas define clases con corchetes${sospechosas.length ? ": " + sospechosas.join(", ") : ""}`
  );
}

console.log(fallos === 0 ? "\nTodo bien\n" : `\n${fallos} fallos\n`);
process.exit(fallos ? 1 : 0);
