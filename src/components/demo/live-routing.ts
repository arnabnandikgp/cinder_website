import { venues } from "./data";
import type { Book, LiveVenue } from "./market-data/adapters";
import {
  COMPARISON_HISTORY_MS,
  type BookObservation,
  type FeedState,
} from "./market-data/feed";
import { FEE_MAX_AGE_MS, type VenueFee } from "./market-data/fees";
import type {
  Candidate,
  Quote,
  RouteComparison,
  RouteInput,
  Side,
} from "./routing";

export const comparisonVenues: LiveVenue[] = ["pacifica", "bulk", "phoenix"];
// Conservative read-only preview policy, not a promise of executable prices.
export const BOOK_MAX_AGE_MS = 2000;
export const BOOK_MAX_SKEW_MS = 1000;
export const FUTURE_TOLERANCE_MS = 500;
export const SIMILAR_COST_BPS = 0.5;
export type Curve = {
  venue: LiveVenue;
  capacity: number;
  points: { notional: number; cost: number }[];
  delayed?: boolean;
};
export type Observation = {
  venue: LiveVenue;
  sourceAt: number;
  receivedAt: number;
  sourceTime?: string;
  bidLevels: number;
  askLevels: number;
  reason: string | null;
  fee: VenueFee | null;
};
export type LiveComparisonMeta = {
  asOf: number;
  now: number;
  aligned: boolean;
  alignmentReason: string | null;
  tied: boolean;
  observations: Observation[];
  curves: Curve[];
  chartMax: number;
  // Read-only observations retained for visual continuity. Never candidates
  // for ranking, savings, route selection or order review.
  delayedQuotes: Partial<Record<LiveVenue, Quote>>;
  displayReference: number;
};
export type ComparisonFeeds = Record<LiveVenue, FeedState>;

function validBook(book: Book) {
  return (
    [book.bids, book.asks].every(
      (levels, side) =>
        levels.length > 0 &&
        levels.every(
          (level, i) =>
            Number.isFinite(level.price) &&
            level.price > 0 &&
            Number.isFinite(level.size) &&
            level.size > 0 &&
            (!i ||
              (side === 0
                ? levels[i - 1].price > level.price
                : levels[i - 1].price < level.price)),
        ),
    ) && book.bids[0].price < book.asks[0].price
  );
}

export function bookIssue(
  feed: FeedState,
  now: number,
  maxAge = BOOK_MAX_AGE_MS,
): string | null {
  if (feed.connection === "offline") return "Offline · waiting for connection";
  if (feed.connection === "reconnecting") return "Reconnecting to venue";
  if (feed.connection === "unsupported") return "Live data unavailable";
  if (feed.connection !== "connected" || !feed.book || !feed.bookAt)
    return "Waiting for order book";
  if (!validBook(feed.book)) return "Invalid order book";
  if (
    ![now, feed.book.time, feed.bookAt].every(Number.isFinite) ||
    feed.book.time > now + FUTURE_TOLERANCE_MS ||
    feed.bookAt > now + FUTURE_TOLERANCE_MS
  )
    return "Timestamp ahead of clock";
  if (
    now - feed.book.time > maxAge + (feed.book.timePrecisionMs ?? 1) - 1 ||
    now - feed.bookAt > maxAge
  )
    return "Stale book · comparison paused";
  return null;
}

function validFee(fee: VenueFee | null, now: number): fee is VenueFee {
  return Boolean(
    fee &&
    Number.isFinite(fee.fetchedAt) &&
    now - fee.fetchedAt <= FEE_MAX_AGE_MS &&
    fee.fetchedAt <= now + FUTURE_TOLERANCE_MS &&
    Number.isFinite(fee.takerBps) &&
    fee.takerBps >= 0 &&
    fee.takerBps <= 100,
  );
}

function compatible(a: BookObservation, b: BookObservation) {
  // Phoenix stamps whole seconds. Compare the timestamp intervals without
  // pretending that its source clock has millisecond precision.
  const sourceGap = Math.max(
    a.book.time - (b.book.time + (b.book.timePrecisionMs ?? 1) - 1),
    b.book.time - (a.book.time + (a.book.timePrecisionMs ?? 1) - 1),
  );
  return (
    sourceGap <= BOOK_MAX_SKEW_MS &&
    Math.abs(a.receivedAt - b.receivedAt) <= BOOK_MAX_SKEW_MS
  );
}

