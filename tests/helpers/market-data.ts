import type { Page, WebSocketRoute } from "@playwright/test";
type TestVenue = "pacifica" | "bulk" | "phoenix";

export function phoenixBars(interval = "15m", price = 152.5) {
  return bars(interval, price).map((b) => ({
    time: b.t,
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
    volume: b.v,
  }));
}
export function phoenixInfo(market = "SOL") {
  return {
    symbol: market,
    marketStatus: "active",
    tickSize: 100,
    baseLotsDecimals: market === "SOL" ? 2 : 4,
    leverageTiers: [{ maxLeverage: 25 }],
    takerFee: 0.00035,
    makerFee: 0.00005,
    fundingIntervalSeconds: 3600,
    fundingPeriodSeconds: 86400,
  };
}

export function bars(interval = "15m", price = 152) {
  const duration =
    ({ "5m": 300, "15m": 900, "1h": 3600, "4h": 14400 }[interval] ?? 900) *
    1000;
  const end = Math.floor(Date.now() / duration) * duration;
  return Array.from({ length: 80 }, (_, i) => ({
    t: end - (79 - i) * duration,
    T: end - (78 - i) * duration,
    o: price - 0.2,
    h: price + 0.2,
    l: price - 0.4,
    c: price,
    v: 12 + i,
    n: 3,
  }));
}
export function bookMessage(
  venue: TestVenue,
  market = "SOL",
  price = 152,
  time = Date.now(),
  deep = false,
) {
  if (venue === "phoenix")
    return {
      channel: "l2Book",
      coin: market,
      timestamp: Math.floor(time / 1000),
      slot: time,
      bids: Array.from({ length: 12 }, (_, i) => [
        Number((price - (i + 1) * 0.01).toFixed(2)),
        i + 1,
      ]),
      asks: Array.from({ length: 12 }, (_, i) => [
        Number((price + (i + 1) * 0.01).toFixed(2)),
        i + 1,
      ]),
    };
  const levels = [-1, 1].map((side) =>
    Array.from({ length: 12 }, (_, i) => {
      const px = Number((price + side * (i + 1) * 0.01).toFixed(2));
      return venue === "pacifica"
        ? { p: String(px), a: String(i + 1), n: 1 }
        : { px, sz: deep ? 60 + i : i + 1, n: 1 };
    }),
  );
  return venue === "pacifica"
    ? { channel: "book", data: { s: market, l: levels, t: time } }
    : {
        type: "l2Snapshot",
        topic: `l2snapshot.${market}-USD.20`,
        data: {
          book: {
            updateType: "snapshot",
            symbol: `${market}-USD`,
            levels,
            timestamp: time * 1e6,
          },
        },
      };
}
export async function mockMarketData(
  page: Page,
  options: {
    failHistory?: boolean;
    empty?: boolean;
    quiet?: boolean;
    stream?: boolean;
    failFees?: boolean;
    // Older two-venue scenarios deliberately model Phoenix as unavailable.
    phoenix?: boolean;
    bookCadenceMs?: Partial<Record<TestVenue, number>>;
    sourceLagMs?: Partial<Record<TestVenue, number>>;
  } = {},
) {
  const sockets: {
    venue: TestVenue;
    socket: WebSocketRoute;
    closed: boolean;
    messages: Record<string, unknown>[];
    paused: boolean;
  }[] = [];
  const requests: string[] = [];
  await page.route(
    /https:\/\/(api\.pacifica\.fi|mainnet-api1\.bulk\.trade|perp-api\.phoenix\.trade)\//,
    async (route) => {
      const url = new URL(route.request().url());
      requests.push(url.toString());
      const pacifica = url.hostname.includes("pacifica");
      if (url.hostname.includes("phoenix")) {
        const market = url.pathname.split("/").at(-1)!;
        const info = url.pathname.includes("/view/exchange/market/");
        if (!options.phoenix || (info ? options.failFees : options.failHistory))
          return route.fulfill({ status: 503, body: "Unavailable" });
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(
            info
              ? phoenixInfo(market)
              : options.empty
                ? []
                : phoenixBars(
                    url.searchParams.get("timeframe") ?? "15m",
                    market === "BTC" ? 86010 : 152.5,
                  ),
          ),
        });
      }
      if (
        url.pathname.endsWith("/info/fees") ||
        url.pathname.endsWith("/feeState")
      ) {
        if (options.failFees)
          return route.fulfill({ status: 503, body: "Unavailable" });
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(
            pacifica
              ? {
                  success: true,
                  data: [{ level: 0, taker_fee_rate: "0.0004" }],
                }
              : {
                  globalPolicyActive: true,
                  scopes: [
                    {
                      instrument: "global",
                      active_policy: {
                        tiers: [{ threshold_volume: 0, taker_bps: 3.5 }],
                      },
                    },
                  ],
                },
          ),
        });
      }
      const info =
        url.pathname.endsWith("/info") ||
        url.pathname.endsWith("/exchangeInfo");
      if (!info && options.failHistory)
        return route.fulfill({ status: 503, body: "Unavailable" });
      const data = info
        ? ["SOL", "BTC"].map((market) =>
            pacifica
              ? {
                  symbol: market,
                  tick_size: market === "SOL" ? "0.01" : "1",
                  lot_size: "0.00001",
                  max_leverage: 20,
                }
              : {
                  symbol: `${market}-USD`,
                  tickSize: 0.01,
                  lotSize: 0.000001,
                  maxLeverage: 20,
                },
          )
        : options.empty
          ? []
          : bars(
              url.searchParams.get("interval") ?? "15m",
              url.searchParams.get("symbol")?.startsWith("BTC")
                ? 86000
                : pacifica
                  ? 152
                  : 153,
            );
      await route.fulfill({
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify(pacifica ? { success: true, data } : data),
      });
    },
  );
  await page.routeWebSocket(
    /wss:\/\/(ws\.pacifica\.fi|mainnet-ws1\.bulk\.trade|perp-api\.phoenix\.trade)/,
    (socket) => {
      const venue = socket.url().includes("phoenix")
        ? "phoenix"
        : socket.url().includes("pacifica")
          ? "pacifica"
          : "bulk";
      const record = {
        venue,
        socket,
        closed: false,
        messages: [],
        paused: false,
      } as (typeof sockets)[number];
      sockets.push(record);
      let stream: ReturnType<typeof setInterval> | undefined;
      socket.onClose(() => {
        record.closed = true;
        clearInterval(stream);
      });
      const startBook = (market: string, price: number, deep = false) => {
        const send = () => {
          if (record.closed || page.isClosed()) {
            clearInterval(stream);
            return;
          }
          if (!record.paused)
            socket.send(
              JSON.stringify(
                bookMessage(
                  venue,
                  market,
                  price,
                  Date.now() - (options.sourceLagMs?.[venue] ?? 0),
                  deep,
                ),
              ),
            );
        };
        send();
        if (options.stream) {
          clearInterval(stream);
          stream = setInterval(send, options.bookCadenceMs?.[venue] ?? 250);
        }
      };
      socket.onMessage((raw) => {
        const m = JSON.parse(String(raw));
        record.messages.push(m);
        if (venue === "phoenix") {
          if (
            !options.phoenix ||
            options.quiet ||
            options.empty ||
            m.type !== "subscribe"
          )
            return;
          const s = m.subscription.coin ?? m.subscription.symbol;
          const price = s === "BTC" ? 86010 : 152.5;
          const send = (value: unknown) => socket.send(JSON.stringify(value));
          if (m.subscription.channel === "l2Book") startBook(s, price);
          if (m.subscription.channel === "market")
            send({
              channel: "market",
              symbol: s,
              markPx: price,
              midPx: price,
              oraclePx: price - 0.05,
              funding: -0.0002,
              prevDayPx: price - 1,
              dayNtlVlm: 34567890,
            });
          if (m.subscription.channel === "candles") {
            const candle = phoenixBars(m.subscription.timeframe, price).at(-1)!;
            send({
              channel: "candle",
              symbol: s,
              timeframe: m.subscription.timeframe,
              candle: { ...candle, time: candle.time / 1000 },
            });
          }
          return;
        }
        if (options.quiet || options.empty) return;
        if (m.method === "ping") {
          socket.send(JSON.stringify({ channel: "pong" }));
          return;
        }
        if (m.method !== "subscribe") return;
        const send = (value: unknown) => socket.send(JSON.stringify(value));
        if (venue === "pacifica") {
          const s = m.params.symbol ?? "SOL",
            price = s === "BTC" ? 86000 : 152;
          if (m.params.source === "book") startBook(s, price);
          if (m.params.source === "prices")
            send({
              channel: "prices",
              data: ["SOL", "BTC"].map((symbol) => ({
                symbol,
                mark: symbol === "SOL" ? "152" : "86000",
                mid: symbol === "SOL" ? "152" : "86000",
                oracle: symbol === "SOL" ? "151.95" : "85998",
                funding: "0.0000125",
                next_funding: "-0.0000215",
                volume_24h: "12345678.9",
                yesterday_price: symbol === "SOL" ? "150" : "85000",
                timestamp: Date.now(),
              })),
            });
          if (m.params.source === "candle")
            send({
              channel: "candle",
              data: {
                ...bars(m.params.interval, price).at(-1),
                s,
                i: m.params.interval,
              },
            });
        } else {
          const s = m.subscription[0].symbol,
            market = s.split("-")[0],
            price = market === "BTC" ? 86000 : 153;
          startBook(market, price, m.subscription[0].nlevels === 1000);
          send({
            type: "ticker",
            data: {
              ticker: {
                symbol: s,
                markPrice: price,
                oraclePrice: price - 0.1,
                fundingRate: 0.0001,
                quoteVolume: 234567890,
                lastPrice: price,
                priceChangePercent: 1,
                timestamp: Date.now() * 1e6,
              },
            },
          });
          const interval = m.subscription.find(
            (x: { type: string }) => x.type === "candle",
          )?.interval;
          if (interval)
            send({
              type: "candle",
              topic: `candle.${s}.${interval}`,
              data: { candles: bars(interval, price) },
            });
        }
      });
    },
  );
  return { sockets, requests };
}
