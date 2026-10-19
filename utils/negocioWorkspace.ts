import type { DatosDelNegocio, LineaDeVenta, MovimientoNegocio, Negocio, Producto } from "@/utils/negocio";
import { historialDelNegocio, productosVendidos } from "@/utils/negocioTotales";
import { isSafeMoneyAmount } from "@/utils/amount";

export type BusinessPeriod = "hoy" | "mes" | "todo" | "rango";
export type BusinessFilter = { tipo: "todos" | "ingreso" | "gasto"; origen: "todos" | "manual" | "automatico"; metodo: string; categoria: string; pendientes: boolean; buscar: string };
export const BUSINESS_FILTER: BusinessFilter = { tipo: "todos", origen: "todos", metodo: "todos", categoria: "todas", pendientes: false, buscar: "" };
export function modoDelNegocio(negocio: Negocio, productos: Producto[]): "categorias" | "simple" {
  return negocio.modo ?? (productos.some(p => p.negocioId === negocio.id) ? "categorias" : "simple");
}
const cents = (n: number) => Math.round(n * 100);
export function importeCategoria(precio: number, cantidad: number): number {
  if(!Number.isInteger(cantidad)||cantidad<1||cantidad>50||!isSafeMoneyAmount(precio)||precio<=0)return 0;
  const amount=Math.round(precio*cantidad*100)/100;
  return isSafeMoneyAmount(amount)?amount:0;
}

