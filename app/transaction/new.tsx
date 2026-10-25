import { useLocalSearchParams } from "expo-router";
import AddSheet from "@/screens/AddSheet";
import SavingsExpenseSheet from "@/screens/SavingsExpenseSheet";
import { useEffect, useRef, useState } from "react";
import type { Transaction } from "@/types";
import { disponiblePersonalEnFecha } from "@/utils/finances";
import { expenseSavingsNeeded } from "@/utils/savingsActions";
import { saldoLibre, totalApartado } from "@/utils/ahorro";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function NewTransactionRoute() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { month, goals, transactions, budgets, carryoverCleared, addOrUpdateTransaction, commitSavingsAction } = useAppData();
  const [pending, setPending] = useState<Transaction | null>(null);
  const [draft, setDraft] = useState<Transaction | undefined>(), [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  if (pending) {
    const total = disponiblePersonalEnFecha(pending.date, budgets, transactions, carryoverCleared);
    return <SavingsExpenseSheet needed={expenseSavingsNeeded(pending.amount, total, goals)} free={saldoLibre(total, totalApartado(goals))}
      onCancel={() => { setDraft(pending); setRevision(n => n + 1); setPending(null); }}
      onExpenseOnly={async () => { const saved = await addOrUpdateTransaction(pending); if (saved && mounted.current) safeBack(); return saved; }}
      onConfirm={async allocations => {
        const saved = await commitSavingsAction({ kind: "expense", transaction: pending, allocations });
        if (saved && mounted.current) safeBack(); return saved;
      }} />;
  }

  // Se llega aquí EN EL LUGAR del panel de elegir tipo, no encima (ver ese archivo), así que
  // detrás está Inicio directamente: cerrar es cerrar una sola hoja, y la baja el sistema con
  // su animación.
  //
  // Antes esto era `dismissTo("/(tabs)")`, que deshacía dos pantallas a la vez para saltarse
  // el panel. Funcionaba, pero Android no anima eso: quitaba las dos de golpe y el cambio a
  // Inicio se sentía como un corte. Con una sola pantalla que cerrar, `safeBack` basta.
  return (
    <AddSheet
      key={revision}
      draft={draft}
      initialType={type === "income" ? "income" : "expense"}
      currentMonth={month}
      onClose={safeBack}
      onSave={async (t) => {
        const total = disponiblePersonalEnFecha(t.date, budgets, transactions, carryoverCleared);
        if (t.type === "expense" && totalApartado(goals) > 0 && expenseSavingsNeeded(t.amount, total, goals) > 0) { setPending(t); return false; }
        const saved = await addOrUpdateTransaction(t);
        if (saved && mounted.current) safeBack();
        return saved;
      }}
    />
  );
}
