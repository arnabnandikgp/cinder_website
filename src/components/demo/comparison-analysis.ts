import type { LiveVenue } from "./market-data/adapters";
import {
  COMPARISON_HISTORY_MS,
  type BookObservation,
} from "./market-data/feed";
import { feeBasisKey, type VenueFee } from "./market-data/fees";
import type { Quote, RouteComparison, RouteInput } from "./routing";
import {
  bookIssue,
  bookMidpoint,
  comparisonVenues,
  focusedChartMax,
  quoteIssue,
  SIMILAR_COST_BPS,
  walkBook,
  type ComparisonFeeds,
  type Curve,
} from "./live-routing";
import { entryCostBreakdown } from "./venue-estimates";

export const SAMPLE_MS = 250;
export const PUBLICATION_MS = 1000;
export const AVERAGE_MS = 5000;
export const WINDOW_SLOTS = AVERAGE_MS / SAMPLE_MS;
export const MIN_SHARED_SLOTS = 16; // 80% of the full five-second window.
export type AnalysisMode = "live" | "average";
type Costs = NonNullable<ReturnType<typeof entryCostBreakdown>>;
export type AnalysisRow = {
  venue: LiveVenue;
  costs: Costs | null;
  dollars: number | null;
  reason: string | null;
  delayed: boolean;
  fee?: VenueFee | null;
};
// Intentionally not a RouteComparison/Quote: an average is not routable.
export type AnalysisFrame = {
  mode: AnalysisMode;
  input: RouteInput;
  reference: number;
  rows: AnalysisRow[];
  curves: Curve[];
  chartMax: number;
  publishedAt: number;
  ready: boolean;
  coverage: number;
  status: string;
  capturedBooks?: Partial<Record<LiveVenue, BookObservation>>;
};
type Sample = {
  slot: number;
  books: Partial<Record<LiveVenue, BookObservation>>;
  fees: Partial<Record<LiveVenue, VenueFee>>;
};

export function analysisContext(input: RouteInput) {
  return JSON.stringify([
    input.market,
    input.side,
    input.notional,
    input.quantity,
    input.leverage,
    input.slippage,
    [...input.allowed].sort(),
    input.account,
  ]);
}

export function liveAnalysis(comparison: RouteComparison): AnalysisFrame {
  const reference = comparison.live?.displayReference ?? comparison.reference;
  return {
    mode: "live",
    input: comparison.input,
    reference,
    rows: comparisonVenues.map((venue) => {
      const candidate = comparison.candidates.find((c) => c.venue === venue)!;
      const delayed = comparison.live?.delayedQuotes[venue];
      const quote = candidate.reason ? delayed : candidate.quote;
      return {
        venue,
        costs: quote ? entryCostBreakdown(quote) : null,
        dollars: quote?.totalCost ?? null,
        reason: candidate.reason,
        delayed: Boolean(delayed),
        fee:
          comparison.live?.observations.find((o) => o.venue === venue)?.fee ??
          null,
      };
    }),
    curves: comparison.live?.curves ?? [],
    chartMax: comparison.live?.chartMax ?? 1000,
    publishedAt: comparison.live?.now ?? 0,
    ready: true,
    coverage: 0,
    status: "Live · updates every 1s",
    capturedBooks: comparison.live?.selectedBooks,
  };
}

function sampleQuote(
  sample: Sample,
  venue: LiveVenue,
  input: RouteInput,
  notional = input.notional,
) {
  const book = sample.books[venue]!.book;
  return walkBook(
    venue,
    book,
    input.side,
    notional !== undefined ? notional / bookMidpoint(book) : input.quantity,
    sample.fees[venue]!.takerBps,
  );
}
const mean = (values: number[]) =>
  values.reduce((sum, n) => sum + n, 0) / values.length;

/** Clock slots, not feed-message counts. No interpolation, zero-fill or backfill. */
export class ComparisonWindow {
  private samples: Sample[] = [];
  private startedAt: number | null = null;
  private lastSlot = -Infinity;
  private context = "";

  capture(comparison: RouteComparison, now: number) {
    // The derived base quantity varies with price; only the entered intent is a key.
    const input = {
      ...comparison.input,
      quantity:
        comparison.input.notional !== undefined
          ? NaN
          : comparison.input.quantity,
    };
    const context = `${analysisContext(input)}:${JSON.stringify(comparison.live?.observations.map((o) => [o.venue, feeBasisKey(o.fee)]))}`;
    if (context !== this.context) {
      this.samples = [];
      this.startedAt = null;
      this.lastSlot = -Infinity;
      this.context = context;
    }
    const slot = Math.floor(now / SAMPLE_MS);
    if (slot <= this.lastSlot) return;
    this.lastSlot = slot;
    this.startedAt ??= now;
    const fees: Sample["fees"] = {};
    for (const o of comparison.live?.observations ?? [])
      if (!o.reason && o.fee) fees[o.venue] = o.fee;
    this.samples.push({
      slot,
      books: comparison.live?.selectedBooks ?? {},
      fees,
    });
    this.samples = this.samples.filter((s) => s.slot > slot - WINDOW_SLOTS);
  }

