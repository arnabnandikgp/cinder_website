"use client";

import type { Market, Venue } from "./data";
import type { PaperAccount } from "./paper-account";
import { channelHealth, type FeedState } from "./market-data/feed";
import { useMarketFeed } from "./market-data/use-market-feed";

/** Only positions enable these lightweight, ticker-only subscriptions. Portfolio
 * valuation must not depend on the selected chart, market, mode or page. */
export function usePaperMarks(
  account: PaperAccount | null,
  chart: { venue: Venue; market: Market; feed: FeedState },
) {
  const has = (venue: Venue, market: Market) =>
    Boolean(
      account?.positions.some((p) => p.venue === venue && p.market === market),
    );
  const solPacifica = useMarketFeed(
    "pacifica",
    "SOL",
    "15m",
    has("pacifica", "SOL"),
    "valuation",
  );
  const solBulk = useMarketFeed(
    "bulk",
    "SOL",
    "15m",
    has("bulk", "SOL"),
    "valuation",
  );
  const solPhoenix = useMarketFeed(
    "phoenix",
    "SOL",
    "15m",
    has("phoenix", "SOL"),
    "valuation",
  );
  const btcPacifica = useMarketFeed(
    "pacifica",
    "BTC",
    "15m",
    has("pacifica", "BTC"),
    "valuation",
  );
  const btcBulk = useMarketFeed(
    "bulk",
    "BTC",
    "15m",
    has("bulk", "BTC"),
    "valuation",
  );
  const btcPhoenix = useMarketFeed(
    "phoenix",
    "BTC",
    "15m",
    has("phoenix", "BTC"),
    "valuation",
  );
  const feeds: Record<string, FeedState> = {
    "pacifica-SOL": solPacifica,
    "bulk-SOL": solBulk,
    "phoenix-SOL": solPhoenix,
    "pacifica-BTC": btcPacifica,
    "bulk-BTC": btcBulk,
    "phoenix-BTC": btcPhoenix,
  };
  const marks: Partial<Record<string, number>> = {};
  const now = Math.max(
    chart.feed.now,
    ...Object.values(feeds).map((feed) => feed.now),
  );
  for (const p of account?.positions ?? []) {
    const sources = [
      feeds[p.id],
      ...(p.market === chart.market && p.venue === chart.venue
        ? [chart.feed]
        : []),
    ];
    const source = sources.find(
      (feed) =>
        feed &&
        channelHealth({ ...feed, now }, "ticker") === "Live" &&
        Number.isFinite(feed.ticker?.mark) &&
        feed.ticker!.mark > 0,
    );
    if (source) marks[p.id] = source.ticker!.mark;
  }
  return marks;
}
