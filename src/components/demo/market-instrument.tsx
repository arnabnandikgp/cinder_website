"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { markets, type Market } from "./data";

/** The same market identity in Standard and Pro; venue identity stays separate. */
export function MarketInstrument({
  id,
  market,
  leverage,
  onMarket,
  children,
}: {
  id: string;
  market: Market;
  leverage: string;
  onMarket: (value: Market) => void;
  children?: ReactNode;
}) {
  return (
    <div className="d-instrument">
      <Image
        className="d-asset-icon"
        src={`/brand/assets/${market.toLowerCase()}.svg`}
        width={32}
        height={32}
        alt=""
        unoptimized
      />
      <div>
        <div className="d-instrument-line">
          <label className="d-sr-only" htmlFor={id}>
            Market
          </label>
          <select
            id={id}
            value={market}
            onChange={(event) => onMarket(event.target.value as Market)}
          >
            {Object.keys(markets).map((key) => (
              <option key={key} value={key}>
                {key}-USDC
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
          {children}
        </div>
      </div>
    </div>
  );
}
