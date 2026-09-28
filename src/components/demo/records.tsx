"use client";

import { Tabs, Empty } from "./controls";
import {
  fillsFor,
  funding,
  markets,
  number,
  recordLabels,
  signed,
  venues,
  type CancelState,
  type Market,
  type RecordTab,
  type Scenario,
  type VenueScope,
} from "./data";

export type RecordActions = {
  onCancel: () => void;
  onReduce: (market: Market) => void;
  onDetail: (id: string) => void;
};

export function Records({
  tab,
  onTab,
  scope,
  onScope,
  scenario,
  cancel,
  actions,
  account = false,
}: {
  tab: RecordTab;
  onTab: (tab: RecordTab) => void;
  scope: VenueScope;
  onScope: (value: VenueScope) => void;
  scenario: Scenario;
  cancel: CancelState;
  actions: RecordActions;
  account?: boolean;
}) {
  const empty = scenario === "empty";
  const matches = (venue: string) => scope === "all" || scope === venue;
  const filled = scenario === "partial" ? 2 : 0;
  const showPosition = !empty && matches("pacifica");
  const showOrder = showPosition && cancel !== "confirmed";
  const fills = fillsFor(scenario).filter((fill) => matches(fill.venue));
  const payments = empty ? [] : funding.filter((item) => matches(item.venue));
  const history = empty
    ? []
    : [
        {
          id: "EX-104",
          venue: "pacifica",
          side: "Buy",
          requested: 5,
          filled,
          status:
            cancel === "confirmed"
              ? "Remainder cancelled"
              : cancel === "requested"
                ? "Cancel requested"
                : filled
                  ? "Partially filled"
                  : "Open",
          time: "11:58:00",
        },
        {
          id: "EX-103",
          venue: "bulk",
          side: "Sell",
          requested: 1,
          filled: 1,
          status: "Filled",
          time: "11:50:00",
        },
        {
          id: "EX-102",
          venue: "pacifica",
          side: "Buy",
          requested: 2,
          filled: 2,
          status: "Filled",
          time: "11:45:02",
        },
        {
          id: "EX-101",
          venue: "bulk",
          side: "Buy",
          requested: 3,
          filled: 0,
          status: "Rejected",
          time: "11:40:00",
        },
      ].filter((item) => matches(item.venue));
  const tabs = Object.entries(recordLabels).map(([value, label]) => ({
    value: value as RecordTab,
    label,
    ...(value === "positions"
      ? { count: showPosition ? 2 : 0 }
      : value === "orders"
        ? { count: showOrder ? 1 : 0 }
        : {}),
  }));
  const any =
    tab === "positions"
      ? showPosition
      : tab === "orders"
        ? showOrder
        : tab === "trades"
          ? fills.length
          : tab === "history"
            ? history.length
            : payments.length;
  return (
    <section
      className={`d-panel d-records${account ? " d-account-records" : ""}`}
      aria-label="Trading records"
    >
      <Tabs
        id="records"
        label="Trading records"
        value={tab}
        options={tabs}
        onChange={onTab}
      />
      <div className="d-record-scope">
        <div className="d-record-filter">
          <label htmlFor="d-record-venue">Venue</label>
          <select
            id="d-record-venue"
            value={scope}
            onChange={(e) => onScope(e.target.value as VenueScope)}
          >
            <option value="all">All venues</option>
            {Object.entries(venues).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <span>Your records · All markets · UTC</span>
      </div>
      <div
        id="records-panel"
        role="tabpanel"
        aria-labelledby={`records-${tab}`}
        tabIndex={0}
      >
        {!any ? (
          <Empty title={`No ${recordLabels[tab].toLowerCase()} in this view`}>
            {empty
              ? "This is an empty sample account. Choose another demo scenario to explore populated records."
              : "Try All venues to see the other sample records."}
            {tab === "orders" && cancel === "confirmed" && (
              <button
                className="d-text-button"
                onClick={() => onTab("history")}
              >
                View cancelled order in history
              </button>
            )}
          </Empty>
        ) : (
          <div className="d-table-scroll">
            {tab === "positions" && (
              <table>
                <caption className="d-sr-only">Your sample positions</caption>
                <thead>
                  <tr>
                    <th>Market / venue</th>
                    <th>Size</th>
                    <th>Entry / mark (USD)</th>
                    <th>Unrealized PnL</th>
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(markets).map(([key, item]) => (
                    <tr key={key}>
                      <td>
                        <strong>{item.symbol}</strong>
                        <span className="d-cell-sub">
                          Pacifica · {item.side}
                        </span>
                      </td>
                      <td className="d-number">
                        {item.size} {key}
                      </td>
                      <td className="d-number">
                        {number(item.entry)}
                        <span className="d-cell-sub">{number(item.price)}</span>
                      </td>
                      <td className="d-number d-positive">
                        {signed(item.pnl)}
                        <span className="d-cell-sub">
                          USDC · before charges
                        </span>
                      </td>
                      <td>
                        <button
                          className="d-small-button"
                          onClick={() => actions.onReduce(key as Market)}
                        >
                          Reduce
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === "orders" && (
              <table>
                <caption className="d-sr-only">Your sample open orders</caption>
                <thead>
                  <tr>
                    <th>Market / order</th>
                    <th>Limit (USD)</th>
                    <th>Filled / total</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>SOL-PERP</strong>
                      <button
                        className="d-cell-link"
                        onClick={() => actions.onDetail("EX-104")}
                      >
                        EX-104 · Pacifica · Buy
                      </button>
                    </td>
                    <td className="d-number">151.50</td>
                    <td className="d-number">
                      {filled} / 5 SOL
                      <span className="d-cell-sub">
                        {5 - filled} SOL remaining
                      </span>
                    </td>
                    <td>
                      <span className="d-badge">
                        {cancel === "requested"
                          ? "Cancel requested"
                          : filled
                            ? "Partially filled"
                            : "Open"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="d-small-button"
                        onClick={actions.onCancel}
                      >
                        {cancel === "requested" ? "View request" : "Cancel"}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
            {tab === "trades" && (
              <table>
                <caption className="d-sr-only">Individual sample fills</caption>
                <thead>
                  <tr>
                    <th>Market / venue</th>
                    <th>Side / size</th>
                    <th>Fill price (USD)</th>
                    <th>Fee (USDC)</th>
                    <th>Time / order</th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((fill) => (
                    <tr key={fill.id}>
                      <td>
                        <strong>{markets[fill.market].symbol}</strong>
                        <span className="d-cell-sub">
                          {venues[fill.venue]} · {fill.id}
                        </span>
                      </td>
                      <td className="d-number">
                        {fill.side} {fill.size} {fill.market}
                      </td>
                      <td className="d-number">{number(fill.price)}</td>
                      <td className="d-number">
                        {fill.fee === null ? "Pending" : number(fill.fee)}
                      </td>
                      <td className="d-number">
                        {fill.time}
                        <button
                          className="d-cell-link"
                          onClick={() => actions.onDetail(fill.order)}
                        >
                          {fill.order}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === "history" && (
              <table>
                <caption className="d-sr-only">
                  Sample order lifecycle history
                </caption>
                <thead>
                  <tr>
                    <th>Market / order</th>
                    <th>Requested</th>
                    <th>Filled</th>
                    <th>Status</th>
                    <th>Time (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>SOL-PERP</strong>
                        <button
                          className="d-cell-link"
                          onClick={() => actions.onDetail(item.id)}
                        >
                          {item.id} ·{" "}
                          {venues[item.venue as keyof typeof venues]}
                        </button>
                      </td>
                      <td className="d-number">
                        {item.side} {item.requested} SOL
                      </td>
                      <td className="d-number">{item.filled} SOL</td>
                      <td>
                        <span className="d-badge">{item.status}</span>
                        {item.id === "EX-104" && cancel === "confirmed" && (
                          <span className="d-cell-sub">
                            {5 - filled} SOL cancelled
                          </span>
                        )}
                      </td>
                      <td className="d-number">{item.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === "funding" && (
              <table>
                <caption className="d-sr-only">
                  Booked sample funding payments, not funding rates
                </caption>
                <thead>
                  <tr>
                    <th>Market / venue</th>
                    <th>Payment</th>
                    <th>Amount (USDC)</th>
                    <th>Time (UTC)</th>
                    <th>Record</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{markets[item.market].symbol}</strong>
                        <span className="d-cell-sub">{venues[item.venue]}</span>
                      </td>
                      <td>{item.amount < 0 ? "Paid" : "Received"}</td>
                      <td
                        className={`d-number ${item.amount < 0 ? "" : "d-positive"}`}
                      >
                        {signed(item.amount)}
                      </td>
                      <td className="d-number">{item.time}</td>
                      <td className="d-number">{item.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      <div className="d-record-foot">
        {scenario === "stale"
          ? "Last-known sample records. Account updates are paused in this scenario."
          : tab === "funding"
            ? "Booked payments, not rates or forecasts."
            : tab === "trades"
              ? "Each row is a fill. One order can have several fills."
              : "Your positions and trading activity, organised by venue."}
      </div>
    </section>
  );
}
