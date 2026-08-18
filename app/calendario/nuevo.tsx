import { useLocalSearchParams } from "expo-router";
import NuevoPagoProgramado from "@/screens/NuevoPagoProgramado";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function NuevoPagoRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <NuevoPagoProgramado id={id} onBack={safeBack} />;
}
