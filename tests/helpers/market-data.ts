import type { Page, WebSocketRoute } from "@playwright/test";

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
  venue: "pacifica" | "bulk",
  market = "SOL",
  price = 152,
  time = Date.now(),
  deep = false,
) {
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
  } = {},
) {
  const sockets: {
    venue: "pacifica" | "bulk";
    socket: WebSocketRoute;
    closed: boolean;
    messages: Record<string, unknown>[];
    paused: boolean;
  }[] = [];
  const requests: string[] = [];
  await page.route(
    /https:\/\/(api\.pacifica\.fi|mainnet-api1\.bulk\.trade)\//,
    async (route) => {
      const url = new URL(route.request().url());
      requests.push(url.toString());
      const pacifica = url.hostname.includes("pacifica");
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
    /wss:\/\/(ws\.pacifica\.fi|mainnet-ws1\.bulk\.trade)/,
    (socket) => {
      const venue = socket.url().includes("pacifica") ? "pacifica" : "bulk";
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
                bookMessage(venue, market, price, Date.now(), deep),
              ),
            );
        };
        send();
        if (options.stream) {
          clearInterval(stream);
          stream = setInterval(send, 250);
        }
      };
      socket.onMessage((raw) => {
        const m = JSON.parse(String(raw));
        record.messages.push(m);
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
