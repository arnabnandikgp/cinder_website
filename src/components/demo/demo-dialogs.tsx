"use client";

import { useState, type FormEvent } from "react";
import { Check, Info } from "lucide-react";
import { DetailList, Modal } from "./controls";
import { RouteReceiptDetails } from "./route-card";
import { StrategyPlanView } from "./strategy-controls";
import {
  fillsFor,
  markets,
  number,
  usdcSize,
  venues,
  type CancelState,
  type Draft,
  type Market,
  type Scenario,
  type Venue,
} from "./data";

export type DialogState =
  | { kind: "review"; draft: Draft }
  | { kind: "detail"; id: string }
  | { kind: "reduce"; market: Market; venue: Venue }
  | {
      kind: "cancel" | "deposit" | "withdraw" | "route";
    };

export function DemoDialogs({
  dialog,
  onClose,
  scenario,
  cancel,
  onCancel,
  onConfirmCancel,
  drafts,
  onSave,
  allowed,
  onAllowed,
}: {
  dialog: DialogState;
  onClose: () => void;
  scenario: Scenario;
  cancel: CancelState;
  onCancel: () => void;
  onConfirmCancel: () => void;
  drafts: Draft[];
  onSave: (draft: Draft) => void;
  allowed: Venue[];
  onAllowed: (venues: Venue[]) => void;
}) {
  const [selected, setSelected] = useState(allowed);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(
    dialog.kind === "reduce"
      ? String((markets[dialog.market].size * markets[dialog.market].price) / 2)
      : "100",
  );
  const [preview, setPreview] = useState(false);
  const filled = scenario === "partial" ? 2 : 0;
  function validateAmount(event: FormEvent, max: number) {
    event.preventDefault();
    if (
      !/^\d+(\.\d+)?$/.test(amount.trim()) ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0 ||
      Number(amount) > max
    ) {
      setError(`Enter an amount greater than zero and no more than ${max}.`);
      document.getElementById("d-dialog-amount")?.focus();
      return;
    }
    setError("");
    setPreview(true);
  }
  const amountField = (label: string, unit: string) => (
    <div className="d-field">
      <label htmlFor="d-dialog-amount">
        {label} ({unit})
      </label>
      <input
        id="d-dialog-amount"
        inputMode="decimal"
        autoComplete="off"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          setPreview(false);
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "d-dialog-error" : undefined}
      />
      {error && (
        <p id="d-dialog-error" className="d-error">
          {error}
        </p>
      )}
    </div>
  );
  if (dialog.kind === "review") {
    const d = dialog.draft;
    return (
      <Modal
        title={d.strategy ? "Review strategy plan" : "Review order"}
        onClose={onClose}
      >
        <p className="d-dialog-intro">
          {d.strategy
            ? "Inspect your plan. Saving keeps it locally; no strategy starts and no orders are submitted."
            : "Check your instruction. Saving creates a local draft, not an order."}
        </p>
        <DetailList
          rows={[
            ["Market", markets[d.market].symbol],
            ["Direction / size", `${d.side} ${usdcSize(Number(d.size))}`],
            ["Order type", d.type],
            ["Leverage preference", `${d.leverage}x`],
            ...(!d.strategy
              ? ([
                  [
                    d.type === "Limit"
                      ? "Limit price"
                      : d.mode === "auto"
                        ? "Price tolerance"
                        : "Maximum slippage",
                    d.type === "Limit"
                      ? `${number(Number(d.limit))} USD`
                      : `${d.slippage}%`,
                  ],
                ] as [string, string][])
              : []),
            ...(d.tif
              ? ([["Time in force", d.tif === "ALO" ? "Post-only" : d.tif]] as [
                  string,
                  string,
                ][])
              : []),
            ...(d.reduceOnly
              ? ([
                  [
                    "Reduce only",
                    "Requested · customer position check not performed",
                  ],
                ] as [string, string][])
              : []),
            [
              "Execution",
              d.mode === "manual"
                ? venues[d.venue]
                : `Pro · ${venues[d.venue]}`,
            ],
            ...(d.mode === "auto"
              ? ([
                  [
                    "Compared venues",
                    d.allowed.map((v) => venues[v]).join(", "),
                  ],
                ] as [string, string][])
              : []),
            [
              "Margin and eligibility",
              d.route ? "Illustrative budget check only" : "Not calculated",
            ],
          ]}
        />
        {d.strategy && <StrategyPlanView plan={d.strategy} />}
        {d.route && <RouteReceiptDetails route={d.route} />}
        <div className="d-notice">
          <Info size={16} aria-hidden="true" />
          <p>
            This draft only concerns a new order. It does not move existing
            positions or collateral. No financial eligibility check has been
            performed.
          </p>
        </div>
        <button className="d-button d-primary d-wide" onClick={() => onSave(d)}>
          {d.strategy ? "Save local plan" : "Save example draft"}
        </button>
      </Modal>
    );
  }
  if (dialog.kind === "route")
    return (
      <Modal title="Route preferences" onClose={onClose}>
        <span className="d-concept">
          Public market estimates · No live trading
        </span>
        <p className="d-dialog-intro">
          Compare the same order quantity using live visible books and public
          venue fees. Cinder pricing is not included. Incomplete or stale data
          cannot establish a cheaper venue.
        </p>
        <fieldset className="d-checks">
          <legend>Venues to compare</legend>
          {Object.entries(venues)
            .filter(([key]) => key !== "velocity")
            .map(([key, name]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={selected.includes(key as Venue)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, key as Venue]
                        : selected.filter((v) => v !== key),
                    )
                  }
                />
                {name}
              </label>
            ))}
        </fieldset>
        {error && (
          <p className="d-error" role="alert">
            {error}
          </p>
        )}
        <p className="d-dialog-intro">
          These preferences apply to new drafts, not existing positions. Public
          data access does not imply a trading integration. Hiding a curve does
          not exclude a venue.
        </p>
        <button
          className="d-button d-primary d-wide"
          onClick={() => {
            if (!selected.length) {
              setError("Choose at least one venue.");
              return;
            }
            onAllowed(selected);
          }}
        >
          Save preferences
        </button>
      </Modal>
    );
  if (dialog.kind === "cancel")
    return (
      <Modal
        title={
          cancel === "requested"
            ? "Cancellation requested"
            : "Cancel the remaining order?"
        }
        onClose={onClose}
      >
        <DetailList
          rows={[
            ["Order", "EX-104 · SOL-PERP · Pacifica"],
            ["Already filled", `${filled} SOL`],
            ["Remaining", `${5 - filled} SOL`],
          ]}
        />
        <p className="d-dialog-intro">
          {cancel === "requested"
            ? "A request is not a confirmation. In live trading, further fills could arrive before cancellation is confirmed."
            : "Only the unfilled remainder would be cancelled. Existing fills and positions remain."}
        </p>
        {cancel === "requested" ? (
          <button
            className="d-button d-primary d-wide"
            onClick={onConfirmCancel}
          >
            Load sample cancellation confirmation
          </button>
        ) : (
          <button className="d-button d-primary d-wide" onClick={onCancel}>
            Simulate cancellation request
          </button>
        )}
        <p className="d-ticket-note">
          Both steps are canned demo states. No venue is contacted.
        </p>
      </Modal>
    );
  if (dialog.kind === "reduce") {
    const item = markets[dialog.market];
    return (
      <Modal title={`Reduce ${item.symbol}`} onClose={onClose}>
        <DetailList
          rows={[
            ["Position", `${item.side} ${item.size} ${dialog.market}`],
            ["Venue", venues[dialog.venue]],
          ]}
        />
        <form
          onSubmit={(e) => validateAmount(e, item.size * item.price)}
          noValidate
        >
          {amountField("Reduction size", "USDC")}
          <button className="d-button d-primary d-wide" type="submit">
            Preview reduction
          </button>
        </form>
        {preview && (
          <div className="d-preview-result" role="status">
            <Check size={18} aria-hidden="true" />
            <div>
              <strong>
                Remaining:{" "}
                {number(
                  item.size - Number(amount) / item.price,
                  dialog.market === "SOL" ? 2 : 4,
                )}{" "}
                {dialog.market}
              </strong>
              <p>
                Arithmetic preview only. The position is unchanged; no exit
                instruction is sent.
              </p>
            </div>
          </div>
        )}
        <p className="d-ticket-note">
          Sizing uses the illustrative mark of {number(item.price)} USD.
          Customer-level exit protection, execution and fees are not modelled.
        </p>
      </Modal>
    );
  }
  if (dialog.kind === "deposit" || dialog.kind === "withdraw") {
    const withdraw = dialog.kind === "withdraw";
    return (
      <Modal
        title={withdraw ? "Withdrawal preview" : "Funding your account"}
        onClose={onClose}
      >
        {withdraw ? (
          <>
            <p className="d-dialog-intro">
              Sample available-to-withdraw amount:{" "}
              {scenario === "empty" ? "0.00" : "5,000.00"} USDC. This is
              different from account equity.
            </p>
            <form
              noValidate
              onSubmit={(e) =>
                validateAmount(e, scenario === "empty" ? 0 : 5000)
              }
            >
              {amountField("Withdrawal amount", "USDC")}
              <button className="d-button d-primary d-wide" type="submit">
                Preview withdrawal
              </button>
            </form>
            {preview && (
              <div className="d-preview-result" role="status">
                <Info size={18} aria-hidden="true" />
                <div>
                  <strong>
                    {number(Number(amount))} USDC requested in this preview
                  </strong>
                  <p>
                    Fees, net payout and timing are not calculated. No
                    withdrawal has been requested.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="d-dialog-intro">
              The intended flow funds your Cinder account from a Solana wallet.
              Trading readiness follows account credit, not simply the wallet
              transfer.
            </p>
            <ol className="d-flow-list">
              <li>Approve a deposit from your wallet.</li>
              <li>Track receipt and account credit.</li>
              <li>Use your available trading balance.</li>
            </ol>
            <p className="d-notice">
              Demo only. Do not send funds. No deposit address or wallet
              connection is provided.
            </p>
          </>
        )}
        <p className="d-ticket-note">
          Normal withdrawals and exceptional recovery are different. Recovery
          depends on authorized operators and access to venue funds.
        </p>
      </Modal>
    );
  }
  if (dialog.kind === "detail") {
    const draft = drafts.find((item) => item.id === dialog.id);
    const fills = fillsFor(scenario).filter((fill) => fill.order === dialog.id);
    return (
      <Modal
        title={draft ? "Unsubmitted draft" : "Order details"}
        onClose={onClose}
      >
        {draft ? (
          <DetailList
            rows={[
              ["Draft", draft.id],
              ["Leverage preference", `${draft.leverage}x`],
              [
                "Instruction",
                `${draft.side} ${usdcSize(Number(draft.size))} · ${draft.type}`,
              ],
              ...(!draft.strategy
                ? ([
                    [
                      draft.type === "Limit"
                        ? "Limit"
                        : draft.mode === "auto"
                          ? "Price tolerance"
                          : "Maximum slippage",
                      draft.type === "Limit"
                        ? `${draft.limit} USD`
                        : `${draft.slippage}%`,
                    ],
                  ] as [string, string][])
                : []),
              ...(draft.tif
                ? ([
                    [
                      "Time in force",
                      draft.tif === "ALO" ? "Post-only" : draft.tif,
                    ],
                  ] as [string, string][])
                : []),
              ...(draft.reduceOnly
                ? ([
                    [
                      "Reduce only",
                      "Requested · customer position check not performed",
                    ],
                  ] as [string, string][])
                : []),
              [
                "Execution",
                draft.mode === "manual"
                  ? venues[draft.venue]
                  : `Pro · ${venues[draft.venue]}`,
              ],
              ...(draft.mode === "auto"
                ? ([
                    [
                      "Compared venues",
                      draft.allowed.map((v) => venues[v]).join(", "),
                    ],
                  ] as [string, string][])
                : []),
              ["Status", "Not submitted"],
            ]}
          />
        ) : (
          <>
            <DetailList
              rows={[
                ["Order", dialog.id],
                ["Market", "SOL-PERP"],
                [
                  "Status",
                  dialog.id === "EX-104"
                    ? cancel === "confirmed"
                      ? "Remainder cancelled"
                      : cancel === "requested"
                        ? "Cancel requested"
                        : filled
                          ? "Partially filled"
                          : "Open"
                    : dialog.id === "EX-101"
                      ? "Rejected"
                      : "Filled",
                ],
                [
                  "Filled quantity",
                  `${fills.reduce((sum, fill) => sum + fill.size, 0)} SOL`,
                ],
                ...(dialog.id === "EX-104"
                  ? ([
                      [
                        cancel === "confirmed"
                          ? "Cancelled remainder"
                          : "Unfilled remainder",
                        `${5 - filled} SOL`,
                      ],
                    ] as [string, string][])
                  : []),
              ]}
            />
            <h3 className="d-detail-heading">Allocated fills</h3>
            {fills.length ? (
              fills.map((fill) => (
                <div className="d-receipt-fill" key={fill.id}>
                  <strong>{fill.id}</strong>
                  <p>
                    {fill.size} SOL at {number(fill.price)} USD ·{" "}
                    {venues[fill.venue]}
                  </p>
                  <span>
                    Fee:{" "}
                    {fill.fee === null ? "Pending" : `${number(fill.fee)} USDC`}
                  </span>
                </div>
              ))
            ) : (
              <p className="d-dialog-intro">No fills in this sample record.</p>
            )}
          </>
        )}
        {draft?.route && <RouteReceiptDetails route={draft.route} />}
        {draft?.strategy && <StrategyPlanView plan={draft.strategy} />}
        <p className="d-ticket-note">
          Illustrative records only. Drafts remain in this tab until you reload.
        </p>
      </Modal>
    );
  }
  return null;
}
