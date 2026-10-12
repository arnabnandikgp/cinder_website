"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Bot, LockKeyhole } from "lucide-react";
import { Mark } from "./ui";
import styles from "./brokerage-diagram.module.css";

const DURATION = 9600;
// The forward choreography is 30% quicker. Hold the result long enough to
// read it, then retrace the connections smoothly instead of cutting to start.
const FORWARD_DURATION = DURATION / 1.3;
const RESULT_HOLD = 2200;
const RETURN_DURATION = 1400;
const CYCLE_DURATION = FORWARD_DURATION + RESULT_HOLD + RETURN_DURATION;
const participants = [
  { id: "trader-1", kind: "trader", label: "Trader" },
  { id: "agent-1", kind: "agent", label: "Agent" },
  { id: "trader-2", kind: "trader", label: "Trader" },
  { id: "agent-2", kind: "agent", label: "Agent" },
  { id: "trader-3", kind: "trader", label: "Trader" },
];
const venues = [
  { id: "pacifica", name: "Pacifica" },
  { id: "bulk", name: "BULK" },
  { id: "phoenix", name: "Phoenix" },
];
const fraction = (time: number, start: number, end: number) =>
  Math.min(1, Math.max(0, (time - start) / (end - start)));
const smooth = (value: number) => value * value * (3 - 2 * value);
const phaseAt = (time: number) =>
  time < 1500 ? 0 : time < 4500 ? 1 : time < 6500 ? 2 : time < DURATION ? 3 : 4;

// Matching SVG commands let each direct connection genuinely change its route.
// The middle segment passes behind the opaque private-account boundary; it
// does not display customer records or identities flowing out to the venues.
function route(
  source: number,
  venue: number,
  amount: number,
  vertical: boolean,
) {
  const mix = (a: number, b: number) => (a + (b - a) * amount).toFixed(2);
  if (vertical) {
    const x = 36 + source * 72;
    const endX = 60 + venue * 120;
    const middle = 32 + ((source * 3 + venue) % 7) * 49;
    return `M${x} 124 C${x} 184 ${mix(middle, 180)} 194 ${mix(middle, 180)} ${mix(390, 240)} L${mix(middle, 180)} ${mix(390, 540)} C${mix(middle, 180)} 590 ${endX} 600 ${endX} 650`;
  }
  const y = 72 + source * 72;
  const endY = 108 + venue * 108;
  const middle = (y + endY) / 2 + (source % 2 === 0 ? -28 : 28);
  return `M180 ${y} C260 ${y} 280 ${mix(middle, 216)} ${mix(500, 360)} ${mix(middle, 216)} L${mix(500, 640)} ${mix(middle, 216)} C720 ${mix(middle, 216)} 740 ${endY} 820 ${endY}`;
}

function MorphingRoute({
  time,
  source,
  venue,
  vertical,
}: {
  time: MotionValue<number>;
  source: number;
  venue: number;
  vertical: boolean;
}) {
  const d = useTransform(time, (value) =>
    route(source, venue, smooth(fraction(value, 1500, 4500)), vertical),
  );
  const opacity = useTransform(time, [0, 4000, 4700], [0.65, 0.65, 0]);
  return (
    <motion.path className={styles.directRoute} d={d} style={{ opacity }} />
  );
}

function Stream({
  time,
  d,
  start,
}: {
  time: MotionValue<number>;
  d: string;
  start: number;
}) {
  const offset = useTransform(
    time,
    (value) => 0.12 - fraction(value, start, start + 1400) * 1.24,
  );
  const opacity = useTransform(
    time,
    [start, start + 150, start + 1250, start + 1400],
    [0, 1, 1, 0],
  );
  return (
    <motion.path
      className={styles.stream}
      d={d}
      pathLength={1}
      style={{ opacity, strokeDashoffset: offset }}
    />
  );
}

