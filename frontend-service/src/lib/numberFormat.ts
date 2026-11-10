/** Compact large counts with the familiar K and Indian lakh suffixes. */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const absolute = Math.abs(value);
  const compact = (divisor: number, suffix: string) => {
    const rounded = Math.round((value / divisor) * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${suffix}`;
  };

  if (absolute >= 100_000) return compact(100_000, "L");
  if (absolute >= 1_000) return compact(1_000, "K");
  return value.toLocaleString("en-IN");
}

/** Add Indian digit grouping to a price while preserving its numeric value. */
export function formatPriceWithCommas(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}
