import { endpoints, numeric, object, symbol, type LiveVenue } from "./adapters";
import type { Market } from "../data";

// Public, undiscounted venue pricing, NOT Cinder's account/customer fee tier.
// No hardcoded fallback: unavailable or stale pricing must withhold a comparison.
export type VenueFee = {
  takerBps: number;
  fetchedAt: number;
  source: string;
  label: string;
};
export const FEE_MAX_AGE_MS = 300_000;
export function feeUrl(venue: LiveVenue) {
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
  if (venue === "pacifica") {
    if (data.success !== true || !Array.isArray(data.data)) return null;
    const tier = data.data.find((row) => object(row).level === 0);
    takerBps = numeric(object(tier).taker_fee_rate) * 10_000;
    label = "Public tier 0";
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
    const tier = policy.tiers.find(
      (row) => numeric(object(row).threshold_volume) === 0,
    );
    takerBps = numeric(object(tier).taker_bps);
    label = instrument.active_policy
      ? "Public instrument base tier"
      : "Public base tier";
  }
  if (
    !Number.isFinite(takerBps) ||
    takerBps < 0 ||
    takerBps > 100 ||
    !Number.isFinite(fetchedAt)
  )
    return null;
  return { takerBps, fetchedAt, source: feeUrl(venue), label };
}
