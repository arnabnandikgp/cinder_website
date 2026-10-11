"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export const LANDING_THEME_KEY = "cinder:landing-theme";
type Theme = "system" | "light" | "dark";
let memoryTheme: Theme | null = null;

function readTheme(): Theme {
  if (memoryTheme) return memoryTheme;
  try {
    const saved = localStorage.getItem(LANDING_THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("cinder-theme-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("cinder-theme-change", callback);
    window.removeEventListener("storage", callback);
  };
}

function useTheme() {
  return useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
}

// Runs before the header paints. CSS also follows the OS without JavaScript.
const initializeTheme = `try{var t=localStorage.getItem('${LANDING_THEME_KEY}');if(t==='light'||t==='dark')document.getElementById('landing-site').dataset.theme=t}catch{}`;

export function LandingTheme({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const theme = useTheme();
  return (
    <div
      id="landing-site"
      className={`landing-site ${className}`}
      data-theme={theme}
      suppressHydrationWarning
    >
      <script dangerouslySetInnerHTML={{ __html: initializeTheme }} />
      {children}
    </div>
  );
}

export function ThemeControl() {
  const theme = useTheme();
  return (
    <div className="theme-control" role="group" aria-label="Color theme">
      {(
        [
          ["system", Monitor],
          ["light", Sun],
          ["dark", Moon],
        ] as const
      ).map(([value, Icon]) => (
        <button
          type="button"
          key={value}
          aria-label={`${value[0].toUpperCase() + value.slice(1)} theme`}
          title={`${value[0].toUpperCase() + value.slice(1)} theme`}
          aria-pressed={theme === value}
          onClick={() => {
            memoryTheme = null;
            try {
              localStorage.setItem(LANDING_THEME_KEY, value);
            } catch {
              // The choice still works for this page if storage is blocked.
              memoryTheme = value;
            }
            document
              .getElementById("landing-site")
              ?.setAttribute("data-theme", value);
            window.dispatchEvent(new Event("cinder-theme-change"));
          }}
        >
          <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
