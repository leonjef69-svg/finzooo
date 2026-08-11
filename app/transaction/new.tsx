import { useLocalSearchParams } from "expo-router";
import AddSheet from "@/screens/AddSheet";
import { useAppData } from "@/contexts/AppDataContext";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function NewTransactionRoute() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { month, addOrUpdateTransaction } = useAppData();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  // Se llega aquí EN EL LUGAR del panel de elegir tipo, no encima (ver ese archivo), así que
  // detrás está Inicio directamente: cerrar es cerrar una sola hoja, y la baja el sistema con
  // su animación.
  //
  // Antes esto era `dismissTo("/(tabs)")`, que deshacía dos pantallas a la vez para saltarse
  // el panel. Funcionaba, pero Android no anima eso: quitaba las dos de golpe y el cambio a
  // Inicio se sentía como un corte. Con una sola pantalla que cerrar, `safeBack` basta.
  return (
    <AddSheet
      initialType={type === "income" ? "income" : "expense"}
      currentMonth={month}
      onClose={safeBack}
      onSave={(t) => {
        addOrUpdateTransaction(t);
        safeBack();
      }}
    />
  );
}
