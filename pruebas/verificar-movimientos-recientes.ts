import assert from "node:assert/strict";
import fs from "node:fs";
import { availableRecentMovementTypes } from "@/utils/recentMovementFilters";

assert.deepEqual(availableRecentMovementTypes([]), { income: false, expense: false });
assert.deepEqual(availableRecentMovementTypes([{ type: "income" }]), { income: true, expense: false });
assert.deepEqual(availableRecentMovementTypes([{ type: "expense" }]), { income: false, expense: true });
assert.deepEqual(availableRecentMovementTypes([{ type: "income" }, { type: "expense" }]), { income: true, expense: true });
assert.deepEqual(availableRecentMovementTypes([
  { type: "expense", internalTransfer: "family" },
  { type: "income", internalTransfer: "box" },
]), { income: false, expense: false }, "las transferencias internas no ofrecen filtros vacíos de Ingreso/Gasto");
assert.deepEqual(availableRecentMovementTypes([{ tipo: "ingreso" }]), { income: true, expense: false });
assert.deepEqual(availableRecentMovementTypes([{ tipo: "gasto" }]), { income: false, expense: true });
assert.deepEqual(availableRecentMovementTypes([
  { tipo: "ingreso", personalTransactionId: 10 },
  { tipo: "gasto", personalReturnAmount: 20 },
]), { income: false, expense: false }, "los pares internos de espacios no crean filtros financieros normales");

const home = fs.readFileSync("screens/Home.tsx", "utf8");
const family = fs.readFileSync("screens/Family.tsx", "utf8");
const boxes = fs.readFileSync("screens/Cajas.tsx", "utf8");
assert.match(home, /compactMonthRows\.length > 0 \? <>[\s\S]*?home\.recentTransactions/, "sin movimientos se oculta el encabezado reciente");
assert.match(home, /recentMovementTypes\.income \? <TouchableOpacity[\s\S]*?ArrowUp/, "la flecha de ingreso depende de un ingreso real");
assert.match(home, /recentMovementTypes\.expense \? <TouchableOpacity[\s\S]*?ArrowDown/, "la flecha de gasto depende de un gasto real");
for (const [name, source] of [["Familia", family], ["Cajas", boxes]]) {
  assert.match(source, /movimientos\.length > 0 \? <>[\s\S]*?MovementAllButton/, `${name}: el encabezado solo aparece si hay movimientos`);
  assert.match(source, /recentMovementTypes\.income \? <TouchableOpacity[\s\S]*?ArrowUp/, `${name}: la flecha verde exige un ingreso`);
  assert.match(source, /recentMovementTypes\.expense \? <TouchableOpacity[\s\S]*?ArrowDown/, `${name}: la flecha roja exige un gasto`);
}

console.log("Inicio, Familia y Cajas: títulos solo con movimientos; flechas solo para tipos presentes; transferencias no generan filtros vacíos.");
