"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  Code2,
  EyeOff,
  Fingerprint,
  Layers3,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Mark } from "./ui";

function useDiagramMotion() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  return { ref, reduceMotion };
}

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
      aria-label="Conceptual order flow: a trader sends an encrypted instruction to Cinder. Private account state stays in Cinder while executable orders reach venue liquidity and fills return."
    >
      <div className="network-stage" ref={stageRef}>
        <HeroConnections stageRef={stageRef} />
        <div className="trader-node">
          <div className="node-icon">
            <Code2 size={24} strokeWidth={1.4} />
          </div>
          <strong>Your strategy</strong>
          <span>Signed + encrypted</span>
        </div>
        <div className="account-node">
          <div className="account-heading">
            <Mark />
            <span>Cinder</span>
            <LockKeyhole size={14} />
          </div>
          <div className="account-caption">YOUR PRIVATE ACCOUNT</div>
          <div className="private-row">
            <span>Balances</span>
            <span>••••••</span>
          </div>
          <div className="private-row">
            <span>Positions</span>
            <span>••••••</span>
          </div>
          <div className="private-row">
            <span>Open orders</span>
            <span>••••••</span>
          </div>
          <div className="account-status">
            <ShieldCheck size={12} />
            <span>Confidential by design</span>
            <span className="account-update" aria-hidden="true">
              <Check size={12} />
              Private account updated
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

const steps = [
  {
    icon: Fingerprint,
    title: "Send",
    label: "SIGNED BY YOU",
    description: "The trader signs and encrypts a trading instruction.",
    detail: "Encrypted instruction",
  },
  {
    icon: ShieldCheck,
    title: "Execute",
    label: "PRIVATE BY DESIGN",
    description:
      "Cinder evaluates the account, manages risk, and selects an execution path inside its confidential runtime.",
    detail: "Private risk evaluation",
  },
  {
    icon: CheckCheck,
    title: "Settle",
    label: "CONNECTED TO THE MARKET",
    description:
      "The order executes on the selected venue. The resulting position, fill, fee, and funding activity return to the trader’s private Cinder account.",
    detail: "Venue execution + private update",
  },
];

export function ExecutionFlow() {
  const { ref, reduceMotion } = useDiagramMotion();
  const seen = useInView(ref, { once: true, amount: 0.3 });
  return (
    <div ref={ref} className="execution-flow">
      {steps.map((step, index) => (
        <div className="execution-step" key={step.title}>
          <div className="execution-track">
            <motion.div
              className="execution-icon"
              initial={false}
              animate={{
                borderColor: seen ? "var(--cobalt)" : "var(--border)",
                backgroundColor: seen ? "var(--cobalt-tint)" : "var(--surface)",
              }}
              transition={{
                duration: reduceMotion ? 0 : 0.35,
                delay: reduceMotion ? 0 : index * 0.65,
              }}
            >
              <step.icon size={26} strokeWidth={1.3} />
            </motion.div>
            {index < 2 && (
              <div className="step-line">
                <motion.span
                  initial={false}
                  animate={{ scaleX: seen ? 1 : 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.6,
                    delay: reduceMotion ? 0 : index * 0.65 + 0.25,
                  }}
                />
                <ChevronRight size={14} />
              </div>
            )}
          </div>
          <span className="mono step-eyebrow">
            0{index + 1} / {step.label}
          </span>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
          <div className="step-detail">
            <LockKeyhole size={12} />
            {step.detail}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PooledVolume() {
  const { ref, reduceMotion } = useDiagramMotion();
  const seen = useInView(ref, { once: true, amount: 0.35 });
  const [replay, setReplay] = useState(0);
  return (
    <div ref={ref} className="pool-diagram">
      <div className="diagram-title">
        <span className="mono">THE POWER OF POOLED VOLUME</span>
        <button
          onClick={() => setReplay((n) => n + 1)}
          className="replay-button"
          aria-label="Replay pooled volume animation"
        >
          <RotateCcw size={14} />
          <span>Replay</span>
        </button>
      </div>
      <div className="pool-traders">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="pool-trader" key={i}>
            <UserRound size={18} strokeWidth={1.5} />
            <span>Trader {String(i + 1).padStart(2, "0")}</span>
            <div className="individual-volume">
              <span style={{ width: `${25 + i * 13}%` }} />
            </div>
          </div>
        ))}
      </div>
      <svg
        className="pool-lines"
        viewBox="0 0 500 64"
        fill="none"
        aria-hidden="true"
      >
        {[50, 150, 250, 350, 450].map((x, i) => (
          <g key={x}>
            <path
              className="connection"
              d={`M${x} 0 V12 Q${x} 30 ${x < 250 ? x + 20 : x > 250 ? x - 20 : 250} 30 H230 Q250 30 250 50 V64`}
            />
            <motion.path
              key={`${replay}-${i}`}
              d={`M${x} 0 V12 Q${x} 30 ${x < 250 ? x + 20 : x > 250 ? x - 20 : 250} 30 H230 Q250 30 250 50 V64`}
              stroke="var(--cobalt)"
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: seen ? 1 : 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.7,
                delay: reduceMotion ? 0 : i * 0.12,
              }}
            />
          </g>
        ))}
      </svg>
      <div className="pool-account">
        <div className="pool-account-heading">
          <span>
            <Mark />
            Cinder pooled volume
          </span>
          <LockKeyhole size={15} />
        </div>
        <div className="pool-bar">
          <motion.div
            key={replay}
            initial={reduceMotion ? false : { scaleX: 0.16 }}
            animate={{ scaleX: seen ? 1 : 0.16 }}
            transition={{
              duration: reduceMotion ? 0 : 1.5,
              delay: reduceMotion ? 0 : 0.7,
              ease: "easeOut",
            }}
          />
          <span className="tier-marker" />
        </div>
        <div className="pool-bar-labels">
          <span>Qualifying venue volume</span>
          <span>
            <Check size={13} />
            Better fee tier
          </span>
        </div>
      </div>
      <div className="pool-output">
        <ArrowDown size={18} />
        <span>VENUE LIQUIDITY</span>
        <Layers3 size={18} />
      </div>
    </div>
  );
}

