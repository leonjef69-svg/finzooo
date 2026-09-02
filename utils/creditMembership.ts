export type MembershipPurchase = {
  total: number;
  createdAt: string;
};

function validDate(value: Date) {
  return Number.isFinite(value.getTime());
}

function addMonthsClamped(start: Date, months: number) {
  const first = new Date(
    start.getFullYear(),
    start.getMonth() + months,
    1,
    0,
    0,
    0,
    0,
  );
  const lastDay = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  first.setDate(Math.min(start.getDate(), lastDay));
  return first;
}

function addYearsClamped(start: Date, years: number) {
  const result = new Date(start);
  result.setDate(1);
  result.setFullYear(start.getFullYear() + years);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(start.getDate(), lastDay));
  result.setHours(0, 0, 0, 0);
  return result;
}

export function membershipProgress(
  purchases: MembershipPurchase[],
  monthlyGoal: number,
  startDate: string,
  nowValue = new Date(),
) {
  const originalStart = new Date(`${startDate}T00:00:00`);
  const now = new Date(nowValue);
  if (!validDate(originalStart) || !validDate(now) || monthlyGoal <= 0)
    return null;

  let cycle = Math.max(0, now.getFullYear() - originalStart.getFullYear());
  while (cycle > 0 && addYearsClamped(originalStart, cycle) > now) cycle -= 1;
  while (addYearsClamped(originalStart, cycle + 1) <= now) cycle += 1;
  const cycleStart = addYearsClamped(originalStart, cycle);
  const cycleEnd = addYearsClamped(originalStart, cycle + 1);
  const started = now >= originalStart;
  const periods = Array.from({ length: 12 }, (_, index) => ({
    start: addMonthsClamped(cycleStart, index),
    end: addMonthsClamped(cycleStart, index + 1),
  }));
  const totals = periods.map(({ start, end }) =>
    purchases.reduce((sum, purchase) => {
      const date = new Date(purchase.createdAt);
      return validDate(date) && date >= start && date < end
        ? sum + Number(purchase.total || 0)
        : sum;
    }, 0),
  );
  const currentIndex = started
    ? periods.findIndex(({ start, end }) => now >= start && now < end)
    : -1;
  const completed = totals.filter(
    (total, index) => periods[index].start <= now && total >= monthlyGoal,
  ).length;
  const missed = totals.filter(
    (total, index) => periods[index].end <= now && total < monthlyGoal,
  ).length;
  const current = currentIndex >= 0 ? totals[currentIndex] : 0;

  return {
    started,
    cycleStart,
    cycleEnd,
    currentIndex,
    current,
    completed,
    missed,
    ratio: Math.min(1, current / monthlyGoal),
    excess: Math.max(0, current - monthlyGoal),
  };
}
