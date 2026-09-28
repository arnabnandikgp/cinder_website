"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { DetailList, Segments } from "./controls";
import {
  markets,
  number,
  referencePrice,
  venues,
  type Draft,
  type Market,
  type Scenario,
  type Venue,
} from "./data";

export type Ticket = Omit<
  Draft,
  "id" | "market" | "mode" | "venue" | "allowed"
>;
export const initialTicket: Ticket = {
  side: "Buy",
  type: "Limit",
  size: "2",
  limit: "151.50",
  slippage: "",
  leverage: "25",
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
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = (key: keyof Ticket, value: string) => {
    onTicket({ ...ticket, [key]: value });
    setErrors((current) => ({ ...current, [key]: "" }));
  };
  const validDecimal = (value: string) =>
    /^\d+(\.\d+)?$/.test(value.trim()) &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0;
  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!validDecimal(ticket.size))
      next.size = `Enter a ${market} quantity greater than zero.`;
    if (ticket.type === "Limit" && !validDecimal(ticket.limit))
      next.limit = "Enter a limit price greater than zero.";
    if (
      ticket.type === "Market" &&
      (!validDecimal(ticket.slippage) || Number(ticket.slippage) >= 100)
    )
      next.slippage =
        "Enter a maximum slippage greater than 0% and below 100%.";
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`d-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    onReview({ ...ticket, id: "", market, mode, venue, allowed: [...allowed] });
  }
  const input = (
    key: "size" | "limit" | "slippage",
    label: string,
    unit: string,
  ) => (
    <div className="d-field">
      <label htmlFor={`d-${key}`}>{label}</label>
      <div className="d-amount-input">
        <input
          id={`d-${key}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={ticket[key]}
          onChange={(e) => update(key, e.target.value)}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `d-${key}-error` : undefined}
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
    <aside className="d-panel d-ticket" aria-labelledby="d-ticket-title">
      <div className="d-panel-title">
        <h2 id="d-ticket-title">New order</h2>
        <span>{markets[market].symbol}</span>
      </div>
      <form onSubmit={submit} noValidate>
        <Segments
          label="Execution"
          value={mode}
          options={[
            { value: "manual", label: "Choose venue" },
            { value: "auto", label: "Auto-route" },
          ]}
          onChange={onMode}
        />
        {mode === "manual" ? (
          <div className="d-field">
            <label htmlFor="d-execution-venue">Execution venue</label>
            <select
              id="d-execution-venue"
              value={venue}
              onChange={(e) => onVenue(e.target.value as Venue)}
            >
              {Object.entries(venues).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="d-route-note">
            <span className="d-concept">Future concept</span>
            <p>
              Compare eligible venues for this new order. No route is calculated
              in the demo.
            </p>
            <button type="button" className="d-text-button" onClick={onAllowed}>
              Allowed venues: {allowed.length}{" "}
              <ArrowRight size={13} aria-hidden="true" />
            </button>
            <span className="d-cell-sub">
              {allowed.map((v) => venues[v]).join(" · ")}
            </span>
          </div>
        )}
        <div className="d-ticket-divider" />
        <div className="d-leverage-control">
          <label htmlFor="d-leverage">Leverage</label>
          <select
            id="d-leverage"
            value={ticket.leverage}
            onChange={(e) => update("leverage", e.target.value)}
          >
            {["1", "2", "5", "10", "25"].map((value) => (
              <option key={value} value={value}>
                {value}x
              </option>
            ))}
          </select>
        </div>
        <Segments
          label="Direction"
          value={ticket.side}
          options={[
            { value: "Buy", label: "Buy / Long" },
            { value: "Sell", label: "Sell / Short" },
          ]}
          onChange={(value) => update("side", value)}
        />
        <Segments
          label="Order type"
          value={ticket.type}
          options={[
            { value: "Market", label: "Market" },
            { value: "Limit", label: "Limit" },
          ]}
          onChange={(value) => update("type", value)}
        />
        {input("size", "Order size", market)}
        {ticket.type === "Limit"
          ? input("limit", "Limit price", "USD")
          : input("slippage", "Maximum slippage", "%")}
        <DetailList
          rows={[
            [
              "Order value",
              `${number(Number(ticket.size || 0) * (ticket.type === "Limit" ? Number(ticket.limit || 0) : referencePrice(market, venue)))} USD`,
            ],
            [
              "Available to trade",
              `${scenario === "empty" ? "0.00" : "7,400.00"} USDC`,
            ],
            ["Margin / estimated fees", "Not calculated"],
          ]}
        />
        <button
          className={`d-button d-trade-submit d-wide ${ticket.side === "Buy" ? "d-buy-action" : "d-sell-action"}`}
          disabled={scenario === "stale"}
          type="submit"
        >
          Review {ticket.side === "Buy" ? "buy" : "sell"} order{" "}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        {scenario === "stale" && (
          <p className="d-ticket-note">
            Refresh the account before reviewing a new order.
          </p>
        )}
        <div className="d-ticket-privacy">
          <LockKeyhole size={13} aria-hidden="true" /> Confidential order
          handling
        </div>
      </form>
    </aside>
  );
}
