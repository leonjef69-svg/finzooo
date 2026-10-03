import assert from "node:assert/strict";
import fs from "node:fs";

const history = fs.readFileSync("screens/History.tsx", "utf8");
const typeFilterRow = history.indexOf('contentContainerStyle={{ gap: 8, paddingHorizontal: 20, marginTop: 12 }}');
const advancedPanel = history.indexOf("{showFilters ? (");

assert.notEqual(typeFilterRow, -1, "se conserva la fila horizontal de filtros por tipo");
assert.notEqual(advancedPanel, -1, "se conserva el panel de filtros avanzados");
assert.ok(typeFilterRow < advancedPanel, "los filtros Todos/Gastos/Ingresos/Transferencias aparecen encima del panel avanzado");
assert.match(history, /onPress=\{\(\) => selectTypeFilter\(id\)\}/, "los filtros por tipo conservan su selección");
assert.match(history, /onPress=\{\(\) => setShowFilters\(\(open\) => !open\)\}/, "el panel avanzado conserva su botón de abrir y cerrar");

console.log("Historial: los filtros de tipo quedan sobre el panel desplegable sin perder su funcionamiento.");
