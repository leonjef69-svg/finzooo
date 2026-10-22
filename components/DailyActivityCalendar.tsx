import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useAppData } from "@/contexts/AppDataContext";
import type { DailyCalendarTotal } from "@/utils/reportCalendar";
import type { Month } from "@/types";

const SPEND_COLORS = ["", "#f0fdf4", "#dcfce7", "#bbf7d0", "#4ade80", "#16a34a"];
const WEEKDAYS = {
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
  pt: ["S", "T", "Q", "Q", "S", "S", "D"],
} as const;
const WEEKDAY_NAMES = {
  es: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  pt: ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"],
} as const;

function firstWeekdayIndex(year: number, month: number) {
  // Monday is the first column, matching the calendar used by the app.
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function defaultDay(days: readonly DailyCalendarTotal[], month: Month) {
  const latestWithActivity = [...days].reverse().find((day) => day.income > 0 || day.expense > 0);
  if (latestWithActivity) return latestWithActivity.day;

  const now = new Date();
  return month.y === now.getFullYear() && month.m === now.getMonth() ? now.getDate() : 1;
}

export default function DailyActivityCalendar({
  data,
  month,
  onMonthChange,
}: {
  data: readonly DailyCalendarTotal[];
  month: Month;
  onMonthChange: (month: Month) => void;
}) {
  const { t, fmt, monthNames, userLanguage } = useAppData();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const monthKey = `${month.y}-${month.m}`;
  const [selection, setSelection] = useState<{ monthKey: string; day: number } | null>(null);
  const activeDay = selection?.monthKey === monthKey ? selection.day : defaultDay(data, month);
  const selected = data[activeDay - 1] ?? { day: activeDay, income: 0, expense: 0 };
  const maxExpense = useMemo(() => Math.max(0, ...data.map((day) => day.expense)), [data]);
  const weekdays = WEEKDAYS[userLanguage as keyof typeof WEEKDAYS] ?? WEEKDAYS.es;
  const weekdayNames = WEEKDAY_NAMES[userLanguage as keyof typeof WEEKDAY_NAMES] ?? WEEKDAY_NAMES.es;

  const leadingCells: (DailyCalendarTotal | null)[] = Array.from(
    { length: firstWeekdayIndex(month.y, month.m) },
    () => null,
  );
  const cells = [...leadingCells, ...data];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  const changeMonth = (offset: number) => {
    const next = new Date(month.y, month.m + offset, 1);
    onMonthChange({ y: next.getFullYear(), m: next.getMonth() });
  };

  const activityText = (amount: number, emptyLabel: string, sign: "+" | "−") =>
    amount > 0 ? `${sign}${fmt(amount)}` : emptyLabel;

  return (
    <View>
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-[18px] font-extrabold text-slate-900 dark:text-slate-100">
          {t("reports.byDayTitle")}
        </Text>
        <View className="flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("reports.previousMonth", { month: monthNames[month.m], year: month.y })}
            onPress={() => changeMonth(-1)}
            className="h-10 w-9 items-center justify-center rounded-full active:bg-slate-100 dark:active:bg-noche"
          >
            <ChevronLeft size={22} color={dark ? "#e2e8f0" : "#334155"} strokeWidth={2.5} />
          </Pressable>
          <Text
            className="max-w-[112px] text-center text-[14px] font-bold text-slate-700 dark:text-slate-200"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {monthNames[month.m]} {month.y}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("reports.nextMonth", { month: monthNames[month.m], year: month.y })}
            onPress={() => changeMonth(1)}
            className="h-10 w-9 items-center justify-center rounded-full active:bg-slate-100 dark:active:bg-noche"
          >
            <ChevronRight size={22} color={dark ? "#e2e8f0" : "#334155"} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      <View className="mt-1 flex-row justify-between">
        {weekdays.map((weekday, index) => (
          <Text
            key={`${weekday}-${index}`}
            accessibilityLabel={weekdayNames[index]}
            className="w-[13.8%] text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400"
          >
            {weekday}
          </Text>
        ))}
      </View>

      <View className="mt-2 gap-[3px]">
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} className="flex-row justify-between">
            {week.map((day, dayIndex) => {
              if (!day) return <View key={`blank-${weekIndex}-${dayIndex}`} className="h-[35px] w-[13.8%]" />;

              const isSelected = day.day === activeDay;
              const intensity = day.expense > 0 && maxExpense > 0
                ? Math.min(5, Math.max(1, Math.ceil((day.expense / maxExpense) * 5)))
                : 0;
              const hasIncomeOnly = day.income > 0 && day.expense === 0;
              const backgroundColor = intensity > 0
                ? SPEND_COLORS[intensity]
                : hasIncomeOnly
                  ? (dark ? "#12382e" : "#f0fdf4")
                  : (dark ? "#17212e" : "#f8fafc");
              const textColor = intensity === 5
                ? "#ffffff"
                : intensity > 0
                  ? "#14532d"
                  : isSelected && !dark
                    ? "#166534"
                    : (dark ? "#e2e8f0" : "#334155");
              const accessibilityLabel = `${t("reports.calendarDay", { day: day.day })}. ${t("reports.calendarIncome")}: ${day.income > 0 ? fmt(day.income) : t("reports.calendarNoIncome")}. ${t("reports.calendarExpense")}: ${day.expense > 0 ? fmt(day.expense) : t("reports.calendarNoExpense")}.`;

              return (
                <Pressable
                  key={day.day}
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelection({ monthKey, day: day.day })}
                  className="h-[35px] w-[13.8%] items-center justify-center rounded-[10px]"
                  style={{
                    backgroundColor: isSelected && intensity === 0 ? (dark ? "#14532d" : "#dcfce7") : backgroundColor,
                    borderWidth: isSelected ? 2 : hasIncomeOnly ? 1 : 0.75,
                    borderColor: isSelected ? (dark ? "#34d399" : "#047857") : hasIncomeOnly ? (dark ? "#16634b" : "#86efac") : (dark ? "#334155" : "#e2e8f0"),
                  }}
                >
                  <Text className="text-[13px] font-semibold" style={{ color: textColor }}>
                    {day.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View className="mt-2 border-t border-slate-300 pt-2.5 dark:border-slate-600">
        {selected.income <= 0 && selected.expense <= 0 ? (
          <Text className="py-1 text-center text-[12px] font-medium text-slate-500 dark:text-slate-400">
            {t("reports.calendarNoMovements")}
          </Text>
        ) : (
          <View className="flex-row items-start">
            <View className="flex-1 pr-3">
              <Text className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                {t("reports.calendarIncome")}
              </Text>
              <Text
                numberOfLines={2}
                className={`mt-0.5 text-[15px] font-extrabold ${selected.income > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400 dark:text-slate-500"}`}
              >
                {activityText(selected.income, t("reports.calendarNoIncome"), "+")}
              </Text>
            </View>
            <View className="h-10 w-[2px] bg-slate-400 dark:bg-slate-500" />
            <View className="flex-1 pl-3">
              <Text className="text-[12px] font-semibold text-rose-700 dark:text-rose-300">
                {t("reports.calendarExpense")}
              </Text>
              <Text
                numberOfLines={2}
                className={`mt-0.5 text-right text-[15px] font-extrabold ${selected.expense > 0 ? "text-rose-700 dark:text-rose-300" : "text-slate-400 dark:text-slate-500"}`}
              >
                {activityText(selected.expense, t("reports.calendarNoExpense"), "−")}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
