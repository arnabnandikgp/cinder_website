"use client";

import { useEffect, useRef, useState } from "react";
import { compareLiveRoutes, type ComparisonFeeds } from "./live-routing";
import type { RouteComparison, RouteInput } from "./routing";
import {
  analysisContext,
  ComparisonWindow,
  guardAnalysis,
  liveAnalysis,
  PUBLICATION_MS,
  SAMPLE_MS,
  type AnalysisFrame,
  type AnalysisMode,
} from "./comparison-analysis";

type Published = { key: string; live: AnalysisFrame; average: AnalysisFrame };

export function useComparisonAnalysis(
  input: RouteInput,
  feeds: ComparisonFeeds,
  current: RouteComparison,
  mode: AnalysisMode,
  enabled: boolean,
) {
  const key = `${enabled}:${analysisContext(input)}`;
  const latest = useRef({ input, feeds });
  const [published, setPublished] = useState<Published | null>(null);
  useEffect(() => {
    latest.current = { input, feeds };
  });
  useEffect(() => {
    if (!enabled) return;
    const window = new ComparisonWindow();
    let publishedSlot = -Infinity;
    function tick() {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      const { input, feeds } = latest.current;
      const slot = Math.floor(now / PUBLICATION_MS);
      const shouldPublish = slot > publishedSlot;
      const comparison = compareLiveRoutes(input, feeds, now, {
        curves: shouldPublish,
      });
      window.capture(comparison, now);
      if (shouldPublish) {
        // Startup/reconnection should not spend a whole second showing an
        // empty analytical frame after usable books arrive.
        if (comparison.live?.curves.some((curve) => curve.points.length))
          publishedSlot = slot;
        setPublished({
          key,
          live: liveAnalysis(comparison),
          average: window.average(comparison, now),
        });
      }
    }
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, SAMPLE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [key, enabled]);
  // Context changes invalidate the old frame synchronously. The interval's first
  // tick collects a new intent, rather than flashing the previous order's data.
  const frame =
    published?.key === key
      ? published[mode]
      : mode === "average"
        ? new ComparisonWindow().average(current, current.live?.now ?? 0)
        : {
            ...liveAnalysis(current),
            rows: liveAnalysis(current).rows.map((r) => ({
              ...r,
              costs: null,
              dollars: null,
              reason: r.reason ?? "Updating comparison",
            })),
            curves: [],
          };
  return guardAnalysis(frame, current, feeds, current.live?.now ?? 0);
}
