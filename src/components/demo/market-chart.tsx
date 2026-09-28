"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CandlestickChart, Info, Minus, Plus, ScanLine } from "lucide-react";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";
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

// Actual TradingView rendering engine, intentionally fed only local fixtures.
// No iframe of another trading terminal, external scripts or live trading API.
function TradingChart({
  bars,
  market,
  venue,
  interval,
}: {
  bars: Bar[];
  market: Market;
  venue: Venue;
  interval: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [hover, setHover] = useState<Bar | null>(null);
  const active = hover ?? bars[bars.length - 1];

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
          const up = token("--d-positive");
          const down = token("--d-negative");
          const chart = createChart(host.current, {
            autoSize: true,
            layout: {
              background: { type: ColorType.Solid, color: token("--d-panel") },
              textColor: token("--d-muted"),
              fontFamily: "Arial, sans-serif",
              fontSize: 12,
              attributionLogo: true,
            },
            grid: {
              vertLines: { color: token("--d-grid") },
              horzLines: { color: token("--d-grid") },
            },
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: {
              entireTextOnly: true,
              borderColor: token("--d-line"),
              scaleMargins: { top: 0.12, bottom: 0.25 },
            },
            timeScale: {
              borderColor: token("--d-line"),
              timeVisible: true,
              secondsVisible: false,
              rightOffset: 5,
            },
            handleScroll: { vertTouchDrag: false },
            localization: { locale: "en-US" },
          });
          chartRef.current = chart;
          cleanup = () => {
            chartRef.current = null;
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
          series.setData(bars);
          const volume = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
            lastValueVisible: false,
            priceLineVisible: false,
          });
          volume
            .priceScale()
            .applyOptions({ scaleMargins: { top: 0.82, bottom: 0.02 } });
          volume.setData(
            bars.map((bar) => ({
              time: bar.time,
              value: bar.volume,
              color:
                bar.close >= bar.open
                  ? token("--d-buy-volume")
                  : token("--d-sell-volume"),
            })),
          );
          chart.timeScale().setVisibleLogicalRange({
            from: Math.max(
              0,
              bars.length - (host.current.clientWidth < 500 ? 38 : 68),
            ),
            to: bars.length + 3,
          });
          chart.subscribeCrosshairMove((event) => {
            const bar = bars.find((item) => item.time === event.time);
            setHover(bar ?? null);
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
  }, [bars, market, attempt]);

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
  function fit() {
    chartRef.current?.timeScale().fitContent();
  }
  return (
    <>
      <div className="d-chart-legend">
        <span>
          {market} · {interval} · {venues[venue]}
        </span>
        <div
          className={`d-chart-ohlc ${active.close >= active.open ? "d-up" : "d-down"}`}
          aria-live="off"
        >
          {(
            [
              ["O", active.open],
              ["H", active.high],
              ["L", active.low],
              ["C", active.close],
            ] as [string, number][]
          ).map(([label, value]) => (
            <span key={label}>
              {label} <b>{number(value)}</b>
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
          tabIndex={0}
          role="group"
          aria-label={`${market} ${interval} chart. Simulated prices for the ${venues[venue]} venue context. Use plus and minus to zoom, arrows to pan, and Home to fit.`}
          onKeyDown={(event) => {
            if (event.key === "+" || event.key === "=") {
              event.preventDefault();
              zoom(0.8);
            } else if (event.key === "-") {
              event.preventDefault();
              zoom(1.25);
            } else if (event.key === "Home") {
              event.preventDefault();
              fit();
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
        {status !== "ready" && (
          <div className="d-chart-state" role="status">
            <p>
              {status === "error" ? "Chart could not load." : "Loading chart…"}
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
          </div>
        )}
      </div>
      <div className="d-chart-caption">
        <span>
          Volume ({market}) <b>{number(active.volume, 1)}</b>{" "}
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
            aria-label="Fit chart to data"
            onClick={fit}
            disabled={status !== "ready"}
          >
            <ScanLine size={14} aria-hidden="true" />
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
}: {
  market: Market;
  venue: Venue;
  canChooseVenue: boolean;
  leverage: string;
  onMarket: (value: Market) => void;
  onVenue: (value: Venue) => void;
}) {
  const [interval, setInterval] = useState("15m");
  const bars = useMemo(() => {
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
  }, [market, venue, interval]);
  const change = (bars[bars.length - 1].close / bars[0].open - 1) * 100;
  return (
    <section className="d-panel d-market" aria-label="Market chart">
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
        <div className="d-reference-price">
          <span>Mark price</span>
          <strong>{number(referencePrice(market, venue))}</strong>
        </div>
        <div className="d-market-change">
          <span>Change · range</span>
          <strong className={change >= 0 ? "d-up" : "d-down"}>
            {change >= 0 ? "+" : ""}
            {number(change)}%
          </strong>
        </div>
        <div className="d-chart-source">
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
      </div>
      <div className="d-chart-toolbar">
        <div className="d-timeframes" aria-label="Chart interval">
          {["5m", "15m", "1h", "4h"].map((value) => (
            <button
              key={value}
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <CandlestickChart size={16} aria-hidden="true" />
        <span>Price · USD</span>
      </div>
      <TradingChart
        key={`${market}-${venue}-${interval}`}
        bars={bars}
        market={market}
        venue={venue}
        interval={interval}
      />
    </section>
  );
}

export function OrderBook({ market, venue }: { market: Market; venue: Venue }) {
  const mid = referencePrice(market, venue);
  const book = orderBook(market, venue);
  const decimals = market === "SOL" ? 1 : 3;
  const buyTotal = book.bids[book.bids.length - 1].total;
  const sellTotal = book.asks[0].total;
  const buyShare = Math.round((buyTotal / (buyTotal + sellTotal)) * 100);
  const spread = book.asks[book.asks.length - 1].price - book.bids[0].price;
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
            <span>{number(row.price)}</span>
            <span>{number(row.size, decimals)}</span>
            <span>{number(row.total, decimals)}</span>
          </div>
        ))}
      </div>
      <div className="d-book-mid">
        <strong>{number(mid)}</strong>
        <span>Mark price</span>
      </div>
      <div className="d-book-spread">
        <span>Spread</span>
        <span>
          {number(spread)} <small>({number((spread / mid) * 100, 3)}%)</small>
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
            <span>{number(row.price)}</span>
            <span>{number(row.size, decimals)}</span>
            <span>{number(row.total, decimals)}</span>
          </div>
        ))}
      </div>
      <div
        className="d-book-balance"
        aria-label={`Displayed bid depth ${buyShare} percent, ask depth ${100 - buyShare} percent`}
      >
        <span style={{ width: `${buyShare}%` }}>B {buyShare}%</span>
        <span style={{ width: `${100 - buyShare}%` }}>{100 - buyShare}% S</span>
      </div>
      <p className="d-book-note">Bars show cumulative depth.</p>
    </section>
  );
}
