"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickChart, Info, Minus, Plus, RotateCcw } from "lucide-react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { displayBook, precision, type Interval } from "./market-data/adapters";
import { candleHealth, channelHealth } from "./market-data/feed";
import type { LiveMarket } from "./market-data/use-market-feed";
import { MarketStatistics } from "./market-statistics";
import {
  candles,
  markets,
  number,
  orderBook,
  referencePrice,
  venues,
  type Market,
  type Venue,
} from "./data";

type Bar = ReturnType<typeof candles>[number] & { time: UTCTimestamp };

function showRecentCandles(chart: IChartApi, width: number, count: number) {
  if (!count) return;
  // Keep bodies legible across terminal widths rather than fitting the whole
  // backfill. The five-bar breathing room is independent of loaded history.
  const visible = Math.max(24, Math.min(120, Math.floor((width - 72) / 12)));
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, count - visible),
    to: count - 1 + 5,
  });
}

// Shared renderer: Standard and Pro price views receive public venue data.
// Data updates do not recreate the canvas or reset the user's viewport.
function TradingChart({
  bars,
  market,
  venue,
  interval,
  tick,
  live,
}: {
  bars: Bar[];
  market: Market;
  venue: Venue;
  interval: string;
  tick: number;
  live?: LiveMarket;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const dataRef = useRef<Bar[]>([]);
  const contextRef = useRef("");
  const volumeColors = useRef({ up: "", down: "" });
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const active =
    bars.find((bar) => bar.time === hoverTime) ?? bars[bars.length - 1];

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    import("lightweight-charts")
      .then(
        ({
          createChart,
          CandlestickSeries,
          HistogramSeries,
          ColorType,
          CrosshairMode,
        }) => {
          if (disposed || !host.current) return;
          const style = getComputedStyle(host.current);
          const token = (name: string) => style.getPropertyValue(name).trim();
          const up = token("--d-chart-up");
          const down = token("--d-chart-down");
          const chart = createChart(host.current, {
            autoSize: true,
            layout: {
              background: { type: ColorType.Solid, color: token("--d-panel") },
              textColor: token("--d-muted"),
              fontFamily: "Arial, sans-serif",
              fontSize: 12,
              attributionLogo: true,
              panes: {
                enableResize: true,
                separatorColor: token("--d-line"),
                separatorHoverColor: token("--d-chart-divider-hover"),
              },
            },
            grid: {
              vertLines: { color: token("--d-chart-grid") },
              horzLines: { color: token("--d-chart-grid") },
            },
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: {
              entireTextOnly: true,
              borderColor: token("--d-line"),
              autoScale: true,
              scaleMargins: { top: 0.06, bottom: 0.06 },
            },
            timeScale: {
              borderColor: token("--d-line"),
              timeVisible: true,
              secondsVisible: false,
              rightOffset: 5,
              barSpacing: 12,
              minBarSpacing: 3,
            },
            handleScroll: { vertTouchDrag: false },
            localization: { locale: "en-US" },
          });
          chartRef.current = chart;
          // Useful for checking that streaming updates preserve the same canvas.
          host.current.dataset.chartInstance = String(performance.now());
          chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (!host.current || !range) return;
            host.current.dataset.chartVisibleFrom = String(range.from);
            host.current.dataset.chartVisibleTo = String(range.to);
          });
          cleanup = () => {
            chartRef.current = null;
            seriesRef.current = null;
            volumeRef.current = null;
            dataRef.current = [];
            contextRef.current = "";
            chart.remove();
          };
          const series = chart.addSeries(CandlestickSeries, {
            upColor: up,
            downColor: down,
            borderVisible: false,
            wickUpColor: up,
            wickDownColor: down,
            priceFormat: {
              type: "price",
              precision: 2,
              minMove: markets[market].step,
            },
          });
          seriesRef.current = series;
          const volume = chart.addSeries(
            HistogramSeries,
            {
              priceFormat: { type: "volume" },
              lastValueVisible: false,
              priceLineVisible: false,
            },
            1,
          );
          volume
            .priceScale()
            .applyOptions({ scaleMargins: { top: 0.12, bottom: 0.02 } });
          chart.panes()[0].setStretchFactor(5);
          volume.getPane().setStretchFactor(1);
          host.current.dataset.chartPaneCount = String(chart.panes().length);
          volumeRef.current = volume;
          volumeColors.current = {
            up: token("--d-chart-volume-up"),
            down: token("--d-chart-volume-down"),
          };
          chart.subscribeCrosshairMove((event) => {
            setHoverTime(typeof event.time === "number" ? event.time : null);
          });
          setStatus("ready");
        },
      )
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [market, attempt]);

  useEffect(() => {
    const chart = chartRef.current,
      series = seriesRef.current,
      volume = volumeRef.current;
    if (!chart || !series || !volume || status !== "ready") return;
    series.applyOptions({
      priceFormat: { type: "price", precision: precision(tick), minMove: tick },
    });
    const histogram = (bar: Bar) => ({
      time: bar.time,
      value: bar.volume,
      color:
        bar.close >= bar.open
          ? volumeColors.current.up
          : volumeColors.current.down,
    });
    const previous = dataRef.current;
    const context = `${venue}-${interval}`;
    const contextChanged = contextRef.current !== context;
    const pastChanged =
      previous.length > bars.length ||
      previous.some(
        (bar, i) =>
          !bars[i] ||
          bar.time !== bars[i].time ||
          (i < previous.length - 1 &&
            (bar.open !== bars[i].open ||
              bar.high !== bars[i].high ||
              bar.low !== bars[i].low ||
              bar.close !== bars[i].close ||
              bar.volume !== bars[i].volume)),
      );
    if (!previous.length || pastChanged || contextChanged) {
      const range = chart.timeScale().getVisibleRange();
      series.setData(bars);
      volume.setData(bars.map(histogram));
      // A lone streamed candle can precede the REST backfill. Populate the
      // visible history then; preserving its one-point range would over-zoom.
      if (!contextChanged && previous.length > 1 && range && bars.length)
        chart.timeScale().setVisibleRange(range);
      else {
        chart.priceScale("right").applyOptions({ autoScale: true });
        showRecentCandles(chart, host.current!.clientWidth, bars.length);
      }
    } else {
      for (const bar of bars.slice(Math.max(0, previous.length - 1))) {
        series.update(bar);
        volume.update(histogram(bar));
      }
    }
    dataRef.current = bars;
    contextRef.current = context;
  }, [bars, status, tick, venue, interval]);

  function zoom(factor: number) {
    const scale = chartRef.current?.timeScale();
    const range = scale?.getVisibleLogicalRange();
    if (!scale || !range) return;
    const center = (range.from + range.to) / 2;
    const half =
      Math.max(5, Math.min(bars.length * 2, (range.to - range.from) * factor)) /
      2;
    scale.setVisibleLogicalRange({ from: center - half, to: center + half });
  }
  function autoScale() {
    chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
  }
  function resetView() {
    const chart = chartRef.current;
    if (!chart || !host.current) return;
    autoScale();
    showRecentCandles(chart, host.current.clientWidth, dataRef.current.length);
    chart.panes()[0].setStretchFactor(5);
    volumeRef.current?.getPane().setStretchFactor(1);
  }
  function resizeVolume(delta: number) {
    const panes = chartRef.current?.panes();
    if (!panes || panes.length < 2) return;
    const total = panes.reduce((sum, pane) => sum + pane.getHeight(), 0);
    panes[1].setHeight(
      Math.max(40, Math.min(total * 0.4, panes[1].getHeight() + delta)),
    );
  }
  return (
    <>
      <div className="d-chart-legend">
        <span>
          {market} · {interval} · {venues[venue]}
        </span>
        <div
          className={`d-chart-ohlc ${active && active.close >= active.open ? "d-up" : "d-down"}`}
          aria-live="off"
        >
          {(
            [
              ["O", active?.open],
              ["H", active?.high],
              ["L", active?.low],
              ["C", active?.close],
            ] as [string, number | undefined][]
          ).map(([label, value]) => (
            <span key={label}>
              {label}{" "}
              <b>
                {value === undefined ? "—" : number(value, precision(tick))}
              </b>
            </span>
          ))}
        </div>
      </div>
      <div className="d-chart-frame">
        <div
          ref={host}
          className="d-tv-chart"
          data-chart-status={status}
          data-chart-key={`${market}-${venue}-${interval}`}
          data-candle-count={bars.length}
          data-last-close={bars.at(-1)?.close ?? ""}
          data-last-time={bars.at(-1)?.time ?? ""}
          tabIndex={0}
          role="group"
          aria-label={`${market} ${interval} chart. ${live ? "Public market data from" : "Simulated prices for"} ${venues[venue]}. Use plus and minus to zoom, left and right arrows to pan, Home to reset, A to auto scale, and Shift with up or down to resize volume. Drag the divider to resize volume or the price axis to scale.`}
          onKeyDown={(event) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (
              event.shiftKey &&
              (event.key === "ArrowUp" || event.key === "ArrowDown")
            ) {
              event.preventDefault();
              resizeVolume(event.key === "ArrowUp" ? 16 : -16);
            } else if (event.key === "+" || event.key === "=") {
              event.preventDefault();
              zoom(0.8);
            } else if (event.key === "-") {
              event.preventDefault();
              zoom(1.25);
            } else if (event.key === "Home") {
              event.preventDefault();
              resetView();
            } else if (event.key.toLowerCase() === "a") {
              event.preventDefault();
              autoScale();
            } else if (
              event.key === "ArrowLeft" ||
              event.key === "ArrowRight"
            ) {
              event.preventDefault();
              const scale = chartRef.current?.timeScale();
              if (scale)
                scale.scrollToPosition(
                  scale.scrollPosition() + (event.key === "ArrowLeft" ? 5 : -5),
                  false,
                );
            }
          }}
        />
        {(status !== "ready" || !bars.length) && (
          <div className="d-chart-state" role="status">
            <p>
              {status === "error"
                ? "Chart could not load."
                : live?.connection === "unsupported"
                  ? "Live data is not connected for this venue."
                  : live?.history === "error"
                    ? "Candle history could not load."
                    : live?.history === "ready"
                      ? "No candles in this range."
                      : "Loading chart…"}
            </p>
            {status === "error" && (
              <button
                className="d-button"
                onClick={() => {
                  setStatus("loading");
                  setAttempt((value) => value + 1);
                }}
              >
                Retry chart
              </button>
            )}
            {live &&
              (live.history === "error" || live.connection === "offline") && (
                <button className="d-button" onClick={live.retry}>
                  Retry market data
                </button>
              )}
          </div>
        )}
      </div>
      <div className="d-chart-caption d-price-chart-caption">
        <span>
          Volume ({market}) <b>{active ? number(active.volume, 3) : "—"}</b>{" "}
          <span className="d-chart-zone">· UTC</span>
        </span>
        <div className="d-chart-tools">
          <details
            className="d-chart-credit"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                event.currentTarget.open = false;
            }}
          >
            <summary aria-label="Chart attribution" title="Chart attribution">
              <Info size={14} aria-hidden="true" />
            </summary>
            <div>
              <p>TradingView Lightweight Charts™</p>
              <p>Copyright (с) 2025 TradingView, Inc.</p>
              <a
                href="https://www.tradingview.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                TradingView
              </a>
            </div>
          </details>
          <button
            aria-label="Zoom out chart"
            onClick={() => zoom(1.25)}
            disabled={status !== "ready"}
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <button
            aria-label="Zoom in chart"
            onClick={() => zoom(0.8)}
            disabled={status !== "ready"}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
          <button
            className="d-chart-auto"
            aria-label="Auto scale price"
            title="Fit visible highs and lows · A"
            onClick={autoScale}
            disabled={status !== "ready"}
          >
            Auto
          </button>
          <button
            aria-label="Reset chart view"
            title="Reset recent candles and pane sizes · Home"
            onClick={resetView}
            disabled={status !== "ready"}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}

