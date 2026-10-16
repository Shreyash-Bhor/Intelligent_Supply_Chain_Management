export function toMinor(value: string | number) {
  const raw = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error("Unsupported price precision");
  const [whole, fraction = ""] = raw.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw new Error("Price exceeds supported range");
  return amount;
}

export function calculateAmounts(subtotalMinor: number, shippingMinor: number, taxRateBasisPoints: number) {
  if (![subtotalMinor, shippingMinor, taxRateBasisPoints].every(Number.isSafeInteger) || subtotalMinor < 0 || shippingMinor < 0 || taxRateBasisPoints < 0) {
    throw new Error("Invalid checkout amount configuration");
  }
  const taxMinor = Math.round((subtotalMinor * taxRateBasisPoints) / 10000);
  const totalMinor = subtotalMinor + shippingMinor + taxMinor;
  if (!Number.isSafeInteger(totalMinor)) throw new Error("Checkout total exceeds supported range");
  return { subtotalMinor, shippingMinor, taxMinor, totalMinor };
}

export function fromMinor(minor: number) {
  if (!Number.isSafeInteger(minor)) throw new Error("Invalid monetary amount");
  return (minor / 100).toFixed(2);
}
