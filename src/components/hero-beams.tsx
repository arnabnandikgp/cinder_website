"use client";

import { lazy, Suspense, useState, useSyncExternalStore } from "react";

// Only load the shader for visitors who allow ambient motion.
const Beams = lazy(() => import("@/components/effects/beams"));
const mediaQueries = [
  "(prefers-color-scheme: dark)",
  "(prefers-reduced-motion: reduce)",
];

function subscribe(callback: () => void) {
  const media = mediaQueries.map((query) => window.matchMedia(query));
  media.forEach((query) => query.addEventListener("change", callback));
  window.addEventListener("cinder-theme-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    media.forEach((query) => query.removeEventListener("change", callback));
    window.removeEventListener("cinder-theme-change", callback);
    window.removeEventListener("storage", callback);
  };
}

function readAppearance() {
  const site = document.getElementById("landing-site");
  if (!site || window.matchMedia(mediaQueries[1]).matches) return "static";
  const styles = getComputedStyle(site);
  return `${styles.colorScheme}|${styles.getPropertyValue("--cobalt").trim()}`;
}

export function HeroBeams() {
  const appearance = useSyncExternalStore(
    subscribe,
    readAppearance,
    () => "static",
  );
  const [status, setStatus] = useState<"ready" | "unavailable" | "loading">(
    "loading",
  );
  const still = appearance === "static";
  const [theme, color] = appearance.split("|");

  return (
    <div
      className="hero-beams"
      aria-hidden="true"
      data-renderer={still ? "static" : status}
      data-theme={still ? undefined : theme}
      data-color={color}
    >
      <div className="hero-beams-fallback" />
      {!still && (
        <Suspense fallback={null}>
          <Beams
            color={color}
            lightMode={theme === "light"}
            beamWidth={140}
            rotation={30}
            speed={0.65}
            brightness={1.7}
            glow={0.35}
            grain={0.12}
            fade={0.1}
            quality={0.5}
            dpr={1}
            intro={false}
            mouseInteraction={false}
            onStatusChange={setStatus}
          />
        </Suspense>
      )}
    </div>
  );
}
