import { router } from "expo-router";
import GoalPickerSheet from "@/screens/GoalPickerSheet";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

// ELEGIR LA META NO ES DECIDIR CUÁNTO (10/08/2026)
//
// Aquí se hacían dos cosas de un solo toque: tocar "Viajes" movía TODO el ahorro del mes a esa
// meta, sin preguntar y sin poder volver atrás en el mismo gesto. Elegir a dónde va el dinero y
// elegir cuánto son dos decisiones distintas, y juntarlas convertía un toque de curiosidad
// —"¿qué metas tengo?"— en un movimiento de dinero.
//
// La hoja para decidir el cuánto YA EXISTÍA (MoveMoneySheet, la del botón "Agregar" dentro de
// una meta): tiene su casilla, su tope y su aviso de cuánto queda libre. Ahora se pasa por ella.
//
// Y VA CON `replace`, NO CON `push`: esta hoja ya cumplió su papel al elegir la meta. Con push,
// al volver atrás desde la hoja del monto se caía otra vez en la lista de metas, como si no
// hubiera elegido nada.
export default function SavingsPickerRoute() {
  // `libre` y no `autoSavings`. Eran dos números distintos en la misma pantalla: la tarjeta de
  // arriba decía "Pasar S/ 200 a una meta" y esta hoja decía "vas a agregar S/ 100", porque
  // autoSavings deja fuera el saldo anterior y `libre` no. Es el mismo fallo que ya se arregló
  // en la tarjeta de Ahorro y que se coló aquí.
  const { goals, libre } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return (
    <GoalPickerSheet
      goals={goals}
      amount={libre}
      onClose={safeBack}
      onPick={(goalId) => router.replace(`/savings/move?id=${goalId}&mode=add`)}
    />
  );
}
