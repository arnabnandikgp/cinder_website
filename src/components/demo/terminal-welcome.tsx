"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ArrowRight } from "lucide-react";
import { Mark } from "@/components/ui";

export function TerminalWelcome({
  onStart,
  onSkip,
  returnFocus,
}: {
  onStart: () => void;
  onSkip: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const root = document.documentElement;
    const body = document.body;
    const overflow = [root.style.overflow, body.style.overflow];
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    node?.showModal();
    // Focus the labelled native dialog: its glowing boundary is the focus
    // indicator, without making the welcome heading look like an input field.
    node?.focus({ preventScroll: true });
    const trigger = returnFocus.current;
    return () => {
      node?.close();
      [root.style.overflow, body.style.overflow] = overflow;
      // Restore synchronously: a delayed focus request could steal focus from
      // the first tour card when the user accepts the invitation.
      trigger?.focus({ preventScroll: true });
    };
  }, [returnFocus]);

  return (
    <dialog
      ref={dialog}
      className="d-welcome-dialog"
      aria-labelledby="d-welcome-title"
      aria-describedby="d-welcome-description"
      onCancel={(event) => {
        event.preventDefault();
        onSkip();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons =
          event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === event.currentTarget)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="d-welcome-brand">
        <Mark className="d-welcome-mark" />
        <span className="d-overline">CINDER / DEMO</span>
      </div>
      <h2 id="d-welcome-title">Welcome to Cinder.</h2>
      <p id="d-welcome-description">
        One workspace. Two ways to trade. Take a quick tour of the Cinder demo,
        or explore at your own pace.
      </p>
      <dl className="d-welcome-modes">
        <div className="d-welcome-mode">
          <svg viewBox="0 0 160 48" aria-hidden="true" focusable="false">
            <path className="d-welcome-grid" d="M0 16H160M0 32H160" />
            <g className="d-welcome-candle-up">
              <path d="M12 28V46M36 18V38M84 8V28M108 2V20M132 4V24" />
              <path
                strokeWidth="7"
                d="M12 32V40M36 22V32M84 12V22M108 6V14M132 10V18"
              />
            </g>
            <g className="d-welcome-candle-down">
              <path d="M60 16V40M156 10V32" />
              <path strokeWidth="7" d="M60 22V34M156 16V26" />
            </g>
          </svg>
          <dt>Standard</dt>
          <dd>Choose your venue. Follow its market.</dd>
        </div>
        <div className="d-welcome-mode d-welcome-mode-pro">
          <svg viewBox="0 0 160 48" aria-hidden="true" focusable="false">
            <path className="d-welcome-grid" d="M0 16H160M0 32H160" />
            <path
              className="d-welcome-curve-pacifica"
              d="M0 38C48 38 64 36 88 28S124 16 160 4"
            />
            <path
              className="d-welcome-curve-bulk"
              d="M0 42C48 42 72 38 96 32S128 26 160 14"
            />
            <path
              className="d-welcome-curve-phoenix"
              d="M0 28C40 28 60 24 84 18S128 10 160 8"
            />
            <path className="d-welcome-guide" d="M100 0V48" />
          </svg>
          <dt>Pro</dt>
          <dd>See how execution costs compare for your order.</dd>
        </div>
      </dl>
      <p className="d-welcome-account">
        Your account, activity and agents. All in one place.
      </p>
      <div className="d-welcome-actions">
        <button type="button" className="d-button" onClick={onSkip}>
          Skip
        </button>
        <button type="button" className="d-button d-primary" onClick={onStart}>
          Take a tour <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="d-welcome-replay">
        You can take the tour anytime from the header.
      </p>
    </dialog>
  );
}
