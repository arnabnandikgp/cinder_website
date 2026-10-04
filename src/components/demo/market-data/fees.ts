import { endpoints, numeric, object, symbol, type LiveVenue } from "./adapters";
import type { Market } from "../data";

// Read-only demo fee model, NOT a verified Cinder account/customer fee tier.
// Volume venues assume qualification for their lowest active published taker
// tier. Rates still come from the API; missing/stale schedules have no fallback.
export type VolumeTierAssumption = {
  tier: string;
  baseTakerBps: number;
  thresholdUsd: number | null;
  thresholdInclusive: boolean;
  windowDays: number;
  completedUtcDays: boolean;
  docs: string;
};
export type VenueFee = {
  takerBps: number;
  fetchedAt: number;
  source: string;
  label: string;
  volumeTier?: VolumeTierAssumption;
};

// Pacifica's rate API exposes levels, but not their volume thresholds. These
// qualifications are from the official fee docs, checked 2026-10-04. Unknown
// future levels retain the API rate but never invent a threshold.
const pacificaTiers = [
  { tier: "Tier 1", thresholdUsd: 0 },
  { tier: "Tier 2", thresholdUsd: 5_000_000 },
  { tier: "Tier 3", thresholdUsd: 10_000_000 },
  { tier: "Tier 4", thresholdUsd: 25_000_000 },
  { tier: "Tier 5", thresholdUsd: 50_000_000 },
  { tier: "VIP 1", thresholdUsd: 100_000_000 },
  { tier: "VIP 2", thresholdUsd: 250_000_000 },
  { tier: "VIP 3", thresholdUsd: 500_000_000 },
];
export const FEE_MAX_AGE_MS = 300_000;
export function feeUrl(venue: LiveVenue, market: Market = "SOL") {
  if (venue === "phoenix")
    return `${endpoints.phoenix.rest}/view/exchange/market/${market}`;
  return `${endpoints[venue].rest}/${venue === "pacifica" ? "info/fees" : "feeState"}`;
}
export function parseVenueFee(
  venue: LiveVenue,
  market: Market,
  value: unknown,
  fetchedAt: number,
): VenueFee | null {
  const data = object(value);
  let takerBps = NaN;
  let label = "Public base tier";
  let volumeTier: VolumeTierAssumption | undefined;
  if (venue === "pacifica") {
    if (data.success !== true || !Array.isArray(data.data)) return null;
    const tiers = data.data.map((value) => {
      const row = object(value);
      return {
        level: numeric(row.level),
        rate: numeric(row.taker_fee_rate) * 10_000,
      };
    });
    if (
      !tiers.length ||
      tiers.some(
        (t) => !Number.isInteger(t.level) || t.level < 0 || !validRate(t.rate),
      )
    )
      return null;
    const base = tiers.find((tier) => tier.level === 0);
    if (!base) return null;
    const tier = [...tiers].sort(
      (a, b) => a.rate - b.rate || a.level - b.level,
    )[0];
    takerBps = tier.rate;
    const requirement = pacificaTiers[tier.level];
    volumeTier = {
      tier: requirement?.tier ?? `API level ${tier.level}`,
      baseTakerBps: base.rate,
      thresholdUsd: requirement?.thresholdUsd ?? null,
      thresholdInclusive: tier.level === 0,
      windowDays: 30,
      completedUtcDays: false,
      docs: "https://docs.pacifica.fi/trading-on-pacifica/trading-fees",
    };
    label = `Lowest volume tier · ${volumeTier.tier} (assumed)`;
  } else if (venue === "phoenix") {
    if (data.symbol !== market || data.marketStatus !== "active") return null;
    // Observed API values are fractions (0.00035 = 3.5 bps), despite the
    // generated endpoint docs describing them as percentages.
    takerBps = numeric(data.takerFee) * 10_000;
    label = "Public market fee";
  } else {
    if (!Array.isArray(data.scopes)) return null;
    const instrument = object(
      data.scopes.find(
        (row) => object(row).instrument === symbol(venue, market),
      ),
    );
    const global = object(
      data.scopes.find((row) => object(row).instrument === "global"),
    );
    // Instrument policy supersedes global pricing; an unrecognised policy
    // must not silently fall back to a cheaper global fee.
    const policy = object(
      instrument.active_policy ??
        (data.globalPolicyActive === true ? global.active_policy : null),
    );
    if (!Array.isArray(policy.tiers)) return null;
    const tiers = policy.tiers.map((value) => {
      const row = object(value);
      return {
        threshold: numeric(row.threshold_volume),
        rate: numeric(row.taker_bps),
      };
    });
    if (
      !tiers.length ||
      tiers.some(
        (t) =>
          !Number.isFinite(t.threshold) ||
          t.threshold < 0 ||
          !validRate(t.rate),
      )
    )
      return null;
    const base = tiers.find((tier) => tier.threshold === 0);
    if (!base) return null;
    const tier = [...tiers].sort(
      (a, b) => a.rate - b.rate || a.threshold - b.threshold,
    )[0];
    const windowDays =
      policy.window_days === undefined ? 14 : numeric(policy.window_days);
    if (!Number.isInteger(windowDays) || windowDays <= 0) return null;
    takerBps = tier.rate;
    volumeTier = {
      tier: instrument.active_policy
        ? "Lowest instrument volume tier"
        : "Lowest volume tier",
      baseTakerBps: base.rate,
      thresholdUsd: tier.threshold,
      thresholdInclusive: true,
      windowDays,
      completedUtcDays: true,
      docs: "https://docs.bulk.trade/bulk-exchange/fees",
    };
    label = `${volumeTier.tier} (assumed)`;
  }
  if (!validRate(takerBps) || !Number.isFinite(fetchedAt)) return null;
  return {
    takerBps,
    fetchedAt,
    source: feeUrl(venue, market),
    label,
    ...(volumeTier ? { volumeTier } : {}),
  };
}

function validRate(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function volumeRequirement(tier: VolumeTierAssumption) {
  if (tier.thresholdUsd === null) return "See venue schedule for qualification";
  if (tier.thresholdUsd === 0)
    return "No volume threshold in the selected tier";
  const threshold =
    tier.thresholdUsd >= 1_000_000_000
      ? `${tier.thresholdUsd / 1_000_000_000}B`
      : tier.thresholdUsd >= 1_000_000
        ? `${tier.thresholdUsd / 1_000_000}M`
        : tier.thresholdUsd.toLocaleString("en-US");
  return `${tier.thresholdInclusive ? "≥" : ">"} $${threshold} executed volume`;
}

/** Fee identity excludes refresh timestamps, so unchanged polls do not reset
 * the five-second window. Never average across different pricing assumptions. */
export function feeBasisKey(fee: VenueFee | null | undefined) {
  return fee
    ? JSON.stringify([fee.takerBps, fee.source, fee.label, fee.volumeTier])
    : "missing";
}
