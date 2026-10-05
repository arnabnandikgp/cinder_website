"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  CandlestickChart,
  WalletCards,
  History,
  Compass,
  Bot,
} from "lucide-react";
import { Brand } from "@/components/ui";
import { AccountOverview, ActivityView } from "./account-views";
import { AgentsView } from "./agents-view";
import { agentsFor } from "./agents";
import { RoutePreferences } from "./route-preferences";
import { MarketChart, OrderBook } from "./market-chart";
import { OrderTicket, initialTicket, type Ticket } from "./order-ticket";
import { PaperRecords } from "./paper-records";
import { PaperDialog } from "./paper-dialogs";
import { usePaperAccount } from "./use-paper-account";
import { usePaperMarks } from "./use-paper-marks";
import {
  cancelPaperOrder,
  paperQuote,
  paperTotals,
  paperValuation,
  placePaperOrder,
  tickPaperAccount,
  type Bracket,
} from "./paper-account";
import { ProWorkspace } from "./pro-workspace";
import { WalletConnect } from "./wallet-connect";
import { SpotlightTour } from "./spotlight-tour";
import { TerminalWelcome } from "./terminal-welcome";
import { useTerminalTour } from "./use-terminal-tour";
import { useMarketFeed } from "./market-data/use-market-feed";
import { channelHealth } from "./market-data/feed";
import { intervals, type Interval } from "./market-data/adapters";
import { parseAmount, type RouteInput } from "./routing";
import { compareLiveRoutes, comparisonVenues } from "./live-routing";
import { useComparisonAnalysis } from "./use-comparison-analysis";
import {
  pick,
  number,
  venues,
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
  {
    value: "agents",
    label: "Agents",
    description: "Permissions & activity",
    icon: Bot,
  },
] as const;

