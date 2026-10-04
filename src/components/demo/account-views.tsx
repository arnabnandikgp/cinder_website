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
  marginByVenue,
  number,
  venues,
  type CancelState,
  type Draft,
  type Scenario,
} from "./data";
import { VenueIcon } from "./venue-select";

export function AccountOverview({
  scenario,
  onTransfer,
}: {
  scenario: Scenario;
  onTransfer: (kind: "deposit" | "withdraw") => void;
}) {
  const empty = scenario === "empty";
  const allocations = marginByVenue(scenario);
  const committed = allocations.reduce(
    (sum, allocation) => sum + allocation.margin,
    0,
  );
  return (
    <div className="d-account-overview">
      <div className="d-view-heading">
        <div>
          <span className="d-overline">YOUR CINDER ACCOUNT</span>
          <h1>Capital, with context.</h1>
          <p>
            Your individual account, separate from the shared venue accounts.
          </p>
        </div>
        <span className="d-private-label">
          <LockKeyhole size={14} aria-hidden="true" /> Sample private account
        </span>
      </div>
      <div className="d-account-capital">
        <div className="d-capital-grid">
          <section className="d-equity" aria-label="Account equity">
            <span className="d-overline">ACCOUNT EQUITY</span>
            <div>
              {number(empty ? 0 : 12024)} <span>USDC</span>
            </div>
            <p>Illustrative snapshot · Includes sample unrealized PnL</p>
            <div className="d-capital-actions">
              <button
                className="d-button d-primary"
                onClick={() => onTransfer("deposit")}
              >
                <ArrowDownLeft size={15} aria-hidden="true" />
                Deposit preview
              </button>
              <button
                className="d-button"
                onClick={() => onTransfer("withdraw")}
              >
                <ArrowUpRight size={15} aria-hidden="true" />
                Withdraw preview
              </button>
            </div>
          </section>
          <section
            className="d-capital-availability"
            aria-label="Capital availability"
          >
            <h2>Capital availability</h2>
            <dl className="d-detail-list">
              <div>
                <dt>Available to trade</dt>
                <dd>{number(empty ? 0 : 7400)} USDC</dd>
              </div>
              <div>
                <dt>Available to withdraw</dt>
                <dd>{number(empty ? 0 : 5000)} USDC</dd>
              </div>
            </dl>
            <p>
              Different measures, not an equity breakdown. Eligibility and risk
              calculations are not implemented in this demo.
            </p>
          </section>
        </div>
        <section
          className="d-capital-detail d-margin-group"
          aria-labelledby="d-margin-title"
        >
          <div className="d-allocation-heading">
            <div>
              <h2 id="d-margin-title">Margin committed</h2>
              <p>Allocated to open positions, by venue.</p>
            </div>
            <strong data-testid="margin-committed">
              {number(committed)} USDC
            </strong>
          </div>
          <div className="d-allocation-labels" aria-hidden="true">
            <span>Venue / positions</span>
            <span>Share of committed margin</span>
          </div>
          <dl
            className="d-margin-breakdown"
            aria-label="Margin committed by venue"
          >
            {allocations.map(({ venue, positions, margin }) => (
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
                    max={committed || 1}
                    value={margin}
                    aria-label={`${venues[venue]} share of committed margin`}
                    aria-valuetext={`${number(margin)} of ${number(committed)} USDC committed`}
                  />
                  <span>{number(margin)} USDC</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="d-allocation-note">
            Margin stays separate by venue. These bars show committed margin,
            not account equity.
          </p>
        </section>
      </div>
      <div className="d-account-context">
        <Wallet size={18} aria-hidden="true" />
        <p>
          {scenario === "deposit"
            ? "Sample deposit: 1,000 USDC received, awaiting account credit. It is not yet included in available funds."
            : "The account view shows your Cinder records. It does not imply shared margin or freely transferable positions across venues."}
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
}: {
  scenario: Scenario;
  cancel: CancelState;
  drafts: Draft[];
  filter: string;
  actor: string;
  onFilter: (value: string) => void;
  onActor: (value: string) => void;
  onDetail: (id: string) => void;
}) {
  const [detail, setDetail] = useState<ActivityEvent | null>(null);
  const visible = activityFor(scenario, cancel, drafts).filter(
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
        <span className="d-badge">All venues · Sample records</span>
      </div>
      <section className="d-activity" aria-label="Account activity ledger">
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
          <span>Sample day</span>
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
                <time className="d-event-time">{event.time}</time>
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
          eyebrow="SAMPLE ACTIVITY"
          onClose={() => setDetail(null)}
        >
          <p className="d-dialog-intro">{detail.detail}</p>
          <DetailList
            rows={[
              ["Event", detail.id],
              ["Initiated by", eventActorLabel(detail)],
              ["Venue", detail.venue ? venues[detail.venue] : "Cinder"],
              ["Time", `${detail.time} UTC · Sample day`],
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
