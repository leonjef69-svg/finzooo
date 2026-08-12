import { useEffect } from "react";
import { router } from "expo-router";
import AutoCapture from "@/screens/AutoCapture";
import { useAppData } from "@/contexts/AppDataContext";
import { hayRegistroAutomatico } from "@/utils/dondeHayYape";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

export default function AutoCaptureRoute() {
  const { refreshAutoCapture, userCurrency } = useAppData();
  const blocked = useRedirectIfOrphaned();
  const disponible = hayRegistroAutomatico(userCurrency);

  // Al entrar se vuelve a preguntar por el permiso: puede haber cambiado en
  // los ajustes de Android desde la última vez que se miró.
  useEffect(() => {
    if (!disponible) return;
    refreshAutoCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disponible]);

  // NO BASTA CON ESCONDER LA FILA DE AJUSTES (11/08/2026).
  //
  // Se puede llegar aquí sin pasar por ella: quedándose la pantalla abierta y cambiando de país
  // en otra, o volviendo atrás a una que ya estaba en la pila. Una función que se esconde en un
  // sitio y sigue abierta por otro no está escondida — es la costura donde se cuelan los fallos
  // de este proyecto, y ya van tres.
  //
  // Se manda a Inicio en vez de enseñar un aviso: no hay nada que explicar ni que decidir, y un
  // cartel de "esto no está en tu país" en una pantalla que nadie pidió abrir solo estorba.
  useEffect(() => {
    if (!blocked && !disponible) router.replace("/(tabs)");
  }, [blocked, disponible]);

  if (blocked || !disponible) return null;
  return <AutoCapture onBack={safeBack} />;
}
