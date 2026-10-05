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
} from "./data";
import { VenueIcon } from "./venue-select";
import {
  paperTotals,
  paperValuation,
  type PaperAccount,
} from "./paper-account";
import { paperTime } from "./paper-records";

export function AccountOverview({
  onTransfer,
  paper,
  marks,
  onReset,
}: {
  onTransfer: (kind: "deposit" | "withdraw") => void;
  paper: PaperAccount | null;
  marks: Partial<Record<string, number>>;
  onReset?: () => void;
}) {
  const empty = !paper;
  const totals = paperTotals(paper);
  const valuation = paperValuation(paper, marks);
  const requirements = Object.keys(venues).map((v) => ({
    venue: v as keyof typeof venues,
    positions: paper?.positions.filter((p) => p.venue === v).length ?? 0,
    margin:
      paper?.positions
        .filter((p) => p.venue === v)
        .reduce((sum, p) => sum + p.margin, 0) ?? 0,
  }));
  const amount = (value: number | null) =>
    value === null ? "—" : `${number(value)} USDC`;
  return (
    <div className="d-account-overview">
      <div className="d-view-heading d-account-heading">
        <div>
          <h1>Account overview</h1>
          <p>One Cinder account. Execution across venues.</p>
        </div>
        <span className="d-private-label">
          <LockKeyhole size={14} aria-hidden="true" /> Paper account · This
          browser
        </span>
      </div>
      <div className="d-account-capital">
        <div className="d-capital-grid">
          <section className="d-equity" aria-label="Account equity">
            <span className="d-overline">ACCOUNT EQUITY</span>
            <div>
              {valuation.equity === null ? "—" : number(valuation.equity)}{" "}
              <span>USDC</span>
            </div>
            <p>
              {valuation.missing.length
                ? `Valuation unavailable · Waiting for ${valuation.missing.length} fresh position mark${valuation.missing.length === 1 ? "" : "s"}.`
                : "Estimated at live venue marks · Cash plus unrealised PnL"}
            </p>
            <div className="d-capital-actions">
              <button
                className="d-button d-primary"
                disabled={empty}
                onClick={() => onTransfer("deposit")}
              >
                <ArrowDownLeft size={15} aria-hidden="true" />
                Deposit preview
              </button>
              <button
                className="d-button"
                disabled={empty}
                onClick={() => onTransfer("withdraw")}
              >
                <ArrowUpRight size={15} aria-hidden="true" />
                Withdraw preview
              </button>
              {onReset && (
                <button
                  className="d-text-button"
                  disabled={empty}
                  onClick={onReset}
                >
                  Reset paper account
                </button>
              )}
            </div>
          </section>
          <section
            className="d-capital-availability"
            aria-label="Capital availability"
          >
            <h2>Capital availability</h2>
            <dl className="d-detail-list">
              <div>
                <dt>Available margin</dt>
                <dd>{amount(totals.available)}</dd>
              </div>
              <div>
                <dt>Available to withdraw</dt>
                <dd className="d-withdraw-unavailable">
                  Unavailable <small>Simulated funds only</small>
                </dd>
              </div>
            </dl>
            <p>
              Available margin is account-wide cash after requirements and
              reservations, not leveraged buying power or guaranteed venue
              capacity.
            </p>
          </section>
        </div>
        <details className="d-balance-breakdown">
          <summary>
            Balance breakdown <ChevronRight size={16} aria-hidden="true" />
          </summary>
          <div className="d-balance-breakdown-grid">
            <section aria-label="Equity valuation">
              <h2>Equity valuation</h2>
              <DetailList
                rows={[
                  ["Cash balance", amount(totals.cash)],
                  ["Unrealised PnL", amount(valuation.unrealized)],
                  ["Estimated account equity", amount(valuation.equity)],
                ]}
              />
              <p>
                Cash already includes realised PnL and booked modeled fees.
                Funding payments are not simulated.
              </p>
              {valuation.missing.length > 0 && (
                <p className="d-mark-unavailable" role="status">
                  Fresh mark missing:{" "}
                  {valuation.missing
                    .map((p) => `${p.market} · ${venues[p.venue]}`)
                    .join(", ")}
                  . No entry-price fallback is used.
                </p>
              )}
            </section>
            <section aria-label="Paper margin capacity">
              <h2>Paper margin capacity</h2>
              <DetailList
                rows={[
                  ["Cash balance", amount(totals.cash)],
                  ["Position margin requirements", amount(totals.margin)],
                  ["Pending reservations", amount(totals.reserved)],
                  ["Available margin", amount(totals.available)],
                ]}
              />
              <p>
                Available margin = cash minus position requirements and pending
                reservations. Reservations include estimated fees. Unrealised
                gains are not spendable in this paper model.
              </p>
            </section>
          </div>
        </details>
        <section
          className="d-capital-detail d-margin-group"
          aria-labelledby="d-margin-title"
        >
          <div className="d-allocation-heading">
            <div>
              <h2 id="d-margin-title">Position margin requirements</h2>
              <p>
                Margin requirements for your positions, grouped by execution
                venue.
              </p>
            </div>
            <strong data-testid="margin-committed">
              {number(totals.margin)} USDC
            </strong>
          </div>
          <div className="d-allocation-labels" aria-hidden="true">
            <span>Venue / positions</span>
            <span>Position requirements · USDC</span>
          </div>
          <dl
            className="d-margin-breakdown"
            aria-label="Position margin requirements by venue"
          >
            {requirements.map(({ venue, positions, margin }) => (
              <div key={venue} data-testid={`margin-${venue}`}>
                <dt>
                  <VenueIcon venue={venue} size={24} />
                  <div>
                    <strong>{venues[venue]}</strong>
                    <span>
                      {positions
                        ? `${positions} open position${positions === 1 ? "" : "s"}`
                        : "No open positions"}
                    </span>
                  </div>
                </dt>
                <dd>
                  <meter
                    min={0}
                    max={totals.margin || 1}
                    value={margin}
                    aria-label={`${venues[venue]} share of position margin requirements`}
                    aria-valuetext={`${number(margin)} of ${number(totals.margin)} USDC position requirements`}
                  />
                  <span>{number(margin)} USDC</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="d-allocation-note">
            Read-only requirements, not editable allocations or separate venue
            accounts. Pending order reservations are shown in Balance breakdown,
            not in these bars.
          </p>
        </section>
      </div>
      <div className="d-account-context">
        <Wallet size={18} aria-hidden="true" />
        <p>
          Saved per wallet in this browser. Paper requirements are not native
          venue risk calculations. Funding, liquidation and cross-venue margin
          offsets are not simulated.
        </p>
      </div>
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
