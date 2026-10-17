import { useState } from "react";
import AddSheet from "@/screens/AddSheet";
import { useAppData } from "@/contexts/AppDataContext";
import { nextId } from "@/utils/id";
import { fechaLocalISO } from "@/utils/date";
import type { Goal, Transaction } from "@/types";

/** Una compra, una fila de gasto y un solo guardado junto con la meta. */
export default function UseSavingsSheet({ goal, onClose, onSave }: {
  goal: Goal; onClose: () => void; onSave: (transaction: Transaction) => Promise<boolean>;
}) {
  const { t, fmt } = useAppData();
  const date = fechaLocalISO();
  const [draft] = useState<Transaction>(() => ({ id: nextId(), type: "expense", amount: goal.saved, category: "otros", description: goal.name,
    date, method: "cash", notes: "" }));
  return <AddSheet draft={draft} currentMonth={{ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 }}
    title={t("savings.use")} caption={t("savings.useCaption", { name: goal.name, amount: fmt(goal.saved) })}
    maxAmount={goal.saved} lockedType="expense" onClose={onClose} onSave={onSave} />;
}
