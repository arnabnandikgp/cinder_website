"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronRight,
  EyeOff,
  Layers3,
  LockKeyhole,
  Route,
  Send,
  UserRound,
} from "lucide-react";
import { Mark } from "./ui";

function HeroConnections({
  stageRef,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
}) {
  const [layout, setLayout] = useState<{
    width: number;
    height: number;
    vertical: boolean;
    incoming: string;
    venues: string[];
    returning: string;
    labelX: number;
    labelY: number;
  } | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const trader = stage.querySelector<HTMLElement>(".trader-node")!;
    const icon = stage.querySelector<HTMLElement>(".node-icon")!;
    const account = stage.querySelector<HTMLElement>(".account-node")!;
    const venues = Array.from(
      stage.querySelectorAll<HTMLElement>(".venue-node"),
    );

    const measure = () => {
      const bounds = stage.getBoundingClientRect();
      const relative = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        return {
          x: box.left - bounds.left,
          y: box.top - bounds.top,
          width: box.width,
          height: box.height,
        };
      };
      const vertical = getComputedStyle(stage).flexDirection === "column";
      const source = relative(vertical ? trader : icon);
      const cinder = relative(account);
      const destinations = venues.map(relative);
      const curve = (sx: number, sy: number, ex: number, ey: number) =>
        vertical
          ? `M${sx} ${sy} C${sx} ${(sy + ey) / 2} ${ex} ${(sy + ey) / 2} ${ex} ${ey}`
          : `M${sx} ${sy} C${(sx + ex) / 2} ${sy} ${(sx + ex) / 2} ${ey} ${ex} ${ey}`;
      const incoming = vertical
        ? curve(
            source.x + source.width / 2,
            source.y + source.height,
            cinder.x + cinder.width / 2,
            cinder.y,
          )
        : curve(
            source.x + source.width,
            source.y + source.height / 2,
            cinder.x,
            cinder.y + cinder.height / 2,
          );
      const routes = destinations.map((venue, index) => {
        const port = (index + 1) / 4;
        return vertical
          ? curve(
              cinder.x + cinder.width * port,
              cinder.y + cinder.height,
              venue.x + venue.width / 2,
              venue.y,
            )
          : curve(
              cinder.x + cinder.width,
              cinder.y + cinder.height * port,
              venue.x,
              venue.y + venue.height / 2,
            );
      });
      const selected = destinations[1];
      const returning = vertical
        ? curve(
            selected.x + selected.width / 2 + 5,
            selected.y,
            cinder.x + cinder.width / 2 + 5,
            cinder.y + cinder.height,
          )
        : curve(
            selected.x,
            selected.y + selected.height / 2 + 8,
            cinder.x + cinder.width,
            cinder.y + cinder.height / 2 + 8,
          );
      setLayout({
        width: bounds.width,
        height: bounds.height,
        vertical,
        incoming,
        venues: routes,
        returning,
        labelX: vertical
          ? cinder.x + cinder.width / 2
          : (cinder.x + cinder.width + selected.x) / 2,
        labelY: vertical
          ? (cinder.y + cinder.height + selected.y) / 2
          : (cinder.y + cinder.height / 2 + selected.y + selected.height / 2) /
            2,
      });
    };

    // Track both responsive positions and content/font-driven changes in node size.
    const observer = new ResizeObserver(measure);
    [stage, trader, icon, account, ...venues].forEach((node) =>
      observer.observe(node),
    );
    measure();
    return () => observer.disconnect();
  }, [stageRef]);

  if (!layout) return null;
  return (
    <>
      <svg
        className="hero-connectors"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        fill="none"
        aria-hidden="true"
      >
        <path className="connection strategy-connection" d={layout.incoming} />
        {layout.venues.map((path, index) => (
          <path key={index} className="connection venue-connection" d={path} />
        ))}
        <path className="flow flow-in" pathLength="1" d={layout.incoming} />
        <path className="flow flow-out" pathLength="1" d={layout.venues[1]} />
        <path
          className="flow flow-return"
          pathLength="1"
          d={layout.returning}
        />
      </svg>
      <span
        className="route-label"
        style={{
          left: layout.labelX - (layout.vertical ? 43 : 15),
          top: layout.labelY - (layout.vertical ? 6 : 19),
        }}
      >
        {layout.vertical ? "Order ↓" : "Order →"}
      </span>
      <span
        className="return-label"
        style={{
          left: layout.labelX + (layout.vertical ? 14 : -15),
          top: layout.labelY + (layout.vertical ? -6 : 15),
        }}
      >
        {layout.vertical ? "↑ Fill" : "← Fill"}
      </span>
    </>
  );
}

