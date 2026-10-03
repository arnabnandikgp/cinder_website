"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Layers,
  Crosshair,
  Timer,
  ChartNoAxesCombined,
  Snowflake,
  Zap,
} from "lucide-react";
import { Segments, DetailList } from "./controls";
import {
  strategies,
  isStrategy,
  type Strategy,
  type StrategyConfig,
  type StrategyPlan,
} from "./strategies";
import { number, usdcSize } from "./data";

const icons = {
  Scale: Layers,
  Chase: Crosshair,
  TWAP: Timer,
  VWAP: ChartNoAxesCombined,
  "Chase TWAP": Timer,
  Iceberg: Snowflake,
  Swarm: Zap,
};

export function OrderTypes({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focusedItem, setFocusedItem] = useState<string>("Scale");
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function show() {
    setFocusedItem(isStrategy(value) ? value : "Scale");
    setOpen(true);
    requestAnimationFrame(() => {
      const selected = ref.current?.querySelector<HTMLButtonElement>(
        '[role="menuitemradio"][aria-checked="true"]',
      );
      const first = ref.current?.querySelector<HTMLButtonElement>(
        '[role="menuitemradio"]',
      );
      (selected ?? first)?.focus();
    });
  }
  return (
    <div
      ref={ref}
      className="d-order-types"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="d-order-type-row">
        <Segments
          label="Order type"
          disabled={disabled}
          value={value}
          options={[
            { value: "Market", label: "Market" },
            { value: "Limit", label: "Limit" },
          ]}
          onChange={(type) => {
            setOpen(false);
            onChange(type);
          }}
        />
        <button
          ref={trigger}
          type="button"
          className={`d-advanced-trigger${isStrategy(value) ? " is-selected" : ""}`}
          disabled={disabled}
          aria-label={
            isStrategy(value)
              ? `${value} · Advanced order types`
              : "Advanced order types"
          }
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? "d-strategy-menu" : undefined}
          onClick={() => (open ? setOpen(false) : show())}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              show();
            }
          }}
        >
          {isStrategy(value) ? value : "Advanced"}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div
          id="d-strategy-menu"
          className="d-strategy-menu"
          role="menu"
          aria-label="Advanced order types"
          onKeyDown={(e) => {
            const items = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
            );
            const i = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              e.key === "ArrowDown"
                ? (i + 1) % items.length
                : e.key === "ArrowUp"
                  ? (i - 1 + items.length) % items.length
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : -1;
            if (next >= 0) {
              e.preventDefault();
              items[next].focus();
            }
          }}
        >
          {(Object.entries(strategies) as [Strategy, string][]).map(
            ([name, description]) => {
              const Icon = icons[name];
              return (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={value === name}
                  tabIndex={focusedItem === name ? 0 : -1}
                  key={name}
                  onFocus={() => setFocusedItem(name)}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>
                    <strong>{name}</strong>
                    <small>{description}</small>
                  </span>
                </button>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

export function StrategyFields({
  kind,
  config,
  onChange,
  errors,
  disabled,
}: {
  kind: Strategy;
  config: StrategyConfig;
  onChange: (value: StrategyConfig) => void;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  const update = (key: keyof StrategyConfig, value: string | boolean) =>
    onChange({ ...config, [key]: value });
  const field = (
    key: keyof StrategyConfig,
    label: string,
    unit?: string,
    hint?: string,
  ) => (
    <div className="d-field" key={key}>
      <label htmlFor={`d-strategy-${key}`}>
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <input
        id={`d-strategy-${key}`}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={String(config[key])}
        onChange={(e) => update(key, e.target.value)}
        aria-invalid={!!errors[key]}
        aria-describedby={
          errors[key]
            ? `d-strategy-${key}-error`
            : hint
              ? `d-strategy-${key}-hint`
              : undefined
        }
      />
      {hint && (
        <p className="d-field-help" id={`d-strategy-${key}-hint`}>
          {hint}
        </p>
      )}
      {errors[key] && (
        <p className="d-error" id={`d-strategy-${key}-error`}>
          {errors[key]}
        </p>
      )}
    </div>
  );
  const timed = ["TWAP", "VWAP", "Chase TWAP"].includes(kind);
  return (
    <div className="d-strategy-fields">
      <div className="d-strategy-caption">
        <span>Strategy preview</span>
        <p>{strategies[kind]}</p>
      </div>
      {kind === "Scale" && (
        <>
          <div className="d-input-pair">
            {field("start", "Start price", "USD")}
            {field("end", "End price", "USD")}
          </div>
          <div className="d-input-pair">
            {field("count", "Total orders")}
            {field("skew", "Size skew")}
          </div>
          <p className="d-field-help">
            1 = equal sizes. Above 1 puts more size toward the end price.
          </p>
        </>
      )}
      {timed && (
        <div className="d-input-pair">
          {field("duration", "Duration", "minutes")}
          {field("interval", "Slice interval", "seconds")}
        </div>
      )}
      {kind === "Swarm" && (
        <div className="d-input-pair">
          {field("count", "Total clips")}
          {field("pace", "Pace", "clips/sec")}
        </div>
      )}
      {kind === "Iceberg" && field("tip", "Displayed size", "USDC")}
      {(kind === "Chase" ||
        kind === "Chase TWAP" ||
        kind === "Swarm" ||
        timed) &&
        field(
          "boundary",
          kind.includes("Chase")
            ? "Chase boundary"
            : "Price boundary (optional)",
          "USD",
          "Buy ceiling / sell floor. Not a predicted fill price.",
        )}
      {(kind === "Chase" ||
        kind === "Chase TWAP" ||
        ((timed || kind === "Swarm") && config.boundary)) && (
        <div className="d-field">
          <label htmlFor="d-strategy-breach">When boundary is crossed</label>
          <select
            id="d-strategy-breach"
            disabled={disabled}
            value={config.breach}
            onChange={(e) => update("breach", e.target.value)}
          >
            <option>Cancel</option>
            <option>Pause</option>
          </select>
          <p className="d-field-help">
            Pause stops new submissions; resting orders may still fill.
          </p>
        </div>
      )}
      {kind === "Chase TWAP" && (
        <div className="d-field">
          <label htmlFor="d-strategy-catchUp">Catch-up policy</label>
          <select
            id="d-strategy-catchUp"
            disabled={disabled}
            value={config.catchUp}
            onChange={(e) => update("catchUp", e.target.value)}
          >
            <option>Passive only</option>
            <option>Bounded market</option>
          </select>
        </div>
      )}
      {(timed || kind === "Swarm") && (
        <label className="d-ticket-check">
          <input
            type="checkbox"
            checked={config.randomize}
            disabled={disabled}
            onChange={(e) => update("randomize", e.target.checked)}
          />
          Vary slice sizes
        </label>
      )}
      {kind === "VWAP" && (
        <p className="d-field-help">
          Uses an illustrative volume profile, not historical venue volume.
        </p>
      )}
    </div>
  );
}

export function StrategyPlanView({ plan }: { plan: StrategyPlan }) {
  const timed = plan.rows.some((r) => r.seconds !== undefined);
  const priced = plan.rows.some((r) => r.price !== undefined);
  const max = Math.max(...plan.rows.map((r) => r.quantity));
  return (
    <section className="d-strategy-plan" aria-label="Strategy plan">
      <div className="d-plan-heading">
        <strong>{plan.kind} plan</strong>
        <span>Not executing</span>
      </div>
      <p>{plan.summary}</p>
      {plan.rows.length > 1 && (
        <div className="d-plan-bars" aria-hidden="true">
          {plan.rows.map((r, i) => (
            <span
              key={i}
              style={{ height: `${Math.max(4, (r.quantity / max) * 100)}%` }}
            />
          ))}
        </div>
      )}
      <DetailList
        rows={[
          ["Total size", usdcSize(plan.quantity)],
          ...(plan.config.boundary &&
          plan.kind !== "Scale" &&
          plan.kind !== "Iceberg"
            ? ([
                [
                  "Price boundary",
                  `${number(Number(plan.config.boundary))} USD`,
                ],
                ["Boundary action", plan.config.breach],
              ] as [string, string][])
            : []),
          ...(plan.kind === "Chase TWAP"
            ? ([["Catch-up", plan.config.catchUp]] as [string, string][])
            : []),
        ]}
      />
      {plan.rows.length > 1 && (
        <details>
          <summary>
            View {plan.rows.length} planned{" "}
            {plan.kind === "Scale" ? "orders" : "portions"}
          </summary>
          <div
            className="d-plan-table"
            tabIndex={0}
            role="region"
            aria-label="Planned portions"
          >
            <table>
              <caption className="d-sr-only">
                Illustrative child instructions, not submitted orders
              </caption>
              <thead>
                <tr>
                  <th>#</th>
                  {timed && <th>Offset</th>}
                  {priced && <th>Price (USD)</th>}
                  <th>Size (USDC)</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    {timed && <td>+{number(r.seconds ?? 0, 1)}s</td>}
                    {priced && <td>{number(r.price ?? 0)}</td>}
                    <td>{usdcSize(r.quantity).replace(" USDC", "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p className="d-field-help">{plan.note}</p>
    </section>
  );
}
