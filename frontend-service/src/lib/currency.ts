const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactInrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatINR(value: number) {
  return inrFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatINRCompact(value: number) {
  return compactInrFormatter.format(Number.isFinite(value) ? value : 0);
}
