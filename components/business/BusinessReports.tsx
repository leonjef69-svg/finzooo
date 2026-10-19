import { Text, View } from "react-native";
import { useAppData } from "@/contexts/AppDataContext";
import { currencySymbolFor } from "@/constants/currencies";
import { fmt } from "@/utils/format";
import { diferenciaConElMesPasado, resumenPorMes } from "@/utils/negocioTotales";
import { categoriasDelResumen } from "@/utils/negocioWorkspace";
import { ahoraDelNegocio } from "@/utils/negocio";
import { businessText } from "@/constants/businessUI";

/** La comparación anterior sigue disponible, sin recargar la pantalla principal. */
export default function BusinessReports({negocioId}:{negocioId:string}) {
  const {negocios,ventas,movimientosNegocio,userLanguage,t,monthNames}=useAppData();
  const negocio=negocios.find(n=>n.id===negocioId);
  const dinero=(value:number)=>fmt(value,currencySymbolFor(negocio?.moneda??"PEN"));
  const meses=resumenPorMes(negocioId,ventas,movimientosNegocio);
  const diferencia=diferenciaConElMesPasado(meses,ahoraDelNegocio().fecha.slice(0,7));
  const vendidos=categoriasDelResumen(negocioId,{ventas,movimientos:movimientosNegocio});
  return <View className="gap-3">
    {!meses.length?<Text className="text-sm text-slate-500 dark:text-slate-300">{businessText(userLanguage,"noReports")}</Text>:null}
    {meses.map(m=><View key={m.mes} className="gap-1 border-b border-slate-200 py-2 dark:border-noche-borde"><Text className="text-sm font-bold text-slate-900 dark:text-slate-100">{monthNames[Number(m.mes.slice(5))-1]} {m.mes.slice(0,4)}</Text><Text className="text-sm text-emerald-700 dark:text-emerald-300">{businessText(userLanguage,"incomes")} · {dinero(m.entro)}</Text><Text className="text-sm text-rose-700 dark:text-rose-300">{businessText(userLanguage,"expenses")} · {dinero(m.salio)}</Text></View>)}
    {meses.length>1 && diferencia!==null?<Text className="text-sm text-slate-700 dark:text-slate-200">{t(diferencia>0?"panel.comparaMas":diferencia<0?"panel.comparaMenos":"panel.comparaIgual",{monto:dinero(Math.abs(diferencia))})}</Text>:null}
    {vendidos.map(p=><Text key={p.productoId} className="text-sm text-slate-700 dark:text-slate-200">{p.nombre} · {businessText(userLanguage,"incomes")}: {dinero(p.total)}</Text>)}
  </View>;
}
