import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Modal from "@/components/PrivateModal";

export function BusinessButton({label,onPress,secondary=false,danger=false,disabled=false,testID}:{label:string;onPress:()=>void;secondary?:boolean;danger?:boolean;disabled?:boolean;testID?:string}) {
  return <TouchableOpacity testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress} className={`min-h-11 items-center justify-center rounded-xl px-3 py-3 ${disabled?"opacity-40":""} ${danger?"bg-rose-600":secondary?"bg-slate-100 dark:bg-noche-2":"bg-emerald-600"}`}><Text className={`text-sm font-bold ${secondary&&!danger?"text-slate-800 dark:text-slate-100":"text-white"}`}>{label}</Text></TouchableOpacity>;
}
export function BusinessChoice({label,detail,subtitle,large=false,onPress,selected=false,disabled=false,testID}:{label:string;detail?:string;subtitle?:string;large?:boolean;onPress:()=>void;selected?:boolean;disabled?:boolean;testID?:string}) {
  return <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} className={`min-h-12 flex-row flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 ${selected?"border-emerald-600 bg-emerald-50 dark:bg-emerald-950":"border-slate-200 bg-white dark:border-noche-borde dark:bg-noche-2"} ${disabled?"opacity-50":""}`}><View className="min-w-0 flex-1 gap-1"><Text className={`font-semibold text-slate-900 dark:text-slate-100 ${large?"text-lg":"text-sm"}`}>{label}</Text>{subtitle?<Text className="text-xs text-slate-500 dark:text-slate-300">{subtitle}</Text>:null}</View>{detail?<Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{detail}</Text>:null}</TouchableOpacity>;
}
export function BusinessField({label,value,onChange,amount=false,hint,maxLength=60,onCalendar,calendarLabel}:{label:string;value:string;onChange:(value:string)=>void;amount?:boolean;hint?:string;maxLength?:number;onCalendar?:()=>void;calendarLabel?:string}) {
  const input=<TextInput accessibilityLabel={label} disableFullscreenUI value={value} onChangeText={onChange} placeholder={hint|| (amount?"0.00":"")} placeholderTextColor="#64748b" keyboardType={amount?"decimal-pad":"default"} autoCapitalize={amount?"none":"sentences"} maxLength={maxLength} className={`min-h-12 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 dark:border-noche-borde dark:bg-noche-2 dark:text-slate-100 ${onCalendar?"flex-1 ":""}${amount?"text-2xl font-bold":"text-base"}`} />;
  return <View className="gap-1.5"><Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</Text>{onCalendar?<View className="flex-row items-center gap-2">{input}<TouchableOpacity accessibilityRole="button" accessibilityLabel={calendarLabel??label} onPress={onCalendar} className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-noche-2"><CalendarDays size={22} color="#64748b"/></TouchableOpacity></View>:input}</View>;
}
export function BusinessQuantityStepper({label,value,onChange,hint,decreaseLabel,increaseLabel,min=1,max=50}:{label:string;value:string;onChange:(value:string)=>void;hint:string;decreaseLabel:string;increaseLabel:string;min?:number;max?:number}) {
  const quantity=Number(value), valid=Number.isInteger(quantity)&&quantity>=min&&quantity<=max;
  const canDecrease=valid&&quantity<=min,canIncrease=valid&&quantity>=max;
  const changeBy=(step:number)=>{
    const current=Number(value);
    const next=Number.isInteger(current)?Math.max(min,Math.min(max,current+step)):min;
    onChange(String(next));
  };
  return <View className="gap-1.5">
    <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</Text>
    <View className="flex-row items-center gap-2">
      <TouchableOpacity testID="business-quantity-decrease" accessibilityRole="button" accessibilityLabel={decreaseLabel} disabled={canDecrease} onPress={()=>changeBy(-1)} className={`h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-noche-borde dark:bg-noche-2 ${canDecrease?"opacity-40":""}`}>
        <ArrowDown size={26} color="#475569" />
      </TouchableOpacity>
      <TextInput testID="business-quantity-input" accessibilityLabel={label} accessibilityHint={hint} disableFullscreenUI value={value} onChangeText={onChange} keyboardType="number-pad" autoCapitalize="none" maxLength={3} className="min-h-14 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-2xl font-bold text-slate-900 dark:border-noche-borde dark:bg-noche-2 dark:text-slate-100" />
      <TouchableOpacity testID="business-quantity-increase" accessibilityRole="button" accessibilityLabel={increaseLabel} disabled={canIncrease} onPress={()=>changeBy(1)} className={`h-14 w-14 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40 ${canIncrease?"opacity-40":""}`}>
        <ArrowUp size={26} color="#047857" />
      </TouchableOpacity>
    </View>
  </View>;
}
export function BusinessSheet({title,children,onClose,onBack,backLabel,closeLabel}:{title:string;children:ReactNode;onClose:()=>void;onBack?:()=>void;backLabel:string;closeLabel:string}) {
  const {height}=useWindowDimensions(), insets=useSafeAreaInsets();
  return <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onBack||onClose}>
    <View className="flex-1 justify-end bg-black/45" accessibilityViewIsModal>
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} className="absolute inset-0" />
      <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined}>
        <View className="rounded-t-[28px] bg-white px-5 dark:bg-noche" style={{maxHeight:height*0.92,paddingBottom:Math.max(insets.bottom,16)}}>
          <View className="my-2.5 h-1 w-9 self-center rounded-full bg-slate-300 dark:bg-slate-600" />
          {onBack?<TouchableOpacity accessibilityRole="button" onPress={onBack} className="min-h-11 flex-row items-center gap-1 self-start"><ChevronLeft size={17} color="#059669"/><Text className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{backLabel}</Text></TouchableOpacity>:null}
          <View className="mb-2 flex-row items-center justify-between gap-2"><Text accessibilityRole="header" className="min-w-0 flex-1 text-base font-extrabold text-slate-900 dark:text-slate-100">{title}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} className="h-11 w-11 items-center justify-center"><X size={20} color="#64748b" /></TouchableOpacity></View>
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{gap:12,paddingBottom:12}}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}