/** Dos soluciones ya prueban ambigüedad. Los límites nunca se presentan como certeza. */
export function coincidenciasNegocio(monto: number, productos: Producto[], combinaciones = true): { opciones: LineaDeVenta[][]; incompleto: boolean } {
  const target = cents(monto);
  const cats = productos.filter(p => p.activo && Number.isSafeInteger(cents(p.precio)) && p.precio > 0);
  if (!Number.isSafeInteger(target) || target <= 0) return { opciones: [], incompleto: true };
  if (!combinaciones) return { opciones: cats.filter(p => cents(p.precio) === target).map(p => [{ productoId:p.id,nombre:p.nombre,precio:p.precio,cantidad:1 }]), incompleto:false };
  if (!cats.length) return { opciones:[],incompleto:false };
  if (cats.length > 12 || target > 200000 || target > Math.min(...cats.map(p=>cents(p.precio))) * 12) return { opciones:[],incompleto:true };
  const opciones: LineaDeVenta[][] = [];
  let visits = 0, incompleto = false;
  function walk(index: number, remaining: number, lines: LineaDeVenta[], count: number) {
    if (opciones.length >= 2 || incompleto) return;
    if (++visits > 18000) { incompleto = true; return; }
    if (remaining === 0) { opciones.push(lines); return; }
    if (index >= cats.length || count >= 12) return;
    const p = cats[index], unit = cents(p.precio);
    for (let qty=Math.min(Math.floor(remaining/unit),12-count); qty>=0 && opciones.length<2 && !incompleto; qty--) {
      walk(index+1,remaining-qty*unit,qty ? [...lines,{productoId:p.id,nombre:p.nombre,precio:p.precio,cantidad:qty}] : lines,count+qty);
    }
  }
  walk(0,target,[],0);
  return { opciones,incompleto };
}
export function clasificacionAlRecibir(negocio: Negocio, productos: Producto[], monto: number): MovimientoNegocio["clasificacion"] {
  if (modoDelNegocio(negocio,productos) === "simple") return undefined;
  const match = coincidenciasNegocio(monto,productos.filter(p=>p.negocioId===negocio.id),negocio.reconocerCombinaciones !== false);
  return match.opciones.length === 1 && !match.incompleto
    ? {estado:"confirmada",lineas:match.opciones[0]}
    : {estado:"pendiente",lineas:[]};
}
export type BusinessRow = ReturnType<typeof filasDelNegocio>[number];
export function filasDelNegocio(id: string, datos: Pick<DatosDelNegocio,"ventas"|"movimientos">, clasifica = true) {
  const movimientos = new Map(datos.movimientos.filter(m=>m.negocioId===id).map(m=>[m.id,m]));
  const ventas = new Map(datos.ventas.filter(v=>v.negocioId===id).map(v=>[v.id,v]));
  return historialDelNegocio(id,datos.ventas,datos.movimientos).map(f=>{
    const m = f.clase === "venta" ? undefined : movimientos.get(f.id);
    const lineas = f.clase === "venta" ? ventas.get(f.id)?.lineas ?? [] : m?.clasificacion?.lineas ?? [];
    return {...f,key:`${f.clase === "venta" ? "venta" : "movimiento"}:${f.id}`,tipo:f.clase === "gasto" ? "gasto" as const : "ingreso" as const,
      detalle:lineas.length ? lineas.map(l=>`${l.cantidad>1?`${l.cantidad} × `:""}${l.nombre}`).join(" + ") : f.detalle,
      lineas,pendiente:clasifica && (m?.clasificacion?.estado === "pendiente" || (m?.tipo === "ingreso" && m.origen === "automatico" && !m.clasificacion)),vinculoManual:m?.vinculoManual};
  });
}
export function fechaNegocioValida(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d] = value.split("-").map(Number), date = new Date(y,m-1,d,12);
  return date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d;
}
export function periodoNegocio(rows: BusinessRow[], periodo: BusinessPeriod, hoy: string, desde: string, hasta: string): BusinessRow[] {
  return rows.filter(r=>periodo === "todo" || (periodo === "hoy" ? r.fecha===hoy : periodo === "mes" ? r.fecha.slice(0,7)===hoy.slice(0,7) : r.fecha>=desde && r.fecha<=hasta));
}
export function filtrarNegocio(rows: BusinessRow[], f: BusinessFilter): BusinessRow[] {
  const query = f.buscar.trim().toLocaleLowerCase();
  return rows.filter(r=>(f.tipo==="todos" || r.tipo===f.tipo) && (f.origen==="todos" || r.automatico === (f.origen === "automatico"))
    && (f.metodo==="todos" || r.metodo===f.metodo) && (f.categoria==="todas" || r.lineas.some(l=>l.productoId===f.categoria))
    && (!f.pendientes || r.pendiente) && (!query || `${r.detalle} ${r.metodo}`.toLocaleLowerCase().includes(query)));
}
export function totalesWorkspace(rows: BusinessRow[]) {
  return { ingresos: rows.filter(r=>r.tipo==="ingreso").reduce((s,r)=>s+cents(r.monto),0)/100,
    gastos: rows.filter(r=>r.tipo==="gasto").reduce((s,r)=>s+cents(r.monto),0)/100 };
}
/** Proyección solo para el desglose: no se guarda ni se suma otra vez al total mensual. */
export function categoriasDelResumen(id: string, datos: Pick<DatosDelNegocio,"ventas"|"movimientos">) {
  return productosVendidos(id,[...datos.ventas,...datos.movimientos.filter(m=>m.negocioId===id && m.tipo==="ingreso" && m.clasificacion?.estado==="confirmada").map(m=>({
    id:`movimiento:${m.id}`,negocioId:m.negocioId,fecha:m.fecha,hora:m.hora,total:m.monto,metodo:m.metodo,estado:"pagado" as const,lineas:m.clasificacion!.lineas,
  }))]);
}
/** Claves con tipo: una venta y un movimiento con el mismo ID no se seleccionan juntos. */
export function borrarFilasNegocio(datos: DatosDelNegocio, id: string, keys: string[]): DatosDelNegocio {
  const selected = new Set(keys);
  return {...datos,ventas:datos.ventas.filter(v=>v.negocioId!==id || !selected.has(`venta:${v.id}`)),movimientos:datos.movimientos.filter(m=>m.negocioId!==id || !selected.has(`movimiento:${m.id}`))};
}
export function vincularCobroNegocio(datos: DatosDelNegocio, id: string, autoId: string, manualKey: string): DatosDelNegocio {
  const auto=datos.movimientos.find(m=>m.negocioId===id && m.id===autoId && m.tipo==="ingreso" && m.origen==="automatico" && m.metodo==="yape" && !m.vinculoManual);
  const manual=filasDelNegocio(id,datos).find(r=>r.key===manualKey && !r.automatico && r.tipo==="ingreso" && r.metodo==="yape");
  if (!auto || !manual || cents(auto.monto)!==cents(manual.monto)) return datos;
  const next=borrarFilasNegocio(datos,id,[manualKey]);
  return {...next,movimientos:next.movimientos.map(m=>m.id===auto.id && m.negocioId===id ? {...m,vinculoManual:manualKey,...(manual.lineas.length ? {clasificacion:{estado:"confirmada" as const,lineas:manual.lineas}} : {})} : m)};
}
