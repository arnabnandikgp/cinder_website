"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Layers3 } from "lucide-react";
import { Tabs } from "./controls";
import { MarketChart } from "./market-chart";
import {
  markets,
  number,
  usdcSize,
  venues,
  type Market,
  type Venue,
} from "./data";
import { money, type RouteComparison } from "./routing";
import {
  comparisonVenues,
  comparisonStatus,
  BOOK_MAX_AGE_MS,
  BOOK_MAX_SKEW_MS,
} from "./live-routing";
import type { LiveMarket } from "./market-data/use-market-feed";
import type { Interval } from "./market-data/adapters";

export function CostChart({ comparison }: { comparison: RouteComparison }) {
  const id = useId();
  const [hidden, setHidden] = useState<Venue[]>([]);
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
  const { input, reference, best } = comparison;
  const orderNotional = input.notional ?? input.quantity * reference;
  const series = comparison.live?.curves ?? [];
  const chartMax = comparison.live?.chartMax ?? 1000;
  const visible = series.filter(
    (s) => !hidden.includes(s.venue) && input.allowed.includes(s.venue),
  );
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
          </button>
        ))}
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${bounds.width} ${bounds.height}`}
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
        className="d-cost-svg"
      >
        <title id={`${id}-title`}>Estimated entry cost versus order size</title>
        <desc id={`${id}-desc`}>
          Estimated {input.side.toLowerCase()} entry costs using live visible
          books and public venue fees. Cinder pricing is excluded. The table
          contains estimates for your order. Lower is better. Curves end at
          observed depth and do not establish full venue liquidity.
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
          Entry cost¹ · bps
        </text>
        <text x={right} y={bounds.height - 2} textAnchor="end">
          Order notional · USDC
        </text>
        {visible
          .filter((s) => s.points.length)
          .map((s) => (
            <path
              key={s.venue}
              className={`d-cost-line d-venue-${s.venue}`}
              data-testid={`curve-${s.venue}`}
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
            {comparison.candidates
              .filter(
                (c) =>
                  c.quote &&
                  !c.reason &&
                  input.allowed.includes(c.venue) &&
                  !hidden.includes(c.venue),
              )
              .map((c) => (
                <circle
                  key={c.venue}
                  className={`d-cost-point d-venue-${c.venue}`}
                  cx={fixed(x(orderNotional))}
                  cy={fixed(y(c.quote!.costBps))}
                  r={best?.venue === c.venue ? 5 : 3}
                />
              ))}
          </g>
        )}
      </svg>
      <div className="d-plot-caption">
        <span>
          {values.length
            ? "Lower is better · visible depth only"
            : "No fresh comparison available"}
        </span>
        <span>
          {orderNotional > chartMax
            ? "Order outside chart range; see exact quote below."
            : "Hiding a curve doesn’t exclude a venue."}
        </span>
      </div>
    </div>
  );
}

export function VenueComparison({
  comparison,
}: {
  comparison: RouteComparison;
}) {
  const sorted = [...comparison.candidates].sort(
    (a, b) =>
      Number(Boolean(a.reason)) - Number(Boolean(b.reason)) ||
      (a.quote?.totalCost ?? Infinity) - (b.quote?.totalCost ?? Infinity),
  );
  return (
    <div
      id="d-route-comparison"
      tabIndex={0}
      role="group"
      aria-label="Venue comparison table"
      className="d-comparison-table d-table-scroll"
    >
      <table>
        <caption className="d-sr-only">
          Estimated prices for the same order quantity, using public venue taker
          fees. Cinder fees are not yet included.
        </caption>
        <thead>
          <tr>
            <th scope="col">Venue</th>
            <th scope="col">Avg. fill</th>
            <th scope="col">Venue fee</th>
            <th scope="col">Effective price</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ venue, quote, reason }) => (
            <tr
              key={venue}
              data-testid={`route-row-${venue}`}
              className={
                comparison.best?.venue === venue &&
                comparison.ranked.length > 1 &&
                !comparison.live?.tied
                  ? "d-best-row"
                  : undefined
              }
            >
              <td>
                <strong className={`d-venue-key d-venue-${venue}`}>
                  <i aria-hidden="true" />
                  {venues[venue]}
                </strong>
                <span className="d-cell-sub">
                  {reason ??
                    (comparison.live?.tied
                      ? "Similar estimate"
                      : comparison.ranked.length === 1
                        ? "Only complete estimate"
                        : comparison.best?.venue === venue
                          ? "Lowest estimate"
                          : "Comparable")}
                </span>
              </td>
              <td>{quote && !reason ? money(quote.averageFill) : "—"}</td>
              <td>
                {quote && !reason ? (
                  <>
                    <span>{money(quote.venueFee)}</span>
                    <span className="d-cell-sub">
                      {number(
                        comparison.live?.observations.find(
                          (o) => o.venue === venue,
                        )?.fee?.takerBps ?? NaN,
                      )}{" "}
                      bps
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td>
                {quote && !reason ? (
                  <>
                    <strong>{money(quote.effectivePrice)}</strong>
                    <span className="d-cell-sub">
                      {inputDirection(comparison)} fee
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProWorkspace({
  comparison,
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
  const { input, reference } = comparison;
  return (
    <section
      className="d-panel d-pro-workspace"
      aria-label="Pro execution workspace"
    >
      <div className="d-pro-heading">
        <div className="d-instrument-line">
          <Layers3 size={20} className="d-pro-symbol" aria-hidden="true" />
          {panel === "cost" && (
            <>
              <label htmlFor="d-pro-market" className="d-sr-only">
                Market
              </label>
              <select
                id="d-pro-market"
                value={input.market}
                onChange={(e) => onMarket(e.target.value as Market)}
              >
                {Object.entries(markets).map(([key, m]) => (
                  <option key={key} value={key}>
                    {m.symbol}
                  </option>
                ))}
              </select>
              <span
                className="d-leverage-badge"
                aria-label={`Order leverage ${leverage}x`}
              >
                {leverage}x
              </span>
            </>
          )}
          {panel === "price" && <strong>Market reference</strong>}
        </div>
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
      </div>
      <div
        id="pro-view-panel"
        role="tabpanel"
        aria-labelledby={`pro-view-${panel}`}
        className="d-pro-content"
      >
        {panel === "price" ? (
          <MarketChart
            market={input.market}
            venue={chartVenue}
            canChooseVenue
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
                  {input.side} ·{" "}
                  {Number.isFinite(input.notional) && input.notional! > 0
                    ? usdcSize(input.notional!)
                    : "Enter order size"}
                </h2>
                <p>Notional exposure · ref. {money(reference)}</p>
              </div>
              <div
                className="d-size-presets"
                aria-label="Order notional presets"
              >
                {[5000, 25000, 100000].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onNotional(value)}
                    disabled={!Number.isFinite(reference)}
                    aria-label={`Set order notional to ${value} USDC`}
                  >
                    {value / 1000}k USDC
                    <ArrowUpRight size={12} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
            <div
              className="d-comparison-status"
              data-testid="comparison-status"
            >
              <span>
                <i
                  className={comparison.live?.aligned ? "is-live" : ""}
                  aria-hidden="true"
                />
                {comparisonStatus(comparison)}
              </span>
              {!comparison.live?.aligned && (
                <button
                  type="button"
                  className="d-text-button"
                  onClick={onRetry}
                >
                  Reconnect feeds
                </button>
              )}
              <span>Public venue fees · Cinder pricing excluded</span>
            </div>
            <div className="d-pro-analysis">
              <CostChart comparison={comparison} />
              <VenueComparison comparison={comparison} />
            </div>
            <details className="d-comparison-method">
              <summary>How estimates work</summary>
              <p>
                ¹ Entry cost compares the average fill with the shared midpoint
                reference, then adds public venue taker fees. Effective price is
                the average fill plus fees for buys, minus fees for sells.
                Negative reference cost is not guaranteed profit.
              </p>
              <p>
                Same quantity across compared venues; no extrapolated liquidity.
                Funding, exit costs, account discounts and Cinder pricing are
                excluded. Differences under 0.5 bps or one cent are treated as
                similar, not as a measured confidence interval.
              </p>
              <p>
                Books must be no more than {BOOK_MAX_AGE_MS / 1000}s old and at
                most {BOOK_MAX_SKEW_MS / 1000}s apart. These are preview checks,
                not executable quotes. Native sizing, actual collateral and
                venue risk limits still require backend validation. New-position
                estimates do not move or close existing positions.
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

function inputDirection(comparison: RouteComparison) {
  return comparison.input.side === "Buy" ? "Including" : "After";
}
