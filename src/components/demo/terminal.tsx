"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  RotateCcw,
  MessageSquare,
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
import { OrderTicket, initialTicket } from "./order-ticket";
import { Records } from "./records";
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
  const chart = pick<Venue>(
    params.get("chart"),
    ["pacifica", "bulk", "velocity"],
    "pacifica",
  );
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
  const [ticket, setTicket] = useState(() =>
    market === "BTC"
      ? { ...initialTicket, size: "0.01", limit: "61750.00" }
      : initialTicket,
  );
  const [allowed, setAllowed] = useState<Venue[]>(["pacifica", "bulk"]);
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
  const actions = {
    onCancel: () => setDialog({ kind: "cancel" }),
    onReduce: (value: Market) => setDialog({ kind: "reduce", market: value }),
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
            <b>{mode === "auto" ? "Auto-route concept" : venues[venue]}</b>
          </span>
          <span>
            Reference: <b>{venues[chart]}</b>
          </span>
          <span className="d-context-demo">Your positions. Your account.</span>
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
            <div className="d-trading-grid">
              <MarketChart
                market={market}
                venue={chart}
                leverage={ticket.leverage}
                onMarket={(value) => {
                  updateQuery({ market: value });
                  setTicket((current) => ({
                    ...current,
                    size: value === "SOL" ? "2" : "0.01",
                    limit: value === "SOL" ? "151.50" : "61750.00",
                  }));
                }}
                onVenue={(value) => {
                  updateQuery({ chart: value });
                  setNotice(
                    "Chart reference updated. Execution and account records are unchanged.",
                  );
                }}
              />
              <OrderBook market={market} venue={chart} />
              <OrderTicket
                market={market}
                mode={mode}
                venue={venue}
                allowed={allowed}
                scenario={scenario}
                ticket={ticket}
                onTicket={setTicket}
                onMode={(value) => {
                  updateQuery({
                    mode: value,
                    scope: value === "auto" ? "all" : venue,
                  });
                  setNotice(
                    "Execution choice updated. Chart reference and existing positions are unchanged.",
                  );
                }}
                onVenue={(value) => {
                  updateQuery({ venue: value, scope: value });
                  setNotice(
                    "Execution venue and record filter updated. Chart reference is unchanged.",
                  );
                }}
                onAllowed={() => setDialog({ kind: "route" })}
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
        <footer className="d-workspace-footer">
          <span>
            <LockKeyhole size={12} aria-hidden="true" />
            Your account. Your trading activity.
          </span>
          <span>Private account · Venue-level execution</span>
        </footer>
      </main>
      <p className="d-demo-disclosure">
        Prices, depth and account records are simulated. Venue names and
        leverage settings illustrate the interface, not live integrations or
        approved limits. Orders stay as local drafts.
      </p>
      <p className="d-chart-attribution">
        TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc.{" "}
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          TradingView
        </a>
      </p>
      <div className="d-review-tools">
        <label htmlFor="d-scenario">
          Demo scenario
          <select
            id="d-scenario"
            value={scenario}
            onChange={(e) => {
              setCancel("none");
              setDrafts([]);
              setNotice(
                "Sample scenario loaded. Local drafts and cancellation state were reset.",
              );
              updateQuery({
                scenario: e.target.value,
                record: e.target.value === "partial" ? "orders" : "positions",
              });
            }}
          >
            <option value="funded">Funded account</option>
            <option value="partial">Partially filled order</option>
            <option value="empty">Empty account</option>
            <option value="deposit">Deposit awaiting credit</option>
            <option value="stale">Stale account</option>
          </select>
        </label>
        <div>
          <button onClick={() => setDialog({ kind: "reset" })}>
            <RotateCcw size={14} aria-hidden="true" />
            Reset demo
          </button>
          <button onClick={() => setDialog({ kind: "feedback" })}>
            <MessageSquare size={14} aria-hidden="true" />
            Give feedback
          </button>
        </div>
      </div>
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
            setNotice("Allowed sample venues saved for future-route drafts.");
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
          onReset={() => {
            window.history.replaceState(null, "", "/demo");
            setDrafts([]);
            setCancel("none");
            setTicket(initialTicket);
            setAllowed(["pacifica", "bulk"]);
            setDialog(null);
            setNotice("Demo reset to the funded sample account.");
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
