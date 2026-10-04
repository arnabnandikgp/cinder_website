"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  Layers3,
  LockKeyhole,
  Pause,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { Mark } from "./ui";
import styles from "./agent-access-diagram.module.css";

export function AgentAccessDiagram() {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let inView = false;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        update();
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <figure
      ref={root}
      className={styles.diagram}
      aria-label="Agent permissions and request flow"
      data-testid="agent-access-diagram"
      data-playing={visible && !paused}
    >
      <figcaption className={styles.heading}>
        <strong>
          <ShieldCheck size={16} aria-hidden="true" /> Access granted by you
        </strong>
        <button
          type="button"
          className={styles.motionControl}
          onClick={() => setPaused((value) => !value)}
          aria-label={
            paused ? "Resume agent animation" : "Pause agent animation"
          }
        >
          {paused ? (
            <Play size={14} aria-hidden="true" />
          ) : (
            <Pause size={14} aria-hidden="true" />
          )}
          {paused ? "Play" : "Pause"}
        </button>
      </figcaption>

      <div className={styles.authorization}>
        <dl>
          <div>
            <dt>Market</dt>
            <dd>SOL-PERP</dd>
          </div>
          <div>
            <dt>Permissions</dt>
            <dd>Trade · Cancel</dd>
          </div>
          <div>
            <dt>Boundaries</dt>
            <dd>Order limits + expiry</dd>
          </div>
        </dl>
      </div>

      <div className={styles.flow}>
        <svg
          className={`${styles.connector} ${styles.incoming}`}
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path className={styles.track} d="M0 10 H100" />
          <path
            className={`${styles.packet} ${styles.allowedIncoming}`}
            d="M0 10 H100"
            pathLength="1"
            data-testid="agent-allowed-request"
          />
          <path
            className={`${styles.packet} ${styles.blockedIncoming}`}
            d="M0 10 H100"
            pathLength="1"
            data-testid="agent-blocked-request"
          />
        </svg>
        <svg
          className={`${styles.connector} ${styles.outgoing}`}
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path className={styles.track} d="M0 10 H100" />
          <path
            className={`${styles.packet} ${styles.allowedOutgoing}`}
            d="M0 10 H100"
            pathLength="1"
            data-testid="agent-forwarded-request"
          />
        </svg>
        <div className={styles.node}>
          <span className={styles.icon}>
            <Bot size={25} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <strong>Trading agent</strong>
          <span>SOL arbitrage</span>
        </div>
        <div className={styles.node}>
          <span className={`${styles.icon} ${styles.permissionGate}`}>
            <span aria-hidden="true">
              <Mark />
            </span>
            <span
              className={`${styles.verdict} ${styles.allowedVerdict}`}
              aria-hidden="true"
            >
              <Check size={12} />
            </span>
            <span
              className={`${styles.verdict} ${styles.blockedVerdict}`}
              aria-hidden="true"
            >
              <X size={12} />
            </span>
          </span>
          <strong>Cinder</strong>
          <span>Permission check</span>
        </div>
        <div className={styles.node}>
          <span className={styles.icon}>
            <Layers3 size={25} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <strong>Perp venue</strong>
          <span>Allowed orders only</span>
        </div>
      </div>

      <div className={styles.activity}>
        <div className={styles.activityHeading}>
          <span>RECORDED IN ACTIVITY</span>
          <span>Actor: SOL arbitrage</span>
        </div>
        <ul>
          <li className={styles.allowedEvent} data-event="allowed">
            <Check size={16} aria-hidden="true" />
            <div>
              <strong>SOL order forwarded</strong>
              <span>Within the authorized scope</span>
            </div>
            <span className={styles.eventStatus}>Allowed</span>
          </li>
          <li className={styles.blockedEvent} data-event="blocked">
            <X size={16} aria-hidden="true" />
            <div>
              <strong>BTC order blocked</strong>
              <span>Outside the authorized market</span>
            </div>
            <span className={styles.eventStatus}>Blocked</span>
          </li>
        </ul>
      </div>
      <p className={styles.withdrawal}>
        <span>
          <LockKeyhole size={15} aria-hidden="true" /> No withdrawal authority
        </span>
        <span>Illustrative flow</span>
      </p>
    </figure>
  );
}
