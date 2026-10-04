"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  tourLayout,
  tourOverviewShape,
  tourSteps,
  type TourRect,
  type TourStep,
} from "./terminal-tour";

export function SpotlightTour({
  index,
  step,
  onStep,
  onClose,
  returnFocus,
}: {
  index: number;
  step: TourStep;
  onStep: (index: number) => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [measured, setMeasured] = useState<{
    id: TourStep["id"];
    layout: ReturnType<typeof tourLayout>;
    overview: ReturnType<typeof tourOverviewShape> | null;
  } | null>(null);
  const layout = measured?.id === step.id ? measured.layout : null;
  const last = index === tourSteps.length - 1;

  useEffect(() => {
    const node = dialog.current;
    const root = document.documentElement;
    const body = document.body;
    const overflow = [root.style.overflow, body.style.overflow];
    const position = { left: window.scrollX, top: window.scrollY };
    const opener = returnFocus.current;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    node?.showModal();
    return () => {
      node?.close();
      [root.style.overflow, body.style.overflow] = overflow;
      requestAnimationFrame(() => {
        window.scrollTo({ ...position, behavior: "instant" });
        opener?.focus({ preventScroll: true });
      });
    };
  }, [returnFocus]);

  useLayoutEffect(() => {
    const node = dialog.current,
      panel = card.current;
    if (!node || !panel) return;
    const target = document.querySelector<HTMLElement>(step.target);
    const header =
      step.presentation === "overview"
        ? target?.querySelector<HTMLElement>(".d-header")
        : null;
    const navigation = step.navigationTarget
      ? document.querySelector<HTMLElement>(step.navigationTarget)
      : null;
    let frame = 0;
    let ready = false;
    const measure = (reveal = false) => {
      const viewport = { width: node.clientWidth, height: node.clientHeight };
      const size = { width: panel.offsetWidth, height: panel.offsetHeight };
      if (target && reveal) {
        if (step.presentation === "overview") {
          // The workspace can stay mounted between a detail stop and an
          // overview. Reset its scrolling panels so the page title and mode
          // controls are visible, rather than inheriting the previous cutout.
          target
            .querySelectorAll<HTMLElement>(
              ".d-ticket, .d-book, .d-account-content, .d-records [role=tabpanel]",
            )
            .forEach((section) => {
              section.scrollTo({ top: 0, left: 0, behavior: "instant" });
            });
        }
        // Use the actual scroll container. The sheet has reserved space below;
        // no smooth scrolling, including for reduced-motion users.
        target.scrollIntoView({
          block: "start",
          inline: "nearest",
          behavior: "instant",
        });
        const bounds = target.getBoundingClientRect();
        if (window.scrollY > 0)
          window.scrollBy({ top: bounds.top - 24, behavior: "instant" });
      }
      const bounds = target?.getBoundingClientRect();
      // Keep the header outside an overview cutout. Account for tourLayout's
      // six-pixel target padding so the outline starts at the header boundary.
      const contentTop = bounds
        ? Math.max(
            bounds.top,
            header ? header.getBoundingClientRect().bottom + 6 : bounds.top,
          )
        : 0;
      const box: TourRect | null = bounds
        ? {
            left: bounds.left,
            top: contentTop,
            width: bounds.width,
            height: Math.max(0, bounds.bottom - contentTop),
          }
        : null;
      const nav = navigation?.getBoundingClientRect();
      const nextLayout = tourLayout(box, viewport, size, step.presentation);
      const nextNavigation = nav
        ? tourLayout(
            {
              left: nav.left,
              top: nav.top,
              width: nav.width,
              height: nav.height,
            },
            viewport,
            size,
            "overview",
          ).frame
        : null;
      setMeasured({
        id: step.id,
        layout: nextLayout,
        overview:
          step.presentation === "overview" && nextLayout.frame
            ? tourOverviewShape(nextLayout.frame, nextNavigation, viewport)
            : null,
      });
    };
    const update = (reveal = false) => {
      if (!ready) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure(reveal));
    };
    const resize = () => update(true);
    const scroll = () => update();
    // showModal runs in the passive effect, so wait one frame for the viewport
    // and auto-scroll before drawing the cutout. It never depends on feed data.
    frame = requestAnimationFrame(() => {
      measure(true);
      heading.current?.focus({ preventScroll: true });
      ready = true;
    });
    const observer = new ResizeObserver(() => update());
    observer.observe(panel);
    if (target) observer.observe(target);
    if (header) observer.observe(header);
    if (navigation) observer.observe(navigation);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", scroll, true);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", scroll, true);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, [step]);

  const hole = layout?.frame;
  const overview = layout ? measured?.overview : null;
  return (
    <dialog
      ref={dialog}
      className="d-tour-dialog"
      aria-labelledby="d-tour-title"
      aria-describedby={`d-tour-description${step.modes ? " d-tour-modes" : ""} d-tour-count`}
      data-tour-step={step.id}
      data-presentation={step.presentation ?? "spotlight"}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
        );
        const first = buttons[0],
          last = buttons.at(-1);
        if (!first || !last) return;
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === heading.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="d-tour-mask" aria-hidden="true">
        {hole && overview ? (
          <>
            {overview.shades.map((shade, index) => (
              <div className="d-tour-shade" key={index} style={shade} />
            ))}
            <div
              className="d-tour-spotlight d-tour-overview"
              data-testid="tour-spotlight"
              style={hole}
            />
            {overview.notch && (
              <div
                className="d-tour-navigation"
                data-testid="tour-navigation"
                style={overview.notch}
              />
            )}
            <svg className="d-tour-outline" aria-hidden="true">
              <path data-testid="tour-overview-outline" d={overview.outline} />
            </svg>
          </>
        ) : hole ? (
          <>
            <div
              className="d-tour-shade"
              style={{ inset: `0 0 auto 0`, height: hole.top }}
            />
            <div
              className="d-tour-shade"
              style={{
                top: hole.top + hole.height,
                bottom: 0,
                left: 0,
                right: 0,
              }}
            />
            <div
              className="d-tour-shade"
              style={{
                top: hole.top,
                height: hole.height,
                left: 0,
                width: hole.left,
              }}
            />
            <div
              className="d-tour-shade"
              style={{
                top: hole.top,
                height: hole.height,
                left: hole.left + hole.width,
                right: 0,
              }}
            />
            <div
              className="d-tour-spotlight"
              data-testid="tour-spotlight"
              style={{ ...hole }}
            />
          </>
        ) : (
          <div className="d-tour-shade" style={{ inset: 0 }} />
        )}
      </div>
      <div
        ref={card}
        className="d-tour-card"
        data-testid="tour-card"
        data-side={layout?.side ?? "none"}
        style={
          layout ? { left: layout.card.left, top: layout.card.top } : undefined
        }
      >
        <div className="d-tour-meta">
          <span>{step.label}</span>
          <span id="d-tour-count">
            {index + 1} of {tourSteps.length}
          </span>
        </div>
        <h2 id="d-tour-title" ref={heading} tabIndex={-1}>
          {step.title}
        </h2>
        <p id="d-tour-description">{step.description}</p>
        {step.modes && (
          <dl id="d-tour-modes" className="d-tour-modes">
            {step.modes.map((mode) => (
              <div key={mode.name}>
                <dt>{mode.name}</dt>
                <dd>{mode.description}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="d-tour-actions">
          <button type="button" className="d-tour-skip" onClick={onClose}>
            Skip tour
          </button>
          <div>
            {index > 0 && (
              <button
                type="button"
                className="d-button"
                onClick={() => onStep(index - 1)}
              >
                <ArrowLeft size={15} aria-hidden="true" /> Back
              </button>
            )}
            <button
              type="button"
              className="d-button d-primary"
              onClick={() => (last ? onClose() : onStep(index + 1))}
            >
              {last ? "Finish" : "Next"}
              {last ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <ArrowRight size={15} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
