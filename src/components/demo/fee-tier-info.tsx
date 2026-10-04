"use client";

import { useState } from "react";
import { Info, ArrowUpRight } from "lucide-react";
import { DetailList, Modal } from "./controls";
import { number, venues, type Venue } from "./data";
import { volumeRequirement, type VenueFee } from "./market-data/fees";

export function FeeTierInfo({
  venue,
  fee,
}: {
  venue: Venue;
  fee?: VenueFee | null;
}) {
  const [open, setOpen] = useState(false);
  const tier = fee?.volumeTier;
  if (!fee || !tier)
    return <span className="d-fee-info-space" aria-hidden="true" />;
  return (
    <>
      <button
        type="button"
        className="d-fee-tier-info"
        aria-label={`${venues[venue]} volume-tier fee information`}
        aria-haspopup="dialog"
        title="Lowest volume-tier rate assumed"
        onClick={() => setOpen(true)}
      >
        <Info size={15} aria-hidden="true" />
      </button>
      {open && (
        <Modal
          title={`${venues[venue]} volume-tier fees`}
          eyebrow="FEE ASSUMPTION"
          onClose={() => setOpen(false)}
        >
          <p>
            This demo assumes pooled account volume qualifies for the lowest
            taker rate in the venue’s active schedule. Cinder’s eligibility has
            not been verified.
          </p>
          <DetailList
            rows={[
              [
                "Applied taker rate",
                `${number(fee.takerBps / 100, 3)}% · ${number(fee.takerBps)} bps`,
              ],
              [
                "Public base taker rate",
                `${number(tier.baseTakerBps / 100, 3)}% · ${number(tier.baseTakerBps)} bps`,
              ],
              ["Selected tier", tier.tier],
              ["Qualifying account volume", volumeRequirement(tier)],
              [
                "Volume window",
                `${tier.windowDays} ${tier.completedUtcDays ? "completed UTC days" : "rolling days"}`,
              ],
            ]}
          />
          <p>
            Fee cost is calculated on the estimated fill and normalized to the
            shared reference, so its bps can differ slightly from this rate.
            Maker rebates and Cinder pricing are not included.
          </p>
          <a
            className="d-button d-fee-doc-link"
            href={tier.docs}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read {venues[venue]}’s fee schedule{" "}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </Modal>
      )}
    </>
  );
}
