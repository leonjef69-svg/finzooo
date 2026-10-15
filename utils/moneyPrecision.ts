/** Suma montos conservando hasta tres decimales durante los acumulados. */
export function moneyUnits(value: number): bigint {
  if (!Number.isFinite(value) || value === 0) return 0n;

  const [coefficient, exponentText] = Math.abs(value).toString().toLowerCase().split("e");
  const [integer, fraction = ""] = coefficient.split(".");
  const digits = BigInt(`${integer}${fraction}`);
  const exponent = Number(exponentText ?? 0) - fraction.length + 3;
  const units = exponent >= 0
    ? digits * (10n ** BigInt(exponent))
    : (() => {
      const divisor = 10n ** BigInt(-exponent);
      return (digits + divisor / 2n) / divisor;
    })();
  return value < 0 ? -units : units;
}

export function moneyFromUnits(units: bigint): number {
  return Number(units) / 1000;
}

export function sumMoney(values: Iterable<number>): number {
  let total = 0n;
  for (const value of values) total += moneyUnits(value);
  return moneyFromUnits(total);
}

export function sumMoneySigned(values: Iterable<{ amount: number; sign: 1 | -1 }>): number {
  let total = 0n;
  for (const { amount, sign } of values) total += moneyUnits(amount) * BigInt(sign);
  return moneyFromUnits(total);
}
