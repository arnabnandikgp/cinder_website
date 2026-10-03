// Local instruction previews only. These schedules never submit or execute orders.
export const strategies = {
  Scale: "A limit ladder across a price range",
  Chase: "Follow the best quote within a boundary",
  TWAP: "Spread an order over time",
  VWAP: "Schedule slices against a volume profile",
  "Chase TWAP": "Timed slices with passive price chasing",
  Iceberg: "Display a portion, replenish after fills",
  Swarm: "A short sequence of small market clips",
} as const;
export type Strategy = keyof typeof strategies;
export const isStrategy = (type: string): type is Strategy =>
  Object.hasOwn(strategies, type);
export type StrategyConfig = {
  start: string;
  end: string;
  count: string;
  skew: string;
  boundary: string;
  duration: string;
  interval: string;
  tip: string;
  pace: string;
  randomize: boolean;
  breach: "Pause" | "Cancel";
  catchUp: "Passive only" | "Bounded market";
};
export const initialStrategy: StrategyConfig = {
  start: "",
  end: "",
  count: "5",
  skew: "1",
  boundary: "",
  duration: "5",
  interval: "30",
  tip: "",
  pace: "2",
  randomize: false,
  breach: "Cancel",
  catchUp: "Passive only",
};
// Allocations are USDC notional, not equal base-asset quantities at each price.
export type PlanRow = { quantity: number; price?: number; seconds?: number };
export type StrategyPlan = {
  kind: Strategy;
  sizeUnit: "USDC";
  config: StrategyConfig;
  quantity: number;
  rows: PlanRow[];
  summary: string;
  note: string;
};
export type PlanResult = {
  plan?: StrategyPlan;
  errors: Record<string, string>;
};

export function positive(value: string) {
  return (
    /^\d+(\.\d+)?$/.test(value.trim()) &&
    Number(value) > 0 &&
    Number.isFinite(Number(value))
  );
}

function previewPrecision(value: string) {
  return (value.trim().split(".")[1]?.replace(/0+$/, "").length ?? 0) <= 8;
}

// Eight-decimal local preview precision, NOT a venue lot-size rule. Allocate
// integer units and distribute residuals so every ladder/schedule conserves size.
function allocate(quantity: number, weights: number[]) {
  const units = Math.round(quantity * 1e8);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (units * w) / sum);
  const result = raw.map(Math.floor);
  const order = raw
    .map((n, i) => ({ i, remainder: n - result[i] }))
    .sort((a, b) => b.remainder - a.remainder);
  let remaining = units - result.reduce((a, b) => a + b, 0);
  for (const { i } of order) {
    if (remaining-- <= 0) break;
    result[i]++;
  }
  return result.map((n) => n / 1e8);
}

