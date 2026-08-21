/**
 * EL VALOR DEL CONTEXTO NO CAMBIA SI NO CAMBIÓ NADA (20/08/2026)
 *
 * Hasta hoy `AppDataContext` entregaba un objeto escrito a mano en el JSX, o sea uno NUEVO en
 * cada dibujado. React compara los contextos por identidad, así que cualquier cambio de sus
 * 34 estados —un aviso, el mes, el mensajito de "guardado"— redibujaba de golpe TODAS las
 * pantallas montadas, usaran o no lo que había cambiado. Ahora pasa por `useValorEstable`.
 *
 * Se llama a la función DE VERDAD, con una caja de mentira en el sitio de la de React (ver
 * `stubs/react.ts`): probar una copia escrita a mano no probaría lo que corre en el celular.
 */
import fs from "node:fs";
import path from "node:path";
import { useValorEstable } from "@/utils/valorEstable";
import { nuevoComponente, nuevoDibujado } from "./stubs/react";

const RAIZ = process.cwd();

let fallos = 0;
function ok(condicion: boolean, texto: string) {
  if (condicion) console.log(`  ok    ${texto}`);
  else {
    console.log(`  FALLA ${texto}`);
    fallos++;
  }
}

/** Un dibujado más del mismo componente. */
function dibujar<T extends object>(crudo: T): T {
  nuevoDibujado();
  return useValorEstable(crudo);
}

console.log("\n--- SIN CAMBIOS, EL MISMO OBJETO ---");
{
  nuevoComponente();
  const uno = dibujar({ mes: "2026-08", saldo: 10, guardar: (): string => "a" });
  const dos = dibujar({ mes: "2026-08", saldo: 10, guardar: (): string => "b" });
  ok(uno === dos, "dos dibujados sin cambios devuelven el MISMO objeto");
  ok(uno.guardar === dos.guardar, "y la misma funcion, aunque por dentro sea otra");
}

console.log("\n--- LA FUNCIÓN ENVUELTA LLAMA SIEMPRE A LA ÚLTIMA ---");
{
  nuevoComponente();
  const uno = dibujar({ mes: "2026-08", guardar: (): string => "vieja" });
  dibujar({ mes: "2026-08", guardar: (): string => "nueva" });
  ok(
    uno.guardar() === "nueva",
    "la envoltura de siempre llama a la version de ahora: no se queda con datos viejos"
  );
}

console.log("\n--- LA ENVOLTURA PASA LOS ARGUMENTOS Y DEVUELVE LO SUYO ---");
{
  nuevoComponente();
  const uno = dibujar({ sumar: (a: number, b: number) => a + b });
  ok(uno.sumar(2, 3) === 5, "los argumentos llegan y la respuesta vuelve");
}

console.log("\n--- CON UN CAMBIO, UN OBJETO NUEVO ---");
{
  nuevoComponente();
  const uno = dibujar({ mes: "2026-08", saldo: 10, guardar: () => 1 });
  const dos = dibujar({ mes: "2026-09", saldo: 10, guardar: () => 1 });
  ok(uno !== dos, "cambiar un dato devuelve un objeto NUEVO");
  ok(dos.mes === "2026-09", "y el dato nuevo llega");
  ok(
    uno.guardar === dos.guardar,
    "pero la funcion sigue siendo la misma, para no despertar a nadie de mas"
  );
}

console.log("\n--- LO QUE NO CAMBIÓ SE CONSERVA TAL CUAL ---");
{
  nuevoComponente();
  const lista = [1, 2];
  dibujar({ mes: "2026-08", lista, guardar: () => 1 });
  const dos = dibujar({ mes: "2026-09", lista, guardar: () => 1 });
  ok(dos.lista === lista, "una lista que no cambio sigue siendo la misma lista");
}

console.log("\n--- SE COMPARA CONTRA EL ÚLTIMO DIBUJADO, NO CONTRA UNO VIEJO ---");
{
  // El fallo sutil: si al no haber cambios se guardara el crudo ANTIGUO, la comparacion
  // siguiente se haria contra un dibujado de hace rato.
  nuevoComponente();
  const uno = dibujar({ saldo: 10, guardar: () => 1 });
  const dos = dibujar({ saldo: 10, guardar: () => 1 });
  const tres = dibujar({ saldo: 20, guardar: () => 1 });
  ok(uno === dos && dos !== tres, "sin cambios se repite; en cuanto cambia, se renueva");
  ok(tres.saldo === 20, "con el valor correcto");
}

console.log("\n--- NADIE ESPERA QUE ESAS FUNCIONES CAMBIEN DE IDENTIDAD ---");
{
  /* La UNICA forma de que esto rompa algo: una pantalla que ponga una funcion del contexto en
     la lista de dependencias de un efecto CONTANDO con que cambie. Como ya no cambia nunca,
     ese efecto se dispararia una sola vez. Se comprobo a mano antes de hacer el cambio; esta
     prueba es para que siga siendo verdad manana. */
  const sospechosas = [
    "reprogramarAvisos",
    "showToast",
    "hydrateFromCloud",
    "reloadPersistedData",
    "logout",
    "addOrUpdateTransaction",
    "guardarPagoProgramado",
    "marcarPagoDelMes",
    "refreshAutoCapture",
    "updateCategoryBudgets",
  ];
  const archivos: string[] = [];
  const recorrer = (d: string) => {
    for (const e of fs.readdirSync(path.join(RAIZ, d), { withFileTypes: true })) {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) recorrer(rel);
      else if (/\.tsx?$/.test(e.name)) archivos.push(rel);
    }
  };
  ["screens", "components", "app"].forEach(recorrer);

  const malas: string[] = [];
  for (const rel of archivos) {
    const txt = fs.readFileSync(path.join(RAIZ, rel), "utf8");
    // Solo las listas de dependencias: "}, [ ... ])"
    for (const m of txt.matchAll(/\}\s*,\s*\[([^\]]*)\]\s*\)/g)) {
      const deps = m[1].split(",").map((x) => x.trim());
      for (const f of sospechosas) if (deps.includes(f)) malas.push(`${rel}: [${m[1].trim()}]`);
    }
  }
  ok(
    malas.length === 0,
    `ningun efecto depende de que una funcion del contexto cambie${
      malas.length ? " — las hay en: " + malas.join(" · ") : ""
    }`
  );
}

console.log("\n--- Y EL CONTEXTO LO USA ---");
{
  const ctx = fs.readFileSync(path.join(RAIZ, "contexts/AppDataContext.tsx"), "utf8");
  ok(ctx.includes("useValorEstable({"), "AppDataContext arma su valor con useValorEstable");
  ok(
    !/<AppDataContext\.Provider\s*\n?\s*value=\{\{/.test(ctx),
    "y ya no entrega un objeto escrito a mano en el JSX"
  );
}

console.log(
  fallos ? `\n${fallos} con problemas` : "\nTodo bien: el contexto no despierta a nadie de mas"
);
process.exit(fallos ? 1 : 0);