export function HeroNetwork() {
  const stageRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className="hero-network"
      role="group"
      aria-label="Conceptual prime broker flow: a trader sends an instruction to one Cinder account. Cinder routes an order to a connected perp venue and records the result for the trader. Venue integrations are in development."
    >
      <div className="network-stage" ref={stageRef}>
        <HeroConnections stageRef={stageRef} />
        <div className="trader-node">
          <div className="node-icon">
            <Send size={24} strokeWidth={1.4} />
          </div>
          <strong>Trader</strong>
          <span>Trading instruction</span>
        </div>
        <div className="account-node">
          <div className="account-heading">
            <Mark />
            <span>Cinder</span>
            <Route size={14} />
          </div>
          <div className="account-caption">ONE TRADING ACCOUNT</div>
          <div className="private-row">
            <span>Orders</span>
            <span>Unified view</span>
          </div>
          <div className="private-row">
            <span>Positions</span>
            <span>Unified view</span>
          </div>
          <div className="private-row">
            <span>Routing</span>
            <span>Connected venues</span>
          </div>
          <div className="account-status">
            <Route size={12} />
            <span>Prime broker layer</span>
            <span className="account-update" aria-hidden="true">
              <Check size={12} />
              Account updated
            </span>
          </div>
        </div>
        <div className="venue-node venue-one">
          <Layers3 size={18} />
          <div>
            <strong>Perp venue 01</strong>
            <span>Available liquidity</span>
          </div>
          <i />
        </div>
        <div className="venue-node venue-two">
          <Layers3 size={18} />
          <div>
            <strong>Perp venue 02</strong>
            <span>Selected route</span>
          </div>
          <i />
        </div>
        <div className="venue-node venue-three">
          <Layers3 size={18} />
          <div>
            <strong>Perp venue 03</strong>
            <span>Available liquidity</span>
          </div>
          <i />
        </div>
      </div>
    </div>
  );
}

export function Fragmentation() {
  return (
    <div
      className="fragmentation"
      role="img"
      aria-label="One trader manages three disconnected venue accounts, each with separate collateral, positions, API, and fee tiers."
    >
      <div className="fragment-trader">
        <UserRound size={18} />
        <span>One trader</span>
      </div>
      <div className="fragment-branches" />
      <div className="fragment-venues">
        {["01", "02", "03"].map((n) => (
          <div className="fragment-venue" key={n}>
            <div className="fragment-venue-title">
              <Layers3 size={15} />
              <span>VENUE {n}</span>
            </div>
            {["Balance", "Positions", "API", "Fee tier"].map((label) => (
              <div className="fragment-row" key={label}>
                <span>{label}</span>
                <span className="fragment-blocks">▪▪▪</span>
              </div>
            ))}
            <span className="fragment-isolated">Separate account</span>
          </div>
        ))}
      </div>
      <div className="fragment-caption">
        <span />
        Fragmented capital. Fragmented execution.
        <span />
      </div>
    </div>
  );
}