export function buildStrategyPlan(
  kind: Strategy,
  size: string,
  limit: string,
  config: StrategyConfig,
): PlanResult {
  const errors: Record<string, string> = {};
  const quantity = Number(size);
  if (
    !positive(size) ||
    quantity < 1e-8 ||
    quantity > 1e6 ||
    !previewPrecision(size)
  )
    errors.size =
      "Use a positive USDC size up to 1,000,000, with at most 8 decimals for this preview.";
  const requireValue = (key: keyof StrategyConfig, label: string) => {
    if (!positive(String(config[key])) || Number(config[key]) > 1e12)
      errors[key] = `Enter ${label} greater than zero.`;
  };
  let count = 1;
  const timed = ["TWAP", "VWAP", "Chase TWAP"].includes(kind);
  if (kind === "Scale" || kind === "Swarm") {
    count = Number(config.count);
    if (!Number.isInteger(count) || count < 2 || count > 100)
      errors.count = "Choose 2 to 100 orders for the preview.";
  }
  if (kind === "Scale") {
    requireValue("start", "a start price");
    requireValue("end", "an end price");
    if (positive(config.start) && Number(config.start) === Number(config.end))
      errors.end = "Use a different end price.";
    if (
      !positive(config.skew) ||
      Number(config.skew) < 0.1 ||
      Number(config.skew) > 10
    )
      errors.skew = "Use a size skew from 0.1 to 10.";
  }
  if (kind === "Chase" || kind === "Chase TWAP")
    requireValue("boundary", "a chase boundary");
  if (timed) {
    requireValue("duration", "a duration");
    requireValue("interval", "an interval");
    if (Number(config.duration) > 1440)
      errors.duration = "Use a duration of 24 hours or less for this preview.";
    count = Math.ceil((Number(config.duration) * 60) / Number(config.interval));
    if (!Number.isFinite(count) || count < 2 || count > 200)
      errors.interval = "Adjust the interval to create 2 to 200 slices.";
    if (config.boundary && !positive(config.boundary))
      errors.boundary = "Enter a positive price boundary, or clear it.";
  }
  if (kind === "Iceberg") {
    if (!positive(limit))
      errors.limit = "Enter a limit price greater than zero.";
    requireValue("tip", "a displayed size");
    if (!previewPrecision(config.tip))
      errors.tip = "Use at most 8 decimals for the displayed size preview.";
    if (Number(config.tip) >= quantity)
      errors.tip = "Displayed size must be smaller than the total size.";
    count = Math.ceil(quantity / Number(config.tip));
    if (!Number.isFinite(count) || count > 200)
      errors.tip =
        "Increase displayed size to use at most 200 portions in this preview.";
  }
  if (kind === "Swarm") {
    if (!positive(config.pace) || Number(config.pace) > 10)
      errors.pace =
        "Use a pace above 0 and up to 10 clips per second for this preview.";
    if (config.boundary && !positive(config.boundary))
      errors.boundary = "Enter a positive price boundary, or clear it.";
  }
  if (Object.keys(errors).length) return { errors };
  const weights = Array.from({ length: count }, (_, i) => {
    if (kind === "Scale") return Math.pow(Number(config.skew), i / (count - 1));
    // Deliberately illustrative, not a claimed historical venue volume profile.
    const profile =
      kind === "VWAP" ? 0.5 + Math.sin(((i + 0.5) / count) * Math.PI) ** 2 : 1;
    return profile * (config.randomize ? 0.75 + ((i * 37 + 11) % 53) / 106 : 1);
  });
  const sizes = allocate(quantity, weights);
  if (sizes.some((q) => q <= 0))
    return {
      errors: {
        size: "Increase size or reduce the number of slices for this preview.",
      },
    };
  let rows: PlanRow[] = sizes.map((q, i) => ({
    quantity: q,
    ...(kind === "Scale"
      ? {
          price:
            Number(config.start) +
            ((Number(config.end) - Number(config.start)) * i) / (count - 1),
        }
      : {}),
    ...(timed ? { seconds: i * Number(config.interval) } : {}),
    ...(kind === "Swarm" ? { seconds: i / Number(config.pace) } : {}),
  }));
  if (kind === "Iceberg") {
    const total = Math.round(quantity * 1e8);
    const tip = Math.round(Number(config.tip) * 1e8);
    if (tip < 1)
      return {
        errors: { tip: "Use a displayed size of at least 0.00000001." },
      };
    rows = Array.from({ length: Math.ceil(total / tip) }, (_, i) => ({
      quantity: Math.min(tip, total - i * tip) / 1e8,
      price: Number(limit),
    }));
  }
  const summary =
    kind === "Scale"
      ? `${count} limit orders across your range`
      : kind === "Chase"
        ? "One resting order, repriced within your boundary"
        : kind === "Iceberg"
          ? `${rows.length} displayed portions, replenished after fills`
          : kind === "Swarm"
            ? `${count} market clips over ${((count - 1) / Number(config.pace)).toFixed(1)} seconds`
            : `${count} planned slices across ${config.duration} minutes`;
  const note =
    kind === "VWAP"
      ? "Illustrative volume profile, not venue-derived. This is an allocation example, not a predicted execution price."
      : kind === "Chase"
        ? "Reprice only the unfilled remainder. Maker fills and completion are not guaranteed."
        : kind === "Chase TWAP"
          ? `${config.catchUp === "Passive only" ? "No aggressive catch-up is authorized." : "Catch-up may take liquidity, within the price boundary."} Future fills and fees are not estimated.`
          : kind === "Iceberg"
            ? "Only the displayed portion is intended to rest. Replenishment waits for fills; timing is not predicted."
            : kind === "Scale"
              ? "Prices and sizes are illustrative; venue tick/lot rules and margin are not checked."
              : "Planned amounts and timing only. Future liquidity, fills and fees are not predicted.";
  return {
    errors,
    plan: {
      kind,
      sizeUnit: "USDC",
      config: { ...config },
      quantity,
      rows,
      summary,
      note:
        note +
        (config.randomize &&
        kind !== "Scale" &&
        kind !== "Iceberg" &&
        kind !== "Chase"
          ? " Size variation is a deterministic preview; timing is unchanged."
          : ""),
    },
  };
}