// Select the largest pairwise-aligned cohort, then the newest conservative
// receive watermark. A slower venue must not veto two healthy venues. Looking
// back a few accepted frames avoids racing three independently arriving feeds.
export function alignedBooks(
  options: Partial<Record<LiveVenue, BookObservation[]>>,
) {
  let best: Partial<Record<LiveVenue, BookObservation>> = {};
  let count = 0,
    watermark = 0,
    sum = 0;
  function visit(index: number, chosen: typeof best) {
    const values = Object.values(chosen) as BookObservation[];
    if (index === comparisonVenues.length) {
      const nextWatermark = values.length
        ? Math.min(...values.map((o) => o.receivedAt))
        : 0;
      const nextSum = values.reduce((total, o) => total + o.receivedAt, 0);
      if (
        values.length > count ||
        (values.length === count &&
          (nextWatermark > watermark ||
            (nextWatermark === watermark && nextSum > sum)))
      ) {
        best = chosen;
        count = values.length;
        watermark = nextWatermark;
        sum = nextSum;
      }
      return;
    }
    const venue = comparisonVenues[index];
    for (const observation of options[venue] ?? []) {
      if (values.every((o) => compatible(o, observation)))
        visit(index + 1, { ...chosen, [venue]: observation });
    }
    visit(index + 1, chosen);
  }
  visit(0, {});
  return best;
}

export function walkBook(
  venue: LiveVenue,
  book: Book,
  side: Side,
  quantity: number,
  reference: number,
  feeBps: number,
): Quote | null {
  if (
    ![quantity, reference, feeBps].every(Number.isFinite) ||
    quantity <= 0 ||
    reference <= 0 ||
    feeBps < 0 ||
    !validBook(book)
  )
    return null;
  let remaining = quantity,
    notional = 0,
    worstFill = 0;
  for (const level of side === "Buy" ? book.asks : book.bids) {
    const consumed = Math.min(remaining, level.size);
    notional += consumed * level.price;
    remaining -= consumed;
    worstFill = level.price;
    if (remaining <= quantity * 1e-12) break;
  }
  if (remaining > quantity * 1e-12 || !Number.isFinite(notional)) return null;
  const averageFill = notional / quantity;
  const venueFee = (notional * feeBps) / 10000;
  const direction = side === "Buy" ? 1 : -1;
  const priceCost = direction * (notional - quantity * reference);
  const totalCost = priceCost + venueFee;
  return {
    venue,
    quantity,
    averageFill,
    worstFill,
    notional,
    venueFee,
    // Unknown Cinder pricing is EXCLUDED, not represented to users as free.
    cinderFee: 0,
    totalFees: venueFee,
    priceCost,
    totalCost,
    costBps: (totalCost / (quantity * reference)) * 10000,
    effectivePrice: averageFill + (direction * venueFee) / quantity,
  };
}

