"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, ChevronDown, LockKeyhole, Route } from "lucide-react";
import { DetailList, Segments, useClientReady } from "./controls";
import { RouteCard } from "./route-card";
import { VenueSelect } from "./venue-select";
import { TradingModeSwitch } from "./trading-mode-switch";
import { parseAmount, type RouteComparison } from "./routing";
import { money } from "./routing";
import { SlippageDialog } from "./slippage-dialog";
import {
  BracketControls,
  emptyBracket,
  resolveBracket,
  type BracketInputs,
} from "./bracket-controls";
import type { Bracket, paperQuote } from "./paper-account";
import type { VenueFee } from "./market-data/fees";
import { FeeTierInfo } from "./fee-tier-info";
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
  number,
  usdcSize,
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
  bracket?: BracketInputs;
};
export const initialTicket: Ticket = {
  side: "Buy",
  type: "Limit",
  size: "300",
  limit: "151.50",
  slippage: "0.5",
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
  onPlace,
  comparison,
  onCompare,
  marketPrice,
  bookPrices,
  refreshComparison,
  canTrade = false,
  available = 0,
  onConnect,
  estimate,
  venueFee,
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
  onPlace: (
    draft: Draft,
    bracket: Bracket,
    submittedAt: number,
  ) => string | void;
  comparison: RouteComparison;
  onCompare: () => void;
  marketPrice?: number;
  bookPrices?: { bid: number; ask: number };
  refreshComparison?: () => RouteComparison;
  canTrade?: boolean;
  available?: number;
  onConnect?: () => void;
  estimate?: ReturnType<typeof paperQuote>;
  venueFee?: VenueFee;
}) {
  const ready = useClientReady();
  const editable = ready && canTrade;
  const [slippageOpen, setSlippageOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const advanced = mode === "manual" && isStrategy(ticket.type);
  const hasLimit = ticket.type === "Limit" || ticket.type === "Iceberg";
  const hasTif =
    mode === "manual" && ["Limit", "Scale", "Iceberg"].includes(ticket.type);
  const mid = bookPrices ? (bookPrices.bid + bookPrices.ask) / 2 : undefined;
  const orderValue = parseAmount(ticket.size);
  const quote = mode === "auto" ? comparison.best : estimate?.quote;
  const bracketInputs = ticket.bracket ?? emptyBracket;
  const entry = hasLimit
    ? parseAmount(ticket.limit)
    : (quote?.averageFill ?? marketPrice ?? NaN);
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
    if (!editable) return;
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
    const bracket =
      advanced || ticket.reduceOnly
        ? {}
        : resolveBracket(
            bracketInputs,
            mode === "auto" ? review.best!.averageFill : entry,
            ticket.side,
          );
    if (
      !advanced &&
      !ticket.reduceOnly &&
      bracketInputs.enabled &&
      bracket.tp === undefined &&
      bracket.sl === undefined
    ) {
      setErrors({
        route: "Enter at least one take-profit or stop-loss level.",
      });
      return;
    }
    const rejection = onPlace(
      {
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
                ...(review.live
                  ? { live: { ...review.live, curves: [] } }
                  : {}),
                savedAt: new Date().toISOString(),
              },
            }
          : {}),
      },
      bracket,
      Date.now(),
    );
    if (rejection) setErrors({ route: rejection });
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
          disabled={!editable}
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
        <TradingModeSwitch
          disabled={!ready}
          value={mode}
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
              <VenueSelect
                id="d-execution-venue"
                label="Execution venue"
                disabled={!ready}
                value={venue}
                onChange={(value) => {
                  setErrors({});
                  onVenue(value);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              className="d-route-scope"
              disabled={!editable}
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
        <fieldset className="d-ticket-fields" disabled={!editable}>
          <legend className="d-sr-only">Paper order controls</legend>
          <div className="d-ticket-available">
            <span>Available</span>
            <strong>{number(available)} USDC</strong>
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
                disabled={!editable}
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
              disabled={!editable}
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
            disabled={!editable}
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
                    disabled={!editable || !bookPrices}
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
              disabled={!editable}
              errors={errors}
              onChange={(value) => {
                onTicket({ ...ticket, strategyConfig: value });
                setErrors({});
              }}
            />
          )}
          <div className="d-order-modifiers">
            <label className="d-ticket-check">
              <input
                type="checkbox"
                disabled={!editable}
                checked={!!ticket.reduceOnly}
                onChange={(e) => update("reduceOnly", e.target.checked)}
              />
              Reduce only
            </label>
            <label className="d-ticket-check">
              <input
                type="checkbox"
                disabled={!editable || advanced || ticket.reduceOnly}
                checked={
                  !advanced && !ticket.reduceOnly && bracketInputs.enabled
                }
                onChange={(e) =>
                  onTicket({
                    ...ticket,
                    bracket: { ...bracketInputs, enabled: e.target.checked },
                  })
                }
              />
              Take profit / Stop loss
            </label>
            {hasTif && (
              <div className="d-tif-control">
                <label htmlFor="d-tif">Time in force</label>
                <select
                  id="d-tif"
                  disabled={!editable}
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
          {bracketInputs.enabled && !advanced && !ticket.reduceOnly && (
            <BracketControls
              value={bracketInputs}
              onChange={(value) => onTicket({ ...ticket, bracket: value })}
              entry={entry}
              side={ticket.side}
              disabled={!editable}
            />
          )}
          {advanced ? (
            result?.plan ? (
              <StrategyPlanView plan={result.plan} />
            ) : (
              <p className="d-plan-empty">
                Complete the strategy inputs to preview the plan.
              </p>
            )
          ) : null}
          {mode === "auto" && (
            <RouteCard
              comparison={comparison}
              onCompare={onCompare}
              onAllowed={onAllowed}
            />
          )}
          <div className="d-ticket-summary" aria-label="Paper order summary">
            <DetailList
              rows={[
                [
                  "Liquidation price",
                  <span
                    key="liq"
                    title="Venue maintenance margin and liquidation are not simulated"
                  >
                    N/A
                  </span>,
                ],
                [
                  "Order value",
                  canTrade && Number.isFinite(orderValue) && orderValue > 0
                    ? usdcSize(orderValue)
                    : "—",
                ],
                [
                  "Margin required",
                  canTrade && Number.isFinite(orderValue) && orderValue > 0
                    ? money(
                        (hasLimit
                          ? orderValue
                          : (quote?.notional ?? orderValue)) /
                          parseAmount(ticket.leverage),
                      )
                    : "—",
                ],
                ...(ticket.type === "Market"
                  ? [
                      [
                        "Slippage",
                        <span key="slippage" className="d-slippage-summary">
                          <span>
                            Est.{" "}
                            {quote
                              ? `${Math.max(0, (ticket.side === "Buy" ? 1 : -1) * (quote.averageFill / (mode === "auto" ? comparison.reference : estimate!.reference) - 1) * 100).toFixed(2)}%`
                              : "—"}
                          </span>
                          <span> / </span>
                          <button
                            type="button"
                            disabled={!editable}
                            className="d-slippage-trigger"
                            aria-label={`Set maximum slippage, currently ${ticket.slippage}%`}
                            onClick={() => setSlippageOpen(true)}
                          >
                            Max: {ticket.slippage}%
                          </button>
                        </span>,
                      ] as [string, React.ReactNode],
                    ]
                  : []),
                [
                  "Est. venue fee",
                  mode === "auto" ? (
                    money(quote?.venueFee)
                  ) : (
                    <span key="fee">
                      {hasLimit && Number.isFinite(orderValue) && venueFee
                        ? money((orderValue * venueFee.takerBps) / 10000)
                        : money(quote?.venueFee)}{" "}
                      {venueFee && (
                        <>
                          <small>{venueFee.takerBps.toFixed(2)} bps</small>
                          <FeeTierInfo venue={venue} fee={venueFee} />
                        </>
                      )}
                    </span>
                  ),
                ],
              ]}
            />
            <p className="d-field-help">
              Paper margin · Venue fees modeled
              {hasLimit ? " at taker rate" : ""} · Cinder pricing excluded
            </p>
          </div>
          <button
            className={`d-button d-trade-submit d-wide ${ticket.side === "Buy" ? "d-buy-action" : "d-sell-action"}`}
            disabled={
              !editable ||
              scenario === "stale" ||
              (mode === "auto" && !comparison.best)
            }
            type="submit"
          >
            {advanced
              ? "Schedule paper plan"
              : `Place ${ticket.side === "Buy" ? "buy" : "sell"} order`}
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
        </fieldset>
        {!canTrade && (
          <div className="d-connect-to-trade">
            <button
              type="button"
              className="d-button d-primary d-wide"
              onClick={onConnect}
            >
              Connect wallet to trade
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <p>Start with 10,000 simulated USDC. No signing or real funds.</p>
          </div>
        )}
        <div className="d-ticket-privacy">
          <LockKeyhole size={13} aria-hidden="true" />
          Paper trading · No live orders
        </div>
      </form>
      {slippageOpen && editable && (
        <SlippageDialog
          value={ticket.slippage}
          onClose={() => setSlippageOpen(false)}
          onSave={(value) => {
            update("slippage", value);
            setSlippageOpen(false);
          }}
        />
      )}
    </aside>
  );
}
