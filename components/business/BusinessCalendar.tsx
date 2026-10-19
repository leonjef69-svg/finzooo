import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { businessText } from "@/constants/businessUI";
import { ahoraDelNegocio } from "@/utils/negocio";
import { fechaNegocioValida } from "@/utils/negocioWorkspace";

export function businessCalendarDays(month: string): (string|null)[] {
  const [year,index]=month.split("-").map(Number);
  const first=new Date(year,index-1,1,12), count=new Date(year,index,0,12).getDate();
  return [...Array((first.getDay()+6)%7).fill(null),...Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,"0")}`)];
}
export default function BusinessCalendar({value,onChange,language,months}:{value:string;onChange:(value:string)=>void;language:string;months:string[]}) {
  const [month,setMonth]=useState((fechaNegocioValida(value)?value:ahoraDelNegocio().fecha).slice(0,7));
  const [year,index]=month.split("-").map(Number);
  const weekdays=language==="en"?["Mo","Tu","We","Th","Fr","Sa","Su"]:language==="pt"?["Se","Te","Qu","Qu","Se","Sá","Do"]:["Lu","Ma","Mi","Ju","Vi","Sá","Do"];
  const shift=(amount:number)=>{const d=new Date(year,index-1+amount,1,12);setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);};
  return <View className="gap-2"><View className="flex-row items-center justify-between gap-2"><TouchableOpacity accessibilityRole="button" accessibilityLabel={businessText(language,"prevMonth")} onPress={()=>shift(-1)} className="h-11 w-11 items-center justify-center"><ChevronLeft size={22} color="#64748b"/></TouchableOpacity><Text accessibilityRole="header" className="text-sm font-bold text-slate-900 dark:text-slate-100">{months[index-1]} {year}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={businessText(language,"nextMonth")} onPress={()=>shift(1)} className="h-11 w-11 items-center justify-center"><ChevronRight size={22} color="#64748b"/></TouchableOpacity></View><View className="flex-row">{weekdays.map((day,i)=><Text key={i} className="py-1 text-center text-xs text-slate-500 dark:text-slate-300" style={{width:"14.285714%"}}>{day}</Text>)}</View><View className="flex-row flex-wrap">{businessCalendarDays(month).map((date,i)=>date?<TouchableOpacity key={date} accessibilityRole="button" accessibilityLabel={date} accessibilityState={{selected:date===value}} onPress={()=>onChange(date)} className={`min-h-11 items-center justify-center rounded-xl ${date===value?"bg-emerald-600":""}`} style={{width:"14.285714%"}}><Text className={`text-sm font-semibold ${date===value?"text-white":"text-slate-900 dark:text-slate-100"}`}>{Number(date.slice(-2))}</Text></TouchableOpacity>:<View key={i} style={{width:"14.285714%"}}/>)}</View></View>;
}
