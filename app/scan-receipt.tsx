import ScanReceipt from "@/screens/ScanReceipt";
import { safeBack, useRedirectIfOrphaned } from "@/utils/nav";

// El escáner es gratuito a propósito: no lleva candado de Premium.
//
// Lee la foto aquí en el celular con el lector de Google, así que no cuesta
// nada por uso y no depende de internet. Lo que sí será de Premium algún día
// es la lectura con IA para las boletas difíciles — pero eso es otra
// pantalla, no esta.
export default function ScanReceiptRoute() {
  const blocked = useRedirectIfOrphaned();
  if (blocked) return null;

  return <ScanReceipt onClose={safeBack} />;
}
