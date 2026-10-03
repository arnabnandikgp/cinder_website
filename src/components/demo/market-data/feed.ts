import type { Market, Venue } from "../data";
import { feeUrl, parseVenueFee, type VenueFee } from "./fees";
import {
  endpoints,
  historyUrl,
  object,
  parseBook,
  parseCandles,
  parseInfo,
  parseTicker,
  parseTrades,
  mergeCandles,
  subscriptions,
  symbol,
  TradeCandles,
  intervals,
  type Book,
  type Candle,
  type Interval,
  type LiveVenue,
  type MarketInfo,
  type Ticker,
} from "./adapters";

export type FeedState = {
  connection:
    "connecting" | "connected" | "reconnecting" | "offline" | "unsupported";
  candles: Candle[];
  book: Book | null;
  ticker: Ticker | null;
  info: MarketInfo | null;
  history: "loading" | "ready" | "error";
  historyError: string;
  bookAt: number;
  tickerAt: number;
  candleAt: number;
  now: number;
  fee?: VenueFee | null;
  feeError?: string;
};
export type Health =
  "Live" | "Connecting" | "Reconnecting" | "Offline" | "Stale" | "Unavailable";
export function channelHealth(
  state: FeedState,
  channel: "book" | "ticker",
): Health {
  if (state.connection === "unsupported") return "Unavailable";
  if (state.connection === "offline") return "Offline";
  if (state.connection === "reconnecting") return "Reconnecting";
  const received = channel === "book" ? state.bookAt : state.tickerAt;
  const timestamp = state[channel]?.time;
  if (!received || !timestamp) return "Connecting";
  return state.now - received <= 6000 &&
    state.now - timestamp <= 10000 &&
    timestamp <= state.now + 5000
    ? "Live"
    : "Stale";
}
export function candleHealth(state: FeedState, interval: Interval): string {
  if (state.connection === "unsupported") return "Unavailable";
  if (!state.candles.length)
    return state.history === "error" ? "Unavailable" : "Loading candles";
  if (state.connection !== "connected")
    return state.connection === "offline" ? "Offline" : "Reconnecting";
  const last = state.candles.at(-1)!;
  if (
    state.now / 1000 >= last.time + intervals[interval] + 30 ||
    state.now - state.candleAt > 45000
  )
    return "Delayed candles";
  return last.partial ? "Partial candle" : "Live candles";
}

const metadata = new Map<LiveVenue, { data: unknown; at: number }>();

// Read-only public feed. No keys, accounts, transactions or order endpoints.
// One socket supplies chart, book and ticker; rendering is coalesced to 10 Hz.
export class MarketFeed {
  private listeners = new Set<() => void>();
  private state: FeedState;
  private initial: FeedState;
  private running = false;
  private generation = 0;
  private socket: WebSocket | null = null;
  private request: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private healthTimer: ReturnType<typeof setInterval> | undefined;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private historyTimer: ReturnType<typeof setTimeout> | undefined;
  private feeTimer: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;
  private canonical: Candle[] = [];
  private tradeCandles: TradeCandles | null = null;
  private historyPending = false;
  private buffered: Candle[] = [];
  private historyRetryAt = 0;
  private receivedAt = 0;
  private openedAt = 0;

