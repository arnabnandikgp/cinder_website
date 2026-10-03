"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Info,
  LockKeyhole,
  CandlestickChart,
  WalletCards,
  History,
} from "lucide-react";
import { Brand } from "@/components/ui";
import { AccountOverview, ActivityView } from "./account-views";
import { DemoDialogs, type DialogState } from "./demo-dialogs";
import { MarketChart, OrderBook } from "./market-chart";
import { OrderTicket, initialTicket, type Ticket } from "./order-ticket";
import { initialStrategy } from "./strategies";
import { Records } from "./records";
import { ProWorkspace } from "./pro-workspace";
import { useMarketFeed } from "./market-data/use-market-feed";
import { channelHealth } from "./market-data/feed";
import { intervals, type Interval } from "./market-data/adapters";
import { parseAmount, type RouteInput } from "./routing";
import { compareLiveRoutes } from "./live-routing";
import {
  pick,
  venues,
  type CancelState,
  type Draft,
  type Market,
  type RecordTab,
  type Scenario,
  type Venue,
  type VenueScope,
  type View,
} from "./data";

const workspaceViews = [
  {
    value: "trade",
    label: "Trade",
    description: "Markets & orders",
    icon: CandlestickChart,
  },
  {
    value: "account",
    label: "Account",
    description: "Balances & positions",
    icon: WalletCards,
  },
  {
    value: "activity",
    label: "Activity",
    description: "Fills, fees & funding",
    icon: History,
  },
] as const;

