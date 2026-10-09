import Image from "next/image";
import { LockKeyhole } from "lucide-react";
import { Mark } from "./ui";

const venues = [
  { id: "bulk", name: "BULK", detail: "Volume-based fee tiers" },
  { id: "pacifica", name: "Pacifica", detail: "Volume-based fee tiers" },
  { id: "phoenix", name: "Phoenix", detail: "Additional venue liquidity" },
];

// Account records stay within the private boundary. Only order flow leaves it;
// the diagram does not imply pooled positions or shared cross-venue collateral.
export function BrokerageDiagram() {
  return (
    <figure
      className="brokerage-map"
      aria-label="Private Cinder accounts and shared execution at each venue"
    >
      <div className="brokerage-private">
        <div className="brokerage-map-label">
          <LockKeyhole size={17} aria-hidden="true" />
          Private Cinder accounts
        </div>
        <div className="brokerage-private-flow">
          <div className="brokerage-accounts">
            {["01", "02", "03"].map((account) => (
              <div className="brokerage-account" key={account}>
                <span>Account {account}</span>
                <span>Individual positions</span>
              </div>
            ))}
          </div>
          <svg
            className="brokerage-converge"
            viewBox="0 0 100 180"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 30 H28 L100 90 M0 90 H100 M0 150 H28 L100 90" />
          </svg>
          <div className="brokerage-hub">
            <Mark />
            <span>Cinder</span>
            <small>Order flow</small>
          </div>
        </div>
        <p>Separate records. Confidential bookkeeping.</p>
      </div>
      <div className="brokerage-venues">
        <div className="brokerage-map-label">
          Shared execution at each venue
        </div>
        <svg
          className="brokerage-branches"
          viewBox="0 0 100 180"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 90 H20 L80 30 H100 M20 90 H100 M20 90 L80 150 H100" />
        </svg>
        <div className="brokerage-venue-list">
          {venues.map((venue) => (
            <div className="brokerage-venue" key={venue.id}>
              <Image
                src={`/brand/venues/${venue.id}.svg`}
                alt=""
                width={32}
                height={32}
                unoptimized
              />
              <div>
                <span>{venue.name}</span>
                <small>{venue.detail}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
      <figcaption>
        Individual accounts stay distinct. Qualifying volume combines at each
        eligible venue, not across venues.
      </figcaption>
    </figure>
  );
}
