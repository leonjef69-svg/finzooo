import { useLocalSearchParams } from "expo-router";
import NuevoPagoProgramado from "@/screens/NuevoPagoProgramado";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function NuevoPagoRoute() {
  // `fecha` llega cuando se tocó un día en el calendario grande: "2026-08-14".
  const { id, fecha } = useLocalSearchParams<{ id?: string; fecha?: string }>();
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;
  return <NuevoPagoProgramado id={id} fecha={fecha} onBack={safeBack} />;
}
