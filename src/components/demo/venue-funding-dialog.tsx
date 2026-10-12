"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { DetailList, Modal } from "./controls";
import { number, venues, type Venue } from "./data";
import { paperTotals, paperVenues, type PaperAccount } from "./paper-account";
import { parseAmount } from "./routing";

export function VenueFundingDialog({
  account,
  initialVenue,
  initialKind = "topup",
  shortfall = 0,
  onClose,
  onTransfer,
}: {
  account: PaperAccount;
  initialVenue: Venue;
  initialKind?: "topup" | "return";
  shortfall?: number;
  onClose: () => void;
  onTransfer: (venue: Venue, amount: number, kind: "topup" | "return") => void;
}) {
  const [venue, setVenue] = useState(initialVenue);
  const [kind, setKind] = useState(initialKind);
  const [amount, setAmount] = useState(
    shortfall > 0 ? String(Math.ceil(shortfall * 100) / 100) : "",
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const available = paperTotals(account, venue).available;
  const maximum =
    kind === "topup" ? account.walletCash : Math.max(0, available);
  const value = parseAmount(amount);
  const valid =
    Number.isFinite(value) &&
    value > 0 &&
    value <= maximum &&
    /^\d+(?:\.\d{1,6})?$/.test(amount.trim());
  const moved = kind === "topup" ? value : -value;
  const money = (n: number) => number(n) + " USDC";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || done) return;
    if (!valid) {
      setError(
        value > maximum
          ? "Amount exceeds the safely available maximum."
          : "Enter a positive amount with up to 6 decimal places.",
      );
      input.current?.focus();
      return;
    }
    submitting.current = true;
    setPending(true);
    setError("");
    // A short local update state, never a fabricated wallet-signature or chain confirmation.
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!mounted.current) return;
    try {
      onTransfer(venue, value, kind); // Store rechecks latest wallet-scoped balances.
      setDone(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t update this demo balance. Try again.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <Modal
      title={
        done
          ? "Demo balance updated"
          : kind === "topup"
            ? "Top up " + venues[venue]
            : "Return funds to demo wallet"
      }
      eyebrow="SIMULATED TRANSFER"
      className="d-funding-drawer"
      onClose={onClose}
    >
      {done ? (
        <div className="d-funding-success" role="status">
          <Check size={28} aria-hidden="true" />
          <h3>
            {money(value)}{" "}
            {kind === "topup"
              ? "added to " + venues[venue]
              : "returned to the demo wallet"}
          </h3>
          <p>
            {kind === "topup"
              ? "Your order inputs are intact. Prices, fees and margin will be rechecked when you submit."
              : "Existing positions and reservations remain on this venue."}
          </p>
          <DetailList
            rows={[
              [venues[venue] + " available margin", money(available)],
              ["Demo wallet balance", money(account.walletCash)],
            ]}
          />
          <p>No real funds moved.</p>
          <button
            type="button"
            className="d-button d-primary d-wide"
            onClick={onClose}
          >
            Done <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate aria-busy={pending}>
          <p className="d-dialog-intro">
            Move simulated USDC between your demo wallet and one venue. Other
            venue balances are unchanged.
          </p>
          <fieldset disabled={pending} className="d-funding-fields">
            <legend className="d-sr-only">Venue funding controls</legend>
            <label htmlFor="d-funding-kind">Action</label>
            <select
              id="d-funding-kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind);
                if (e.target.value === "topup" && !paperVenues.includes(venue))
                  setVenue(paperVenues[0]);
                setAmount("");
                setError("");
              }}
            >
              <option value="topup">Top up venue</option>
              <option value="return">Return to demo wallet</option>
            </select>
            <label htmlFor="d-funding-venue">Venue</label>
            <select
              id="d-funding-venue"
              value={venue}
              onChange={(e) => {
                setVenue(e.target.value as Venue);
                setAmount("");
                setError("");
              }}
            >
              {(Object.keys(venues) as Venue[])
                .filter(
                  (v) =>
                    paperVenues.includes(v) ||
                    (kind === "return" && account.venueCash[v] > 0),
                )
                .map((v) => (
                  <option key={v} value={v}>
                    {venues[v]}
                  </option>
                ))}
            </select>
            <div className="d-funding-path">
              <span>{kind === "topup" ? "Demo wallet" : venues[venue]}</span>
              <ArrowRight size={17} aria-hidden="true" />
              <span>
                {kind === "topup"
                  ? venues[venue] + " trading balance"
                  : "Demo wallet"}
              </span>
            </div>
            <div className="d-funding-amount-label">
              <label htmlFor="d-funding-amount">Amount (USDC)</label>
              <button
                type="button"
                className="d-text-button"
                onClick={() => {
                  setAmount(String(maximum));
                  setError("");
                }}
              >
                Max
              </button>
            </div>
            <input
              ref={input}
              id="d-funding-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={
                "d-funding-maximum" + (error ? " d-funding-error" : "")
              }
              placeholder="1000"
            />
            <p id="d-funding-maximum">
              Safely available: {money(maximum)}
              {kind === "return"
                ? " · Position and order requirements excluded"
                : " · Simulated wallet only"}
            </p>
          </fieldset>
          <div className="d-funding-preview" aria-label="Transfer preview">
            <DetailList
              rows={[
                [
                  "Demo wallet · Before → after",
                  money(account.walletCash) +
                    " → " +
                    (valid ? money(account.walletCash - moved) : "—"),
                ],
                [
                  venues[venue] + " margin · Before → after",
                  money(available) +
                    " → " +
                    (valid ? money(available + moved) : "—"),
                ],
                ["Transfer cost", "0 USDC · Simulation"],
              ]}
            />
          </div>
          {maximum <= 0 && (
            <p className="d-funding-hint">
              {kind === "topup"
                ? "The demo wallet is empty. Return free funds from another venue, or reset the paper account in Account."
                : "No free margin to return. Reduce a position or cancel a resting order first."}
            </p>
          )}
          {error && (
            <p className="d-error" id="d-funding-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="d-button d-primary d-wide"
            disabled={pending || maximum <= 0}
          >
            {pending ? (
              <>
                <LoaderCircle size={16} aria-hidden="true" /> Updating demo
                balance…
              </>
            ) : kind === "topup" ? (
              "Confirm demo top-up"
            ) : (
              "Confirm demo return"
            )}
          </button>
          <p className="d-field-help">
            Local simulation only. No signature, network fee or real escrow
            transaction. Closing before the update cancels it.
          </p>
        </form>
      )}
    </Modal>
  );
}