export function Terminal() {
  const params = useSearchParams();
  const tour = useTerminalTour();
  // Tour navigation is temporary, never written into the URL or order state.
  const tourContext: Record<string, string> = tour.step?.context ?? {};
  const context = (key: string) => tourContext[key] ?? params.get(key);
  const tourTrigger = useRef<HTMLButtonElement>(null);
  const walletTrigger = useRef<HTMLButtonElement>(null);
  const paper = usePaperAccount();
  const totals = paperTotals(paper.account);
  const canTrade = Boolean(paper.address && paper.account);
  const [paperDialog, setPaperDialog] = useState<string | null>(null);
  const view = pick<View>(
    context("view"),
    ["trade", "account", "activity", "agents"],
    "trade",
  );
  const market = pick<Market>(context("market"), ["SOL", "BTC"], "SOL");
  const mode = pick(context("mode"), ["manual", "auto"] as const, "manual");
  const venue = pick<Venue>(
    context("venue"),
    Object.keys(venues) as Venue[],
    "pacifica",
  );
  const autoChart = pick<Venue>(
    params.get("chart"),
    Object.keys(venues) as Venue[],
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
    view === "trade" && (mode === "manual" || context("panel") === "price"),
  );
  const proEnabled = mode === "auto" && view === "trade";
  const pacifica = useMarketFeed(
    "pacifica",
    market,
    "15m",
    proEnabled || canTrade,
    "comparison",
  );
  const bulk = useMarketFeed(
    "bulk",
    market,
    "15m",
    proEnabled || canTrade,
    "comparison",
  );
  const phoenix = useMarketFeed(
    "phoenix",
    market,
    "15m",
    proEnabled || canTrade,
    "comparison",
  );
  const scope = pick<VenueScope>(
    context("scope"),
    ["all", ...(Object.keys(venues) as Venue[])],
    mode === "auto" ? "all" : venue,
  );
  const tab = pick<RecordTab>(
    context("record"),
    ["positions", "orders", "trades", "history", "funding"],
    "positions",
  );
  const scenario = pick<Scenario>(
    context("scenario"),
    ["funded", "partial", "empty", "stale", "deposit"],
    "funded",
  );
  const filter = pick(
    context("filter"),
    ["all", "orders", "trades", "fees", "funding", "transfers", "drafts"],
    "all",
  );
  const actor = pick(
    context("actor"),
    ["all", "you", "system", ...agentsFor(scenario).map((agent) => agent.id)],
    "all",
  );
  const visitedMarkets = useRef(new Set<Market>([market]));
  const [standardTickets, setStandardTickets] = useState<
    Record<Market, Ticket>
  >({
    SOL: { ...initialTicket },
    BTC: { ...initialTicket },
  });
  const [proTickets, setProTickets] = useState<Record<Market, Ticket>>({
    SOL: { ...initialTicket, type: "Market", size: "10000" },
    BTC: { ...initialTicket, type: "Market", size: "10000" },
  });
  const standardTicket = standardTickets[market];
  const proTicket = proTickets[market];
  const setStandardTicket = (update: Ticket | ((current: Ticket) => Ticket)) =>
    setStandardTickets((current) => ({
      ...current,
      [market]: typeof update === "function" ? update(current[market]) : update,
    }));
  const setProTicket = (update: Ticket | ((current: Ticket) => Ticket)) =>
    setProTickets((current) => ({
      ...current,
      [market]: typeof update === "function" ? update(current[market]) : update,
    }));
  const [proVisited, setProVisited] = useState<
    Partial<Record<Market, boolean>>
  >({
    [market]: params.get("mode") === "auto",
  });
  const ticket = mode === "auto" ? proTicket : standardTicket;
  const setTicket = mode === "auto" ? setProTicket : setStandardTicket;
  const [allowed, setAllowed] = useState<Venue[]>([...comparisonVenues]);
  const panel = pick(context("panel"), ["cost", "price"] as const, "cost");
  const analysisMode = pick(
    context("analysis"),
    ["live", "average"] as const,
    "live",
  );
  const routeInput: RouteInput = {
    market,
    side: ticket.side === "Sell" ? "Sell" : "Buy",
    quantity: NaN, // Derived from USDC at the comparison's shared live reference.
    notional: parseAmount(ticket.size),
    leverage: parseAmount(ticket.leverage),
    slippage: parseAmount(ticket.slippage),
    allowed,
    snapshot: "balanced", // Legacy draft schema; live comparison never reads fixtures.
    account: "funded",
    // Cost analysis is browseable independent of the wallet's buying power.
    // Paper submission checks actual free collateral against the fresh fill.
    availableCollateral: Infinity,
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
          account: "funded",
          availableCollateral: Infinity,
        },
        { pacifica, bulk, phoenix },
        Math.max(pacifica.now, bulk.now, phoenix.now),
        { curves: false },
      ),
    [
      market,
      ticket.side,
      ticket.size,
      ticket.leverage,
      ticket.slippage,
      allowed,
      pacifica,
      bulk,
      phoenix,
    ],
  );
  const analysis = useComparisonAnalysis(
    routeInput,
    { pacifica, bulk, phoenix },
    comparison,
    analysisMode,
    proEnabled,
  );
  const cancel = "none" as const;
  const drafts: Draft[] = [];
  const [routePreferences, setRoutePreferences] = useState(false);
  const [notice, setNotice] = useState("");
  const lastSubmission = useRef({ fingerprint: "", at: 0 });
  const reduceIntent = useRef<{ id: string; size: string } | null>(null);
  const connectPaper = paper.connect;
  const onWallet = useCallback(
    (address: string | null) => {
      connectPaper(address);
      setNotice("");
      setPaperDialog(null);
      setRoutePreferences(false);
    },
    [connectPaper, setNotice, setPaperDialog, setRoutePreferences],
  );
  const updatePaper = paper.update;
  const feeds = { pacifica, bulk, phoenix };
  const manualFeed = venue === "velocity" ? live : feeds[venue];
  const closingQuantity =
    ticket.reduceOnly &&
    reduceIntent.current?.id === `${venue}-${market}` &&
    reduceIntent.current.size === ticket.size
      ? Math.abs(
          paper.account?.positions.find(
            (p) => p.id === reduceIntent.current?.id,
          )?.quantity ?? 0,
        ) || undefined
      : undefined;
  const estimate = paperQuote(
    venue,
    manualFeed,
    ticket.side,
    parseAmount(ticket.size),
    manualFeed.now,
    mode === "manual" ? closingQuantity : undefined,
  );
  useEffect(() => {
    if (!canTrade) return;
    updatePaper((a) =>
      tickPaperAccount(a, market, { pacifica, bulk, phoenix }),
    );
  }, [canTrade, market, pacifica, bulk, phoenix, updatePaper]);
  const marks = usePaperMarks(paper.account, {
    venue: chart,
    market,
    feed: live,
  });
  const valuation = paperValuation(paper.account, marks);
  const initialPrice =
    channelHealth(manualFeed, "book") === "Live" && manualFeed.book
      ? (manualFeed.book.bids[0].price + manualFeed.book.asks[0].price) / 2
      : undefined;
  useEffect(() => {
    if (
      !canTrade ||
      !initialPrice ||
      !Number.isFinite(initialPrice) ||
      standardTickets[market].limit ||
      standardTickets[market].limitTouched
    )
      return;
    // Initialise once when an external book arrives; never chase subsequent
    // prices or replace a deliberately cleared/user-entered field.
    const frame = requestAnimationFrame(() =>
      setStandardTickets((current) =>
        current[market].limit || current[market].limitTouched
          ? current
          : {
              ...current,
              [market]: { ...current[market], limit: initialPrice.toFixed(2) },
            },
      ),
    );
    return () => cancelAnimationFrame(frame);
  }, [canTrade, initialPrice, market, standardTickets]);
  function place(draft: Draft, bracket: Bracket, submittedAt: number) {
    if (!canTrade) {
      walletTrigger.current?.click();
      return;
    }
    const fingerprint = JSON.stringify([
      paper.address,
      draft.market,
      draft.venue,
      draft.side,
      draft.type,
      draft.size,
      draft.limit,
      draft.leverage,
      draft.reduceOnly,
      bracket,
      draft.strategy,
    ]);
    if (
      lastSubmission.current.fingerprint === fingerprint &&
      submittedAt - lastSubmission.current.at < 750
    )
      return;
    try {
      const feed = draft.venue === "velocity" ? live : feeds[draft.venue];
      let record = "positions";
      paper.update((a) => {
        const closing =
          draft.reduceOnly &&
          reduceIntent.current?.id === `${draft.venue}-${draft.market}` &&
          reduceIntent.current.size === draft.size
            ? a.positions.find((p) => p.id === reduceIntent.current?.id)
            : undefined;
        const r = placePaperOrder(
          a,
          draft,
          feed,
          Date.now(),
          draft.route?.best?.reference,
          closing ? Math.abs(closing.quantity) : draft.route?.best?.quantity,
          bracket,
        );
        record =
          r.order.status === "Filled"
            ? "positions"
            : r.order.status === "Cancelled"
              ? "history"
              : "orders";
        return r.account;
      });
      setNotice("");
      lastSubmission.current = { fingerprint, at: submittedAt };
      updateQuery({
        record,
        scope: mode === "auto" ? "all" : draft.venue,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Paper order could not be placed";
      setNotice(message);
      return message;
    }
  }
  function updateQuery(values: Record<string, string>, push = false) {
    const next = new URLSearchParams(window.location.search);
    next.delete("journey"); // Retire bookmarks for the removed ledger guide.
    Object.entries(values).forEach(([key, value]) => next.set(key, value));
    // Only share navigation/context, never amounts, draft contents or personal data.
    if (push) window.history.pushState(null, "", `/demo?${next}`);
    else window.history.replaceState(null, "", `/demo?${next}`);
  }
  function changeMarket(value: Market) {
    if (!visitedMarkets.current.has(value)) {
      visitedMarkets.current.add(value);
      // Carry market-independent intent on first visit, then restore each
      // market's own draft. Never carry a SOL price or bracket into BTC.
      const shared = (t: Ticket) => ({
        size: t.size,
        side: t.side,
        type: t.type,
        leverage: t.leverage,
        slippage: t.slippage,
        tif: t.tif,
      });
      setStandardTickets((current) => ({
        ...current,
        [value]: { ...current[value], ...shared(current[market]) },
      }));
      setProTickets((current) => ({
        ...current,
        [value]: { ...current[value], ...shared(current[market]) },
      }));
      setProVisited((current) => ({ ...current, [value]: current[market] }));
    }
    updateQuery({ market: value });
  }
  const actions = {
    onCancel: (id: string) => {
      if (!canTrade) return;
      try {
        paper.update((a) => cancelPaperOrder(a, id));
        setNotice("");
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : "Cancellation unavailable",
        );
      }
    },
    onReduce: (m: Market, v: Venue) => {
      if (!canTrade) return;
      const p = paper.account?.positions.find(
        (p) => p.market === m && p.venue === v,
      );
      if (!p) return;
      visitedMarkets.current.add(m);
      const mark = marks[p.id] ?? p.entry;
      reduceIntent.current = {
        id: p.id,
        size: String(Math.abs(p.quantity) * mark),
      };
      setStandardTickets((current) => ({
        ...current,
        [m]: {
          ...current[m],
          side: p.quantity > 0 ? "Sell" : "Buy",
          type: "Market",
          size: String(Math.abs(p.quantity) * mark),
          reduceOnly: true,
          leverage: String(Math.round(p.leverage)),
          slippage: "0.5",
        },
      }));
      updateQuery({
        view: "trade",
        mode: "manual",
        market: m,
        venue: v,
        chart: v,
        scope: v,
      });
      setNotice("");
    },
    onDetail: (id: string) => setPaperDialog(id),
  };
  const records = (
    <PaperRecords
      tab={tab}
      onTab={(value) => updateQuery({ record: value })}
      scope={scope}
      onScope={(value) => updateQuery({ scope: value })}
      account={paper.account}
      marks={marks}
      {...actions}
      accountView={view === "account"}
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
          <div className="d-brand-tools">
            <Brand />
            <details
              className="d-demo-indicator"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector("summary")?.focus();
                }
              }}
            >
              <summary>
                Demo <Info size={12} aria-hidden="true" />
              </summary>
              <p>
                Live market data where available. Simulated account and
                execution. No live orders or real transfers.
              </p>
            </details>
            <button
              ref={tourTrigger}
              type="button"
              className="d-tour-trigger"
              aria-label="Take a tour"
              aria-haspopup="dialog"
              title="Take a tour"
              onClick={tour.start}
            >
              <Compass size={17} aria-hidden="true" />
              <span>Take a tour</span>
            </button>
          </div>
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
            <button
              className="d-header-balance"
              title="Estimated paper equity: cash plus unrealised PnL at fresh venue marks. Not your wallet's real USDC."
              aria-label="View account equity (simulated)"
              onClick={() => updateQuery({ view: "account" }, true)}
            >
              <span>Account equity</span>
              <strong>
                {valuation.equity === null ? "—" : number(valuation.equity)}{" "}
                <small>USDC</small>
              </strong>
            </button>
            <button
              className="d-button d-header-deposit"
              disabled={!canTrade}
              onClick={() => setPaperDialog("deposit")}
            >
              <ArrowDownLeft size={15} aria-hidden="true" /> Deposit
            </button>
            <button
              className="d-button"
              disabled={!canTrade}
              onClick={() => setPaperDialog("withdraw")}
            >
              Withdraw <ArrowUpRight size={14} aria-hidden="true" />
            </button>
            <WalletConnect
              onAccountChange={onWallet}
              triggerRef={walletTrigger}
            />
          </div>
        </header>
        {notice && (
          <div className="d-feedback-note" role="status">
            <CheckMessage text={notice} />
            <button aria-label="Dismiss update" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </div>
        )}
        {paper.warning && (
          <p className="d-feedback-note" role="status">
            {paper.warning}
          </p>
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
                  analysis={analysis}
                  onAnalysis={(value) => updateQuery({ analysis: value })}
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
                    phoenix.retry();
                  }}
                  onNotional={(value) =>
                    canTrade &&
                    setProTicket((current) => ({
                      ...current,
                      size: String(value),
                    }))
                  }
                  canEdit={canTrade}
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
                      setNotice("");
                    }}
                    live={live}
                    liveInterval={interval}
                    onInterval={(value) => updateQuery({ interval: value })}
                  />
                  <OrderBook market={market} venue={chart} live={live} />
                </>
              )}
              <OrderTicket
                key={`${venue}-${market}`}
                market={market}
                mode={mode}
                venue={venue}
                allowed={allowed}
                scenario="funded"
                ticket={ticket}
                canTrade={canTrade}
                available={totals.available}
                paper={paper.account}
                marks={marks}
                executionFeed={
                  mode === "auto" && comparison.best
                    ? feeds[comparison.best.venue as keyof typeof feeds]
                    : manualFeed
                }
                closingQuantity={closingQuantity}
                onConnect={() => walletTrigger.current?.click()}
                estimate={estimate}
                venueFee={manualFeed.fee ?? undefined}
                onTicket={(value) => {
                  if (canTrade) setTicket(value);
                }}
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
                  if (value === "auto" && !proVisited[market]) {
                    setProTicket((current) => ({
                      ...current,
                      side: standardTicket.side,
                      size: standardTicket.size,
                      leverage: standardTicket.leverage,
                      slippage: standardTicket.slippage || "0.5",
                    }));
                    setProVisited((current) => ({
                      ...current,
                      [market]: true,
                    }));
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
                  setNotice("");
                }}
                onAllowed={() => {
                  if (canTrade) setRoutePreferences(true);
                }}
                comparison={comparison}
                refreshComparison={() =>
                  compareLiveRoutes(
                    routeInput,
                    { pacifica, bulk, phoenix },
                    Date.now(),
                  )
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
                onPlace={place}
              />
              {records}
            </div>
          </>
        ) : (
          <div className="d-account-content" key={view}>
            {view === "account" ? (
              <>
                <AccountOverview
                  paper={paper.account}
                  marks={marks}
                  onReset={() => setPaperDialog("reset")}
                  onTransfer={(kind) => {
                    if (canTrade) setPaperDialog(kind);
                  }}
                />
                {records}
              </>
            ) : view === "agents" ? (
              <AgentsView
                scenario={scenario}
                cancel={cancel}
                drafts={drafts}
                selected={context("agent") ?? ""}
                onSelect={(value) => updateQuery({ agent: value })}
                onActivity={(value) =>
                  updateQuery(
                    { view: "activity", actor: value, filter: "all" },
                    true,
                  )
                }
              />
            ) : (
              <ActivityView
                scenario={scenario}
                cancel={cancel}
                drafts={drafts}
                filter={filter}
                actor={actor}
                onActor={(value) => updateQuery({ actor: value })}
                onFilter={(value) => updateQuery({ filter: value })}
                onDetail={actions.onDetail}
                events={paper.account?.events ?? []}
              />
            )}
          </div>
        )}
      </main>
      {tour.welcome && (
        <TerminalWelcome
          onStart={tour.start}
          onSkip={tour.close}
          returnFocus={tourTrigger}
        />
      )}
      {tour.step && tour.index !== null && (
        <SpotlightTour
          step={tour.step}
          index={tour.index}
          onStep={tour.go}
          onClose={tour.close}
          returnFocus={tourTrigger}
        />
      )}
      {routePreferences && canTrade && (
        <RoutePreferences
          allowed={allowed}
          onClose={() => setRoutePreferences(false)}
          onSave={(values) => {
            setAllowed(values);
            setRoutePreferences(false);
            setNotice("");
          }}
        />
      )}
      {paperDialog && canTrade && (
        <PaperDialog
          kind={paperDialog}
          account={paper.account}
          onClose={() => setPaperDialog(null)}
          onReset={() => {
            paper.reset();
            setPaperDialog(null);
            setNotice("");
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