const visibility = [
  {
    name: "You",
    icon: UserRound,
    label: "Complete visibility. Yours alone.",
    description:
      "Access your balances, positions, open orders, and trading history through your private Cinder account.",
    cells: [true, true, true, true],
  },
  {
    name: "Selected venue",
    icon: Layers3,
    label: "Only what execution requires.",
    description:
      "The venue receives the executable order, without the end user’s full Cinder portfolio or account history.",
    cells: [false, false, true, false],
  },
  {
    name: "Operators",
    icon: Code2,
    label: "Operation without account visibility.",
    description:
      "Cinder is designed to keep account state confidential from ordinary operators and infrastructure providers.",
    cells: [false, false, false, false],
  },
  {
    name: "Public observers",
    icon: EyeOff,
    label: "Your broader strategy stays private.",
    description:
      "Public venue activity does not expose the end user’s complete private Cinder account. Public execution and settlement remain subject to venue design.",
    cells: [false, false, false, false],
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
              "Balances",
              "Positions",
              "Execution order",
              "Account history",
            ].map((label, i) => (
              <div
                key={label}
                className={current.cells[i] ? "visible-cell" : "private-cell"}
              >
                {current.cells[i] ? (
                  <Check size={18} />
                ) : (
                  <LockKeyhole size={17} />
                )}
                <span>{label}</span>
                <small>{current.cells[i] ? "Visible" : "Private"}</small>
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
      aria-label="Cinder’s vision: a private account connecting an expanding network of venues through unified execution and, eventually, private clearing."
    >
      <div className="vision-orbit orbit-outer" />
      <div className="vision-orbit orbit-inner" />
      <div className="vision-center">
        <Mark />
        <span>One private account</span>
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
  type: "private" | "fees" | "liquidity" | "code";
}) {
  if (type === "private")
    return (
      <div className="mini-private" aria-hidden="true">
        <div>
          <LockKeyhole size={14} />
          <span>PRIVATE ACCOUNT</span>
          <ShieldCheck size={15} />
        </div>
        {["Balances", "Positions"].map((label) => (
          <p key={label}>
            <span>{label}</span>
            <span>••••••••</span>
          </p>
        ))}
      </div>
    );
  if (type === "fees")
    return (
      <div className="mini-fees" aria-hidden="true">
        <div className="fee-bars">
          {[25, 40, 34, 55, 65, 78, 100].map((height, i) => (
            <span key={i} style={{ height: `${height}%` }} />
          ))}
        </div>
        <div className="fee-guide">
          <span>NETWORK SCALE</span>
          <ArrowUpRight size={15} />
        </div>
      </div>
    );
  if (type === "liquidity")
    return (
      <div className="mini-liquidity" aria-hidden="true">
        <span className="mini-center">
          <Mark />
        </span>
        <span className="mini-connector" />
        {[0, 1, 2].map((i) => (
          <span className={`mini-venue mv-${i}`} key={i}>
            <Layers3 size={16} />
          </span>
        ))}
      </div>
    );
  return (
    <div className="mini-code" aria-hidden="true">
      <div>
        <span className="code-blue">cinder</span>.orders.create({"{"}
      </div>
      <div>
        &nbsp; market: <span>&quot;SOL-PERP&quot;</span>,
      </div>
      <div>
        &nbsp; privacy: <span>&quot;by default&quot;</span>
      </div>
      <div>
        {"}"})<span className="code-caption">ILLUSTRATIVE INTERFACE</span>
      </div>
    </div>
  );
}
