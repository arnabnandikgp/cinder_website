// Display only: never round the feed's underlying values.
const valid = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function percent(value: number | undefined, decimals = 2): string {
  if (!valid(value)) return "—";
  if (value === 0) return "0.00%";
  const sign = value < 0 ? "−" : "+";
  const magnitude = Math.abs(value);
  const minimum = 10 ** -decimals;
  if (magnitude < minimum) return `${sign}<${minimum.toFixed(decimals)}%`;
  return `${sign}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: magnitude >= 100 ? 0 : 2,
    maximumFractionDigits:
      magnitude >= 1000 ? 0 : magnitude >= 100 ? 1 : decimals,
  }).format(magnitude)}%`;
}

export function fundingPercent(rate: number | undefined): string {
  // Funding needs finer precision than ordinary percentage changes: the
  // common 0.00125% hourly rate must not become 0.00% or just <0.01%.
  return percent(valid(rate) ? rate * 100 : undefined, 5);
}

export function volumeUsd(value: number | undefined): string {
  if (!valid(value) || value < 0) return "—";
  if (value > 0 && value < 0.01) return "<$0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    ...(value >= 1000
      ? {
          notation: "compact",
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  }).format(value === 0 ? 0 : value);
}