const visibility = [
  {
    name: "You",
    icon: UserRound,
    label: "Your Cinder account view.",
    description:
      "The planned account experience brings your balances, positions, orders, and history together in one view.",
    cells: ["visible", "visible", "visible", "visible"],
  },
  {
    name: "Selected venue",
    icon: Layers3,
    label: "The information needed to execute.",
    description:
      "The venue sees the order and any other data its execution requires. Cinder aims not to share the trader’s complete Cinder portfolio or account history.",
    cells: ["limited", "limited", "visible", "limited"],
  },
  {
    name: "Operators",
    icon: Route,
    label: "Routine access is designed to be limited.",
    description:
      "The attested runtime is intended to keep individual account state and routing decisions from ordinary operators and infrastructure providers.",
    cells: ["limited", "limited", "limited", "limited"],
  },
  {
    name: "Public observers",
    icon: EyeOff,
    label: "Venue-level visibility may vary.",
    description:
      "Cinder aims to avoid linking public activity to a trader’s full Cinder account. Order and settlement visibility still depend on the venue.",
    cells: ["limited", "limited", "depends", "limited"],
  },
];

export function PrivacyMap() {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const current = visibility[selected];
  return (
    <div className="privacy-map">
      <div className="privacy-map-header">
        <LockKeyhole size={16} />
        <span className="mono">VISIBILITY, BY DESIGN</span>
      </div>
      <div className="privacy-map-body">
        <div
          className="visibility-roles"
          aria-label="Explore account visibility"
        >
          {visibility.map((role, i) => (
            <button
              key={role.name}
              aria-pressed={selected === i}
              aria-controls={`${id}-detail`}
              onClick={() => setSelected(i)}
              onFocus={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
            >
              <role.icon size={17} />
              <span>{role.name}</span>
              <ChevronRight size={13} />
            </button>
          ))}
        </div>
        <div className="visibility-detail" id={`${id}-detail`}>
          <div className="visibility-grid">
            {[
              "Account balances",
              "Individual positions",
              "Execution order",
              "Account history",
            ].map((label, i) => (
              <div
                key={label}
                className={
                  current.cells[i] === "visible"
                    ? "visible-cell"
                    : "private-cell"
                }
              >
                {current.cells[i] === "visible" ? (
                  <Check size={18} />
                ) : (
                  <LockKeyhole size={17} />
                )}
                <span>{label}</span>
                <small>
                  {current.cells[i] === "visible"
                    ? "Visible"
                    : current.cells[i] === "depends"
                      ? "Venue-dependent"
                      : "Limited by design"}
                </small>
              </div>
            ))}
          </div>
          <div className="visibility-description" aria-live="polite">
            <strong>{current.label}</strong>
            <p>{current.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VisionNetwork() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.35 });
  const reduced = useReducedMotion();
  return (
    <div
      ref={ref}
      className="vision-network"
      role="img"
      aria-label="Cinder’s long-term vision: one trader-facing account connected to an expanding network of perp venues, with deeper risk management and a future clearing layer."
    >
      <div className="vision-orbit orbit-outer" />
      <div className="vision-orbit orbit-inner" />
      <div className="vision-center">
        <Mark />
        <span>One Cinder account</span>
      </div>
      <svg viewBox="0 0 560 390" fill="none" aria-hidden="true">
        {[
          [100, 85],
          [445, 90],
          [70, 245],
          [475, 260],
          [285, 348],
        ].map(([x, y], index) => (
          <motion.path
            key={x}
            d={`M280 190 L${x} ${y}`}
            stroke="var(--cobalt)"
            strokeOpacity=".5"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: seen ? 1 : 0 }}
            transition={{
              duration: reduced ? 0 : 0.8,
              delay: reduced ? 0 : index * 0.15,
            }}
          />
        ))}
      </svg>
      {["01", "02", "03", "04", "05"].map((n, i) => (
        <div className={`vision-venue vv-${i}`} key={n}>
          <Layers3 size={18} />
          <span>VENUE {n}</span>
        </div>
      ))}
    </div>
  );
}