export function MarketChart({
  market,
  venue,
  canChooseVenue,
  leverage,
  onMarket,
  onVenue,
  live,
  liveInterval,
  onInterval,
}: {
  market: Market;
  venue: Venue;
  canChooseVenue: boolean;
  leverage: string;
  onMarket: (value: Market) => void;
  onVenue: (value: Venue) => void;
  live?: LiveMarket;
  liveInterval?: Interval;
  onInterval?: (value: Interval) => void;
}) {
  const [localInterval, setInterval] = useState<Interval>("15m");
  const interval = liveInterval ?? localInterval;
  const liveBars = live?.candles;
  const bars: Bar[] = useMemo(() => {
    if (liveBars)
      return liveBars.map((bar) => ({
        ...bar,
        time: bar.time as UTCTimestamp,
      }));
    const seconds =
      interval === "1h"
        ? 3600
        : interval === "4h"
          ? 14400
          : interval === "5m"
            ? 300
            : 900;
    const values = candles(market, venue, interval);
    const end = Date.UTC(2026, 8, 28, 12) / 1000;
    return values.map((bar, i) => ({
      ...bar,
      time: (end - (values.length - 1 - i) * seconds) as UTCTimestamp,
    }));
  }, [market, venue, interval, liveBars]);
  const change = live
    ? live.ticker?.change
    : (bars[bars.length - 1].close / bars[0].open - 1) * 100;
  const tick = live?.info?.tick ?? markets[market].step;
  const mark = live ? live.ticker?.mark : referencePrice(market, venue);
  const chartHealth = live ? candleHealth(live, interval) : "Simulated";
  return (
    <section
      className="d-panel d-market"
      aria-label="Market chart"
      data-live={live ? "true" : undefined}
    >
      <div className="d-market-heading">
        <div className="d-instrument">
          <span className="d-token" aria-hidden="true">
            {market === "SOL" ? "S" : "₿"}
          </span>
          <div>
            <div className="d-instrument-line">
              <label className="d-sr-only" htmlFor="d-market">
                Market
              </label>
              <select
                id="d-market"
                value={market}
                onChange={(e) => onMarket(e.target.value as Market)}
              >
                {Object.entries(markets).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.symbol}
                  </option>
                ))}
              </select>
              <span
                className="d-leverage-badge"
                title="Leverage preference for the new order"
                aria-label={`Order leverage ${leverage}x`}
              >
                {leverage}x
              </span>
            </div>
            <span>{markets[market].name} perpetual</span>
          </div>
        </div>
        {!live && (
          <>
            <div className="d-reference-price">
              <span>Mark price</span>
              <strong data-testid="market-mark">
                {mark === undefined ? "—" : number(mark, precision(tick))}
              </strong>
            </div>
            <div className="d-market-change">
              <span>Change · range</span>
              <strong
                className={
                  change !== undefined && change >= 0 ? "d-up" : "d-down"
                }
              >
                {change === undefined
                  ? "—"
                  : `${change >= 0 ? "+" : ""}${number(change)}%`}
              </strong>
            </div>
          </>
        )}
        <div className="d-chart-source">
          {live && (
            <span
              className="d-stat-health"
              data-testid="ticker-status"
              data-health={channelHealth(live, "ticker")}
            >
              {channelHealth(live, "ticker")}
            </span>
          )}
          {canChooseVenue ? (
            <>
              <label htmlFor="d-chart-source">Chart source</label>
              <select
                id="d-chart-source"
                value={venue}
                onChange={(e) => onVenue(e.target.value as Venue)}
              >
                {Object.entries(venues).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <span className="d-chart-source-label">Chart source</span>
              <strong data-testid="manual-chart-source">{venues[venue]}</strong>
            </>
          )}
        </div>
        {live && <MarketStatistics venue={venue} live={live} tick={tick} />}
      </div>
      <div className="d-chart-toolbar">
        <div className="d-timeframes" aria-label="Chart interval">
          {(["5m", "15m", "1h", "4h"] as Interval[]).map((value) => (
            <button
              key={value}
              aria-pressed={interval === value}
              onClick={() =>
                onInterval ? onInterval(value) : setInterval(value)
              }
            >
              {value}
            </button>
          ))}
        </div>
        <CandlestickChart size={16} aria-hidden="true" />
        <span>Price · USD</span>
        {live && (
          <details
            className="d-feed-detail"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                event.currentTarget.open = false;
            }}
          >
            <summary
              className="d-feed-status"
              data-testid="candle-status"
              data-health={chartHealth}
              title={
                chartHealth === "Partial candle"
                  ? "BULK candle built from trades observed since connection. Earlier trades in the first candle are missing; venue history will reconcile completed candles."
                  : "Candles and ticker have independent freshness checks."
              }
            >
              {chartHealth}
            </summary>
            <div className="d-feed-caption">
              <p>
                {live.connection === "unsupported"
                  ? "Select Pacifica or BULK for live markets."
                  : chartHealth === "Partial candle"
                    ? "Observed trades · first candle incomplete until venue history catches up."
                    : chartHealth === "Delayed candles"
                      ? "Venue candles are delayed. Book and ticker update independently."
                      : live.historyError
                        ? "History refresh unavailable; retaining last-known candles."
                        : "Venue candles · UTC · public market data"}
              </p>
              {live.connection !== "unsupported" && (
                <button onClick={live.retry} aria-label="Reconnect market data">
                  Reconnect
                </button>
              )}
            </div>
          </details>
        )}
      </div>
      <TradingChart
        key={`${market}-${venue}-${interval}`}
        bars={bars}
        market={market}
        venue={venue}
        interval={interval}
        tick={tick}
        live={live}
      />
    </section>
  );
}

