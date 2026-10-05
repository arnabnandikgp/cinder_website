"use client";
import { parseAmount } from "./routing";
import type { Bracket } from "./paper-account";

export type BracketInputs = {
  enabled: boolean;
  tp: string;
  sl: string;
  tpPercent: string;
  slPercent: string;
};
export const emptyBracket: BracketInputs = {
  enabled: false,
  tp: "",
  sl: "",
  tpPercent: "",
  slPercent: "",
};
export function resolveBracket(
  value: BracketInputs,
  entry: number,
  side: string,
): Bracket {
  if (!value.enabled) return {};
  const direction = side === "Buy" ? 1 : -1;
  return Object.fromEntries(
    (["tp", "sl"] as const).flatMap((key) => {
      const pct = value[`${key}Percent`];
      if (!value[key] && !pct) return [];
      const price = value[key]
        ? parseAmount(value[key])
        : entry *
          (1 + ((key === "tp" ? 1 : -1) * direction * parseAmount(pct)) / 100);
      return [[key, price]];
    }),
  );
}
export function BracketControls({
  value,
  onChange,
  entry,
  side,
  disabled,
}: {
  value: BracketInputs;
  onChange: (v: BracketInputs) => void;
  entry: number;
  side: string;
  disabled: boolean;
}) {
  const direction = side === "Buy" ? 1 : -1;
  const shown = resolveBracket(value, entry, side);
  return (
    <div className="d-brackets" aria-label="Take profit and stop loss">
      {(["tp", "sl"] as const).map((key) => {
        const pctKey = `${key}Percent` as const;
        const price = shown[key];
        const pct =
          value[pctKey] ||
          (value[key] && entry > 0
            ? String(
                Number(
                  (
                    (parseAmount(value[key]) / entry - 1) *
                    direction *
                    (key === "tp" ? 1 : -1) *
                    100
                  ).toFixed(3),
                ),
              )
            : "");
        return (
          <div key={key} className="d-bracket-row">
            <label>
              {key === "tp" ? "TP price" : "SL price"}
              <input
                aria-label={
                  key === "tp" ? "Take profit price" : "Stop loss price"
                }
                disabled={disabled}
                inputMode="decimal"
                autoComplete="off"
                value={
                  value[key] ||
                  (value[pctKey] && Number.isFinite(price)
                    ? String(Number(price!.toFixed(4)))
                    : "")
                }
                placeholder="0.00"
                onChange={(e) =>
                  onChange({ ...value, [key]: e.target.value, [pctKey]: "" })
                }
              />
              <span>USD</span>
            </label>
            <label>
              {key === "tp" ? "Gain" : "Loss"}
              <input
                aria-label={
                  key === "tp"
                    ? "Take profit gain percent"
                    : "Stop loss loss percent"
                }
                disabled={disabled}
                inputMode="decimal"
                autoComplete="off"
                value={pct}
                placeholder="0"
                onChange={(e) =>
                  onChange({ ...value, [pctKey]: e.target.value, [key]: "" })
                }
              />
              <span>%</span>
            </label>
          </div>
        );
      })}
      <p className="d-field-help">
        Price move from entry, not leveraged ROI. Triggers monitored on the
        active market while this demo is open.
      </p>
    </div>
  );
}
