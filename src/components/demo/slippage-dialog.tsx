"use client";
import { useState } from "react";
import { Modal } from "./controls";
import { parseAmount } from "./routing";
export function SlippageDialog({
  value,
  onSave,
  onClose,
}: {
  value: string;
  onSave: (v: string) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(value),
    [error, setError] = useState("");
  return (
    <Modal
      title="Maximum slippage"
      eyebrow="ORDER PROTECTION"
      onClose={onClose}
    >
      <form
        className="d-slippage-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseAmount(amount);
          if (!Number.isFinite(n) || n <= 0 || n >= 100) {
            setError("Enter a percentage above 0 and below 100.");
            return;
          }
          onSave(amount);
        }}
      >
        <p>
          Maximum adverse fill-price movement from the current reference. Fees
          are separate.
        </p>
        <div className="d-size-presets">
          {["0.1", "0.5", "1"].map((n) => (
            <button
              type="button"
              aria-pressed={amount === n}
              key={n}
              onClick={() => {
                setAmount(n);
                setError("");
              }}
            >
              {n}%
            </button>
          ))}
        </div>
        <label className="d-field" htmlFor="d-slippage">
          Custom percentage
          <input
            id="d-slippage"
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError("");
            }}
            aria-invalid={!!error}
            aria-describedby="d-slippage-error"
          />
        </label>
        <p
          className="d-error"
          id="d-slippage-error"
          role={error ? "alert" : undefined}
        >
          {error}
        </p>
        <button className="d-button d-primary d-wide" type="submit">
          Save slippage
        </button>
      </form>
    </Modal>
  );
}