export function OrderBook({
  market,
  venue,
  live,
}: {
  market: Market;
  venue: Venue;
  live?: LiveMarket;
}) {
  const mid = live ? live.ticker?.mark : referencePrice(market, venue);
  const book = live
    ? live.book
      ? displayBook(live.book, 8, live.info?.tick)
      : { bids: [], asks: [], max: 1 }
    : orderBook(market, venue);
  const decimals = live
    ? precision(live.info?.lot ?? (market === "SOL" ? 0.001 : 0.000001))
    : market === "SOL"
      ? 1
      : 3;
  const priceDecimals = live
    ? precision(live.info?.tick ?? markets[market].step)
    : 2;
  const buyTotal = book.bids.at(-1)?.total ?? 0;
  const sellTotal = book.asks[0]?.total ?? 0;
  const buyShare =
    buyTotal + sellTotal
      ? Math.round((buyTotal / (buyTotal + sellTotal)) * 100)
      : 50;
  const spread = live?.book
    ? live.book.asks.length && live.book.bids.length
      ? live.book.asks[0].price - live.book.bids[0].price
      : undefined
    : book.asks.length && book.bids.length
      ? book.asks.at(-1)!.price - book.bids[0].price
      : undefined;
  const health = live ? channelHealth(live, "book") : "Simulated";
  return (
    <section
      className="d-panel d-book"
      aria-labelledby="d-book-title"
      tabIndex={0}
    >
      <div className="d-panel-title">
        <h2 id="d-book-title">Order book</h2>
        <span>{venues[venue]}</span>
      </div>
      {live && (
        <div className="d-book-feed">
          <span
            className="d-feed-status"
            data-testid="book-status"
            data-health={health}
          >
            {health}
          </span>
          <span>
            {live.book
              ? new Date(live.book.time).toISOString().slice(11, 19) + " UTC"
              : "Public feed"}
          </span>
        </div>
      )}
      <div className="d-book-labels">
        <span>Price (USD)</span>
        <span>Size ({market})</span>
        <span>Total ({market})</span>
      </div>
      <div
        className="d-book-orders"
        role="list"
        aria-label="Asks, highest price first"
      >
        {book.asks.map((row) => (
          <div className="d-book-row d-ask" role="listitem" key={row.price}>
            <i
              aria-hidden="true"
              style={{ width: `${(row.total / book.max) * 100}%` }}
            />
            <span>{number(row.price, priceDecimals)}</span>
            <span>{number(row.size, decimals)}</span>
            <span>{number(row.total, decimals)}</span>
          </div>
        ))}
      </div>
      <div className="d-book-mid">
        <strong>{mid === undefined ? "—" : number(mid, priceDecimals)}</strong>
        <span>
          Mark price
          {live && channelHealth(live, "ticker") !== "Live"
            ? " · stale / waiting"
            : ""}
        </span>
      </div>
      <div className="d-book-spread">
        <span>Spread</span>
        <span>
          {spread === undefined || !mid ? (
            "—"
          ) : (
            <>
              {spread > 0 && spread < 10 ** -priceDecimals - 1e-9
                ? `<${number(10 ** -priceDecimals, priceDecimals)}`
                : number(spread, priceDecimals)}{" "}
              <small>({number((spread / mid) * 100, 3)}%)</small>
            </>
          )}
        </span>
      </div>
      <div
        className="d-book-orders"
        role="list"
        aria-label="Bids, highest price first"
      >
        {book.bids.map((row) => (
          <div className="d-book-row d-bid" role="listitem" key={row.price}>
            <i
              aria-hidden="true"
              style={{ width: `${(row.total / book.max) * 100}%` }}
            />
            <span>{number(row.price, priceDecimals)}</span>
            <span>{number(row.size, decimals)}</span>
            <span>{number(row.total, decimals)}</span>
          </div>
        ))}
      </div>
      {live && !book.bids.length && !book.asks.length && (
        <div className="d-book-empty" role="status">
          {live.connection === "unsupported"
            ? "Live book unavailable."
            : live.book
              ? "No resting liquidity."
              : health === "Offline"
                ? "You’re offline. Reconnect to load the book."
                : "Waiting for venue depth…"}
        </div>
      )}
      {(buyTotal > 0 || sellTotal > 0) && (
        <div
          className="d-book-balance"
          aria-label={`Displayed bid depth ${buyShare} percent, ask depth ${100 - buyShare} percent`}
        >
          <span style={{ width: `${buyShare}%` }}>B {buyShare}%</span>
          <span style={{ width: `${100 - buyShare}%` }}>
            {100 - buyShare}% S
          </span>
        </div>
      )}
      <p className="d-book-note">
        Bars show cumulative depth.
        {live && health !== "Live" && live.book ? " Last-known levels." : ""}
      </p>
    </section>
  );
}