export function AdvantageMini({
  type,
}: {
  type: "account" | "fees" | "liquidity";
}) {
  if (type === "liquidity")
    return (
      <figure className="benefit-visual">
        <svg
          viewBox="0 0 336 170"
          role="img"
          aria-label="Your strategy connects to Cinder routing, with separate paths from Cinder to three conceptual perp venues."
        >
          <g className="benefit-path">
            <path d="M79 86 H104" />
            <path d="M204 64 C224 64 224 26 246 26" />
            <path
              className="is-selected"
              d="M204 86 H246 M240 82 L246 86 L240 90"
            />
            <path d="M204 108 C224 108 224 146 246 146" />
          </g>
          <rect
            className="benefit-node"
            x="1"
            y="64"
            width="78"
            height="44"
            rx="3"
          />
          <text x="40" y="82" textAnchor="middle">
            Your
          </text>
          <text x="40" y="98" textAnchor="middle">
            strategy
          </text>
          <rect
            className="benefit-node is-selected"
            x="104"
            y="50"
            width="100"
            height="72"
            rx="3"
          />
          <text className="benefit-primary" x="154" y="81" textAnchor="middle">
            Cinder
          </text>
          <text x="154" y="101" textAnchor="middle">
            routing
          </text>
          {["A", "B", "C"].map((venue, i) => (
            <g key={venue}>
              <rect
                className={`benefit-node${i === 1 ? " is-selected" : ""}`}
                x="246"
                y={9 + i * 60}
                width="89"
                height="34"
                rx="3"
              />
              <text x="290" y={31 + i * 60} textAnchor="middle">
                Venue {venue}
              </text>
            </g>
          ))}
        </svg>
        <figcaption>One interface. Connected liquidity.</figcaption>
      </figure>
    );
  if (type === "fees")
    return (
      <figure className="benefit-visual">
        <svg
          viewBox="0 0 336 170"
          role="img"
          aria-label="Qualifying activity from several traders contributes to Cinder’s combined volume at one venue. Fee-tier eligibility is determined per venue."
        >
          <g className="benefit-path">
            <path d="M82 30 C114 30 114 86 145 86" />
            <path d="M82 86 H145" />
            <path d="M82 142 C114 142 114 86 145 86" />
          </g>
          {["A", "B", "C"].map((trader, i) => (
            <g key={trader}>
              <rect
                className="benefit-node"
                x="1"
                y={13 + i * 56}
                width="81"
                height="34"
                rx="3"
              />
              <text x="41" y={35 + i * 56} textAnchor="middle">
                Trader {trader}
              </text>
            </g>
          ))}
          <rect
            className="benefit-node is-selected"
            x="145"
            y="37"
            width="190"
            height="100"
            rx="3"
          />
          <text className="benefit-primary" x="240" y="63" textAnchor="middle">
            Qualifying volume
          </text>
          {[0, 1, 2].map((i) => (
            <rect
              className="benefit-volume"
              key={i}
              x={165 + i * 51}
              y="78"
              width="47"
              height="16"
              rx="1"
            />
          ))}
          <text x="240" y="119" textAnchor="middle">
            At the same venue
          </text>
        </svg>
        <figcaption>Shared volume. Fee-tier potential.</figcaption>
      </figure>
    );
  return (
    <figure className="benefit-visual">
      <svg
        viewBox="0 0 336 170"
        role="img"
        aria-label="Execution activity from separate venues is recorded in the trader’s individual Cinder account, with orders and positions in one view."
      >
        {["A", "B", "C"].map((venue, i) => (
          <g key={venue}>
            <rect
              className="benefit-node"
              x="1"
              y={19 + i * 52}
              width="80"
              height="34"
              rx="3"
            />
            <text x="41" y={41 + i * 52} textAnchor="middle">
              Venue {venue}
            </text>
            <path className="benefit-path" d={`M81 ${36 + i * 52} H119`} />
          </g>
        ))}
        <rect
          className="benefit-node is-selected"
          x="119"
          y="8"
          width="216"
          height="154"
          rx="3"
        />
        <text className="benefit-primary" x="136" y="34">
          Your Cinder account
        </text>
        <path className="benefit-path" d="M120 48 H334" />
        {["Orders", "Positions", "Trading history"].map((label, i) => (
          <g key={label}>
            <text x="136" y={74 + i * 33}>
              {label}
            </text>
            <path
              className="benefit-path is-selected"
              d={`M302 ${68 + i * 33} l4 4 8 -8`}
            />
          </g>
        ))}
      </svg>
      <figcaption>Your activity. Your account record.</figcaption>
    </figure>
  );
}
