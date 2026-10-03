"use client";

import { Info } from "lucide-react";
import { number, venues, type Venue } from "./data";
import { precision } from "./market-data/adapters";
import { channelHealth } from "./market-data/feed";
import { fundingPercent, percent, volumeUsd } from "./market-data/format";
import type { LiveMarket } from "./market-data/use-market-feed";

export function MarketStatistics({
  venue,
  live,
  tick,
}: {
  venue: Venue;
  live: LiveMarket;
  tick: number;
}) {
  const ticker = live.ticker;
  const health = channelHealth(live, "ticker");
  const estimated = venue === "pacifica" && ticker?.nextFunding !== undefined;
  const rate = estimated ? ticker?.nextFunding : ticker?.funding;
  const fundingLabel =
    venue === "pacifica"
      ? `${estimated ? "Est. funding" : "Funding"} · 1h`
      : "Funding · venue";
  const price = (value: number | undefined) =>
    value === undefined ? "—" : number(value, precision(tick));
  const direction =
    rate === undefined
      ? "Funding rate unavailable."
      : rate > 0
        ? "Positive rate: longs pay shorts."
        : rate < 0
          ? "Negative rate: shorts pay longs."
          : "Zero rate: no funding payment at this rate.";
  return (
    <div
      className="d-live-stats"
      role="group"
      data-health={health}
      aria-label={`${venues[venue]} market statistics · ${health}`}
    >
      <div className="d-market-stat">
        <span>Mark price</span>
        <strong
          data-testid="market-mark"
          aria-label={ticker ? undefined : "Mark price unavailable"}
        >
          {price(ticker?.mark)}
        </strong>
      </div>
      <div className="d-market-stat">
        <span>Oracle price</span>
        <strong
          data-testid="market-oracle"
          aria-label={
            ticker?.oracle === undefined
              ? "Oracle price unavailable"
              : undefined
          }
        >
          {price(ticker?.oracle)}
        </strong>
      </div>
      <details
        key={venue}
        className="d-funding-detail"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            event.currentTarget.open = false;
        }}
      >
        <summary className="d-market-stat" aria-label="Funding rate details">
          <span>
            {fundingLabel} <Info size={12} aria-hidden="true" />
          </span>
          <strong
            data-testid="market-funding"
            aria-label={
              rate === undefined ? "Funding rate unavailable" : undefined
            }
          >
            {fundingPercent(rate)}
          </strong>
        </summary>
        <div className="d-funding-popover">
          <h3>Funding on {venues[venue]}</h3>
          {health !== "Live" && (
            <p className="d-funding-warning">
              {health}. Values shown are last received, not a current quote.
            </p>
          )}
          {venue === "pacifica" ? (
            <>
              <dl>
                <div>
                  <dt>Estimated next · 1h</dt>
                  <dd>{fundingPercent(ticker?.nextFunding)}</dd>
                </div>
                <div>
                  <dt>Current rate · 1h</dt>
                  <dd>{fundingPercent(ticker?.funding)}</dd>
                </div>
              </dl>
              <p>
                The next hourly rate is an estimate and can change before
                settlement.
              </p>
            </>
          ) : venue === "bulk" ? (
            <>
              <p>
                Venue-reported rate. BULK’s documentation differs on the
                quotation period, so no hourly conversion or countdown is shown.
              </p>
              <a
                href="https://docs.bulk.trade/bulk-exchange/funding"
                target="_blank"
                rel="noopener noreferrer"
              >
                BULK funding rules ↗
              </a>
            </>
          ) : venue === "phoenix" ? (
            <>
              <p>
                Venue-reported funding rate, shown without an hourly conversion.
                Funding is separate from Pro’s estimated entry cost.
              </p>
              <a
                href="https://docs.phoenix.trade/phoenix/margin-and-risk/funding-rate"
                target="_blank"
                rel="noopener noreferrer"
              >
                Phoenix funding rules ↗
              </a>
            </>
          ) : (
            <p>Live funding data is not connected for this venue.</p>
          )}
          <p>{direction} Actual account payments belong in Funding history.</p>
        </div>
      </details>
      <div className="d-market-stat">
        <span>Change · 24h</span>
        <strong
          data-testid="market-change"
          className={
            ticker?.change ? (ticker.change > 0 ? "d-up" : "d-down") : undefined
          }
        >
          {percent(ticker?.change)}
        </strong>
      </div>
      <div className="d-market-stat">
        <span>Volume · 24h</span>
        <strong
          data-testid="market-volume"
          title={
            ticker?.volume === undefined
              ? "Volume unavailable"
              : `${number(ticker.volume)} USD`
          }
          aria-label={
            ticker?.volume === undefined
              ? "24 hour volume unavailable"
              : `${number(ticker.volume)} USD traded in 24 hours`
          }
        >
          {volumeUsd(ticker?.volume)}
        </strong>
      </div>
    </div>
  );
}
