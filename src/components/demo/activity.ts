import {
  fillsFor,
  funding,
  markets,
  number,
  signed,
  usdcSize,
  venues,
  type CancelState,
  type Draft,
  type Scenario,
  type Venue,
} from "./data";
import { actorLabel } from "./agents";

export type ActivityEvent = {
  id: string;
  category: string;
  title: string;
  detail: string;
  time: string;
  amount: string;
  actor: string;
  // System consequences can be linked to the initiating agent without being
  // falsely presented as requests that the agent signed (e.g. fee booking).
  originAgent?: string;
  order?: string;
  venue?: Venue;
};

export function eventActorLabel(event: ActivityEvent) {
  return event.originAgent
    ? `${actorLabel(event.actor)} · for ${actorLabel(event.originAgent)}`
    : actorLabel(event.actor);
}

export function matchesActor(event: ActivityEvent, actor: string) {
  return (
    actor === "all" || event.actor === actor || event.originAgent === actor
  );
}

export function activityFor(
  scenario: Scenario,
  cancel: CancelState,
  drafts: Draft[],
): ActivityEvent[] {
  const filled = scenario === "partial" ? 2 : 0;
  const events: ActivityEvent[] =
    scenario === "empty"
      ? []
      : [
          {
            id: "EX-104",
            venue: "pacifica",
            category: "orders",
            actor: "you",
            title:
              cancel === "confirmed"
                ? "Order remainder cancelled"
                : cancel === "requested"
                  ? "Cancellation requested"
                  : filled
                    ? "Order partially filled"
                    : "Limit order open",
            detail: `SOL-PERP · Pacifica · ${filled} of 5 SOL filled`,
            time: "11:58:00",
            amount:
              cancel === "confirmed"
                ? `${5 - filled} SOL cancelled`
                : `${5 - filled} SOL remaining`,
            order: "EX-104",
          },
          {
            id: "AG-103",
            category: "orders",
            actor: "sol-execution",
            title: "Order request rejected",
            detail:
              "SOL-PERP · Per-order lot limit exceeded. No order admitted.",
            time: "11:56:00",
            amount: "Rejected",
          },
          ...fillsFor(scenario).flatMap((fill): ActivityEvent[] => {
            const actor = fill.order === "EX-102" ? "sol-execution" : "you";
            return [
              {
                id: fill.id,
                venue: fill.venue,
                category: "trades",
                actor,
                title: `${fill.side} filled`,
                detail: `${markets[fill.market].symbol} · ${venues[fill.venue]} · ${fill.size} ${fill.market} at ${number(fill.price)} USD`,
                time: fill.time,
                amount: `${fill.size} ${fill.market}`,
                order: fill.order,
              },
              {
                id: `fee-${fill.id}`,
                venue: fill.venue,
                category: "fees",
                actor: "system",
                originAgent: actor === "you" ? undefined : actor,
                title:
                  fill.fee === null
                    ? "Trading fee pending"
                    : "Trading fee booked",
                detail: `${venues[fill.venue]} · ${fill.id}`,
                time: fill.time,
                amount:
                  fill.fee === null ? "Pending" : `−${number(fill.fee)} USDC`,
                order: fill.order,
              },
            ];
          }),
          {
            id: "AG-102",
            venue: "pacifica",
            category: "orders",
            actor: "sol-execution",
            order: "EX-102",
            title: "Agent order accepted",
            detail:
              "SOL-PERP · Pacifica · Accepted under SOL execution's grant.",
            time: "11:44:58",
            amount: "Accepted",
          },
          {
            id: "AG-101",
            venue: "pacifica",
            category: "orders",
            actor: "sol-execution",
            title: "Agent order cancelled",
            detail:
              "SOL-PERP · Pacifica · An unfilled order admitted under this agent's key was cancelled.",
            time: "11:42:00",
            amount: "Cancelled",
          },
          ...funding.map((item) => ({
            id: item.id,
            venue: item.venue,
            category: "funding",
            actor: "system",
            title: item.amount < 0 ? "Funding paid" : "Funding received",
            detail: `${markets[item.market].symbol} · ${venues[item.venue]}`,
            time: item.time,
            amount: `${signed(item.amount)} USDC`,
          })),
          {
            id: "AG-201",
            category: "orders",
            actor: "btc-hedger",
            title: "Order request rejected",
            detail: "BTC-PERP · Agent grant expired. No order admitted.",
            time: "09:31:00",
            amount: "Expired grant",
          },
          {
            id: "TR-101",
            category: "transfers",
            actor: "you",
            title: "Deposit credited",
            detail: "Sample Solana wallet → Cinder account",
            time: "09:00:00",
            amount: "+1,000.00 USDC",
          },
        ];
  if (scenario === "deposit")
    events.push({
      id: "TR-102",
      category: "transfers",
      actor: "you",
      title: "Deposit awaiting credit",
      detail: "Received, not yet available to trade",
      time: "11:59:00",
      amount: "1,000.00 USDC pending",
    });
  events.sort((a, b) => b.time.localeCompare(a.time));
  return [
    ...[...drafts].reverse().map((draft): ActivityEvent => ({
      id: draft.id,
      venue: draft.venue,
      category: "drafts",
      actor: "you",
      title: draft.strategy ? `${draft.type} plan saved` : "Order draft saved",
      detail: `${markets[draft.market].symbol} · ${draft.mode === "auto" ? `Pro route: ${venues[draft.venue]}` : venues[draft.venue]} · ${draft.side} ${usdcSize(Number(draft.size))}`,
      time: "This session",
      amount: "Not submitted",
      order: draft.id,
    })),
    ...events,
  ];
}
