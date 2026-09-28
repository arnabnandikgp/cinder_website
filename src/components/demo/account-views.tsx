"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  FileText,
  LockKeyhole,
  Wallet,
} from "lucide-react";
import { Empty } from "./controls";
import {
  fillsFor,
  funding,
  markets,
  marginByVenue,
  number,
  signed,
  venues,
  type CancelState,
  type Draft,
  type Scenario,
} from "./data";

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
    <>
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
      <div className="d-capital-grid">
        <section className="d-panel d-equity">
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
            <button className="d-button" onClick={() => onTransfer("withdraw")}>
              <ArrowUpRight size={15} aria-hidden="true" />
              Withdraw preview
            </button>
          </div>
        </section>
        <section className="d-panel d-capital-detail">
          <h2>Capital availability</h2>
          <dl className="d-detail-list">
            <div>
              <dt>Available to trade</dt>
              <dd>{number(empty ? 0 : 7400)} USDC</dd>
            </div>
            <div className="d-margin-group">
              <dt>Margin committed</dt>
              <dd data-testid="margin-committed">{number(committed)} USDC</dd>
              <dd className="d-margin-details">
                <dl
                  className="d-margin-breakdown"
                  aria-label="Margin committed by venue"
                >
                  {allocations.map(({ venue, positions, margin }) => (
                    <div key={venue} data-testid={`margin-${venue}`}>
                      <dt>
                        {venues[venue]}
                        <span>
                          {positions
                            ? `${positions} open position${positions === 1 ? "" : "s"}`
                            : "No open positions"}
                        </span>
                      </dt>
                      <dd>{number(margin)} USDC</dd>
                    </div>
                  ))}
                </dl>
              </dd>
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
      <div className="d-account-context">
        <Wallet size={18} aria-hidden="true" />
        <p>
          {scenario === "deposit"
            ? "Sample deposit: 1,000 USDC received, awaiting account credit. It is not yet included in available funds."
            : "The account view shows your Cinder records. It does not imply shared margin or freely transferable positions across venues."}
        </p>
      </div>
    </>
  );
}

type Event = {
  id: string;
  category: string;
  title: string;
  detail: string;
  time: string;
  amount: string;
  order?: string;
};
export function ActivityView({
  scenario,
  cancel,
  drafts,
  filter,
  onFilter,
  onDetail,
}: {
  scenario: Scenario;
  cancel: CancelState;
  drafts: Draft[];
  filter: string;
  onFilter: (value: string) => void;
  onDetail: (id: string) => void;
}) {
  const filled = scenario === "partial" ? 2 : 0;
  const events: Event[] =
    scenario === "empty"
      ? []
      : [
          {
            id: "EX-104",
            category: "orders",
            title:
              cancel === "confirmed"
                ? "Order remainder cancelled"
                : cancel === "requested"
                  ? "Cancellation requested"
                  : filled
                    ? "Order partially filled"
                    : "Limit order open",
            detail: `SOL-PERP · Pacifica · ${filled} of 5 SOL filled`,
            time: "11:58:00",
            amount:
              cancel === "confirmed"
                ? `${5 - filled} SOL cancelled`
                : `${5 - filled} SOL remaining`,
            order: "EX-104",
          },
          ...fillsFor(scenario).flatMap((fill) => [
            {
              id: fill.id,
              category: "trades",
              title: `${fill.side} filled`,
              detail: `${markets[fill.market].symbol} · ${venues[fill.venue]} · ${fill.size} ${fill.market} at ${number(fill.price)} USD`,
              time: fill.time,
              amount: `${fill.size} ${fill.market}`,
              order: fill.order,
            },
            {
              id: `fee-${fill.id}`,
              category: "fees",
              title:
                fill.fee === null
                  ? "Trading fee pending"
                  : "Trading fee booked",
              detail: `${venues[fill.venue]} · ${fill.id}`,
              time: fill.time,
              amount:
                fill.fee === null ? "Pending" : `−${number(fill.fee)} USDC`,
              order: fill.order,
            },
          ]),
          ...funding.map((item) => ({
            id: item.id,
            category: "funding",
            title: item.amount < 0 ? "Funding paid" : "Funding received",
            detail: `${markets[item.market].symbol} · ${venues[item.venue]}`,
            time: item.time,
            amount: `${signed(item.amount)} USDC`,
          })),
          {
            id: "TR-101",
            category: "transfers",
            title: "Deposit credited",
            detail: "Sample Solana wallet → Cinder account",
            time: "09:00:00",
            amount: "+1,000.00 USDC",
          },
        ];
  if (scenario === "deposit")
    events.push({
      id: "TR-102",
      category: "transfers",
      title: "Deposit awaiting credit",
      detail: "Received, not yet available to trade",
      time: "11:59:00",
      amount: "1,000.00 USDC pending",
    });
  events.sort((a, b) => b.time.localeCompare(a.time));
  const draftEvents: Event[] = [...drafts].reverse().map((draft) => ({
    id: draft.id,
    category: "drafts",
    title: "Order draft saved",
    detail: `${markets[draft.market].symbol} · ${draft.mode === "auto" ? `Auto-route concept: ${draft.allowed.map((v) => venues[v]).join(", ")}` : venues[draft.venue]} · ${draft.side} ${draft.size} ${draft.market}`,
    time: "This session",
    amount: "Not submitted",
    order: draft.id,
  }));
  const visible = [...draftEvents, ...events].filter(
    (event) => filter === "all" || filter === event.category,
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
      <section className="d-panel d-activity">
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
        {visible.length === 0 ? (
          <Empty title="No activity in this view">
            Choose another filter, or save an example order draft from Trade.
          </Empty>
        ) : (
          <ol className="d-events">
            {visible.map((event) => (
              <li key={event.id}>
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
                <div className="d-event-content">
                  <h2>{event.title}</h2>
                  <p>{event.detail}</p>
                  {event.order ? (
                    <button
                      className="d-cell-link"
                      onClick={() => onDetail(event.order!)}
                    >
                      {event.order} · View details
                    </button>
                  ) : (
                    <span className="d-cell-sub">{event.id}</span>
                  )}
                </div>
                <div className="d-event-amount">
                  <strong>{event.amount}</strong>
                  <span>{event.time}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="d-record-foot">
          This timeline is account-wide. It is independent of the chart and the
          venue filter in Trade.
        </p>
      </section>
    </>
  );
}
