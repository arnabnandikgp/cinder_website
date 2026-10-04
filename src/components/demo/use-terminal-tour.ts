"use client";

import { useState, useSyncExternalStore } from "react";
import { TOUR_SEEN_KEY, tourSteps } from "./terminal-tour";

const eventName = "cinder:tour-seen";
let seenInSession = false;
function seen() {
  if (seenInSession) return true;
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) === "seen";
  } catch {
    return false;
  }
}
function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === TOUR_SEEN_KEY || event.key === null) callback();
  };
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", storage);
  };
}
const serverSeen = () => true;

function rememberChoice() {
  seenInSession = true;
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, "seen");
  } catch {
    // Private/blocked storage must never prevent skipping or replaying.
  }
  window.dispatchEvent(new Event(eventName));
}

export function useTerminalTour() {
  // Server and hydration output remain the regular terminal; the browser-only
  // preference is checked immediately after hydration, without a URL flag.
  const hasSeen = useSyncExternalStore(subscribe, seen, serverSeen);
  const [requested, setRequested] = useState<number | null>(null);
  const index = requested;
  return {
    index,
    welcome: !hasSeen && index === null,
    step: index === null ? null : tourSteps[index],
    start: () => {
      rememberChoice();
      setRequested(0);
    },
    go: (next: number) =>
      setRequested(Math.max(0, Math.min(next, tourSteps.length - 1))),
    close: () => {
      rememberChoice();
      setRequested(null);
    },
  };
}
