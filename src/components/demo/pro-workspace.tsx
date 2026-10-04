"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Tabs } from "./controls";
import { MarketChart } from "./market-chart";
import { MarketInstrument } from "./market-instrument";
import { VenueIcon } from "./venue-select";
import { FeeTierInfo } from "./fee-tier-info";
import { COMPARISON_HISTORY_MS } from "./market-data/feed";
import { number, usdcSize, venues, type Market, type Venue } from "./data";
import { money, type RouteComparison } from "./routing";
import {
  comparisonVenues,
  comparisonStatus,
  BOOK_MAX_AGE_MS,
  BOOK_MAX_SKEW_MS,
  focusedChartMax,
} from "./live-routing";
import type { LiveMarket } from "./market-data/use-market-feed";
import type { Interval } from "./market-data/adapters";
import { formatCostBps } from "./venue-estimates";
import {
  rankAnalysis,
  type AnalysisFrame,
  type AnalysisMode,
} from "./comparison-analysis";

export function CostChart({ analysis }: { analysis: AnalysisFrame }) {
  const id = useId();
  const [hidden, setHidden] = useState<Venue[]>([]);
  const [range, setRange] = useState<"order" | "depth">("order");
  const svg = useRef<SVGSVGElement>(null);
  const [bounds, setBounds] = useState({ width: 560, height: 220 });
  useEffect(() => {
    const target = svg.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0)
        setBounds({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  const { input, reference } = analysis;
  const { lowest } = rankAnalysis(analysis);
  const orderNotional = input.notional ?? input.quantity * reference;
  const series = analysis.curves;
  const fullRange = analysis.chartMax;
  const chartMax =
    range === "order" ? focusedChartMax(orderNotional, fullRange) : fullRange;
  // Changing the viewport or visibility never changes routing eligibility.
  const visible = series
    .filter((s) => !hidden.includes(s.venue) && input.allowed.includes(s.venue))
    .map((s) => ({
      ...s,
      points: s.points.filter((point) => point.notional <= chartMax),
    }));
  const values = visible.flatMap((s) => s.points.map((p) => p.cost));
  const min = Math.min(0, Math.floor(Math.min(0, ...values) / 5) * 5);
  const max = Math.max(5, Math.ceil(Math.max(0, ...values) / 5) * 5);
  const right = bounds.width - 24;
  const bottom = bounds.height - 40;
  const x = (n: number) => 44 + (n / chartMax) * (right - 44);
  const y = (bps: number) =>
    bottom - ((bps - min) / (max - min)) * (bottom - 36);
  const showMarker =
    Number.isFinite(orderNotional) &&
    orderNotional > 0 &&
    orderNotional <= chartMax;
  const fixed = (n: number) => Number(n.toFixed(4));
  return (
    <div className="d-cost-plot">
      <div className="d-cost-plot-heading">
        <h3>
          {analysis.mode === "average"
            ? "5s average by size"
            : "Entry cost by size"}
        </h3>
        <div
          className="d-chart-range"
          role="group"
          aria-label="Cost chart range"
        >
          <button
            type="button"
            aria-pressed={range === "order"}
            onClick={() => setRange("order")}
          >
            Order range
          </button>
          <button
            type="button"
            aria-pressed={range === "depth"}
            onClick={() => setRange("depth")}
          >
            Full range
          </button>
        </div>
      </div>
      <div className="d-cost-legend" aria-label="Chart visibility">
        {comparisonVenues.map((venue) => (
          <button
            key={venue}
            className={`d-venue-key d-venue-${venue}`}
            aria-label={`Show ${venues[venue]} curve`}
            aria-pressed={!hidden.includes(venue)}
            disabled={
              !input.allowed.includes(venue) ||
              !series.find((s) => s.venue === venue)?.points.length
            }
            onClick={() =>
              setHidden((value) =>
                value.includes(venue)
                  ? value.filter((v) => v !== venue)
                  : [...value, venue],
              )
            }
          >
            <i aria-hidden="true" /> {venues[venue]}
            {series.find((s) => s.venue === venue)?.delayed && (
              <span className="d-delayed-label"> · delayed</span>
            )}
          </button>
        ))}
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${bounds.width} ${bounds.height}`}
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
        className="d-cost-svg"
        data-chart-range={range}
        data-chart-max={chartMax}
        data-published-at={analysis.publishedAt}
        data-analysis-mode={analysis.mode}
      >
        <title id={`${id}-title`}>Estimated entry cost versus order size</title>
        <desc id={`${id}-desc`}>
          Estimated {input.side.toLowerCase()} entry costs using observed
          visible books and modeled venue fees. Pacifica and BULK assume their
          lowest volume-tier taker rates; Phoenix uses its public market fee.
          Solid curves are fresh; dashed curves are delayed or unaligned and
          excluded from recommendations. Cinder pricing is excluded. The table
          contains estimates for your order. Lower is better. Curves end at
          observed depth and do not establish full venue liquidity.
          {analysis.mode === "average" &&
            " Five-second averages use matched 250ms observations. The live order ticket does not use these averages."}
        </desc>
        {Array.from({ length: 5 }, (_, i) => {
          const cost = min + ((max - min) * i) / 4;
          return (
            <g key={i}>
              <line
                x1="40"
                x2={right}
                y1={y(cost)}
                y2={y(cost)}
                className="d-plot-grid"
              />
              <text x="30" y={y(cost) + 4} textAnchor="end">
                {number(cost, cost % 1 ? 1 : 0)}
              </text>
            </g>
          );
        })}
        {[0, chartMax / 2, chartMax].map((n) => (
          <g key={n}>
            <line
              x1={x(n)}
              x2={x(n)}
              y1="36"
              y2={bottom}
              className="d-plot-grid"
            />
            <text x={x(n)} y={bottom + 18} textAnchor="middle">
              {n ? `${number(n / 1000, n % 1000 ? 1 : 0)}k` : "0"}
            </text>
          </g>
        ))}
        <text x="40" y="14">
          Cost¹ · bps
        </text>
        <text x={right} y={bounds.height - 2} textAnchor="end">
          Order notional · USDC
        </text>
        {visible
          .filter((s) => s.points.length)
          .map((s) => (
            <path
              key={s.venue}
              className={`d-cost-line d-venue-${s.venue}${s.delayed ? " is-delayed" : ""}`}
              data-testid={`${s.delayed ? "delayed-curve" : "curve"}-${s.venue}`}
              d={s.points
                .map(
                  (p, i) =>
                    `${i ? "L" : "M"}${fixed(x(p.notional))},${fixed(y(p.cost))}`,
                )
                .join(" ")}
            />
          ))}
        {showMarker && (
          <g data-testid="order-size-marker">
            <line
              x1={fixed(x(orderNotional))}
              x2={fixed(x(orderNotional))}
              y1="36"
              y2={bottom}
              className="d-order-marker"
            />
            <text
              x={fixed(Math.min(right - 36, Math.max(78, x(orderNotional))))}
              y="30"
              textAnchor="middle"
              className="d-order-label"
            >
              Your order
            </text>
            {analysis.rows
              .filter(
                (c) =>
                  c.costs &&
                  !c.reason &&
                  input.allowed.includes(c.venue) &&
                  !hidden.includes(c.venue),
              )
              .map((c) => (
                <circle
                  key={c.venue}
                  className={`d-cost-point d-venue-${c.venue}`}
                  cx={fixed(x(orderNotional))}
                  cy={fixed(y(c.costs!.totalBps))}
                  r={lowest === c.venue ? 5 : 3}
                />
              ))}
          </g>
        )}
      </svg>
      <div className="d-plot-caption">
        <span>
          {values.length
            ? series.some((s) => s.delayed && s.points.length)
              ? "Dashed = excluded from recommendation"
              : "Lower is better · visible depth only"
            : "No fresh comparison available"}
        </span>
        <span>
          {orderNotional > chartMax
            ? "Order outside chart range; see venue estimates."
            : "Hiding a curve doesn’t exclude a venue."}
        </span>
      </div>
    </div>
  );
}

export function VenueComparison({ analysis }: { analysis: AnalysisFrame }) {
  const { rows: sorted, count, tied, lowest } = rankAnalysis(analysis);
  return (
    <div
      id="d-route-comparison"
      tabIndex={0}
      role="group"
      aria-label="Venue comparison table"
      className="d-comparison-table d-table-scroll"
      data-published-at={analysis.publishedAt}
      data-analysis-mode={analysis.mode}
    >
      <div className="d-comparison-table-heading">
        <h3>
          {analysis.mode === "average"
            ? "5s average · bps"
            : "Entry cost · bps"}
        </h3>
        <span>Lowest first · {count} comparable</span>
      </div>
      <table>
        <caption className="d-sr-only">
          Estimated entry costs for the same order quantity, in basis points
          against the shared reference notional. Price cost plus fee cost equals
          entry cost. Eligible venues are sorted from lowest to highest cost;
          delayed, excluded and unavailable venues follow and are not ranked.
          Lowest published volume-tier taker fees are assumed for Pacifica and
          BULK; Phoenix uses its public market fee. Cinder pricing is excluded.
        </caption>
        <thead>
          <tr>
            <th scope="col">Venue</th>
            <th scope="col">Price cost</th>
            <th scope="col">Fee cost</th>
            <th scope="col" aria-sort="ascending">
              Entry cost¹
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ venue, costs, dollars, reason, delayed, fee }) => {
            return (
              <tr
                key={venue}
                data-testid={`route-row-${venue}`}
                className={
                  lowest === venue
                    ? "d-best-row"
                    : delayed
                      ? "d-delayed-row"
                      : undefined
                }
              >
                <td>
                  <strong className={`d-venue-key d-venue-${venue}`}>
                    <VenueIcon venue={venue} size={20} />
                    {venues[venue]}
                  </strong>
                  <span className="d-cell-sub">
                    {delayed
                      ? reason?.startsWith("Books out of sync")
                        ? "Unaligned · not compared"
                        : "Delayed · not compared"
                      : (reason ??
                        (tied
                          ? "Similar estimate"
                          : count === 1
                            ? "Only complete estimate"
                            : lowest === venue
                              ? analysis.mode === "average"
                                ? "Lowest 5s average"
                                : "Lowest estimate"
                              : "Comparable"))}
                  </span>
                </td>
                <td>
                  {costs ? (
                    <span className="d-cost-bps">
                      {formatCostBps(costs.priceBps)} <small>bps</small>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="d-fee-cost">
                    {costs ? (
                      <span className="d-cost-bps">
                        {formatCostBps(costs.feeBps)} <small>bps</small>
                      </span>
                    ) : (
                      "—"
                    )}
                    <FeeTierInfo venue={venue} fee={fee} />
                  </div>
                </td>
                <td>
                  {dollars !== null && costs ? (
                    <>
                      <strong
                        className="d-cost-bps d-entry-cost"
                        data-cost-bps={costs.totalBps}
                      >
                        {formatCostBps(costs.totalBps)} <small>bps</small>
                      </strong>
                      <span className="d-cell-sub">{money(dollars)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProWorkspace({
  comparison,
  analysis,
  onAnalysis,
  chartVenue,
  leverage,
  panel,
  onPanel,
  onMarket,
  onChartVenue,
  live,
  interval,
  onInterval,
  onRetry,
  onNotional,
}: {
  comparison: RouteComparison;
  analysis: AnalysisFrame;
  onAnalysis: (mode: AnalysisMode) => void;
  chartVenue: Venue;
  leverage: string;
  panel: "cost" | "price";
  onPanel: (value: "cost" | "price") => void;
  onMarket: (value: Market) => void;
  onChartVenue: (value: Venue) => void;
  live: LiveMarket;
  interval: Interval;
  onInterval: (value: Interval) => void;
  onRetry: () => void;
  onNotional: (value: number) => void;
}) {
  const { input } = comparison;
  const reference = analysis.reference;
  return (
    <section
      className="d-panel d-pro-workspace"
      aria-label="Pro execution workspace"
    >
      <div className="d-pro-heading">
        <MarketInstrument
          id="d-pro-market"
          market={input.market}
          leverage={leverage}
          onMarket={onMarket}
        />
        <Tabs
          id="pro-view"
          label="Pro workspace views"
          value={panel}
          options={[
            { value: "cost", label: "Execution cost" },
            { value: "price", label: "Price chart" },
          ]}
          onChange={onPanel}
        />
        {panel === "cost" && (
          <div className="d-comparison-status" data-testid="comparison-status">
            <span>
              <i
                className={comparison.live?.aligned ? "is-live" : ""}
                aria-hidden="true"
              />
              {comparisonStatus(comparison)}
            </span>
            {!comparison.live?.aligned && (
              <button type="button" className="d-text-button" onClick={onRetry}>
                Reconnect feeds
              </button>
            )}
          </div>
        )}
      </div>
      <div
        id="pro-view-panel"
        role="tabpanel"
        aria-labelledby={`pro-view-${panel}`}
        className={`d-pro-content d-pro-${panel}-content`}
      >
        {panel === "price" ? (
          <MarketChart
            market={input.market}
            venue={chartVenue}
            canChooseVenue
            showInstrument={false}
            leverage={leverage}
            onMarket={onMarket}
            onVenue={onChartVenue}
            live={live}
            liveInterval={interval}
            onInterval={onInterval}
          />
        ) : (
          <>
            <div className="d-cost-heading">
              <div>
                <h2>
                  <span className={input.side === "Buy" ? "d-up" : "d-down"}>
                    {input.side === "Buy" ? "Buy / Long" : "Sell / Short"}
                  </span>
                  <span className="d-cost-notional">
                    {Number.isFinite(input.notional) && input.notional! > 0
                      ? usdcSize(input.notional!)
                      : "Enter order size"}
                  </span>
                </h2>
                <p>
                  {analysis.mode === "average"
                    ? "5s mean reference"
                    : Number.isFinite(reference)
                      ? "Shared reference"
                      : "Last observed reference"}
                  <strong>{money(reference)}</strong>
                </p>
              </div>
              <div className="d-quick-size">
                <span>Quick size · USDC</span>
                <div
                  className="d-size-presets"
                  role="group"
                  aria-label="Order notional presets"
                >
                  {[5000, 25000, 100000].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onNotional(value)}
                      disabled={!Number.isFinite(comparison.reference)}
                      aria-label={`Set order notional to ${value} USDC`}
                      aria-pressed={input.notional === value}
                    >
                      {value / 1000}k
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="d-analysis-controls">
              <div
                className="d-chart-range d-analysis-switch"
                role="group"
                aria-label="Comparison sampling"
              >
                <button
                  type="button"
                  aria-pressed={analysis.mode === "live"}
                  onClick={() => onAnalysis("live")}
                >
                  Live
                </button>
                <button
                  type="button"
                  aria-pressed={analysis.mode === "average"}
                  onClick={() => onAnalysis("average")}
                >
                  5s average
                </button>
              </div>
              <span data-testid="analysis-status">{analysis.status}</span>
              {analysis.mode === "average" && (
                <span className="d-analysis-ticket-note">
                  Ticket uses live books
                </span>
              )}
            </div>
            <div className="d-pro-analysis">
              <CostChart analysis={analysis} />
              <VenueComparison analysis={analysis} />
            </div>
            <details className="d-comparison-method">
              <summary>
                <span>How estimates work</span>
                <span className="d-method-pricing">
                  Volume-tier fees assumed · Cinder pricing excluded
                </span>
              </summary>
              <p>
                ¹ Entry cost = price cost + fee cost. Each is expressed in basis
                points of the same shared-reference order notional; 1 bp is
                0.01%. Price cost compares the average fill with the shared
                midpoint reference. Fee cost is the modeled taker fee on the
                estimated fill, normalized to that same reference notional.
                Values are rounded for display; ranking uses full precision.
                Negative reference cost is not guaranteed profit.
              </p>
              <p>
                Feeds continue updating independently. Analysis samples aligned
                books on a common 250ms clock; graph and table publish together
                every second. The optional 5s view averages calculated costs,
                not order books, using at least 16 of 20 matching time slots.
                Each ranked venue uses the same slots and reference cohort.
                Missing or invalid samples are not zero-filled. Average curves
                end at the minimum observed depth across those samples. Changing
                order intent resets the window. Stale or invalid data is
                excluded immediately. The ticket and order review always
                recompute from live books; the lowest average need not be best
                now.
              </p>
              <p>
                Same quantity across compared venues; no extrapolated liquidity.
                Pacifica and BULK assume qualification for the lowest published
                taker tier in their active schedules through pooled account
                volume; Cinder’s qualifying volume is not verified. Phoenix uses
                its public market fee without a volume discount. Funding, exit
                costs, maker rebates, referral discounts and Cinder pricing are
                excluded. Differences under 0.5 bps or one cent are treated as
                similar, not as a measured confidence interval.
              </p>
              <p>
                Ranked books must be received within {BOOK_MAX_AGE_MS / 1000}s
                and aligned within {BOOK_MAX_SKEW_MS / 1000}s, allowing for
                Phoenix’s whole-second source timestamps. Recent accepted
                snapshots are aligned instead of comparing only the latest
                independently arriving frames. Delayed observations may remain
                visible, dashed, for up to {COMPARISON_HISTORY_MS / 1000}s; they
                never enter rankings, savings or order review. These are preview
                checks, not executable quotes. Native sizing, actual collateral
                and venue risk limits still require backend validation.
                New-position estimates do not move or close existing positions.
              </p>
              <ul>
                {comparison.live?.observations.map((o) => (
                  <li key={o.venue}>
                    <strong>{venues[o.venue]}</strong> · {o.bidLevels} bid /{" "}
                    {o.askLevels} ask levels ·{" "}
                    {o.sourceAt
                      ? `${Math.max(0, comparison.live!.now - o.sourceAt)}ms source age`
                      : "awaiting book"}{" "}
                    ·{" "}
                    {o.receivedAt
                      ? `${Math.max(0, comparison.live!.now - o.receivedAt)}ms receive age`
                      : "not received"}
                    {o.fee && (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={o.fee.source}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {o.fee.label}: {number(o.fee.takerBps)} bps
                        </a>{" "}
                        · fees fetched{" "}
                        {new Date(o.fee.fetchedAt).toISOString().slice(11, 19)}{" "}
                        UTC
                      </>
                    )}
                    {o.reason && <> · {o.reason}</>}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
