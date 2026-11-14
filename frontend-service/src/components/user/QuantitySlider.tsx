"use client";

type Props = {
  value: number;
  max: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  disabled?: boolean;
  label?: string;
};

export function QuantitySlider({
  value,
  max,
  onValueChange,
  onValueCommit,
  disabled = false,
  label = "Quantity",
}: Props) {
  const upperBound = Math.max(1, Math.floor(max));
  const quantity = Math.min(upperBound, Math.max(1, Math.floor(value)));
  const progress =
    upperBound === 1 ? 100 : ((quantity - 1) / (upperBound - 1)) * 100;
  const commit = (rawValue: string) => onValueCommit?.(Number(rawValue));

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        <output
          className="min-w-10 rounded-full bg-primary/10 px-3 py-1 text-center text-sm font-semibold tabular-nums text-primary"
          aria-live="polite"
        >
          {quantity}
        </output>
      </div>
      <input
        type="range"
        min={1}
        max={upperBound}
        step={1}
        value={quantity}
        disabled={disabled || upperBound <= 1}
        aria-label={label}
        aria-valuetext={`${quantity} ${quantity === 1 ? "unit" : "units"}`}
        onChange={(event) => onValueChange(Number(event.currentTarget.value))}
        onPointerUp={(event) => commit(event.currentTarget.value)}
        onKeyUp={(event) => commit(event.currentTarget.value)}
        style={{
          background: `linear-gradient(to right, var(--primary) ${progress}%, color-mix(in oklch, var(--muted-foreground) 24%, transparent) ${progress}%)`,
        }}
        className="h-2.5 w-full cursor-pointer appearance-none rounded-full outline-none transition-[background] duration-300 ease-out focus-visible:ring-4 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-[0_2px_10px_color-mix(in_oklch,var(--primary)_45%,transparent)] [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:duration-200 [&::-moz-range-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_2px_10px_color-mix(in_oklch,var(--primary)_45%,transparent)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-200 [&::-webkit-slider-thumb]:hover:scale-110"
      />
      <div
        className="flex justify-between text-[11px] text-muted-foreground"
        aria-hidden="true"
      >
        <span>1</span>
        <span>{upperBound}</span>
      </div>
    </div>
  );
}
