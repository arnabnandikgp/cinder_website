"use client";
import { Tabs, Empty } from "./controls";
import {
  number,
  recordLabels,
  venues,
  type Market,
  type RecordTab,
  type Venue,
  type VenueScope,
} from "./data";
import { money } from "./routing";
import { VenueIcon } from "./venue-select";
import type { PaperAccount } from "./paper-account";
export const paperTime = (at: string) =>
  new Date(at).toLocaleString("en-GB", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
export function PaperRecords({
  tab,
  onTab,
  scope,
  onScope,
  account,
  accountView = false,
  marks,
  onCancel,
  onReduce,
  onDetail,
}: {
  tab: RecordTab;
  onTab: (v: RecordTab) => void;
  scope: VenueScope;
  onScope: (v: VenueScope) => void;
  account: PaperAccount | null;
  accountView?: boolean;
  marks: Partial<Record<string, number>>;
  onCancel: (id: string) => void;
  onReduce: (market: Market, venue: Venue) => void;
  onDetail: (id: string) => void;
}) {
  const matches = (v: Venue) => scope === "all" || scope === v;
  const positions = account?.positions.filter((p) => matches(p.venue)) ?? [];
  const orders = account?.orders.filter((o) => matches(o.draft.venue)) ?? [];
  const open = orders.filter(
    (o) => o.status === "Open" || o.status === "Scheduled plan",
  );
  const fills = account?.fills.filter((f) => matches(f.venue)) ?? [];
  const any =
    tab === "positions"
      ? positions.length
      : tab === "orders"
        ? open.length
        : tab === "trades"
          ? fills.length
          : tab === "history"
            ? orders.length
            : 0;
  const venue = (v: Venue) => (
    <span className="d-paper-venue">
      <VenueIcon venue={v} size={16} />
      {venues[v]}
    </span>
  );
  return (
    <section
      className={`d-panel d-records${accountView ? " d-account-records" : ""}`}
      aria-label="Trading records"
    >
      <Tabs
        id="records"
        label="Trading records"
        value={tab}
        options={Object.entries(recordLabels).map(([value, label]) => ({
          value: value as RecordTab,
          label,
          ...(value === "positions"
            ? { count: positions.length }
            : value === "orders"
              ? { count: open.length }
              : {}),
        }))}
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
            {Object.entries(venues).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <span>All markets · UTC</span>
      </div>
      <div
        id="records-panel"
        role="tabpanel"
        aria-labelledby={`records-${tab}`}
        tabIndex={0}
      >
        {!any ? (
          <Empty
            title={
              account
                ? `No ${recordLabels[tab].toLowerCase()} in this view`
                : "Connect your wallet to begin"
            }
          >
            {!account
              ? "Start with 10,000 simulated USDC. No signing or real orders."
              : tab === "funding"
                ? "Funding payments are not simulated. Live rates remain visible in the market header."
                : "Your trades will appear here. Try All venues to see the whole account."}
          </Empty>
        ) : (
          <div className="d-table-scroll d-table-wrap">
            <table className="d-paper-table">
              <thead>
                <tr>
                  {(tab === "positions"
                    ? [
                        "Market / venue",
                        "Position",
                        "Entry price",
                        "Mark / PnL",
                        "Margin",
                        "TP / SL",
                        "",
                      ]
                    : tab === "trades"
                      ? [
                          "Time / order",
                          "Market / venue",
                          "Side",
                          "Fill value",
                          "Fill price",
                          "Fee / realized PnL",
                        ]
                      : [
                          "Order / time",
                          "Market / venue",
                          "Side / type",
                          "Size",
                          "Limit",
                          "Status",
                          "",
                        ]
                  ).map((h, i) => (
                    <th key={i} scope="col">
                      {h || <span className="d-sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tab === "positions"
                  ? positions.map((p) => {
                      const mark = marks[p.id];
                      const pnl =
                        mark === undefined
                          ? undefined
                          : (mark - p.entry) * p.quantity;
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.market}-PERP</strong>
                            <small>{venue(p.venue)}</small>
                          </td>
                          <td className={p.quantity > 0 ? "d-up" : "d-down"}>
                            {p.quantity > 0 ? "Long" : "Short"}
                            <small>
                              {mark === undefined
                                ? "Exposure unavailable"
                                : `${money(Math.abs(p.quantity) * mark)} USDC`}
                            </small>
                          </td>
                          <td>{money(p.entry)}</td>
                          <td>
                            {money(mark)}
                            <small
                              className={
                                pnl !== undefined && pnl < 0 ? "d-down" : "d-up"
                              }
                            >
                              {pnl === undefined
                                ? "Mark unavailable"
                                : `${pnl > 0 ? "+" : ""}${money(pnl)}`}
                            </small>
                          </td>
                          <td>
                            {money(p.margin)}
                            <small>{number(p.leverage, 2)}x leverage</small>
                          </td>
                          <td>
                            {money(p.tp)} / {money(p.sl)}
                          </td>
                          <td>
                            <button
                              className="d-cell-link"
                              onClick={() => onReduce(p.market, p.venue)}
                            >
                              Reduce
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  : tab === "trades"
                    ? fills.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <button
                              className="d-cell-link"
                              onClick={() => onDetail(f.order)}
                            >
                              {f.order}
                            </button>
                            <small>{paperTime(f.at)}</small>
                          </td>
                          <td>
                            {f.market}-PERP<small>{venue(f.venue)}</small>
                          </td>
                          <td className={f.side === "Buy" ? "d-up" : "d-down"}>
                            {f.side}
                          </td>
                          <td>{money(f.quantity * f.price)} USDC</td>
                          <td>{money(f.price)}</td>
                          <td>
                            {money(f.fee)}
                            <small>{money(f.realized)} realized</small>
                          </td>
                        </tr>
                      ))
                    : (tab === "orders" ? open : orders).map((o) => (
                        <tr key={o.id}>
                          <td>
                            <button
                              className="d-cell-link"
                              onClick={() => onDetail(o.id)}
                            >
                              {o.id}
                            </button>
                            <small>{paperTime(o.createdAt)}</small>
                          </td>
                          <td>
                            {o.draft.market}-PERP
                            <small>{venue(o.draft.venue)}</small>
                          </td>
                          <td
                            className={
                              o.draft.side === "Buy" ? "d-up" : "d-down"
                            }
                          >
                            {o.draft.side}
                            <small>
                              {o.draft.type}
                              {o.draft.reduceOnly ? " · Reduce only" : ""}
                            </small>
                          </td>
                          <td>{money(Number(o.draft.size))} USDC</td>
                          <td>
                            {o.draft.type === "Limit"
                              ? money(Number(o.draft.limit))
                              : "—"}
                          </td>
                          <td>
                            {o.status}
                            <small>
                              {o.reason ??
                                (o.status === "Scheduled plan"
                                  ? "Preview only · no child execution"
                                  : "")}
                            </small>
                          </td>
                          <td>
                            {(o.status === "Open" ||
                              o.status === "Scheduled plan") && (
                              <button
                                className="d-cell-link"
                                onClick={() => onCancel(o.id)}
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