  average(current: RouteComparison, now: number): AnalysisFrame {
    const input = current.input;
    const slot = Math.floor(now / SAMPLE_MS);
    const samples = this.samples.filter(
      (s) => s.slot > slot - WINDOW_SLOTS && s.slot <= slot,
    );
    const warmed =
      this.startedAt !== null && now - this.startedAt >= AVERAGE_MS;
    const notional = input.notional ?? input.quantity * current.reference;
    const available = comparisonVenues.filter(
      (v) => !current.candidates.find((c) => c.venue === v)!.reason,
    );
    let cohort: LiveVenue[] = [],
      shared: Sample[] = [];
    // Largest healthy cohort first; an intermittently missing third venue must
    // not veto a healthy pair. Every ranked venue uses exactly the same slots.
    for (let mask = 1; mask < 1 << available.length; mask++) {
      const subset = available.filter((_, i) => mask & (1 << i));
      if (subset.length < Math.min(2, input.allowed.length)) continue;
      const paired = samples.filter((s) => {
        if (!subset.every((v) => s.books[v] && s.fees[v])) return false;
        return subset.every(
          (v) => !quoteIssue(input, sampleQuote(s, v, input)),
        );
      });
      if (
        paired.length >= MIN_SHARED_SLOTS &&
        (subset.length > cohort.length ||
          (subset.length === cohort.length && paired.length > shared.length))
      ) {
        cohort = subset;
        shared = paired;
      }
    }
    const ready = warmed && cohort.length > 0;
    const rows: AnalysisRow[] = comparisonVenues.map((venue) => {
      const reason = current.candidates.find((c) => c.venue === venue)!.reason;
      const eligible = ready && cohort.includes(venue);
      const quotes = eligible
        ? shared.map((s) => sampleQuote(s, venue, input)!)
        : [];
      const costs = quotes.map((q) => entryCostBreakdown(q)!);
      return {
        venue,
        costs: eligible
          ? {
              priceBps: mean(costs.map((c) => c.priceBps)),
              feeBps: mean(costs.map((c) => c.feeBps)),
              totalBps: mean(costs.map((c) => c.totalBps)),
            }
          : null,
        dollars: eligible ? mean(quotes.map((q) => q.totalCost)) : null,
        reason:
          reason ??
          (eligible
            ? null
            : warmed
              ? "Insufficient shared coverage"
              : "Collecting 5s average"),
        delayed: false,
        fee:
          current.live?.observations.find((o) => o.venue === venue)?.fee ??
          null,
      };
    });
    const capacities = Object.fromEntries(
      cohort.map((v) => [
        v,
        ready
          ? Math.min(
              ...shared.map(
                (s) =>
                  (input.side === "Buy"
                    ? s.books[v]!.book.asks
                    : s.books[v]!.book.bids
                  ).reduce((sum, l) => sum + l.size, 0) *
                  bookMidpoint(s.books[v]!.book),
              ),
            )
          : 0,
      ]),
    );
    const targetMax = Math.max(
      1000,
      Math.min(
        250000,
        Math.max(0, ...Object.values(capacities), notional * 1.1 || 0),
      ),
    );
    const magnitude = 10 ** Math.floor(Math.log10(targetMax));
    const chartMax = Math.ceil(targetMax / magnitude / 0.5) * magnitude * 0.5;
    const focus = focusedChartMax(notional, chartMax);
    const curves: Curve[] = comparisonVenues.map((venue) => {
      const capacity = capacities[venue] ?? 0,
        end = Math.min(capacity, chartMax);
      if (!ready || !end) return { venue, capacity: 0, points: [] };
      const sizes = [
        ...new Set(
          [
            ...Array.from({ length: 121 }, (_, i) =>
              Math.max(1e-8, (end * i) / 120),
            ),
            ...Array.from({ length: 61 }, (_, i) =>
              Math.max(1e-8, (Math.min(end, focus) * i) / 60),
            ),
            end,
            notional,
          ].filter((n) => Number.isFinite(n) && n > 0 && n <= end),
        ),
      ].sort((a, b) => a - b);
      return {
        venue,
        capacity,
        points: sizes.flatMap((size) => {
          const quotes = shared.map((s) => sampleQuote(s, venue, input, size));
          // Do not average just the fillable periods: thin-book periods count too.
          return quotes.every((q): q is Quote => q !== null)
            ? [{ notional: size, cost: mean(quotes.map((q) => q.costBps)) }]
            : [];
        }),
      };
    });
    return {
      mode: "average",
      input,
      // Selected-route context only. Every sample uses its own venue midpoint.
      reference: ready ? current.reference : NaN,
      rows,
      curves,
      chartMax,
      publishedAt: now,
      ready,
      coverage: ready ? shared.length : 0,
      status: ready
        ? `5s average · ${shared.length}/${WINDOW_SLOTS} paired samples`
        : warmed
          ? "Not enough shared data · average paused"
          : "Collecting 5s average",
    };
  }
}

