import { Text, View } from "react-native";

export default function SpaceTransferAmounts({ title, sentLabel, returnedLabel, sent, returned, format }: {
  title: string;
  sentLabel: string;
  returnedLabel: string;
  sent: number;
  returned: number;
  format: (value: number) => string;
}) {
  return <View className="min-w-0 flex-1">
    <Text numberOfLines={1} className="mb-1 text-[15px] font-extrabold text-slate-900 dark:text-slate-100">{title}</Text>
    <View className="flex-row items-center justify-between gap-3">
      <Text numberOfLines={1} className="min-w-0 flex-1 text-xs font-semibold text-blue-600 dark:text-blue-300">{sentLabel}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className="text-sm font-extrabold text-blue-700 dark:text-blue-200">{format(sent)}</Text>
    </View>
    {returned > 0 && <View className="mt-1 flex-row items-center justify-between gap-3">
      <Text numberOfLines={1} className="min-w-0 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{returnedLabel}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} className="text-sm font-bold text-slate-700 dark:text-slate-200">{format(returned)}</Text>
    </View>}
  </View>;
}
