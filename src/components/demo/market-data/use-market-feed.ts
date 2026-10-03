"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Market, Venue } from "../data";
import type { Interval } from "./adapters";
import { MarketFeed } from "./feed";

export function useMarketFeed(
  venue: Venue,
  market: Market,
  interval: Interval,
  enabled: boolean,
  purpose: "chart" | "comparison" = "chart",
) {
  const feed = useMemo(
    () => new MarketFeed(venue, market, interval, purpose),
    [venue, market, interval, purpose],
  );
  const state = useSyncExternalStore(
    feed.subscribe,
    feed.getSnapshot,
    feed.getServerSnapshot,
  );
  useEffect(() => {
    if (!enabled) return;
    feed.start();
    return feed.stop;
  }, [feed, enabled]);
  return useMemo(() => ({ ...state, retry: feed.retry }), [state, feed]);
}
export type LiveMarket = ReturnType<typeof useMarketFeed>;
