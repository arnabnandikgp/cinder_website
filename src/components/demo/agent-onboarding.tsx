"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { DetailList, Modal } from "./controls";
import { agentGuide, isAgentPublicKey, type AgentPermission } from "./agents";

type GrantPreview = {
  name: string;
  publicKey: string;
  market: string;
  duration: string;
  maximumLots: string;
  maximumFee: string;
  maximumOrders: string;
};
type Field = keyof GrantPreview;
export function AgentOnboarding({ onClose }: { onClose: () => void }) {
  const [grant, setGrant] = useState<GrantPreview>({
    name: "",
    publicKey: "",
    market: "SOL",
    duration: "24 hours",
    maximumLots: "200",
    maximumFee: "10",
    maximumOrders: "100",
  });
  const [permissions, setPermissions] = useState<AgentPermission[]>([
    "TRADE",
    "CANCEL",
  ]);
  const [errors, setErrors] = useState<
    Partial<Record<Field | "permissions", string>>
  >({});
  const [review, setReview] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (review) heading.current?.focus();
  }, [review]);
  function change(field: Field, value: string) {
    setGrant((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!grant.name.trim()) next.name = "Give this agent a name.";
    if (!isAgentPublicKey(grant.publicKey.trim()))
      next.publicKey =
        "Enter a base58, 32-byte public key. Never paste a secret key or seed phrase.";
    for (const field of [
      "maximumLots",
      "maximumFee",
      "maximumOrders",
    ] as const) {
      const value = Number(grant[field]);
      if (
        !/^\d+$/.test(grant[field]) ||
        !Number.isSafeInteger(value) ||
        value < (field === "maximumFee" ? 0 : 1)
      ) {
        next[field] =
          field === "maximumFee"
            ? "Enter a nonnegative whole number."
            : "Enter a positive whole number.";
      }
    }
    if (!permissions.length)
      next.permissions = "Select at least one permission.";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      const field = form.current?.elements.namedItem(
        first === "permissions" ? "TRADE" : first,
      );
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    setReview(true);
  }
  function input(field: Field, label: string, hint?: string) {
    return (
      <div className="d-agent-field">
        <label htmlFor={`agent-${field}`}>{label}</label>
        <input
          id={`agent-${field}`}
          name={field}
          value={grant[field]}
          type="text"
          inputMode={field.startsWith("maximum") ? "numeric" : "text"}
          maxLength={field === "name" ? 60 : field === "publicKey" ? 200 : 16}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!errors[field]}
          aria-describedby={
            errors[field]
              ? `agent-${field}-error`
              : hint
                ? `agent-${field}-hint`
                : undefined
          }
          onChange={(event) => change(field, event.target.value)}
        />
        {hint && <p id={`agent-${field}-hint`}>{hint}</p>}
        {errors[field] && (
          <p id={`agent-${field}-error`} className="d-agent-error">
            {errors[field]}
          </p>
        )}
      </div>
    );
  }
  return (
    <Modal title="Add agent" eyebrow="AUTHORIZATION PREVIEW" onClose={onClose}>
      <div className="d-agent-onboarding">
        <p className="d-agent-preview-note">
          <ShieldCheck size={17} aria-hidden="true" /> Preview only. No signing,
          permissions granted or keys stored.
        </p>
        {review ? (
          <>
            <h3 ref={heading} tabIndex={-1} className="d-agent-review-heading">
              Review {grant.name.trim()}
            </h3>
            <DetailList
              rows={[
                ["Trading / cancellation market", `${grant.market}-PERP`],
                ["Permissions", permissions.join(" · ")],
                ["Authorization duration", grant.duration],
                ["Maximum lots per order", grant.maximumLots],
                ["Maximum fee per lot", `${grant.maximumFee} quote atoms`],
                [
                  "Accepted-order budget",
                  `${grant.maximumOrders} orders in this epoch`,
                ],
              ]}
            />
            <div className="d-agent-key">
              <span>Agent public key</span>
              <code>{grant.publicKey.trim()}</code>
            </div>
            {permissions.includes("READ") && (
              <p className="d-agent-warning">
                READ allows this agent to view your account across all markets,
                not just {grant.market}.
              </p>
            )}
            {permissions.includes("CANCEL") && (
              <p className="d-agent-note">
                Cancellation is limited to this agent’s own orders in{" "}
                {grant.market}-PERP.
              </p>
            )}
            <p className="d-agent-note">
              The owner would approve a signed grant in production, after
              checking market units, key validity and the deployment’s maximum
              expiry. This preview does not authorize an agent.
            </p>
            <div className="d-agent-form-actions">
              <button className="d-button" onClick={() => setReview(false)}>
                Edit preview
              </button>
              <button className="d-button d-primary" onClick={onClose}>
                Close preview
              </button>
            </div>
          </>
        ) : (
          <form ref={form} onSubmit={submit} noValidate>
            {input("name", "Agent name")}
            {input(
              "publicKey",
              "Agent public key",
              "Use a separate Ed25519 public key. Never enter a private key or seed phrase.",
            )}
            <div className="d-agent-form-grid">
              <div className="d-agent-field">
                <label htmlFor="agent-market">Trading market</label>
                <select
                  id="agent-market"
                  value={grant.market}
                  onChange={(event) => change("market", event.target.value)}
                >
                  <option value="SOL">SOL-PERP</option>
                  <option value="BTC">BTC-PERP</option>
                </select>
              </div>
              <div className="d-agent-field">
                <label htmlFor="agent-duration">Expires after</label>
                <select
                  id="agent-duration"
                  value={grant.duration}
                  onChange={(event) => change("duration", event.target.value)}
                >
                  <option>1 hour</option>
                  <option>24 hours</option>
                  <option>7 days</option>
                </select>
              </div>
            </div>
            <fieldset className="d-agent-permissions">
              <legend>Permissions</legend>
              {(
                [
                  [
                    "TRADE",
                    "Place orders",
                    "Only in the selected market, within the grant’s limits.",
                  ],
                  [
                    "CANCEL",
                    "Cancel own orders",
                    "Only orders admitted under this agent’s key in that market.",
                  ],
                  [
                    "READ",
                    "Read account",
                    "Balances, positions and history across all markets.",
                  ],
                ] as const
              ).map(([value, title, description]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    name={value}
                    checked={permissions.includes(value)}
                    onChange={(event) => {
                      setPermissions((current) =>
                        event.target.checked
                          ? [...current, value]
                          : current.filter((item) => item !== value),
                      );
                      setErrors((current) => ({
                        ...current,
                        permissions: undefined,
                      }));
                    }}
                  />
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
              {errors.permissions && (
                <p className="d-agent-error" role="alert">
                  {errors.permissions}
                </p>
              )}
            </fieldset>
            {permissions.includes("READ") && (
              <p className="d-agent-warning">
                READ exposes your whole account. Grant it only to an agent you
                trust with that information.
              </p>
            )}
            <div className="d-agent-limits">
              <h3>Order limits</h3>
              <p>
                Protocol units shown for this preview. Production will use the
                market’s verified lot and quote precision.
              </p>
              <div className="d-agent-form-grid">
                {input("maximumLots", "Maximum lots per order")}
                {input("maximumFee", "Max fee per lot (quote atoms)")}
              </div>
              {input(
                "maximumOrders",
                "Lifetime accepted-order budget",
                "Each newly accepted order uses one unit. An exact retry does not use another.",
              )}
            </div>
            <p className="d-agent-note">
              No withdrawals, leverage changes or permission to authorize other
              agents. Revocation disables all account grants; open orders
              remain.
            </p>
            <button
              className="d-button d-primary d-agent-review-button"
              type="submit"
            >
              Review authorization preview
            </button>
          </form>
        )}
        <a
          className="d-agent-guide"
          href={agentGuide}
          target="_blank"
          rel="noopener noreferrer"
        >
          Agent setup guide <ArrowUpRight size={15} aria-hidden="true" />
          <span className="d-sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </Modal>
  );
}
