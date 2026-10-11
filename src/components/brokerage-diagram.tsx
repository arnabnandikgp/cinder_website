"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Bot, UsersRound } from "lucide-react";
import { Mark } from "./ui";

const participants = [
  { id: "trader-1", kind: "trader", label: "Trader" },
  { id: "agent-1", kind: "agent", label: "Agent" },
  { id: "trader-2", kind: "trader", label: "Trader" },
  { id: "agent-2", kind: "agent", label: "Agent" },
  { id: "trader-3", kind: "trader", label: "Trader" },
];

const incomingPaths = participants.map(
  (_, index) => `M0 ${24 + index * 48} H20 L80 120 H100`,
);

const venues = [
  { id: "pacifica", name: "Pacifica" },
  { id: "bulk", name: "BULK" },
  { id: "phoenix", name: "Phoenix" },
];

export function BrokerageDiagram() {
  const root = useRef<HTMLElement>(null);
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
      className="brokerage-map"
      aria-label="Traders and agents connect through one Cinder brokerage layer to venue liquidity"
      data-playing={visible}
    >
      <figcaption className="brokerage-map-heading">
        <span>
          <UsersRound size={17} aria-hidden="true" /> Individual traders.
          Collective reach.
        </span>
      </figcaption>
      <div className="brokerage-model">
        <div className="brokerage-participants">
          <h3>Traders &amp; agents</h3>
          <ul className="brokerage-participant-list">
            {participants.map((participant) => (
              <li
                className="brokerage-participant"
                data-kind={participant.kind}
                key={participant.id}
              >
                <span
                  className="brokerage-participant-avatar"
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
        <svg
          className="brokerage-converge"
          viewBox="0 0 100 240"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path d={incomingPaths.join(" ")} />
          {incomingPaths.map((path) => (
            <path
              className="brokerage-stream brokerage-stream-in"
              pathLength="1"
              d={path}
              key={path}
            />
          ))}
        </svg>
        <div className="brokerage-layer">
          <h3>One brokerage layer</h3>
          <div className="brokerage-hub">
            <Mark />
            <strong>Cinder</strong>
            <span>Prime brokerage</span>
            <p>
              Private positions.
              <br />
              Pooled trading volume.
            </p>
          </div>
        </div>
        <svg
          className="brokerage-branches"
          viewBox="0 0 100 240"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path d="M0 120 H20 L80 40 H100 M0 120 H100 M0 120 H20 L80 200 H100" />
          <path
            className="brokerage-stream brokerage-stream-out"
            pathLength="1"
            d="M0 120 H20 L80 40 H100"
          />
          <path
            className="brokerage-stream brokerage-stream-out"
            pathLength="1"
            d="M0 120 H100"
          />
          <path
            className="brokerage-stream brokerage-stream-out"
            pathLength="1"
            d="M0 120 H20 L80 200 H100"
          />
        </svg>
        <div className="brokerage-venues">
          <h3>Venue liquidity</h3>
          <div className="brokerage-venue-list">
            {venues.map((venue) => (
              <div className="brokerage-venue" key={venue.id}>
                <Image
                  src={"/brand/venues/" + venue.id + ".svg"}
                  alt=""
                  width={28}
                  height={28}
                  unoptimized
                />
                <strong>{venue.name}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
