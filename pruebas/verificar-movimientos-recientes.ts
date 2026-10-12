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

const home = fs.readFileSync("screens/Home.tsx", "utf8");
assert.match(home, /compactMonthRows\.length > 0 \? <>[\s\S]*?home\.recentTransactions/, "sin movimientos se oculta el encabezado reciente");
assert.match(home, /recentMovementTypes\.income \? <TouchableOpacity[\s\S]*?ArrowUp/, "la flecha de ingreso depende de un ingreso real");
assert.match(home, /recentMovementTypes\.expense \? <TouchableOpacity[\s\S]*?ArrowDown/, "la flecha de gasto depende de un gasto real");

console.log("Inicio: título solo con movimientos; flechas solo para tipos presentes; transferencias no generan filtros vacíos.");
