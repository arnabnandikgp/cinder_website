"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";
import { venues, type Venue } from "./data";

export function VenueIcon({
  venue,
  size = 24,
}: {
  venue: Venue;
  size?: number;
}) {
  return (
    <Image
      className="d-venue-icon"
      src={`/brand/venues/${venue}.svg`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      alt=""
      loading="eager"
      unoptimized
    />
  );
}

const choices = Object.keys(venues) as Venue[];

// Keep focus on the combobox while its active descendant moves through the
// branded list. This preserves native-select keyboard behavior without relying
// on image support inside <option>, which varies between browsers.
export function VenueSelect({
  id,
  label,
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  id?: string;
  label: string;
  value: Venue;
  onChange: (venue: Venue) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const uid = useId();
  const listId = `${uid}-venues`;
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(choices.indexOf(value));
  const search = useRef({ text: "", time: 0 });

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    if (open)
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function choose(venue: Venue) {
    setOpen(false);
    if (venue !== value) onChange(venue);
  }

  return (
    <div
      ref={root}
      className={`d-venue-select${compact ? " d-venue-select-compact" : ""}`}
    >
      <button
        type="button"
        id={id}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        data-value={value}
        disabled={disabled}
        className="d-venue-trigger"
        onClick={() => {
          setActive(choices.indexOf(value));
          setOpen(!open);
        }}
        onBlur={(event) => {
          if (!root.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          } else if (event.key === "Tab") {
            setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(
              open
                ? (active +
                    (event.key === "ArrowDown" ? 1 : choices.length - 1)) %
                    choices.length
                : choices.indexOf(value),
            );
            setOpen(true);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setActive(event.key === "Home" ? 0 : choices.length - 1);
            setOpen(true);
          } else if (open && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            choose(choices[active]);
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            event.key !== " "
          ) {
            event.preventDefault();
            const time = Date.now();
            const text =
              (time - search.current.time < 700 ? search.current.text : "") +
              event.key.toLowerCase();
            search.current = { text, time };
            const index = choices.findIndex((choice) =>
              venues[choice].toLowerCase().startsWith(text),
            );
            if (index >= 0) {
              setActive(index);
              setOpen(true);
            }
          }
        }}
      >
        <VenueIcon venue={value} size={compact ? 18 : 24} />
        <span>{venues[value]}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="d-venue-options"
          role="listbox"
          id={listId}
          aria-label={label}
        >
          {choices.map((venue, index) => (
            <button
              type="button"
              role="option"
              aria-label={venues[venue]}
              aria-selected={venue === value}
              key={venue}
              id={`${listId}-${index}`}
              tabIndex={-1}
              data-active={active === index}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(venue)}
            >
              <VenueIcon venue={venue} />
              <span>
                {venues[venue]}
                {venue === "velocity" && <small>Preview only</small>}
              </span>
              {venue === value && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
