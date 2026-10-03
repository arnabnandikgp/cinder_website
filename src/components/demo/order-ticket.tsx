"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, ChevronDown, LockKeyhole, Route } from "lucide-react";
import { DetailList, Segments, useClientReady } from "./controls";
import { RouteCard } from "./route-card";
import { parseAmount, type RouteComparison } from "./routing";
import {
  OrderTypes,
  StrategyFields,
  StrategyPlanView,
} from "./strategy-controls";
import {
  buildStrategyPlan,
  initialStrategy,
  isStrategy,
  positive,
  type StrategyConfig,
} from "./strategies";
import {
  markets,
  usdcSize,
  venues,
  type Draft,
  type Market,
  type Scenario,
  type Venue,
} from "./data";

export type Ticket = Omit<
  Draft,
  "id" | "market" | "mode" | "venue" | "allowed" | "strategy"
> & {
  strategyConfig: StrategyConfig;
};
export const initialTicket: Ticket = {
  side: "Buy",
  type: "Limit",
  size: "300",
  limit: "151.50",
  slippage: "",
  leverage: "25",
  reduceOnly: false,
  tif: "GTC",
  strategyConfig: initialStrategy,
  sizeUnit: "USDC",
};

export function OrderTicket({
  market,
  mode,
  venue,
  allowed,
  scenario,
  ticket,
  onTicket,
  onMode,
  onVenue,
  onAllowed,
  onReview,
  comparison,
  onCompare,
  marketPrice,
  bookPrices,
  refreshComparison,
}: {
  market: Market;
  mode: "manual" | "auto";
  venue: Venue;
  allowed: Venue[];
  scenario: Scenario;
  ticket: Ticket;
  onTicket: (value: Ticket) => void;
  onMode: (value: "manual" | "auto") => void;
  onVenue: (value: Venue) => void;
  onAllowed: () => void;
  onReview: (draft: Draft) => void;
  comparison: RouteComparison;
  onCompare: () => void;
  marketPrice?: number;
  bookPrices?: { bid: number; ask: number };
  refreshComparison?: () => RouteComparison;
}) {
  const ready = useClientReady();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const advanced = mode === "manual" && isStrategy(ticket.type);
  const hasLimit = ticket.type === "Limit" || ticket.type === "Iceberg";
  const hasTif =
    mode === "manual" && ["Limit", "Scale", "Iceberg"].includes(ticket.type);
  const mid = bookPrices ? (bookPrices.bid + bookPrices.ask) / 2 : undefined;
  const orderValue = parseAmount(ticket.size);
  const result =
    advanced && isStrategy(ticket.type)
      ? buildStrategyPlan(
          ticket.type,
          ticket.size,
          ticket.limit,
          ticket.strategyConfig,
        )
      : undefined;

  const update = (key: keyof Ticket, value: string | boolean) => {
    onTicket({ ...ticket, [key]: value });
    setErrors({});
  };
  function selectType(type: string) {
    const config = { ...ticket.strategyConfig };
    const price = mid ?? marketPrice;
    if (isStrategy(type)) {
      if (price && Number.isFinite(price) && price > 0) {
        if (!config.start) config.start = price.toFixed(2);
        if (!config.end)
          config.end = (
            price * (ticket.side === "Buy" ? 0.995 : 1.005)
          ).toFixed(2);
        if (!config.boundary)
          config.boundary = (
            price * (ticket.side === "Buy" ? 1.005 : 0.995)
          ).toFixed(2);
      }
      if (!config.tip && positive(ticket.size))
        config.tip = (Number(ticket.size) / 5).toFixed(8).replace(/\.?0+$/, "");
    }
    onTicket({
      ...ticket,
      type,
      strategyConfig: config,
      tif: type === "Iceberg" && ticket.tif === "IOC" ? "GTC" : ticket.tif,
    });
    setErrors({});
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = advanced ? { ...result?.errors } : {};
    if (!positive(ticket.size))
      next.size = "Enter an order size in USDC greater than zero.";
    if (hasLimit && !positive(ticket.limit))
      next.limit = "Enter a limit price greater than zero.";
    if (
      ticket.type === "Market" &&
      (!positive(ticket.slippage) || Number(ticket.slippage) >= 100)
    )
      next.slippage =
        "Enter a maximum slippage greater than 0% and below 100%.";
    setErrors(next);
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      document
        .getElementById(
          ["size", "limit", "slippage"].includes(first)
            ? `d-${first}`
            : `d-strategy-${first}`,
        )
        ?.focus();
      return;
    }
    const review =
      mode === "auto" ? (refreshComparison?.() ?? comparison) : comparison;
    if (mode === "auto" && !review.best) {
      setErrors({
        route: "Estimate expired or unavailable. Wait for fresh venue data.",
      });
      return;
    }
    onReview({
      id: "",
      market,
      mode,
      venue: mode === "auto" ? review.best!.venue : venue,
      allowed: [...allowed],
      side: ticket.side,
      type: ticket.type,
      size: ticket.size,
      sizeUnit: "USDC",
      limit: ticket.limit,
      slippage: ticket.slippage,
      leverage: ticket.leverage,
      reduceOnly: ticket.reduceOnly,
      ...(hasTif ? { tif: ticket.tif } : {}),
      ...(result?.plan ? { strategy: result.plan } : {}),
      ...(mode === "auto"
        ? {
            route: {
              ...review,
              input: { ...review.input, allowed: [...allowed] },
              ...(review.live ? { live: { ...review.live, curves: [] } } : {}),
              savedAt: new Date().toISOString(),
            },
          }
        : {}),
    });
  }
  const input = (
    key: "size" | "limit" | "slippage",
    label: string,
    unit: string,
  ) => (
    <div className={`d-field d-field-inline d-field-${key}`}>
      <label htmlFor={`d-${key}`}>{label}</label>
      <div className="d-amount-input">
        <input
          id={`d-${key}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          disabled={!ready}
          value={ticket[key]}
          onChange={(e) => update(key, e.target.value)}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={
            [
              key === "size" ? "d-size-hint" : "",
              errors[key] ? `d-${key}-error` : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        <span>{unit}</span>
      </div>
      {errors[key] && (
        <p className="d-error" id={`d-${key}-error`}>
          {errors[key]}
        </p>
      )}
    </div>
  );
  return (
    <aside
      className={`d-panel d-ticket d-ticket-v2${mode === "auto" ? " d-ticket-pro" : ""}`}
      aria-labelledby="d-ticket-title"
    >
      <h2 id="d-ticket-title" className="d-sr-only">
        New order · {markets[market].symbol}
      </h2>
      <div className="d-mode-switch">
        <Segments
          label="Trading mode"
          disabled={!ready}
          value={mode}
          options={[
            { value: "manual", label: "Standard" },
            { value: "auto", label: "Pro" },
          ]}
          onChange={(value) => {
            setErrors({});
            onMode(value);
          }}
        />
      </div>
      <form onSubmit={submit} noValidate>
        <div className="d-venue-header">
          {mode === "manual" ? (
            <div className="d-field">
              <label htmlFor="d-execution-venue">Execution venue</label>
              <select
                id="d-execution-venue"
                disabled={!ready}
                value={venue}
                onChange={(e) => {
                  setErrors({});
                  onVenue(e.target.value as Venue);
                }}
              >
                {Object.entries(venues).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                    {key === "velocity" ? " · preview only" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <button
              type="button"
              className="d-route-scope"
              disabled={!ready}
              onClick={onAllowed}
            >
              <Route size={18} aria-hidden="true" />
              <span>
                <strong>Smart route</strong>
                <small>{allowed.length} included venues</small>
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="d-risk-controls">
          <div className="d-margin-context" aria-label="Margin mode: Cross">
            Cross
          </div>
          <div className="d-leverage-control">
            <label htmlFor="d-leverage">Leverage</label>
            <select
              id="d-leverage"
              aria-describedby="d-leverage-hint"
              disabled={!ready}
              value={ticket.leverage}
              onChange={(e) => update("leverage", e.target.value)}
            >
              {["1", "2", "5", "10", "25"].map((value) => (
                <option key={value} value={value}>
                  {value}x
                </option>
              ))}
            </select>
            <span className="d-sr-only" id="d-leverage-hint">
              Requested leverage for the preview, not a verified venue limit.
            </span>
          </div>
        </div>
        {mode === "manual" ? (
          <OrderTypes
            value={ticket.type}
            disabled={!ready}
            onChange={selectType}
          />
        ) : (
          <div className="d-pro-order-type">
            <span>Order type</span>
            <strong>Market</strong>
            <span>Compare immediate entry</span>
          </div>
        )}
        <Segments
          label="Direction"
          disabled={!ready}
          value={ticket.side}
          options={[
            { value: "Buy", label: "Buy / Long" },
            { value: "Sell", label: "Sell / Short" },
          ]}
          onChange={(value) => update("side", value)}
        />
        {hasLimit && (
          <div className="d-price-field">
            {input("limit", "Limit price", "USD")}
            <div
              className="d-price-shortcuts"
              aria-label="Set limit from order book"
            >
              {(["Bid", "Mid", "Ask"] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled={!ready || !bookPrices}
                  onClick={() =>
                    update(
                      "limit",
                      String(
                        label === "Mid"
                          ? mid
                          : label === "Bid"
                            ? bookPrices!.bid
                            : bookPrices!.ask,
                      ),
                    )
                  }
                >
                  {label}
                </button>
              ))}
              <span>{bookPrices ? "Live book" : "Waiting for book"}</span>
            </div>
          </div>
        )}
        <div className="d-size-field">
          {input("size", "Order size", "USDC")}
          <p className="d-sizing-reference" id="d-size-hint">
            USDC notional exposure, not margin.
          </p>
        </div>
        {advanced && isStrategy(ticket.type) && (
          <StrategyFields
            kind={ticket.type}
            config={ticket.strategyConfig}
            disabled={!ready}
            errors={errors}
            onChange={(value) => {
              onTicket({ ...ticket, strategyConfig: value });
              setErrors({});
            }}
          />
        )}
        {ticket.type === "Market" &&
          input(
            "slippage",
            mode === "auto" ? "Price tolerance" : "Maximum slippage",
            "%",
          )}
        {mode === "auto" && (
          <p className="d-mode-hint">
            Adverse price vs reference · exposure, not collateral.
          </p>
        )}
        {mode === "manual" && (
          <div className="d-order-modifiers">
            <label className="d-ticket-check">
              <input
                type="checkbox"
                disabled={!ready}
                checked={!!ticket.reduceOnly}
                onChange={(e) => update("reduceOnly", e.target.checked)}
              />
              Reduce only
            </label>
            {hasTif && (
              <div className="d-tif-control">
                <label htmlFor="d-tif">Time in force</label>
                <select
                  id="d-tif"
                  disabled={!ready}
                  value={ticket.tif ?? "GTC"}
                  onChange={(e) => update("tif", e.target.value)}
                >
                  <option value="GTC">GTC</option>
                  <option value="ALO">Post-only</option>
                  {ticket.type !== "Iceberg" && (
                    <option value="IOC">IOC</option>
                  )}
                </select>
              </div>
            )}
          </div>
        )}
        {advanced ? (
          result?.plan ? (
            <StrategyPlanView plan={result.plan} />
          ) : (
            <p className="d-plan-empty">
              Complete the strategy inputs to preview the plan.
            </p>
          )
        ) : (
          <DetailList
            rows={[
              [
                "Order value",
                Number.isFinite(orderValue) && orderValue > 0
                  ? usdcSize(orderValue)
                  : "—",
              ],
              [
                "Available to trade",
                `${scenario === "empty" ? "0.00" : "7,400.00"} USDC`,
              ],
              ...(mode === "manual"
                ? ([["Margin / estimated fees", "Not calculated"]] as [
                    string,
                    string,
                  ][])
                : []),
            ]}
          />
        )}
        {mode === "auto" && (
          <RouteCard
            comparison={comparison}
            onCompare={onCompare}
            onAllowed={onAllowed}
          />
        )}
        <button
          className={`d-button d-trade-submit d-wide ${ticket.side === "Buy" ? "d-buy-action" : "d-sell-action"}`}
          disabled={
            !ready ||
            scenario === "stale" ||
            (mode === "auto" && !comparison.best)
          }
          type="submit"
        >
          {advanced
            ? "Preview plan"
            : `Review ${ticket.side === "Buy" ? "buy" : "sell"} order`}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        {errors.route && (
          <p className="d-error" role="alert">
            {errors.route}
          </p>
        )}
        {scenario === "stale" && (
          <p className="d-ticket-note">
            Refresh the account before reviewing a new order.
          </p>
        )}
        <div className="d-ticket-privacy">
          <LockKeyhole size={13} aria-hidden="true" />
          Confidential order handling
        </div>
      </form>
    </aside>
  );
}
