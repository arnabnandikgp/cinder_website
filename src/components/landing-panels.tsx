"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  LockKeyhole,
  Vault,
} from "lucide-react";
import tradePreview from "../../public/previews/cinder-trade.png";
import proPreview from "../../public/previews/cinder-pro.png";
import accountPreview from "../../public/previews/cinder-account.png";
import { site } from "@/lib/site";

const modes = {
  standard: {
    name: "Standard",
    description:
      "Choose your venue and trade with the chart, order book and controls you know.",
    href: "/demo",
    image: tradePreview,
    alt: "Standard terminal preview with a selected venue, chart, order book and order entry.",
    context: "Your chosen venue",
  },
  pro: {
    name: "Pro",
    description:
      "Compare liquidity and estimated trading costs for your size, across the venues you choose.",
    href: "/demo?mode=auto",
    image: proPreview,
    alt: "Pro terminal preview comparing venue-local execution cost estimates for a 100,000 USDC order.",
    context: "Your allowed venues",
  },
};

export function TradingStory() {
  const [mode, setMode] = useState<keyof typeof modes>("standard");
  const selected = modes[mode];
  return (
    <div className="trading-story" data-mode={mode}>
      <div className="trading-story-copy">
        <h2 id="trading-title">
          Your venue.
          <br />
          <span className="heading-accent">Or a wider view.</span>
        </h2>
        <div
          className="trading-mode-switch"
          role="group"
          aria-label="Trading mode preview"
        >
          {(Object.keys(modes) as (keyof typeof modes)[]).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={mode === value}
              aria-controls="trading-preview"
              onClick={() => setMode(value)}
            >
              {modes[value].name}
            </button>
          ))}
        </div>
        <div
          className="trading-mode-copy"
          aria-live="polite"
          aria-atomic="true"
        >
          <p>{selected.description}</p>
          <Link className="text-link" href={selected.href}>
            Explore {selected.name} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <figure
        className="trading-preview"
        id="trading-preview"
        aria-label={`${selected.name} trading preview`}
      >
        <figcaption>
          <span>Cinder terminal</span>
          <span className="trading-context">
            <span aria-hidden="true" />
            {selected.context}
          </span>
        </figcaption>
        <div className="trading-preview-crop">
          {Object.entries(modes).map(([value, config]) => (
            <Image
              key={value}
              src={config.image}
              alt={config.alt}
              hidden={mode !== value}
              sizes="(max-width: 800px) 1000px, 960px"
            />
          ))}
        </div>
      </figure>
    </div>
  );
}

// Product imagery is separate from the illustrative activity controls: no
// fabricated customer balances or performance figures are added to the page.
const activities = [
  {
    id: "order",
    title: "Order placed",
    description: "SOL-PERP · Pacifica",
    icon: ArrowUpRight,
  },
  {
    id: "fill",
    title: "Order filled",
    description: "Execution recorded",
    icon: Check,
  },
  {
    id: "fee",
    title: "Fee recorded",
    description: "Included in account activity",
    icon: Check,
  },
];

export function AccountStory() {
  const [selected, setSelected] = useState("fill");
  const event = activities.find((item) => item.id === selected)!;
  return (
    <div className="account-story">
      <figure className="account-product-preview">
        <Image
          src={accountPreview}
          alt="Cinder Account demo with equity, margin and positions grouped by execution venue."
          sizes="(max-width: 800px) 1000px, 900px"
        />
      </figure>
      <div
        className="account-activity"
        aria-label="Illustrative order activity"
      >
        <div className="account-activity-heading">
          <span className="account-activity-dot" aria-hidden="true" />
          <h3>Every move, connected.</h3>
        </div>
        <p className="account-activity-market">
          SOL-PERP <span>Pacifica</span>
        </p>
        <div
          className="account-activity-list"
          role="group"
          aria-label="Order activity preview"
        >
          {activities.map((item) => (
            <button
              key={item.id}
              type="button"
              className="account-activity-event"
              aria-pressed={selected === item.id}
              aria-controls="account-event-detail"
              onClick={() => setSelected(item.id)}
            >
              <span className="account-event-icon">
                <item.icon size={16} aria-hidden="true" />
              </span>
              <span>{item.title}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div
          className="account-event-detail"
          id="account-event-detail"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>{event.title}</span>
          <p>{event.description}</p>
        </div>
        <Link href="/demo?view=activity" className="text-link">
          Open the timeline <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

const trustLayers = [
  {
    name: "Account processing",
    detail: "TEE-backed confidentiality",
    icon: LockKeyhole,
    label: "Security",
    href: `${site.docs}/security/privacy`,
  },
  {
    name: "Vault controls",
    detail: "Solana vault and recovery",
    icon: Vault,
    label: "Documentation",
    href: site.docs,
  },
  {
    name: "Verification",
    detail: "Public code and documentation",
    icon: Code2,
    label: "GitHub",
    href: site.github,
  },
];

export function TrustStory() {
  const [selected, setSelected] = useState(0);
  const layer = trustLayers[selected];
  return (
    <div className="trust-story">
      <div
        className="trust-layers"
        role="group"
        aria-label="Explore Cinder’s architecture"
      >
        {trustLayers.map((item, index) => (
          <button
            key={item.name}
            type="button"
            aria-pressed={selected === index}
            aria-controls="trust-resource"
            onClick={() => setSelected(index)}
          >
            <item.icon size={25} strokeWidth={1.5} aria-hidden="true" />
            <span>
              <strong>{item.name}</strong>
              <span>{item.detail}</span>
            </span>
            <span className="trust-layer-number" aria-hidden="true">
              0{index + 1}
            </span>
          </button>
        ))}
      </div>
      <div
        className="trust-resource"
        id="trust-resource"
        aria-live="polite"
        aria-atomic="true"
      >
        <span>{layer.name}</span>
        <a
          className="text-link"
          href={layer.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {layer.label} <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