/** Live validity always overrides the analytical display, even between ticks. */
export function guardAnalysis(
  frame: AnalysisFrame,
  current: RouteComparison,
  feeds: ComparisonFeeds,
  now: number,
): AnalysisFrame {
  const rows = frame.rows.map((row) => {
    const candidate = current.candidates.find((c) => c.venue === row.venue)!;
    const captured = frame.capturedBooks?.[row.venue];
    const frozenFeed = captured
      ? {
          ...feeds[row.venue],
          book: captured.book,
          bookAt: captured.receivedAt,
        }
      : null;
    // Live is a one-second analytical snapshot, not an executable quote. Its
    // intentional publication lag must not manufacture a stale-feed warning
    // while the current feed remains healthy. A suspended publisher does expire.
    const publicationExpired =
      now - frame.publishedAt > PUBLICATION_MS + SAMPLE_MS;
    const currentFee = current.live?.observations.find(
      (o) => o.venue === row.venue,
    )?.fee;
    const feeChanged =
      row.fee !== undefined && feeBasisKey(row.fee) !== feeBasisKey(currentFee);
    const reason =
      candidate.reason ??
      (feeChanged
        ? "Fee basis changed · awaiting refresh"
        : publicationExpired
          ? ((frozenFeed ? bookIssue(frozenFeed, now) : null) ??
            "Analysis paused · awaiting refresh")
          : null);
    if (!reason) return row;
    const retain =
      frame.mode === "live" &&
      (reason.startsWith("Stale book") ||
        reason.startsWith("Books out of sync")) &&
      Boolean(
        current.live?.delayedQuotes[row.venue] ||
        (frozenFeed && !bookIssue(frozenFeed, now, COMPARISON_HISTORY_MS)),
      );
    return {
      ...row,
      reason,
      costs: retain ? row.costs : null,
      dollars: retain ? row.dollars : null,
      delayed: retain,
    };
  });
  return {
    ...frame,
    rows,
    status:
      frame.mode === "average" &&
      frame.ready &&
      rows.filter((r) => !r.reason && r.costs).length <
        Math.min(2, frame.input.allowed.length)
        ? "Not enough fresh data · average paused"
        : frame.status,
    curves: frame.curves.map((curve) => {
      const row = rows.find((r) => r.venue === curve.venue)!;
      if (frame.mode === "live") {
        // A book can still explain costs at smaller sizes even when the current
        // ticket is too large or fails its margin/tolerance gate.
        const observation = current.live?.observations.find(
          (o) => o.venue === curve.venue,
        );
        const dataIssue = !frame.input.allowed.includes(curve.venue)
          ? "Excluded"
          : (observation?.reason ??
            (row.reason?.startsWith("Fee basis changed") ? row.reason : null));
        const captured = frame.capturedBooks?.[curve.venue];
        const expired = now - frame.publishedAt > PUBLICATION_MS + SAMPLE_MS;
        if (!dataIssue && !expired) return curve;
        const retain =
          !row.reason?.startsWith("Fee basis changed") &&
          (dataIssue?.startsWith("Stale book") ||
            dataIssue?.startsWith("Books out of sync") ||
            expired) &&
          Boolean(
            current.live?.delayedQuotes[curve.venue] ||
            (captured &&
              !bookIssue(
                {
                  ...feeds[curve.venue],
                  book: captured.book,
                  bookAt: captured.receivedAt,
                },
                now,
                COMPARISON_HISTORY_MS,
              )),
          );
        return { ...curve, delayed: true, points: retain ? curve.points : [] };
      }
      return row.reason
        ? { ...curve, delayed: true, points: row.delayed ? curve.points : [] }
        : curve;
    }),
  };
}

export function rankAnalysis(frame: AnalysisFrame) {
  const eligible = (r: AnalysisRow) =>
    !r.reason && r.costs && Number.isFinite(r.costs.totalBps);
  const rows = [...frame.rows].sort((a, b) =>
    eligible(a) && eligible(b)
      ? a.costs!.totalBps - b.costs!.totalBps
      : eligible(a)
        ? -1
        : eligible(b)
          ? 1
          : 0,
  );
  const ranked = rows.filter(eligible);
  const notional =
    frame.input.notional ?? frame.input.quantity * frame.reference;
  const similarityBps = Math.max(SIMILAR_COST_BPS, (0.01 / notional) * 10000);
  const tied =
    ranked.length > 1 &&
    ranked[1].costs!.totalBps - ranked[0].costs!.totalBps <= similarityBps;
  return {
    rows,
    count: ranked.length,
    tied,
    similar: tied
      ? ranked
          .filter(
            (r) =>
              r.costs!.totalBps - ranked[0].costs!.totalBps <= similarityBps,
          )
          .map((r) => r.venue)
      : [],
    lowest: ranked.length > 1 && !tied ? ranked[0].venue : null,
  };
}
