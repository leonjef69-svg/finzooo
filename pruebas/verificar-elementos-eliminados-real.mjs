import assert from "node:assert/strict";
import { handlerOriginal } from "./helpers/handler-original.mjs";

const MissingItem = Symbol("MissingItem");
const AddSheet = Symbol("AddSheet");
let navigations = 0, writes = 0;
const data = { month: "2026-10", transactions: [], goals: [], negocios: [], isPremium: true,
  addOrUpdateTransaction() { writes++; return true; }, t: key => key };
const common = {
  React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
  MissingItem, AddSheet, PremiumLocked: Symbol("PremiumLocked"), PanelNegocio: Symbol("PanelNegocio"), MoveMoneySheet: Symbol("MoveMoneySheet"),
  useAppData: () => data, useLocalSearchParams: () => ({ id: "999", mode: "add" }),
  useRedirectIfOrphaned: () => false, safeBack() { navigations++; },
  router: { dismissTo() { navigations++; } }, irUnaVez() { navigations++; },
  useState: value => [value, () => {}], useRef: value => ({ current: value }), useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
  useColorScheme: () => ({ colorScheme: "light" }),
  candadoPremium: () => "abierto", puedeTocar: () => true,
};
for (const [file, name, props] of [
  ["app/transaction/[id]/edit.tsx", "EditTransactionRoute", undefined],
  ["app/savings/move.tsx", "SavingsMoveRoute", undefined],
  ["app/negocio/[id].tsx", "PanelNegocioRoute", undefined],
  ["app/negocio/productos.tsx", "ProductosRoute", undefined],
  ["app/negocio/venta.tsx", "NuevaVentaRoute", undefined],
  ["app/negocio/movimiento.tsx", "MovimientoNegocioRoute", undefined],
  ["app/savings/form.tsx", "SavingsFormRoute", undefined],
  ["screens/Detail.tsx", "Detail", { transaction: undefined, onBack: common.safeBack }],
  ["screens/SavingsDetail.tsx", "SavingsDetail", { goal: undefined, onBack: common.safeBack }],
  ["screens/DuplicateReview.tsx", "DuplicateReview", { dupes: [], newCount: 0, onCancel: common.safeBack }],
]) {
  const screen = handlerOriginal(file, name, common)(props);
  assert.equal(screen?.type, MissingItem, `${file}: mensaje y salida, no formulario nuevo ni pantalla vacía`);
  assert.equal(navigations, 0, "No navegar durante el dibujo");
  assert.equal(writes, 0, "No guardar si el elemento desapareció");
  assert.equal(typeof screen.props.onBack, "function");
}
const transactionsLive = { current: [] };
const save = handlerOriginal("contexts/AppDataContext.tsx", "addOrUpdateTransaction", {
  transactionsLive, transactions: [], deletedTransactionIdsRef: { current: [] },
  showToast() {}, t: key => key, isSafeMoneyAmount: () => true,
  setTransactions() { writes++; },
});
const tx = { id: 999, amount: 50, type: "expense", category: "comida" };
assert.equal(save(tx, false, true), false, "Edición atrasada no crea un alta nueva");
assert.equal(writes, 0);
const saveGoal = handlerOriginal("contexts/AppDataContext.tsx", "addOrUpdateGoal", {
  isPremium: true, goalsLive: { current: [] }, deletedGoalIds: [],
  metaConEstadoActual: value => value, setGoals() { writes++; }, showToast() {}, t: key => key,
});
assert.equal(saveGoal({ id: 999 }, true), false);
assert.equal(writes, 0, "No recrear una meta desaparecida al guardar una edición");
data.transactions = [{ ...tx }];
let requireExisting;
data.addOrUpdateTransaction = (_tx, _allowLinked, required) => { requireExisting = required; return false; };
const activeEdit = handlerOriginal("app/transaction/[id]/edit.tsx", "EditTransactionRoute", common)();
assert.equal(activeEdit.type, AddSheet);
activeEdit.props.onSave(tx);
assert.equal(requireExisting, true, "El formulario de edición pide verificar el origen al guardar");
assert.equal(navigations, 0, "No cerrar como éxito una edición rechazada");
console.log("Pantallas originales: elementos ausentes muestran salida y no navegan al dibujar; una edición atrasada no crea movimientos.");
