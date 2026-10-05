import { ArrowRight, Route } from "lucide-react";
import { DetailList } from "./controls";
import { number, usdcSize, venues } from "./data";
import { VenueIcon } from "./venue-select";
import { FeeTierInfo } from "./fee-tier-info";
import {
  money,
  snapshotLabels,
  type RouteComparison,
  type RouteReceipt,
} from "./routing";

export function RouteCard({
  comparison,
  onCompare,
  onAllowed,
}: {
  comparison: RouteComparison;
  onCompare: () => void;
  onAllowed: () => void;
}) {
  const { best, ranked, savings, explanation } = comparison;
  const appliedFee = comparison.live?.observations.find(
    (o) => o.venue === best?.venue,
  )?.fee;
  return (
    <section
      className="d-route-card"
      aria-label="Estimated route"
      data-testid="route-card"
    >
      <div className="d-route-card-heading">
        <span>
          <Route size={15} aria-hidden="true" /> Best now · live estimate
        </span>
        <span>{ranked.length} comparable</span>
      </div>
      <div className="d-route-destination">
        <strong data-testid="recommended-venue">
          {best && <VenueIcon venue={best.venue} size={22} />}
          {best ? venues[best.venue] : "No estimate"}
        </strong>
        <span>
          {best
            ? comparison.live?.tied
              ? "Similar estimates"
              : ranked.length === 1
                ? "Only available estimate"
                : "Lowest estimated cost"
            : "Check venue status"}
        </span>
      </div>
      {!best && <p>{explanation}</p>}
      {best && (
        <>
          <div className="d-route-compact-metrics">
            <DetailList
              rows={[
                [
                  "Entry cost",
                  `${number(best.costBps)} bps · ${money(best.totalCost)}`,
                ],
                ["Average fill", money(best.averageFill)],
                ["Effective price", money(best.effectivePrice)],
                [
                  "Price cost",
                  `${number((best.priceCost / (comparison.input.quantity * comparison.reference)) * 10000)} bps`,
                ],
                ...(appliedFee
                  ? [
                      [
                        "Venue fee rate",
                        <span key="rate">
                          {number(appliedFee.takerBps)} bps{" "}
                          <FeeTierInfo venue={best.venue} fee={appliedFee} />
                        </span>,
                      ] as [string, React.ReactNode],
                    ]
                  : []),
              ]}
            />
          </div>
        </>
      )}
      {best && savings !== null && savings >= 0.01 && (
        <div className="d-route-saving">
          Est. {money(savings)} below{" "}
          {venues[ranked.find((q) => q.venue !== best.venue)!.venue]}
        </div>
      )}
      <div className="d-route-links">
        <button type="button" className="d-text-button" onClick={onCompare}>
          View comparison <ArrowRight size={13} aria-hidden="true" />
        </button>
        <button type="button" className="d-text-button" onClick={onAllowed}>
          Allowed venues: {comparison.input.allowed.length}
        </button>
      </div>
      <span className="d-route-fixture">
        Live estimate · Rechecked on paper submission
      </span>
    </section>
  );
}

export function RouteReceiptDetails({ route }: { route: RouteReceipt }) {
  if (!route.best) return null;
  const q = route.best;
  return (
    <section className="d-route-receipt" aria-label="Saved route estimate">
      <h3>Route estimate at review</h3>
      <p>{route.explanation}</p>
      <DetailList
        rows={[
          ["Selected venue", venues[q.venue]],
          ...(route.input.notional !== undefined
            ? ([["Order size", usdcSize(route.input.notional)]] as [
                string,
                string,
              ][])
            : []),
          ["Average fill", money(q.averageFill)],
          ["Venue fee", money(q.venueFee)],
          ["Cinder pricing", route.live ? "Not included" : money(q.cinderFee)],
          ["Effective price", money(q.effectivePrice)],
          ["Price cost vs reference", money(q.priceCost)],
          [
            "Total estimated entry cost",
            `${money(q.totalCost)} · ${number(q.costBps)} bps`,
          ],
          ["Common reference", money(route.reference)],
          [
            "Market snapshot",
            route.live
              ? `Live books captured ${new Date(route.live.asOf).toISOString().slice(11, 23)} UTC`
              : snapshotLabels[route.input.snapshot],
          ],
          ...(route.live
            ? route.live.observations
                .filter((o) => o.fee)
                .map((o): [string, string] => [
                  `${venues[o.venue]} fee basis`,
                  `${o.fee!.label} · ${number(o.fee!.takerBps)} bps`,
                ])
            : []),
          [
            "Review time",
            new Date(route.savedAt)
              .toISOString()
              .replace("T", " ")
              .slice(0, 19) + " UTC",
          ],
        ]}
      />
      <h3>Compared venues</h3>
      <ul>
        {route.candidates.map((c) => (
          <li key={c.venue}>
            <span>{venues[c.venue]}</span>
            <span>
              {c.reason ??
                (c.quote
                  ? `${money(c.quote.totalCost)} estimated cost`
                  : "No quote")}
            </span>
          </li>
        ))}
      </ul>
      <p>
        No fills or fees were booked. This{" "}
        {route.live ? "point-in-time market" : "simulated"} estimate is
        preserved with the draft; it is not a current quote.
      </p>
    </section>
  );
}
