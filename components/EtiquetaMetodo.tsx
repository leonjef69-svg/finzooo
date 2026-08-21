import { Text, View } from "react-native";
import { Banknote, CreditCard, Landmark, Smartphone, Wallet } from "lucide-react-native";
import { methodLabel } from "@/constants/i18n";

/**
 * CON QUÉ SE PAGÓ, EN LA FILA DEL MOVIMIENTO.
 *
 * Pedido suyo (21/08/2026): *"en la pantalla de inicio, nuevos movimientos, no veo que salga
 * el método de pago"*. Estaba guardado desde siempre y solo se veía abriendo el movimiento.
 *
 * **VIVE APARTE PORQUE LO USAN DOS PANTALLAS**, Inicio e Historial —*"no te olvides que
 * historial también"*—, y dos etiquetas escritas por separado son dos que se van despegando:
 * basta con que alguien cambie un color en una para que el mismo Yape se vea de dos maneras
 * según por dónde se entre.
 *
 * Los movimientos viejos guardaron el método como texto suelto ("Tarjeta débito") en vez de
 * un identificador. `methodLabel` ya sabe enseñarlos tal cual; aquí eso cae en el color gris
 * de siempre, que es lo correcto: no inventar un color para algo que no se reconoce.
 */
const COLORES: Record<string, { fondo: string; tinta: string; Icono: typeof Wallet }> = {
  cash: { fondo: "#f1f5f9", tinta: "#475569", Icono: Banknote },
  debit: { fondo: "#e0f2fe", tinta: "#0369a1", Icono: CreditCard },
  credit: { fondo: "#ede9fe", tinta: "#6d28d9", Icono: CreditCard },
  transfer: { fondo: "#ecfeff", tinta: "#0e7490", Icono: Landmark },
  yape: { fondo: "#f5e8ff", tinta: "#7e22ce", Icono: Smartphone },
  plin: { fondo: "#e0f2fe", tinta: "#0e7490", Icono: Smartphone },
};

const POR_DEFECTO = { fondo: "#f1f5f9", tinta: "#475569", Icono: Wallet };

/**
 * Los que tienen una versión corta para la pastilla. Los que no están aquí —Efectivo, Yape,
 * Plin— ya son cortos de por sí y usan su nombre de siempre.
 */
const CORTOS: Record<string, string> = {
  debit: "method.debitShort",
  credit: "method.creditShort",
  transfer: "method.transferShort",
};

/** Los mismos colores pero apagados, para que no griten sobre el negro. */
const OSCURO: Record<string, string> = {
  cash: "#94a3b8",
  debit: "#7dd3fc",
  credit: "#c4b5fd",
  transfer: "#67e8f9",
  yape: "#e9d5ff",
  plin: "#7dd3fc",
};

export default function EtiquetaMetodo({
  metodo,
  t,
  oscuro,
}: {
  metodo: string;
  t: (clave: string) => string;
  oscuro: boolean;
}) {
  if (!metodo) return null;
  const { fondo, tinta, Icono } = COLORES[metodo] ?? POR_DEFECTO;
  const color = oscuro ? (OSCURO[metodo] ?? "#94a3b8") : tinta;
  return (
    <View
      className="flex-row items-center rounded-full px-1.5 py-0.5"
      // De noche NO se pinta el fondo: los fondos claros de arriba serían manchas sobre el
      // negro. Basta con el color de la letra, que ya distingue igual.
      style={oscuro ? undefined : { backgroundColor: fondo }}
    >
      <Icono size={10} color={color} strokeWidth={2.4} />
      <Text className="text-[10px] font-bold ml-1" style={{ color }} numberOfLines={1}>
        {/* EL NOMBRE CORTO, Y SOLO AQUÍ.
            *"Se ve apretado la fecha y la hora"*: con "Tarjeta débito" en la pastilla ya no
            entraban los cuatro datos de la fila y la hora se cortaba con puntos suspensivos.
            Y sobraban letras, no espacio: el icono de al lado ya dice que es una tarjeta, así
            que "Débito" no pierde nada y ocupa la mitad.
            En el detalle del movimiento y en los filtros sigue el nombre completo — ahí hay
            sitio de sobra y conviene la palabra entera. */}
        {CORTOS[metodo] ? t(CORTOS[metodo]) : methodLabel(metodo, t)}
      </Text>
    </View>
  );
}