function Connections({
  time,
  vertical = false,
}: {
  time: MotionValue<number>;
  vertical?: boolean;
}) {
  const opacity = useTransform(time, [4000, 4700], [0, 1]);
  const incoming = participants.map((_, index) =>
    vertical
      ? `M${36 + index * 72} 124 C${36 + index * 72} 184 180 194 180 240`
      : `M180 ${72 + index * 72} C260 ${72 + index * 72} 280 216 360 216`,
  );
  const outgoing = venues.map((_, index) =>
    vertical
      ? `M180 540 C180 590 ${60 + index * 120} 600 ${60 + index * 120} 650`
      : `M640 216 C720 216 740 ${108 + index * 108} 820 ${108 + index * 108}`,
  );
  return (
    <svg
      className={`${styles.connections} ${vertical ? styles.vertical : styles.horizontal}`}
      viewBox={vertical ? "0 0 360 760" : "0 0 1000 432"}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      {participants.flatMap((_, source) =>
        venues.map((_, venue) => (
          <MorphingRoute
            key={`${source}-${venue}`}
            time={time}
            source={source}
            venue={venue}
            vertical={vertical}
          />
        )),
      )}
      <motion.g className={styles.organizedRoutes} style={{ opacity }}>
        {incoming.map((d) => (
          <path d={d} key={d} />
        ))}
        {outgoing.map((d) => (
          <path d={d} key={d} />
        ))}
      </motion.g>
      {incoming.map((d, index) => (
        <Stream time={time} d={d} start={4700 + index * 120} key={d} />
      ))}
      {outgoing.map((d, index) => (
        <Stream time={time} d={d} start={6800 + index * 260} key={d} />
      ))}
    </svg>
  );
}

function AccountRecord({
  time,
  index,
}: {
  time: MotionValue<number>;
  index: number;
}) {
  const opacity = useTransform(
    time,
    [4500 + index * 180, 4900 + index * 180],
    [0, 1],
  );
  return (
    <motion.li className={styles.accountRecord} style={{ opacity }}>
      <span>Account 0{index + 1}</span>
      <span className={styles.privateRecord} aria-hidden="true">
        <i />
        <i />
        <i />
        <LockKeyhole size={12} aria-hidden="true" />
      </span>
    </motion.li>
  );
}

function VolumeBar({
  time,
  start,
}: {
  time: MotionValue<number>;
  start: number;
}) {
  const opacity = useTransform(time, [start, start + 200], [0.15, 1]);
  return <motion.i style={{ opacity }} />;
}

function VolumeMeter({
  time,
  venue,
}: {
  time: MotionValue<number>;
  venue: number;
}) {
  const opacity = useTransform(
    time,
    [6900 + venue * 260, 7250 + venue * 260],
    [0, 1],
  );
  return (
    <motion.div className={styles.volume} style={{ opacity }}>
      <span aria-hidden="true">
        {[0, 1, 2, 3, 4].map((bar) => (
          <VolumeBar
            time={time}
            start={7300 + venue * 260 + bar * 160}
            key={bar}
          />
        ))}
      </span>
      Pooled volume
    </motion.div>
  );
}

