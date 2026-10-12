"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { motion, useMotionValue } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Layers3,
  Pause,
  Play,
  Wallet,
} from "lucide-react";
import { Mark } from "./ui";

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function useInView<T extends HTMLElement>() {
  const root = useRef<T>(null);
  const [visible, setVisible] = useState(false);
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
      { threshold: 0.2 },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return { root, visible };
}

const modes = {
  standard: {
    name: "Standard",
    description:
      "Choose your venue and trade with the chart, order book and controls you know.",
    context: "Your chosen venue",
    playbackRate: 1.35,
  },
  pro: {
    name: "Pro",
    description:
      "Compare liquidity and estimated trading costs for your size, across the venues you choose.",
    context: "Your allowed venues",
    playbackRate: 1,
  },
};

function ProductLoop({
  mode,
  active,
}: {
  mode: keyof typeof modes;
  active: boolean;
}) {
  const { root, visible } = useInView<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [explicitPlay, setExplicitPlay] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const config = modes[mode];

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.defaultPlaybackRate = config.playbackRate;
    element.playbackRate = config.playbackRate;
    let cancelled = false;
    if (
      !active ||
      !visible ||
      paused ||
      failed ||
      blocked ||
      (reducedMotion && !explicitPlay)
    ) {
      element.pause();
    } else {
      element.play().catch((error: DOMException) => {
        if (!cancelled && error.name !== "AbortError") setBlocked(true);
      });
    }
    return () => {
      cancelled = true;
      element.pause();
    };
  }, [
    active,
    visible,
    paused,
    reducedMotion,
    explicitPlay,
    blocked,
    failed,
    config.playbackRate,
  ]);

  return (
    <div
      ref={root}
      hidden={!active}
      className="product-loop"
      data-mode={mode}
      data-visible={visible}
    >
      <div className="product-loop-frame">
        {failed ? (
          <Image
            src={`/previews/loops/${mode}.webp`}
            alt={`${config.name} terminal preview`}
            width={1440}
            height={710}
            sizes="(max-width: 800px) 800px, 1280px"
          />
        ) : (
          <video
            ref={video}
            src={`/previews/loops/${mode}.mp4`}
            poster={`/previews/loops/${mode}.webp`}
            aria-label={`Recorded ${config.name} trading flow`}
            muted
            loop
            playsInline
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <div className="product-loop-footer">
        {failed && <span role="status">Video unavailable.</span>}
        {!failed && (
          <button
            type="button"
            className="preview-motion-control"
            aria-label={`${playing ? "Pause" : "Play"} ${config.name} preview`}
            onClick={() => {
              if (playing) {
                setPaused(true);
              } else {
                setPaused(false);
                setExplicitPlay(true);
                setBlocked(false);
                // A direct gesture also permits playback when autoplay is blocked.
                video.current?.play().catch(() => setBlocked(true));
              }
            }}
          >
            {playing ? (
              <Pause size={14} aria-hidden="true" />
            ) : (
              <Play size={14} aria-hidden="true" />
            )}
            {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>
    </div>
  );
}

export function TradingStory() {
  const [mode, setMode] = useState<keyof typeof modes>("standard");
  const selected = modes[mode];
  return (
    <div className="trading-story" data-mode={mode}>
      <div className="trading-story-heading">
        <h2 id="trading-title">
          Your venue.
          <br />
          <span className="heading-accent">Or a wider view.</span>
        </h2>
        <div className="trading-story-copy">
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
          </div>
        </div>
      </div>
      <figure
        className="trading-preview"
        id="trading-preview"
        aria-label={`${selected.name} trading preview`}
      >
        <figcaption>
          <span className="preview-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>Cinder terminal</span>
          <span className="trading-context">{selected.context}</span>
        </figcaption>
        {(Object.keys(modes) as (keyof typeof modes)[]).map((value) => (
          <ProductLoop key={value} mode={value} active={mode === value} />
        ))}
      </figure>
    </div>
  );
}

const stages = [
  {
    id: "overview",
    title: "Know where you stand.",
    description:
      "Total portfolio equity, venue balances and available venue margin. Separate balances, one clear overview.",
  },
  {
    id: "positions",
    title: "See every position.",
    description:
      "Follow your exposure and position margin requirements, grouped by execution venue.",
  },
  {
    id: "activity",
    title: "Connect every move.",
    description:
      "Trace funding, orders, fills and fees in a single timeline, including actions taken by your agents.",
  },
];

const accountMetrics = [
  {
    icon: Wallet,
    label: "Total equity",
    description: "Portfolio value across venues",
  },
  {
    icon: Layers3,
    label: "Available venue margin",
    description: "Free collateral on the selected venue",
  },
  {
    icon: ArrowUpRight,
    label: "Venue balances",
    description: "Top up each venue explicitly",
  },
];

function AccountVisual({ scene }: { scene: number }) {
  return (
    <div className="account-scenes">
      <div className="account-scene" hidden={scene !== 0} data-scene="overview">
        <div className="account-orbit" aria-hidden="true">
          <span />
          <span />
          <Mark themeAware />
        </div>
        <div className="account-visual-heading">
          <h3>Your account, in focus.</h3>
          <p>Clarity before your next trade.</p>
        </div>
        <dl className="account-metrics">
          {accountMetrics.map(({ icon: Icon, label, description }) => (
            <div key={label}>
              <Icon size={19} aria-hidden="true" />
              <dt>{label}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div
        className="account-scene"
        hidden={scene !== 1}
        data-scene="positions"
      >
        <div className="account-visual-heading">
          <span className="visual-kicker">Across execution venues</span>
          <h3>Positions. Not silos.</h3>
          <p>Exposure and margin, kept distinct.</p>
        </div>
        <div className="position-illustration">
          {[
            ["pacifica", "Pacifica", "SOL-PERP", "Long"],
            ["bulk", "BULK", "BTC-PERP", "Short"],
            ["phoenix", "Phoenix", "SOL-PERP", "Long"],
          ].map(([id, name, market, side]) => (
            <div className="illustrative-position" key={id}>
              <span className="venue-logo">
                <Image
                  src={`/brand/venues/${id}.svg`}
                  width={25}
                  height={25}
                  unoptimized
                  alt=""
                />
              </span>
              <div>
                <strong>{name}</strong>
                <span>
                  {market} · {side}
                </span>
              </div>
              <span className="position-label">
                Exposure
                <br />
                <span>Margin required</span>
              </span>
            </div>
          ))}
        </div>
        <span className="visual-footnote">
          Grouped by venue. Visible together.
        </span>
      </div>
      <div className="account-scene" hidden={scene !== 2} data-scene="activity">
        <div className="account-visual-heading">
          <span className="visual-kicker">A connected timeline</span>
          <h3>From funding to fill.</h3>
          <p>Top up when needed. Track every order.</p>
        </div>
        <ol className="activity-illustration">
          {[
            ["Venue topped up", "Wallet → selected execution venue"],
            ["Order submitted", "SOL-PERP · Pacifica"],
            ["Fill recorded", "Execution linked to the order"],
            ["Fees recorded", "Reflected in that venue’s balance"],
          ].map(([title, description], i) => (
            <li key={title}>
              <span className="activity-check">
                <Check size={15} aria-hidden="true" />
              </span>
              <div>
                <strong>{title}</strong>
                <span>{description}</span>
              </div>
              <span className="activity-sequence">0{i + 1}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function AccountStory() {
  const { root, visible } = useInView<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const progress = useMotionValue(0);
  const advancing = visible && !paused && !focused && !reducedMotion;

  useEffect(() => {
    if (!advancing) return;
    let frame = 0;
    let previous: number | undefined;
    const advance = (now: number) => {
      if (previous !== undefined) {
        const next = progress.get() + (now - previous) / 7000;
        if (next >= 1) {
          progress.set(next % 1);
          setScene((value) => (value + 1) % stages.length);
        } else progress.set(next);
      }
      previous = now;
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [advancing, progress]);

  return (
    <div
      ref={root}
      className="account-story"
      data-advancing={advancing}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <figure
        className="account-stage"
        id="account-scene"
        aria-label={stages[scene].title}
      >
        <figcaption>
          <span>Cinder / Account</span>
        </figcaption>
        <AccountVisual scene={scene} />
      </figure>
      <div className="account-story-controls">
        <div
          className="account-step-list"
          role="group"
          aria-label="Account walkthrough"
        >
          {stages.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              aria-pressed={scene === index}
              aria-expanded={scene === index}
              aria-controls={`account-detail-${stage.id} account-scene`}
              onClick={() => {
                setScene(index);
                setPaused(true);
                progress.set(1);
              }}
            >
              <span className="account-step-rail" aria-hidden="true">
                <motion.span
                  style={{
                    scaleY:
                      scene === index ? (reducedMotion ? 1 : progress) : 0,
                  }}
                />
              </span>
              <span className="account-step-number">0{index + 1}</span>
              <span className="account-step-content">
                <strong>{stage.title}</strong>
                <span
                  id={`account-detail-${stage.id}`}
                  className="account-step-detail"
                  aria-hidden={scene !== index}
                >
                  <span>{stage.description}</span>
                </span>
              </span>
              <ArrowRight size={19} aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="account-tour-status">
          <span>
            0{scene + 1} <span>/ 03</span>
          </span>
          {!reducedMotion && (
            <button
              type="button"
              className="preview-motion-control"
              onClick={() => {
                if (paused && progress.get() >= 1) progress.set(0);
                setPaused((value) => !value);
              }}
              aria-label={`${paused ? "Resume" : "Pause"} account walkthrough`}
            >
              {paused ? (
                <Play size={14} aria-hidden="true" />
              ) : (
                <Pause size={14} aria-hidden="true" />
              )}
              {paused ? "Play sequence" : "Pause sequence"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