export function compareLiveRoutes(
  input: RouteInput,
  feeds: ComparisonFeeds,
  now: number,
): RouteComparison {
  const observations: Observation[] = comparisonVenues.map((venue) => {
    const feed = feeds[venue];
    const fee = feed.fee ?? null;
    let reason = bookIssue(feed, now);
    if (!reason && !validFee(fee, now))
      reason =
        feed.feeError || (fee ? "Fee schedule expired" : "Loading venue fees");
    return {
      venue,
      sourceAt: feed.book?.time ?? 0,
      receivedAt: feed.bookAt,
      sourceTime: feed.book?.sourceTime,
      bidLevels: feed.book?.bids.length ?? 0,
      askLevels: feed.book?.asks.length ?? 0,
      reason,
      fee,
    };
  });
  const fresh = observations.filter(
    (o) => !o.reason && input.allowed.includes(o.venue),
  );
  const options = Object.fromEntries(
    fresh.map((o) => {
      const feed = feeds[o.venue];
      const latest = { book: feed.book!, receivedAt: feed.bookAt };
      const history = (feed.books ?? []).filter(
        (old) =>
          old.book !== latest.book &&
          !bookIssue({ ...feed, book: old.book, bookAt: old.receivedAt }, now),
      );
      return [o.venue, [...history.slice(-23), latest].reverse()];
    }),
  );
  let selected = alignedBooks(options);
  const selectedCount = Object.keys(selected).length;
  const alignmentReason =
    fresh.length > 1 && selectedCount < 2
      ? "Books out of sync · waiting for aligned updates"
      : null;
  if (alignmentReason) selected = {};
  for (const observation of fresh) {
    const chosen = selected[observation.venue];
    if (!chosen)
      observation.reason = "Books out of sync · waiting for aligned updates";
    else {
      observation.sourceAt = chosen.book.time;
      observation.receivedAt = chosen.receivedAt;
      observation.sourceTime = chosen.book.sourceTime;
      observation.bidLevels = chosen.book.bids.length;
      observation.askLevels = chosen.book.asks.length;
    }
  }
  const comparable = observations.filter(
    (o) => !o.reason && input.allowed.includes(o.venue),
  );
  const aligned = comparable.length > 1;
  // Freeze one reference for this entire calculation. Same quantity on every
  // venue. No fallback to the old fictional market prices on feed failure.
  const reference = comparable.length
    ? comparable.reduce((sum, o) => {
        const book = selected[o.venue]!.book;
        return sum + (book.bids[0].price + book.asks[0].price) / 2;
      }, 0) / comparable.length
    : NaN;
  if (input.notional !== undefined) {
    // One USDC exposure becomes the same base quantity for every candidate.
    // Never treat the entered USDC value as SOL/BTC or apply leverage to it.
    input = {
      ...input,
      quantity:
        Number.isFinite(input.notional) && input.notional > 0 && reference > 0
          ? input.notional / reference
          : NaN,
    };
  }
  const sizeValid =
    Number.isFinite(input.quantity) &&
    input.quantity > 0 &&
    Number.isFinite(input.quantity * reference);
  const candidates: Candidate[] = comparisonVenues.map((venue) => {
    const observation = observations.find((o) => o.venue === venue)!;
    let reason = !input.allowed.includes(venue)
      ? "Excluded in preferences"
      : (observation.reason ?? alignmentReason);
    const quote = !reason
      ? walkBook(
          venue,
          selected[venue]!.book,
          input.side,
          input.quantity,
          reference,
          observation.fee!.takerBps,
        )
      : null;
    if (!reason) {
      if (!sizeValid) reason = "Enter a valid order size";
      else if (!quote) reason = "Insufficient visible depth for this size";
      else if (input.account === "stale") reason = "Account updates paused";
      else if (input.account === "empty")
        reason = "No sample collateral available";
      else if (!Number.isFinite(input.leverage) || input.leverage <= 0)
        reason = "Select a valid leverage preference";
      else if (
        !Number.isFinite(input.slippage) ||
        input.slippage <= 0 ||
        input.slippage >= 100
      )
        reason = "Enter a valid price tolerance";
      // Adverse movement only: a favourable price must never fail this gate.
      else if (
        (input.side === "Buy" ? 1 : -1) *
          (quote.worstFill / reference - 1) *
          100 >
        input.slippage + 1e-10
      )
        reason = "Beyond price tolerance";
      else if (quote.notional / input.leverage + quote.totalFees > 7400)
        reason = "Exceeds sample margin budget";
    }
    return { venue, quote, reason };
  });
  const ranked = candidates
    .filter((c) => c.quote && !c.reason)
    .map((c) => c.quote!)
    .sort(
      (a, b) => a.totalCost - b.totalCost || a.venue.localeCompare(b.venue),
    );
  const difference =
    ranked.length > 1 ? ranked[1].totalCost - ranked[0].totalCost : null;
  const tied =
    difference !== null &&
    difference <=
      Math.max(0.01, (input.quantity * reference * SIMILAR_COST_BPS) / 10000);
  // Stable preference within the similarity band, never a "saving" claim.
  const best =
    (tied
      ? ranked.find(
          (q) =>
            q.venue ===
            input.allowed.find((v) => ranked.some((r) => r.venue === v)),
        )
      : ranked[0]) ?? null;
  const savings = tied ? null : difference;
  const explanation = !best
    ? "No comparable estimate. Check the venue status, order size and price tolerance."
    : tied
      ? "Estimates are within 0.5 bps or one cent. No clear cost advantage; venue preference is retained."
      : ranked.length === 1
        ? "Only one complete estimate is available. This does not establish a cheaper venue."
        : `Lowest estimated entry cost using visible books and public venue fees. ${venues[ranked[1].venue]} is the next comparable venue.`;
  const displayBooks: Partial<Record<LiveVenue, Book>> = {};
  for (const o of observations) {
    if (!input.allowed.includes(o.venue)) continue;
    if (!o.reason) displayBooks[o.venue] = selected[o.venue]!.book;
    else if (
      (o.reason.startsWith("Stale book") ||
        o.reason.startsWith("Books out of sync")) &&
      // Relax age ONLY for explicitly delayed, non-actionable presentation.
      !bookIssue(feeds[o.venue], now, COMPARISON_HISTORY_MS) &&
      validFee(o.fee, now)
    )
      displayBooks[o.venue] = feeds[o.venue].book!;
  }
  const displayValues = Object.values(displayBooks) as Book[];
  const displayReference = Number.isFinite(reference)
    ? reference
    : displayValues.length
      ? displayValues.reduce(
          (sum, b) => sum + (b.bids[0].price + b.asks[0].price) / 2,
          0,
        ) / displayValues.length
      : NaN;
  const displayQuantity =
    input.notional !== undefined
      ? input.notional / displayReference
      : input.quantity;
  const delayedQuotes: LiveComparisonMeta["delayedQuotes"] = {};
  for (const o of observations) {
    const book = displayBooks[o.venue];
    if (book && o.reason) {
      const quote = walkBook(
        o.venue,
        book,
        input.side,
        displayQuantity,
        displayReference,
        o.fee!.takerBps,
      );
      if (quote) delayedQuotes[o.venue] = quote;
    }
  }
  const capacities = Object.values(displayBooks).map(
    (book) =>
      (input.side === "Buy" ? book!.asks : book!.bids).reduce(
        (sum, l) => sum + l.size,
        0,
      ) * displayReference,
  );
  const maxCapacity = Math.max(0, ...capacities.filter(Number.isFinite));
  // Keep small books legible instead of drawing a few pixels on a fixed $150k axis.
  const targetMax = Math.max(
    1000,
    Math.min(
      250000,
      Math.max(maxCapacity, sizeValid ? input.quantity * reference * 1.1 : 0),
    ),
  );
  const magnitude = 10 ** Math.floor(Math.log10(targetMax));
  const chartMax = Math.ceil(targetMax / magnitude / 0.5) * magnitude * 0.5;
  const curves: Curve[] = comparisonVenues.map((venue) => {
    const observation = observations.find((o) => o.venue === venue)!;
    if (!displayBooks[venue] || !Number.isFinite(displayReference))
      return { venue, capacity: 0, points: [] };
    const book = displayBooks[venue]!;
    const levels = input.side === "Buy" ? book.asks : book.bids;
    const capacity =
      levels.reduce((sum, l) => sum + l.size, 0) * displayReference;
    const end = Math.min(capacity, chartMax);
    const sizes = [
      ...Array.from({ length: 121 }, (_, i) => Math.max(1e-8, (end * i) / 120)),
      end,
      displayQuantity * displayReference,
    ];
    const points = [
      ...new Set(sizes.filter((n) => Number.isFinite(n) && n > 0 && n <= end)),
    ]
      .sort((a, b) => a - b)
      .flatMap((notional) => {
        const q = walkBook(
          venue,
          book,
          input.side,
          notional / displayReference,
          displayReference,
          observation.fee!.takerBps,
        );
        return q ? [{ notional, cost: q.costBps }] : [];
      });
    return { venue, capacity, points, delayed: Boolean(observation.reason) };
  });
  return {
    input,
    reference,
    candidates,
    ranked,
    best,
    savings,
    explanation,
    live: {
      asOf: comparable.length
        ? Math.min(...comparable.map((o) => o.sourceAt))
        : 0,
      now,
      aligned,
      alignmentReason,
      tied,
      observations,
      curves,
      chartMax,
      delayedQuotes,
      displayReference,
    },
  };
}

export function comparisonStatus(comparison: RouteComparison) {
  const live = comparison.live;
  if (!live) return "Waiting for feeds";
  if (live.alignmentReason) return "Waiting for aligned books";
  const fresh = live.observations.filter(
    (o) => !o.reason && comparison.input.allowed.includes(o.venue),
  ).length;
  return fresh > 1
    ? `Live books · ${fresh} venues`
    : fresh === 1
      ? "1 venue available · comparison limited"
      : "Waiting for fresh venue data";
}
