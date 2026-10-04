"use client";

import { useId } from "react";
import { CandlestickChart, Check, Route } from "lucide-react";
import type { Draft } from "./data";

type TradingMode = Draft["mode"];

/** Button styling, native radio semantics: exactly one mode is always active. */
export function TradingModeSwitch({
  value,
  onChange,
  disabled,
}: {
  value: TradingMode;
  onChange: (value: TradingMode) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="d-mode-options" disabled={disabled}>
      <legend className="d-sr-only">Trading mode</legend>
      {(
        [
          {
            value: "manual",
            label: "Standard",
            description: "Choose venue",
            icon: CandlestickChart,
          },
          {
            value: "auto",
            label: "Pro",
            description: "Compare venues",
            icon: Route,
          },
        ] as const
      ).map((option) => {
        const Icon = option.icon;
        return (
          <label
            key={option.value}
            className={`d-mode-option${value === option.value ? " is-selected" : ""}`}
            data-mode={option.value}
          >
            <input
              className="d-mode-input"
              type="radio"
              name={`${id}-mode`}
              value={option.value}
              checked={value === option.value}
              aria-labelledby={`${id}-${option.value}-label`}
              aria-describedby={`${id}-${option.value}-description`}
              onChange={() => onChange(option.value)}
            />
            <Icon className="d-mode-icon" size={16} aria-hidden="true" />
            <span className="d-mode-copy">
              <strong id={`${id}-${option.value}-label`}>{option.label}</strong>
              <span id={`${id}-${option.value}-description`}>
                {option.description}
              </span>
            </span>
            <Check className="d-mode-selected" size={12} aria-hidden="true" />
          </label>
        );
      })}
    </fieldset>
  );
}
