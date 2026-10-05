"use client";
import { Modal, DetailList } from "./controls";
import { venues } from "./data";
import { money } from "./routing";
import { StrategyPlanView } from "./strategy-controls";
import { paperTime } from "./paper-records";
import type { PaperAccount } from "./paper-account";
export function PaperDialog({
  kind,
  account,
  onClose,
  onReset,
}: {
  kind: string;
  account: PaperAccount | null;
  onClose: () => void;
  onReset: () => void;
}) {
  const o = account?.orders.find((o) => o.id === kind);
  if (kind === "reset")
    return (
      <Modal
        title="Reset paper account?"
        eyebrow="SIMULATED FUNDS ONLY"
        onClose={onClose}
      >
        <p>
          Clear this wallet’s paper positions, orders and history in this
          browser and start again with 10,000 simulated USDC. No real wallet
          assets are affected.
        </p>
        <div className="d-dialog-actions">
          <button className="d-button" onClick={onClose}>
            Keep account
          </button>
          <button className="d-button d-primary" onClick={onReset}>
            Reset paper account
          </button>
        </div>
      </Modal>
    );
  if (kind === "deposit" || kind === "withdraw")
    return (
      <Modal
        title={
          kind === "deposit"
            ? "Demo credit, not a deposit"
            : "Paper funds, not withdrawable"
        }
        eyebrow="PAPER ACCOUNT"
        onClose={onClose}
      >
        <p>
          Your connected wallet starts with 10,000 simulated USDC. No tokens are
          held or transferred by this demo. Use Reset paper account in Account
          for a fresh recording session.
        </p>
        <button className="d-button d-wide" onClick={onClose}>
          Got it
        </button>
      </Modal>
    );
  if (!o) return null;
  const fills = account?.fills.filter((f) => f.order === o.id) ?? [];
  return (
    <Modal
      title={`${o.id} · ${o.status}`}
      eyebrow="PAPER ORDER RECORD"
      onClose={onClose}
    >
      <DetailList
        rows={[
          [
            "Market / venue",
            `${o.draft.market}-PERP · ${venues[o.draft.venue]}`,
          ],
          [
            "Order",
            `${o.draft.side} · ${o.draft.type}${o.draft.reduceOnly ? " · Reduce only" : ""}`,
          ],
          ["USDC notional", money(Number(o.draft.size))],
          ["Created", `${paperTime(o.createdAt)} UTC`],
          ["Reserved collateral", money(o.reserve)],
          ["TP / SL", `${money(o.bracket.tp)} / ${money(o.bracket.sl)}`],
          ...fills.flatMap(
            (f) =>
              [
                ["Fill price", money(f.price)],
                ["Modeled venue fee", money(f.fee)],
                ["Realized PnL", money(f.realized)],
              ] as [string, string][],
          ),
          ...(o.execution
            ? ([
                [
                  o.execution.costBasis === "venue-midpoint"
                    ? "Venue midpoint"
                    : "Recorded reference (legacy)",
                  money(o.execution.reference),
                ],
                [
                  o.execution.costBasis === "venue-midpoint"
                    ? "Execution cost"
                    : "Benchmark cost (legacy)",
                  `${o.execution.costBps.toFixed(2)} bps`,
                ],
                ["Effective price", money(o.execution.effectivePrice)],
                ["Applied fee rate", `${o.execution.feeBps.toFixed(2)} bps`],
                ["Cinder pricing", "Not included"],
              ] as [string, string][])
            : []),
        ]}
      />
      {o.reason && <p>{o.reason}</p>}
      {o.draft.strategy && <StrategyPlanView plan={o.draft.strategy} />}
      <p className="d-field-help">
        Stored in this browser for this wallet. No venue order or transaction
        was sent.
      </p>
    </Modal>
  );
}
