"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  ChevronRight,
  FileText,
  LockKeyhole,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { DetailList, Empty, Modal } from "./controls";
import { agentsFor } from "./agents";
import {
  activityFor,
  eventActorLabel,
  matchesActor,
  type ActivityEvent,
} from "./activity";
import {
  number,
  venues,
  type CancelState,
  type Draft,
  type Scenario,
  type Venue,
  type VenueScope,
} from "./data";
import { VenueIcon } from "./venue-select";
import {
  paperTotals,
  paperValuation,
  paperVenues,
  type PaperAccount,
} from "./paper-account";
import { paperTime } from "./paper-records";

export function AccountOverview({
  onTransfer,
  paper,
  marks,
  onReset,
  scope,
  onScope,
}: {
  onTransfer: (venue: Venue, kind?: "topup" | "return") => void;
  paper: PaperAccount | null;
  marks: Partial<Record<string, number>>;
  onReset?: () => void;
  scope: VenueScope;
  onScope: (venue: VenueScope) => void;
}) {
  const totals = paperTotals(paper);
  const valuation = paperValuation(paper, marks);
  const amount = (value: number | null) =>
    value === null || !paper ? "—" : number(value) + " USDC";
  const pnl = (value: number | null) =>
    value === null || !paper
      ? "—"
      : (value > 0 ? "+" : "") + number(value) + " USDC";
  const displayedVenues = (Object.keys(venues) as Venue[]).filter(
    (v) =>
      paperVenues.includes(v) ||
      (paper?.venueCash[v] ?? 0) !== 0 ||
      paper?.positions.some((p) => p.venue === v),
  );
  return (
    <div className="d-account-overview">
      <div className="d-portfolio-heading">
        <div>
          <h1>Account overview</h1>
          <p>Venue balances. One portfolio view.</p>
          <span className="d-private-label">
            <LockKeyhole size={13} aria-hidden="true" /> Simulated account ·
            Saved in this browser
          </span>
        </div>
        <div
          className="d-portfolio-totals"
          aria-label="Portfolio across all venues"
        >
          <section aria-label="Total equity">
            <span>
              Total equity <small>Across all venues</small>
            </span>
            <strong data-testid="portfolio-equity">
              {amount(valuation.equity)}
            </strong>
          </section>
          <section aria-label="Unrealised PnL">
            <span>
              Unrealised PnL <small>Across all venues</small>
            </span>
            <strong
              className={
                valuation.unrealized !== null && valuation.unrealized < 0
                  ? "d-down"
                  : "d-up"
              }
            >
              {pnl(valuation.unrealized)}
            </strong>
          </section>
        </div>
      </div>
      {valuation.missing.length > 0 && (
        <p className="d-mark-unavailable" role="status">
          Portfolio valuation incomplete · Waiting for fresh marks:{" "}
          {valuation.missing
            .map((p) => `${p.market} · ${venues[p.venue]}`)
            .join(", ")}
          . Venue cash remains available below.
        </p>
      )}
      <section
        className="d-venue-balances d-margin-group"
        aria-labelledby="d-venue-balances-title"
      >
        <div className="d-venue-balances-heading">
          <div>
            <h2 id="d-venue-balances-title">Your venue balances</h2>
            <p>
              Margin stays with its venue. Select a card to filter the records
              below.
            </p>
          </div>
          <button
            type="button"
            className="d-button"
            aria-pressed={scope === "all"}
            onClick={() => onScope("all")}
          >
            All venues
          </button>
        </div>
        <div className="d-venue-balance-grid">
          {displayedVenues.map((venue) => {
            const capital = paperTotals(paper, venue);
            const value = paperValuation(paper, marks, venue);
            const positions =
              paper?.positions.filter((p) => p.venue === venue).length ?? 0;
            return (
              <article
                key={venue}
                className={
                  "d-venue-balance-card" +
                  (scope === venue ? " is-selected" : "")
                }
                data-testid={"venue-balance-" + venue}
              >
                <button
                  type="button"
                  className="d-venue-balance-select"
                  aria-label={"Show " + venues[venue] + " records"}
                  aria-pressed={scope === venue}
                  onClick={() => onScope(venue)}
                >
                  <span className="d-venue-balance-name">
                    <VenueIcon venue={venue} size={26} />
                    <strong>{venues[venue]}</strong>
                    <span>{scope === venue ? "Selected" : "View records"}</span>
                  </span>
                  <span className="d-venue-balance-available">
                    <span>Available venue margin</span>
                    <strong data-testid={"available-" + venue}>
                      {amount(capital.available)}
                    </strong>
                  </span>
                  <span className="d-venue-balance-stat">
                    <span>Venue equity</span>
                    <strong>{amount(value.equity)}</strong>
                  </span>
                  <span className="d-venue-balance-stat">
                    <span>Unrealised PnL</span>
                    <strong
                      className={
                        value.unrealized !== null && value.unrealized < 0
                          ? "d-down"
                          : "d-up"
                      }
                    >
                      {pnl(value.unrealized)}
                    </strong>
                  </span>
                  <span className="d-venue-balance-stat">
                    <span>Open positions</span>
                    <strong>{positions}</strong>
                  </span>
                  <span className="d-venue-balance-stat">
                    <span>Position requirements</span>
                    <strong>{amount(capital.margin)}</strong>
                  </span>
                  <span className="d-venue-balance-stat">
                    <span>Pending reservations</span>
                    <strong>{amount(capital.reserved)}</strong>
                  </span>
                </button>
                <div className="d-venue-balance-actions">
                  <button
                    type="button"
                    className="d-button d-primary"
                    disabled={!paper || !paperVenues.includes(venue)}
                    aria-label={"Top up " + venues[venue]}
                    onClick={() => onTransfer(venue)}
                  >
                    <ArrowDownLeft size={14} aria-hidden="true" /> Top up
                  </button>
                  <button
                    type="button"
                    className="d-text-button"
                    disabled={!paper || capital.available <= 0}
                    aria-label={
                      "Return " + venues[venue] + " funds to demo wallet"
                    }
                    onClick={() => onTransfer(venue, "return")}
                  >
                    Return funds <ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <details className="d-balance-breakdown">
        <summary>
          Balance breakdown <ChevronRight size={16} aria-hidden="true" />
        </summary>
        <div className="d-balance-breakdown-grid">
          <section aria-label="Equity valuation">
            <h2>Portfolio valuation</h2>
            <DetailList
              rows={[
                ["Cash across venues", amount(totals.cash)],
                ["Unrealised PnL", amount(valuation.unrealized)],
                ["Total equity", amount(valuation.equity)],
              ]}
            />
            <p>
              Cash includes realised PnL and booked fees. Unrealised PnL uses
              fresh marks from each position’s venue. Missing marks are not
              treated as zero.
            </p>
          </section>
          <section aria-label="Margin across venues">
            <h2>Margin by requirement</h2>
            <DetailList
              rows={[
                ["Cash across venues", amount(totals.cash)],
                ["Position margin requirements", amount(totals.margin)],
                ["Pending reservations", amount(totals.reserved)],
                [
                  "Available margin · Sum across venues",
                  amount(totals.available),
                ],
              ]}
            />
            <p>
              This sum is not a shared trading balance. Each order uses its
              execution venue’s available margin. Unrealised gains are not
              spendable in this demo.
            </p>
          </section>
        </div>
      </details>
      <div className="d-portfolio-footer">
        <span>
          <Wallet size={16} aria-hidden="true" /> Demo wallet:{" "}
          {amount(paper?.walletCash ?? 0)}{" "}
          <small>Separate from portfolio equity</small>
        </span>
        {onReset && (
          <button
            type="button"
            className="d-text-button"
            disabled={!paper}
            onClick={onReset}
          >
            Reset paper account
          </button>
        )}
      </div>
      <p className="d-account-context">
        Simulated balances and execution only. No real deposits, withdrawals or
        escrow transactions. Venue separation does not establish liquidation or
        loss isolation.
      </p>
    </div>
  );
}

export function ActivityView({
  scenario,
  cancel,
  drafts,
  filter,
  actor,
  onFilter,
  onActor,
  onDetail,
  events,
}: {
  scenario: Scenario;
  cancel: CancelState;
  drafts: Draft[];
  filter: string;
  actor: string;
  onFilter: (value: string) => void;
  onActor: (value: string) => void;
  onDetail: (id: string) => void;
  events?: ActivityEvent[];
}) {
  const [detail, setDetail] = useState<ActivityEvent | null>(null);
  const visible = (events ?? activityFor(scenario, cancel, drafts)).filter(
    (event) =>
      (filter === "all" || filter === event.category) &&
      matchesActor(event, actor),
  );
  return (
    <>
      <div className="d-view-heading">
        <div>
          <span className="d-overline">ACCOUNT-WIDE ACTIVITY</span>
          <h1>Every move. In context.</h1>
          <p>Follow an order, understand a charge, or find a transfer.</p>
        </div>
        <span className="d-badge">
          All venues · {events ? "Paper records" : "Sample records"}
        </span>
      </div>
      <section className="d-activity" aria-label="Account activity ledger">
        <h2 className="d-sr-only">Activity records</h2>
        <div className="d-activity-actor">
          <label htmlFor="d-activity-actor">Initiated by</label>
          <select
            id="d-activity-actor"
            value={actor}
            onChange={(event) => onActor(event.target.value)}
          >
            <option value="all">Everyone</option>
            <option value="you">You</option>
            <option value="system">System</option>
            {agentsFor(scenario).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          {actor !== "all" && (
            <button className="d-cell-link" onClick={() => onActor("all")}>
              Clear actor filter
            </button>
          )}
          <span>
            {actor !== "all" && actor !== "you" && actor !== "system"
              ? "Includes fees from this agent’s fills."
              : "Requests and system events, clearly attributed."}
          </span>
        </div>
        <div className="d-activity-filters" aria-label="Activity filters">
          {Object.entries({
            all: "All activity",
            orders: "Orders",
            trades: "Trades",
            fees: "Fees",
            funding: "Funding",
            transfers: "Transfers",
            drafts: "Drafts",
          }).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              onClick={() => onFilter(key)}
            >
              {label}
              {key === "drafts" && drafts.length > 0 && (
                <span className="d-count">{drafts.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="d-activity-day">
          <span>{events ? "This paper account" : "Sample day"}</span>
          <span>UTC · Newest first</span>
        </div>
        <div className="d-ledger-columns" aria-hidden="true">
          <span>Time</span>
          <span>Event</span>
          <span>Initiated by</span>
          <span>Venue</span>
          <span>Amount / result</span>
          <span />
        </div>
        {visible.length === 0 ? (
          <Empty title="No activity in this view">
            Choose another event or actor filter.
          </Empty>
        ) : (
          <ol className="d-events">
            {visible.map((event) => (
              <li
                key={event.id}
                data-event-id={event.id}
                data-actor={event.actor}
                data-origin-agent={event.originAgent}
              >
                <time
                  className="d-event-time"
                  dateTime={events ? event.time : undefined}
                >
                  {events ? paperTime(event.time) : event.time}
                </time>
                <div className="d-event-content">
                  <h2>
                    <span className="d-event-icon" aria-hidden="true">
                      {event.category === "transfers" ? (
                        <ArrowDownLeft size={18} />
                      ) : event.category === "trades" ||
                        event.category === "funding" ? (
                        <ArrowRightLeft size={18} />
                      ) : (
                        <FileText size={18} />
                      )}
                    </span>
                    {event.title}
                  </h2>
                  <p>
                    {event.detail}
                    <span className="d-event-id"> · {event.id}</span>
                  </p>
                </div>
                <span className="d-event-actor">{eventActorLabel(event)}</span>
                <span className="d-event-venue">
                  {event.venue && <VenueIcon venue={event.venue} size={16} />}
                  {event.venue ? venues[event.venue] : "Cinder"}
                </span>
                <div
                  className="d-event-amount"
                  data-tone={
                    event.amount.startsWith("−")
                      ? "negative"
                      : event.amount.startsWith("+")
                        ? "positive"
                        : /rejected|expired/i.test(event.amount)
                          ? "negative"
                          : "neutral"
                  }
                >
                  <strong>{event.amount}</strong>
                </div>
                <button
                  className="d-event-inspect"
                  aria-label={
                    event.id.startsWith("AG-")
                      ? `${event.id} · View event details`
                      : event.order
                        ? `${event.order} · View details`
                        : `${event.id} · View event details`
                  }
                  onClick={() =>
                    event.id.startsWith("AG-") || !event.order
                      ? setDetail(event)
                      : onDetail(event.order)
                  }
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <p className="d-record-foot">
          This timeline is account-wide, independent of the venue filter in
          Trade. Funding is a system event; an agent filter includes linked fill
          fees, not position-level funding.
        </p>
      </section>
      {detail && (
        <Modal
          title={detail.title}
          eyebrow={events ? "PAPER ACTIVITY" : "SAMPLE ACTIVITY"}
          onClose={() => setDetail(null)}
        >
          <p className="d-dialog-intro">{detail.detail}</p>
          <DetailList
            rows={[
              ["Event", detail.id],
              ["Initiated by", eventActorLabel(detail)],
              ["Venue", detail.venue ? venues[detail.venue] : "Cinder"],
              [
                "Time",
                events
                  ? `${paperTime(detail.time)} UTC`
                  : `${detail.time} UTC · Sample day`,
              ],
              ["Result", detail.amount],
              ...(detail.order
                ? [["Order", detail.order] as [string, string]]
                : []),
            ]}
          />
          <p className="d-agent-note">
            Illustrative account record. No request was sent from this demo.
          </p>
        </Modal>
      )}
    </>
  );
}