  constructor(
    readonly venue: Venue,
    readonly market: Market,
    readonly interval: Interval,
    readonly purpose: "chart" | "comparison" = "chart",
  ) {
    this.state = this.initial = {
      connection: venue === "velocity" ? "unsupported" : "connecting",
      candles: [],
      book: null,
      ticker: null,
      info: null,
      history: "loading",
      historyError: "",
      bookAt: 0,
      tickerAt: 0,
      candleAt: 0,
      now: 0,
      fee: null,
      feeError: "",
    };
  }
  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };
  getSnapshot = () => this.state;
  getServerSnapshot = () => this.initial;
  private publish(patch: Partial<FeedState>) {
    this.state = { ...this.state, ...patch, now: Date.now() };
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      if (this.running) this.listeners.forEach((callback) => callback());
    }, 100);
  }
  start = () => {
    this.running = true;
    if (this.venue === "velocity") return;
    window.addEventListener("online", this.resume);
    window.addEventListener("offline", this.offline);
    document.addEventListener("visibilitychange", this.visible);
    this.healthTimer = setInterval(
      () => {
        this.publish({});
        if (
          this.socket &&
          Date.now() - Math.max(this.receivedAt, this.openedAt) > 20000
        )
          this.reconnect();
      },
      this.purpose === "comparison" ? 250 : 1000,
    );
    this.connect();
  };
  stop = () => {
    this.running = false;
    this.generation++;
    this.cleanupConnection();
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.flushTimer);
    clearInterval(this.healthTimer);
    this.reconnectTimer = this.flushTimer = undefined;
    window.removeEventListener("online", this.resume);
    window.removeEventListener("offline", this.offline);
    document.removeEventListener("visibilitychange", this.visible);
  };
  retry = () => {
    if (!this.running || this.venue === "velocity" || this.reconnectTimer)
      return;
    this.reconnect();
  };
  private offline = () => {
    this.generation++;
    this.cleanupConnection();
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.publish({ connection: "offline" });
  };
  private resume = () => {
    if (this.running && !this.socket && !this.reconnectTimer) this.connect();
  };
  private visible = () => {
    if (
      document.visibilityState === "visible" &&
      Date.now() - this.receivedAt > 10000
    )
      this.retry();
  };
  private cleanupConnection() {
    if (this.socket) {
      this.socket.onopen =
        this.socket.onmessage =
        this.socket.onerror =
        this.socket.onclose =
          null;
      this.socket.close();
      this.socket = null;
    }
    this.request?.abort();
    clearInterval(this.heartbeat);
    clearTimeout(this.historyTimer);
    clearTimeout(this.feeTimer);
    this.historyPending = false;
  }
  private reconnect() {
    if (!this.running || this.reconnectTimer) return;
    this.generation++;
    this.cleanupConnection();
    if (!navigator.onLine) {
      this.publish({ connection: "offline" });
      return;
    }
    this.publish({ connection: "reconnecting" });
    const delay =
      Math.min(30000, 1000 * 2 ** Math.min(this.failures++, 5)) +
      Math.random() * 500;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delay);
  }
  private connect() {
    if (!this.running || this.venue === "velocity") return;
    if (!navigator.onLine) {
      this.publish({ connection: "offline" });
      return;
    }
    const venue = this.venue;
    const generation = ++this.generation;
    const valid = () => this.running && generation === this.generation;
    this.request = new AbortController();
    this.publish({
      connection: this.openedAt ? "reconnecting" : "connecting",
      bookAt: 0,
      tickerAt: 0,
      candleAt: 0,
    });
    this.tradeCandles = null;
    this.openedAt = Date.now();
    this.receivedAt = 0;
    void this.loadInfo(venue, generation);
    if (this.purpose === "chart")
      void this.loadHistory(venue, generation, true);
    else void this.loadFee(venue, generation);
    try {
      const ws = (this.socket = new WebSocket(endpoints[venue].ws));
      ws.onopen = () => {
        if (!valid()) return;
        this.publish({ connection: "connected" });
        this.tradeCandles =
          venue === "bulk" && this.purpose === "chart"
            ? new TradeCandles(this.interval, Date.now())
            : null;
        for (const message of subscriptions(
          venue,
          this.market,
          this.interval,
          this.purpose,
        ))
          ws.send(JSON.stringify(message));
        // Pacifica needs application pings even while receiving market data.
        // BULK uses transport pings, answered automatically by the browser.
        if (venue === "pacifica")
          this.heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN)
              ws.send(JSON.stringify({ method: "ping" }));
          }, 25000);
      };
      ws.onmessage = (event) => {
        if (!valid() || typeof event.data !== "string") return;
        try {
          // Preserve raw nanosecond timestamps before JSON can round them.
          this.consume(
            venue,
            JSON.parse(
              event.data.replace(
                /("(?:timestamp|stamp)"\s*:\s*)(\d{16,20})(?=\s*[,}])/g,
                '$1"$2"',
              ),
            ),
          );
        } catch {
          /* Malformed frames never replace valid state. */
        }
      };
      ws.onclose = ws.onerror = () => {
        if (valid()) this.reconnect();
      };
    } catch {
      this.reconnect();
    }
  }
  private async get(url: string, signal: AbortSignal) {
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      credentials: "omit",
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 429) {
        const header = response.headers.get("retry-after");
        const seconds = header ? Number(header) : NaN;
        const date = header ? Date.parse(header) : NaN;
        this.historyRetryAt =
          Date.now() +
          Math.max(
            30000,
            Number.isFinite(seconds)
              ? seconds * 1000
              : Number.isFinite(date)
                ? date - Date.now()
                : 60000,
          );
      }
      throw new Error(
        response.status === 429
          ? "Rate limited. Retrying shortly."
          : "Venue history unavailable. Retrying shortly.",
      );
    }
    const data: unknown = await response.json();
    if (object(data).success === false)
      throw new Error("Venue data unavailable. Retrying shortly.");
    return data;
  }
  private async loadInfo(venue: LiveVenue, generation: number) {
    try {
      const cached = metadata.get(venue);
      const data =
        cached && Date.now() - cached.at < 300000
          ? cached.data
          : await this.get(
              `${endpoints[venue].rest}/${venue === "pacifica" ? "info" : "exchangeInfo"}`,
              this.request!.signal,
            );
      if (!this.running || generation !== this.generation) return;
      metadata.set(venue, { data, at: Date.now() });
      this.publish({ info: parseInfo(venue, data, this.market) });
    } catch {
      /* The chart remains usable without optional venue metadata. */
    }
  }
  private async loadFee(venue: LiveVenue, generation: number) {
    if (!this.running || generation !== this.generation) return;
    if (Date.now() < this.historyRetryAt) {
      this.feeTimer = setTimeout(
        () => void this.loadFee(venue, generation),
        this.historyRetryAt - Date.now(),
      );
      return;
    }
    try {
      const raw = await this.get(feeUrl(venue), this.request!.signal);
      if (!this.running || generation !== this.generation) return;
      const fee = parseVenueFee(venue, this.market, raw, Date.now());
      if (!fee) throw new Error("Unrecognised venue fee schedule");
      this.publish({ fee, feeError: "" });
    } catch {
      if (this.running && generation === this.generation)
        this.publish({ fee: null, feeError: "Fee schedule unavailable" });
    } finally {
      if (this.running && generation === this.generation)
        this.feeTimer = setTimeout(
          () => void this.loadFee(venue, generation),
          Math.max(60000, this.historyRetryAt - Date.now()),
        );
    }
  }
  private async loadHistory(
    venue: LiveVenue,
    generation: number,
    full: boolean,
  ) {
    if (!this.running || generation !== this.generation || this.historyPending)
      return;
    if (Date.now() < this.historyRetryAt) {
      this.historyTimer = setTimeout(
        () => void this.loadHistory(venue, generation, full),
        this.historyRetryAt - Date.now(),
      );
      return;
    }
    this.historyPending = true;
    this.buffered = [];
    try {
      const data = await this.get(
        historyUrl(
          venue,
          this.market,
          this.interval,
          Date.now(),
          full ? 500 : 8,
        ),
        this.request!.signal,
      );
      if (!this.running || generation !== this.generation) return;
      const values = venue === "pacifica" ? object(data).data : data;
      if (!Array.isArray(values))
        throw new Error("Unexpected candle response. Retrying shortly.");
      const bars = parseCandles(values, this.interval);
      if (values.length && !bars.length)
        throw new Error("Invalid candle data. Retrying shortly.");
      this.canonical = mergeCandles(
        mergeCandles(this.canonical, bars),
        this.buffered,
      );
      this.publish({
        history: "ready",
        historyError: "",
        candles: this.combined(),
        // A historical fetch is not evidence that the forming candle is live.
        ...(venue === "pacifica" &&
        bars.at(-1)?.time ===
          Math.floor(Date.now() / (intervals[this.interval] * 1000)) *
            intervals[this.interval]
          ? { candleAt: Date.now() }
          : {}),
      });
    } catch (error) {
      if (!this.running || generation !== this.generation) return;
      this.publish({
        history: "error",
        historyError:
          error instanceof Error
            ? error.message
            : "History unavailable. Retrying shortly.",
      });
    } finally {
      if (this.running && generation === this.generation) {
        this.historyPending = false;
        this.historyTimer = setTimeout(
          () =>
            void this.loadHistory(
              venue,
              generation,
              this.state.history === "error",
            ),
          30000,
        );
      }
    }
  }
  private combined() {
    return (
      this.tradeCandles?.combine(this.canonical, Date.now()) ?? this.canonical
    );
  }
  private acceptCandles(bars: Candle[]) {
    if (!bars.length) return;
    if (this.historyPending) this.buffered = mergeCandles(this.buffered, bars);
    this.canonical = mergeCandles(this.canonical, bars);
    this.publish({ candles: this.combined(), candleAt: Date.now() });
  }
  private consume(venue: LiveVenue, value: unknown) {
    const message = object(value),
      data = object(message.data),
      s = symbol(venue, this.market);
    const now = Date.now();
    if (message.channel === "error" || message.type === "error") {
      this.reconnect();
      return;
    }
    const bookValue =
      venue === "pacifica" && message.channel === "book" && data.s === s
        ? data
        : venue === "bulk" &&
            message.type === "l2Snapshot" &&
            object(data.book).symbol === s
          ? data.book
          : null;
    if (bookValue) {
      const book = parseBook(venue, bookValue);
      if (
        book &&
        book.time <= now + 5000 &&
        (!this.state.book || book.time >= this.state.book.time)
      ) {
        this.receivedAt = now;
        if (now - book.time < 10000) this.failures = 0;
        this.publish({ book, bookAt: now });
      }
    }
    const tickerValue =
      venue === "pacifica" &&
      message.channel === "prices" &&
      Array.isArray(message.data)
        ? message.data.find((row) => object(row).symbol === s)
        : venue === "bulk" &&
            message.type === "ticker" &&
            object(data.ticker).symbol === s
          ? data.ticker
          : null;
    if (tickerValue) {
      const ticker = parseTicker(venue, tickerValue);
      if (
        ticker &&
        ticker.time <= now + 5000 &&
        (!this.state.ticker || ticker.time >= this.state.ticker.time)
      )
        this.publish({ ticker, tickerAt: now });
    }
    if (
      venue === "pacifica" &&
      message.channel === "candle" &&
      data.s === s &&
      data.i === this.interval
    )
      this.acceptCandles(parseCandles([data], this.interval));
    if (
      venue === "bulk" &&
      message.type === "candle" &&
      message.topic === `candle.${s}.${this.interval}`
    )
      this.acceptCandles(parseCandles(data.candles, this.interval));
    if (
      venue === "bulk" &&
      message.type === "trades" &&
      message.topic === `trades.${s}`
    ) {
      const trades = parseTrades(data.trades, this.market);
      if (trades.length && this.tradeCandles) {
        this.tradeCandles.add(trades);
        this.publish({ candles: this.combined(), candleAt: now });
      }
    }
  }
}