export function Terminal() {
  const params = useSearchParams();
  const view = pick<View>(
    params.get("view"),
    ["trade", "account", "activity"],
    "trade",
  );
  const market = pick<Market>(params.get("market"), ["SOL", "BTC"], "SOL");
  const mode = pick(params.get("mode"), ["manual", "auto"] as const, "manual");
  const venue = pick<Venue>(
    params.get("venue"),
    ["pacifica", "bulk", "velocity"],
    "pacifica",
  );
  const autoChart = pick<Venue>(
    params.get("chart"),
    ["pacifica", "bulk", "velocity"],
    venue,
  );
  const chart = mode === "auto" ? autoChart : venue;
  const interval = pick<Interval>(
    params.get("interval"),
    Object.keys(intervals) as Interval[],
    "15m",
  );
  const live = useMarketFeed(
    chart,
    market,
    interval,
    view === "trade" && (mode === "manual" || params.get("panel") === "price"),
  );
  const proEnabled = mode === "auto" && view === "trade";
  const pacifica = useMarketFeed(
    "pacifica",
    market,
    "15m",
    proEnabled,
    "comparison",
  );
  const bulk = useMarketFeed("bulk", market, "15m", proEnabled, "comparison");
  const scope = pick<VenueScope>(
    params.get("scope"),
    ["all", "pacifica", "bulk", "velocity"],
    mode === "auto" ? "all" : venue,
  );
  const tab = pick<RecordTab>(
    params.get("record"),
    ["positions", "orders", "trades", "history", "funding"],
    "positions",
  );
  const scenario = pick<Scenario>(
    params.get("scenario"),
    ["funded", "partial", "empty", "stale", "deposit"],
    "funded",
  );
  const filter = pick(
    params.get("filter"),
    ["all", "orders", "trades", "fees", "funding", "transfers", "drafts"],
    "all",
  );
  const [standardTicket, setStandardTicket] = useState<Ticket>(() =>
    market === "BTC" ? { ...initialTicket, limit: "61750.00" } : initialTicket,
  );
  const [proTicket, setProTicket] = useState<Ticket>(() => ({
    ...initialTicket,
    type: "Market",
    size: "10000",
    slippage: "0.5",
  }));
  const [proVisited, setProVisited] = useState(mode === "auto");
  const ticket = mode === "auto" ? proTicket : standardTicket;
  const setTicket = mode === "auto" ? setProTicket : setStandardTicket;
  const [allowed, setAllowed] = useState<Venue[]>(["pacifica", "bulk"]);
  const panel = pick(params.get("panel"), ["cost", "price"] as const, "cost");
  const routeInput: RouteInput = {
    market,
    side: ticket.side === "Sell" ? "Sell" : "Buy",
    quantity: NaN, // Derived from USDC at the comparison's shared live reference.
    notional: parseAmount(ticket.size),
    leverage: parseAmount(ticket.leverage),
    slippage: parseAmount(ticket.slippage),
    allowed,
    snapshot: "balanced", // Legacy draft schema; live comparison never reads fixtures.
    account: scenario,
  };
  const comparison = useMemo(
    () =>
      compareLiveRoutes(
        {
          market,
          side: ticket.side === "Sell" ? "Sell" : "Buy",
          quantity: NaN,
          notional: parseAmount(ticket.size),
          leverage: parseAmount(ticket.leverage),
          slippage: parseAmount(ticket.slippage),
          allowed,
          snapshot: "balanced",
          account: scenario,
        },
        { pacifica, bulk },
        Math.max(pacifica.now, bulk.now),
      ),
    [
      market,
      ticket.side,
      ticket.size,
      ticket.leverage,
      ticket.slippage,
      allowed,
      scenario,
      pacifica,
      bulk,
    ],
  );
  const [cancel, setCancel] = useState<CancelState>("none");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState("");
  function updateQuery(values: Record<string, string>, push = false) {
    const next = new URLSearchParams(window.location.search);
    Object.entries(values).forEach(([key, value]) => next.set(key, value));
    // Only share navigation/context, never amounts, draft contents or personal data.
    if (push) window.history.pushState(null, "", `/demo?${next}`);
    else window.history.replaceState(null, "", `/demo?${next}`);
  }
  function changeMarket(value: Market) {
    updateQuery({ market: value });
    setStandardTicket((current) => ({
      ...current,
      limit: value === "SOL" ? "151.50" : "61750.00",
      strategyConfig: { ...initialStrategy },
    }));
  }
  const actions = {
    onCancel: () => setDialog({ kind: "cancel" }),
    onReduce: (market: Market, venue: Venue) =>
      setDialog({ kind: "reduce", market, venue }),
    onDetail: (id: string) => setDialog({ kind: "detail", id }),
  };
  const records = (
    <Records
      tab={tab}
      onTab={(value) => updateQuery({ record: value })}
      scope={scope}
      onScope={(value) => updateQuery({ scope: value })}
      scenario={scenario}
      cancel={cancel}
      actions={actions}
      account={view === "account"}
    />
  );
  return (
    <div className="demo">
      <main
        id="main"
        className="d-workspace"
        data-testid="demo-workspace"
        aria-label="Cinder demo workspace"
      >
        <header className="d-header">
          <Brand />
          <nav aria-label="Workspace navigation">
            {workspaceViews.map(({ value, label, description, icon: Icon }) => (
              <button
                key={value}
                aria-labelledby={`d-nav-${value}-label`}
                aria-describedby={`d-nav-${value}-description`}
                aria-current={view === value ? "page" : undefined}
                onClick={() => updateQuery({ view: value }, true)}
              >
                <Icon size={19} aria-hidden="true" />
                <span className="d-nav-copy">
                  <span id={`d-nav-${value}-label`} className="d-nav-label">
                    {label}
                  </span>
                  <span
                    id={`d-nav-${value}-description`}
                    className="d-nav-description"
                  >
                    {description}
                  </span>
                </span>
              </button>
            ))}
          </nav>
          <div className="d-account-actions">
            <span className="d-sample-account">
              <LockKeyhole size={13} aria-hidden="true" />
              Your account
            </span>
            <button
              className="d-button"
              onClick={() => setDialog({ kind: "deposit" })}
            >
              Deposit
            </button>
            <button
              className="d-button"
              onClick={() => setDialog({ kind: "withdraw" })}
            >
              Withdraw <ArrowUpRight size={14} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="d-context-strip">
          <span>
            <i />
            {scenario === "stale"
              ? "Last-known account snapshot"
              : "Trading workspace"}
          </span>
          <span>
            Execution:{" "}
            <b>{mode === "auto" ? "Pro · compare venues" : venues[venue]}</b>
          </span>
          <span>
            Reference:{" "}
            <b>
              {mode === "auto" && panel === "cost"
                ? "Live venue books"
                : venues[chart]}
            </b>
          </span>
          <span className="d-context-demo">
            Public market data · simulated account · no live trading
          </span>
        </div>
        {notice && (
          <div className="d-feedback-note" role="status">
            <CheckMessage text={notice} />
            <button aria-label="Dismiss update" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </div>
        )}
        {scenario === "stale" && (
          <div className="d-stale" role="status">
            <Info size={17} aria-hidden="true" />
            <p>
              Account updates paused in this scenario. These are last-known
              records; new order review is unavailable.
            </p>
            <button
              onClick={() => {
                updateQuery({ scenario: "funded" });
                setNotice(
                  "Sample account restored. No live connection was made.",
                );
              }}
            >
              Restore sample
            </button>
          </div>
        )}
        {view === "trade" ? (
          <>
            <h1 className="d-sr-only">Cinder trading workspace</h1>
            <div
              className={`d-trading-grid${mode === "auto" ? " d-pro-grid" : ""}`}
            >
              {mode === "auto" ? (
                <ProWorkspace
                  comparison={comparison}
                  chartVenue={chart}
                  leverage={ticket.leverage}
                  panel={panel}
                  onPanel={(value) => updateQuery({ panel: value })}
                  onMarket={changeMarket}
                  onChartVenue={(value) => updateQuery({ chart: value })}
                  live={live}
                  interval={interval}
                  onInterval={(value) => updateQuery({ interval: value })}
                  onRetry={() => {
                    pacifica.retry();
                    bulk.retry();
                  }}
                  onNotional={(value) =>
                    setProTicket((current) => ({
                      ...current,
                      size: String(value),
                    }))
                  }
                />
              ) : (
                <>
                  <MarketChart
                    market={market}
                    venue={chart}
                    canChooseVenue={false}
                    leverage={ticket.leverage}
                    onMarket={changeMarket}
                    onVenue={(value) => {
                      updateQuery({ chart: value });
                      setNotice(
                        "Chart reference updated. Execution and account records are unchanged.",
                      );
                    }}
                    live={live}
                    liveInterval={interval}
                    onInterval={(value) => updateQuery({ interval: value })}
                  />
                  <OrderBook market={market} venue={chart} live={live} />
                </>
              )}
              <OrderTicket
                key={`${mode}-${venue}-${market}`}
                market={market}
                mode={mode}
                venue={venue}
                allowed={allowed}
                scenario={scenario}
                ticket={ticket}
                onTicket={setTicket}
                marketPrice={
                  channelHealth(live, "ticker") === "Live"
                    ? live.ticker?.mark
                    : undefined
                }
                bookPrices={
                  channelHealth(live, "book") === "Live" &&
                  live.book?.bids.length &&
                  live.book.asks.length
                    ? {
                        bid: live.book.bids[0].price,
                        ask: live.book.asks[0].price,
                      }
                    : undefined
                }
                onMode={(value) => {
                  if (value === "auto" && !proVisited) {
                    setProTicket((current) => ({
                      ...current,
                      side: standardTicket.side,
                      size: standardTicket.size,
                      leverage: standardTicket.leverage,
                      slippage: standardTicket.slippage || "0.5",
                    }));
                    setProVisited(true);
                  }
                  updateQuery({
                    mode: value,
                    scope: value === "auto" ? "all" : venue,
                    chart: value === "auto" ? chart : venue,
                  });
                  setNotice("");
                }}
                onVenue={(value) => {
                  updateQuery({ venue: value, scope: value, chart: value });
                  setNotice(
                    "Execution venue, chart and record filter updated. Existing positions are unchanged.",
                  );
                }}
                onAllowed={() => setDialog({ kind: "route" })}
                comparison={comparison}
                refreshComparison={() =>
                  compareLiveRoutes(routeInput, { pacifica, bulk }, Date.now())
                }
                onCompare={() => {
                  updateQuery({ panel: "cost" });
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => {
                      const table =
                        document.getElementById("d-route-comparison");
                      table?.focus({ preventScroll: true });
                      table?.scrollIntoView({ block: "nearest" });
                    }),
                  );
                }}
                onReview={(draft) => setDialog({ kind: "review", draft })}
              />
              {records}
            </div>
          </>
        ) : (
          <div className="d-account-content">
            {view === "account" ? (
              <>
                <AccountOverview
                  scenario={scenario}
                  onTransfer={(kind) => setDialog({ kind })}
                />
                {records}
              </>
            ) : (
              <ActivityView
                scenario={scenario}
                cancel={cancel}
                drafts={drafts}
                filter={filter}
                onFilter={(value) => updateQuery({ filter: value })}
                onDetail={actions.onDetail}
              />
            )}
          </div>
        )}
      </main>
      {dialog && (
        <DemoDialogs
          key={dialog.kind}
          dialog={dialog}
          onClose={() => setDialog(null)}
          scenario={scenario}
          cancel={cancel}
          drafts={drafts}
          allowed={allowed}
          onAllowed={(values) => {
            setAllowed(values);
            setDialog(null);
            setNotice("Allowed venues updated. Route estimates recalculated.");
          }}
          onCancel={() => {
            setCancel("requested");
            setNotice(
              "Sample cancellation requested. The order remains open until confirmation.",
            );
          }}
          onConfirmCancel={() => {
            setCancel("confirmed");
            setDialog(null);
            setNotice(
              "Sample cancellation confirmed. Filled quantity is preserved in Trade history; the order remains in Order history.",
            );
          }}
          onSave={(draft) => {
            const id = `DRAFT-${drafts.length + 1}`;
            setDrafts((current) => [...current, { ...draft, id }]);
            setDialog(null);
            setNotice(
              `${id} saved locally. Find it in Activity → Drafts. No order was submitted.`,
            );
          }}
        />
      )}
    </div>
  );
}

function CheckMessage({ text }: { text: string }) {
  return (
    <p>
      <Info size={15} aria-hidden="true" />
      {text}
    </p>
  );
}
