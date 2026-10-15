"use client";

import { useEffect, useRef } from "react";
import styles from "./hero-architecture.module.css";

/** Architectural planes echo the mark's angles without redrawing the logo.
 * The complete illustration is server-rendered; JS only manages ambient motion.
 */
export function HeroArchitecture() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    const update = () => {
      element.dataset.active = String(
        inView && !document.hidden && !motion.matches,
      );
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div
      ref={root}
      className={`hero-architecture ${styles.artwork}`}
      aria-hidden="true"
      data-active="false"
    >
      <svg
        viewBox="0 0 1440 760"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient
            id="cinder-plane-front"
            x1="0"
            y1="0"
            x2="400"
            y2="650"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--hero-plane-start)" />
            <stop offset="1" stopColor="var(--hero-plane-end)" />
          </linearGradient>
          <linearGradient
            id="cinder-plane-edge"
            x1="180"
            y1="40"
            x2="370"
            y2="240"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--hero-edge-start)" />
            <stop offset="1" stopColor="var(--hero-edge-end)" />
          </linearGradient>
          <linearGradient
            id="cinder-plane-side"
            x1="-40"
            y1="250"
            x2="210"
            y2="700"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--hero-side-start)" />
            <stop offset="1" stopColor="var(--hero-side-end)" />
          </linearGradient>
        </defs>
        <g className={styles.construction} stroke="var(--hero-rule)">
          <path d="M0 144 252 0M0 640 208 760M1440 116 1238 0M1440 616 1188 760" />
          <path d="M24 0V760M1416 0V760" strokeDasharray="2 10" />
        </g>
        <g className={styles.left}>
          <g className={styles.plane}>
            <path
              d="M-122 208 190 28 374 134V238L190 132-32 260V516L190 644V748L-122 568Z"
              fill="url(#cinder-plane-front)"
              stroke="var(--hero-plane-outline)"
            />
            <path
              d="M190 28 374 134V238L190 132Z"
              fill="url(#cinder-plane-edge)"
            />
            <path
              d="M-32 260 0 278V498L190 608V644L-32 516Z"
              fill="url(#cinder-plane-side)"
            />
            <path
              d="M-122 208 190 28 374 134M-32 260 190 132 374 238"
              stroke="var(--hero-highlight)"
            />
            <path d="M0 278 190 168 332 250" stroke="var(--hero-rule)" />
          </g>
        </g>
        <g transform="translate(1440 760) rotate(180)">
          <g className={styles.right}>
            <g className={styles.plane}>
              <path
                d="M-122 208 190 28 374 134V238L190 132-32 260V516L190 644V748L-122 568Z"
                fill="url(#cinder-plane-front)"
                stroke="var(--hero-plane-outline)"
              />
              <path
                d="M190 28 374 134V238L190 132Z"
                fill="url(#cinder-plane-edge)"
              />
              <path
                d="M-32 260 0 278V498L190 608V644L-32 516Z"
                fill="url(#cinder-plane-side)"
              />
              <path
                d="M-122 208 190 28 374 134M-32 260 190 132 374 238"
                stroke="var(--hero-highlight)"
              />
              <path d="M0 278 190 168 332 250" stroke="var(--hero-rule)" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