export function BrokerageDiagram() {
  // The server/no-JS and reduced-motion versions show the finished architecture.
  const time = useMotionValue(DURATION);
  const root = useRef<HTMLElement>(null);
  const started = useRef(false);
  const elapsed = useRef(0);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [returning, setReturning] = useState(false);
  const [phase, setPhase] = useState(4);
  useMotionValueEvent(time, "change", (value) => setPhase(phaseAt(value)));

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    const updatePreference = () => {
      setMotionAllowed(!preference.matches);
      if (preference.matches) {
        started.current = false;
        elapsed.current = 0;
        setReturning(false);
        time.set(DURATION);
      } else if (inView && !document.hidden && !started.current) {
        started.current = true;
        time.set(0);
      }
    };
    const updateVisibility = () => {
      const active = inView && !document.hidden;
      if (active && !started.current && !preference.matches) {
        started.current = true;
        time.set(0);
      }
      setVisible(active);
    };
    updatePreference();
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        updateVisibility();
      },
      { threshold: 0.25 },
    );
    observer.observe(element);
    preference.addEventListener("change", updatePreference);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", updatePreference);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, [time]);

  useEffect(() => {
    if (!visible || !motionAllowed) return;
    let frame = 0;
    let previous: number | undefined;
    const advance = (now: number) => {
      if (previous !== undefined) {
        elapsed.current = (elapsed.current + now - previous) % CYCLE_DURATION;
        const position = elapsed.current;
        const reversing = position > FORWARD_DURATION + RESULT_HOLD;
        setReturning(reversing);
        time.set(
          reversing
            ? DURATION *
                (1 -
                  smooth(
                    fraction(
                      position,
                      FORWARD_DURATION + RESULT_HOLD,
                      CYCLE_DURATION,
                    ),
                  ))
            : Math.min(DURATION, position * 1.3),
        );
      }
      previous = now;
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [visible, motionAllowed, time]);

  const hubOpacity = useTransform(time, [2400, 4000], [0, 1]);
  const hubScale = useTransform(
    time,
    (value) => 0.94 + 0.06 * smooth(fraction(value, 2400, 4000)),
  );
  const boundaryOpacity = useTransform(time, [4100, 4600], [0, 1]);
  const withCinder = phase >= 2;

  return (
    <figure
      ref={root}
      className={`brokerage-map ${styles.diagram}`}
      aria-label="Traders and agents connect through one Cinder brokerage layer to venue liquidity"
      data-phase={phase}
      data-playing={visible && motionAllowed}
      data-view={withCinder ? "cinder" : "today"}
      data-returning={returning}
    >
      <figcaption className={styles.heading}>
        <span className={styles.states} aria-hidden="true">
          <span data-active={!withCinder}>Today</span>
          <span data-active={withCinder}>With Cinder</span>
        </span>
        <span className={styles.legend}>
          <span>
            <i /> Direct connections
          </span>
          <span>
            <i /> Cinder-routed flow
          </span>
        </span>
      </figcaption>
      <div className={`brokerage-model ${styles.canvas}`}>
        <Connections time={time} />
        <Connections time={time} vertical />
        <div className={`brokerage-participants ${styles.participants}`}>
          <h3>Traders &amp; agents</h3>
          <ul className={styles.participantList}>
            {participants.map((participant) => (
              <li
                className={`brokerage-participant ${styles.participant}`}
                data-kind={participant.kind}
                key={participant.id}
              >
                <span
                  className={`brokerage-participant-avatar ${styles.avatar}`}
                  role="img"
                  aria-label={participant.label}
                >
                  {participant.kind === "trader" ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="7" r="4" />
                      <path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z" />
                    </svg>
                  ) : (
                    <Bot size={28} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <motion.div
          className={`brokerage-layer ${styles.layer}`}
          style={{ opacity: hubOpacity, scale: hubScale }}
        >
          <div className={`brokerage-hub ${styles.hub}`}>
            <div className={styles.brand}>
              <Mark themeAware />
              <div>
                <strong>Cinder</strong>
                <span>Prime brokerage</span>
              </div>
            </div>
            <motion.div
              className={styles.privateAccounts}
              style={{ opacity: boundaryOpacity }}
            >
              <h3>
                <LockKeyhole size={14} aria-hidden="true" /> Private accounts
                &amp; positions
              </h3>
              <ul>
                {participants.map((participant, index) => (
                  <AccountRecord
                    time={time}
                    index={index}
                    key={participant.id}
                  />
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.div>
        <div className={`brokerage-venues ${styles.venues}`}>
          <h3>Venue liquidity</h3>
          <div className={styles.venueList}>
            {venues.map((venue, index) => (
              <div className={`brokerage-venue ${styles.venue}`} key={venue.id}>
                <div className={styles.venueName}>
                  <Image
                    src={`/brand/venues/${venue.id}.svg`}
                    alt=""
                    width={28}
                    height={28}
                    unoptimized
                  />
                  <strong>{venue.name}</strong>
                </div>
                <VolumeMeter time={time} venue={index} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.comparison}>
        <div data-active={!withCinder}>
          <span>Today</span>
          <strong>Trade separately.</strong>
          <p>Separate connections. Individual volume at each venue.</p>
        </div>
        <div data-active={withCinder}>
          <span>With Cinder</span>
          <strong>Benefit collectively.</strong>
          <p>Private positions. Qualifying volume combines at each venue.</p>
        </div>
      </div>
      <p className={styles.accessibleDescription}>
        Each trader and agent retains an individual private Cinder account.
        Cinder executes against existing venue liquidity and aggregates
        qualifying trading volume separately at each venue for fee-tier access.
        The executing venue sees Cinder’s submitted orders, not the individual
        private account records.
      </p>
    </figure>
  );
}
