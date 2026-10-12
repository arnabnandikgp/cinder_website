import type { ActivityEvent } from "./activity";
import { number, venues, type Draft, type Market, type Venue } from "./data";
import { bookIssue, bookMidpoint, walkBook } from "./live-routing";
import type { FeedState } from "./market-data/feed";
import { FEE_MAX_AGE_MS } from "./market-data/fees";
import type { LiveVenue } from "./market-data/adapters";
import { parseAmount, type Quote } from "./routing";

export type Bracket = { tp?: number; sl?: number };
export type PaperPosition = Bracket & {
  id: string;
  market: Market;
  venue: Venue;
  quantity: number;
  entry: number;
  margin: number;
  leverage: number;
};
export type PaperOrder = {
  id: string;
  draft: Draft;
  quantity: number;
  reserve: number;
  status: "Open" | "Scheduled plan" | "Filled" | "Cancelled" | "Rejected";
  createdAt: string;
  updatedAt: string;
  reason?: string;
  bracket: Bracket;
  execution?: {
    costBasis?: "venue-midpoint";
    reference: number;
    costBps: number;
    effectivePrice: number;
    priceCost: number;
    feeBps: number;
  };
};
export type PaperFill = {
  id: string;
  order: string;
  market: Market;
  venue: Venue;
  side: string;
  quantity: number;
  price: number;
  fee: number;
  realized: number;
  at: string;
};
export type PaperAccount = {
  version: 2;
  wallet: string;
  venueCash: Record<Venue, number>;
  walletCash: number;
  seq: number;
  createdAt: string;
  positions: PaperPosition[];
  orders: PaperOrder[];
  fills: PaperFill[];
  events: ActivityEvent[];
};
export const PAPER_PREFIX = "cinder:paper:v2:";
export const LEGACY_PAPER_PREFIX = "cinder:paper:v1:";
export const paperVenues: Venue[] = ["pacifica", "bulk", "phoenix"];
const roundCash = (n: number) => Math.round(n * 1e6) / 1e6;
const active = (o: PaperOrder) =>
  o.status === "Open" || o.status === "Scheduled plan";
export function paperTotals(account: PaperAccount | null, venue?: Venue) {
  const margin =
    account?.positions
      .filter((p) => !venue || p.venue === venue)
      .reduce((n, p) => n + p.margin, 0) ?? 0;
  const reserved =
    account?.orders
      .filter((o) => active(o) && (!venue || o.draft.venue === venue))
      .reduce((n, o) => n + o.reserve, 0) ?? 0;
  const cash = account
    ? venue
      ? account.venueCash[venue]
      : Object.values(account.venueCash).reduce((sum, n) => sum + n, 0)
    : 0;
  return {
    cash: roundCash(cash),
    margin,
    reserved,
    available: roundCash(cash - margin - reserved),
  };
}

// Valuation and spending capacity are deliberately different. The paper risk
// model reserves against settled cash; unrealised gains are not spendable.
export function paperValuation(
  account: PaperAccount | null,
  marks: Partial<Record<string, number>>,
  venue?: Venue,
) {
  const positions =
    account?.positions.filter((p) => !venue || p.venue === venue) ?? [];
  const missing =
    positions.filter(
      (p) => !Number.isFinite(marks[p.id]) || !(marks[p.id]! > 0),
    ) ?? [];
  const unrealized = missing.length
    ? null
    : roundCash(
        positions.reduce(
          (sum, p) => sum + (marks[p.id]! - p.entry) * p.quantity,
          0,
        ) ?? 0,
      );
  return {
    unrealized,
    equity:
      unrealized === null
        ? null
        : roundCash(paperTotals(account, venue).cash + unrealized),
    missing,
  };
}

/** Shared by the inline preview and confirmed local fills. Positions only net
 * on the same market AND venue. A reduction releases margin; a reversal can
 * both release old margin and require margin for the newly opened remainder. */
export function paperFillImpact(
  previous: PaperPosition | undefined,
  side: string,
  quantity: number,
  price: number,
  leverage: number,
) {
  const signed = quantity * (side === "Buy" ? 1 : -1);
  const oldQuantity = previous?.quantity ?? 0;
  const opposite = oldQuantity * signed < 0;
  const closing = opposite ? Math.min(Math.abs(oldQuantity), quantity) : 0;
  const remainingOld = opposite
    ? Math.max(0, Math.abs(oldQuantity) - closing)
    : Math.abs(oldQuantity);
  const opening = quantity - closing;
  const released =
    previous && closing
      ? (previous.margin * closing) / Math.abs(oldQuantity)
      : 0;
  const added = (opening * price) / leverage;
  const realized =
    closing * (price - (previous?.entry ?? 0)) * Math.sign(oldQuantity);
  return {
    signed,
    oldQuantity,
    closing,
    remainingOld,
    opening,
    released,
    added,
    realized,
    delta: added - released,
    nextQuantity: oldQuantity + signed,
  };
}

export type PaperPreview = {
  margin: number;
  released: number;
  fees: number;
  availableAfter: number;
  reservation: boolean;
  reason: string | null;
  shortfall: number;
  fundingRequired: boolean;
};

// Preview only local, simulated funding capacity. Production escrow balances
// and execution eligibility must come from Cinder's authoritative backend.
export function previewPaperOrder(
  account: PaperAccount | null,
  draft: Draft,
  feed: FeedState,
  now = Date.now(),
  reference?: number,
  quantity?: number,
): PaperPreview | null {
  if (!account) return null;
  const notional = parseAmount(draft.size),
    leverage = parseAmount(draft.leverage);
  const limit = draft.type === "Limit" ? parseAmount(draft.limit) : undefined;
  if (
    !(notional > 0) ||
    !Number.isFinite(notional) ||
    notional > 1e9 ||
    !Number.isFinite(leverage) ||
    leverage < 1 ||
    leverage > 25 ||
    (limit !== undefined && (!(limit > 0) || !Number.isFinite(limit)))
  )
    return null;
  const result = paperQuote(
    draft.venue,
    feed,
    draft.side,
    notional,
    now,
    quantity ?? (limit ? notional / limit : undefined),
    reference,
  );
  if (!Number.isFinite(result.reference)) return null;
  const qty =
    quantity ??
    (limit
      ? notional / limit
      : (result.quote?.quantity ?? notional / (reference ?? result.reference)));
  const previous = account.positions.find(
    (p) => p.market === draft.market && p.venue === draft.venue,
  );
  const direction = draft.side === "Buy" ? 1 : -1;
  const reduceIssue =
    draft.reduceOnly &&
    (!previous ||
      Math.sign(previous.quantity) === direction ||
      qty > Math.abs(previous.quantity) + 1e-10)
      ? "Reduce-only size must reduce an existing position on this venue"
      : null;
  const crosses =
    limit !== undefined &&
    direction *
      ((draft.side === "Buy"
        ? feed.book!.asks[0].price
        : feed.book!.bids[0].price) -
        limit) <=
      0;
  const fills =
    result.quote &&
    (limit === undefined ||
      (crosses && direction * (result.quote.worstFill - limit) <= 1e-10));
  const available = paperTotals(account, draft.venue).available;
  if (draft.strategy || (limit !== undefined && !fills)) {
    const margin =
      draft.strategy || !draft.reduceOnly ? notional / leverage : 0;
    const fees = (notional * feed.fee!.takerBps) / 10000;
    const cancelled = !draft.strategy && draft.tif === "IOC";
    const required = cancelled ? 0 : roundCash(margin + fees);
    const constraint =
      reduceIssue ??
      (limit !== undefined && draft.tif === "ALO" && crosses
        ? "Post-only order would cross the book. Change the limit price."
        : cancelled
          ? "IOC will cancel unfilled: the full size is not available within this limit."
          : null);
    const fundingRequired = !constraint && required > available;
    return {
      margin: cancelled ? 0 : margin,
      released: 0,
      fees: cancelled ? 0 : fees,
      availableAfter: roundCash(available - required),
      reservation: true,
      shortfall: Math.max(0, roundCash(required - available)),
      fundingRequired,
      reason:
        constraint ??
        (fundingRequired
          ? `Not enough available venue margin on ${venues[draft.venue]}. Top up or reduce the reservation.`
          : null),
    };
  }
  if (!result.quote) return null;
  const impact = paperFillImpact(
    previous,
    draft.side,
    qty,
    result.quote.averageFill,
    leverage,
  );
  const after = roundCash(
    available - impact.delta - result.quote.venueFee + impact.realized,
  );
  const tolerance = parseAmount(draft.slippage);
  const constraint =
    reduceIssue ??
    (limit !== undefined && draft.tif === "ALO" && crosses
      ? "Post-only order would cross the book. Change the limit price."
      : limit === undefined &&
          (!Number.isFinite(tolerance) ||
            tolerance <= 0 ||
            tolerance >= 100 ||
            direction * (result.quote.worstFill / result.reference - 1) * 100 >
              tolerance + 1e-10)
        ? "Fresh fill exceeds maximum slippage. Reduce size or adjust slippage."
        : null);
  const fundingRequired = !constraint && after < -1e-6;
  return {
    margin: Math.max(0, impact.delta),
    released: Math.max(0, -impact.delta),
    fees: result.quote.venueFee,
    availableAfter: after,
    reservation: false,
    shortfall: Math.max(0, -after),
    fundingRequired,
    reason:
      constraint ??
      (fundingRequired
        ? `Not enough available venue margin on ${venues[draft.venue]}. Top up or reduce the order.`
        : null),
  };
}
function event(
  a: PaperAccount,
  at: string,
  entry: Omit<ActivityEvent, "id" | "time">,
) {
  a.events.unshift({ ...entry, id: `P-E${++a.seq}`, time: at });
}
export function newPaperAccount(
  wallet: string,
  now = Date.now(),
): PaperAccount {
  const at = new Date(now).toISOString();
  const a: PaperAccount = {
    version: 2,
    wallet,
    venueCash: { pacifica: 5000, bulk: 5000, phoenix: 5000, velocity: 0 },
    walletCash: 10000,
    seq: 0,
    createdAt: at,
    positions: [],
    orders: [],
    fills: [],
    events: [],
  };
  for (const venue of paperVenues)
    event(a, at, {
      category: "transfers",
      actor: "system",
      venue,
      title: "Demo venue balance credited",
      detail: `5,000 simulated USDC credited to ${venues[venue]}. No tokens were transferred. The separate demo wallet is not part of portfolio equity.`,
      amount: "+5,000.00 USDC",
    });
  return a;
}

export function transferPaperFunds(
  account: PaperAccount,
  venue: Venue,
  amount: number,
  kind: "topup" | "return",
  now = Date.now(),
): PaperAccount {
  if (
    !Object.hasOwn(venues, venue) ||
    (kind === "topup" && !paperVenues.includes(venue))
  )
    throw new Error("This venue is preview-only and cannot be topped up.");
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1e9 ||
    roundCash(amount) !== amount
  )
    throw new Error(
      "Enter a positive USDC amount with up to 6 decimal places.",
    );
  const maximum =
    kind === "topup"
      ? account.walletCash
      : Math.max(0, paperTotals(account, venue).available);
  if (amount > maximum + 1e-8)
    throw new Error(
      kind === "topup"
        ? "Not enough funds in the demo wallet."
        : "This amount is required by positions or pending orders. Reduce it or release margin first.",
    );
  const a = structuredClone(account);
  const direction = kind === "topup" ? 1 : -1;
  a.venueCash[venue] = roundCash(a.venueCash[venue] + direction * amount);
  a.walletCash = roundCash(a.walletCash - direction * amount);
  event(a, new Date(now).toISOString(), {
    category: "transfers",
    actor: "you",
    venue,
    title:
      kind === "topup"
        ? "Demo venue topped up"
        : "Demo funds returned to wallet",
    detail:
      kind === "topup"
        ? `Demo wallet → ${venues[venue]} trading balance. Confirmed in this browser only; no tokens or real escrow funds moved.`
        : `${venues[venue]} available margin → demo wallet. Position and order requirements remain on this venue. No real withdrawal.`,
    amount: `${kind === "topup" ? "+" : "−"}${number(amount)} USDC`,
  });
  return a;
}

// Stored data is untrusted. Schema, finite numbers and wallet identity are checked
// before any record is displayed or participates in the local simulation.
export function decodePaperAccount(
  raw: string | null,
  wallet: string,
): PaperAccount | null {
  if (!raw || raw.length > 8_000_000) return null;
  try {
    const a = JSON.parse(raw) as PaperAccount & { cash?: number };
    const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
    const date = (s: unknown) =>
      typeof s === "string" && Number.isFinite(Date.parse(s));
    const venue = (v: unknown) =>
      typeof v === "string" && Object.hasOwn(venues, v);
    const market = (m: unknown) => m === "SOL" || m === "BTC";
    const bracket = (b: Bracket) =>
      b && [b.tp, b.sl].every((n) => n === undefined || (finite(n) && n > 0));
    if (
      ![1, 2].includes(a.version) ||
      a.wallet !== wallet ||
      !Number.isSafeInteger(a.seq) ||
      a.seq < 0 ||
      !date(a.createdAt)
    )
      return null;
    if (
      Number(a.version) === 1
        ? !finite(a.cash)
        : !a.venueCash ||
          Object.keys(a.venueCash).length !== Object.keys(venues).length ||
          !Object.keys(venues).every((v) => finite(a.venueCash[v as Venue])) ||
          !finite(a.walletCash) ||
          a.walletCash < 0
    )
      return null;
    if (
      ![a.positions, a.orders, a.fills, a.events].every(
        (v) => Array.isArray(v) && v.length <= 20000,
      )
    )
      return null;
    if (
      !a.positions.every(
        (p) =>
          typeof p.id === "string" &&
          venue(p.venue) &&
          market(p.market) &&
          [p.quantity, p.entry, p.margin, p.leverage].every(finite) &&
          p.quantity !== 0 &&
          p.entry > 0 &&
          p.margin >= 0 &&
          p.leverage > 0 &&
          bracket(p),
      )
    )
      return null;
    if (
      !a.orders.every(
        (o) =>
          typeof o.id === "string" &&
          o.draft &&
          venue(o.draft.venue) &&
          market(o.draft.market) &&
          ["Buy", "Sell"].includes(o.draft.side) &&
          typeof o.draft.type === "string" &&
          ["size", "limit", "slippage", "leverage"].every(
            (k) => typeof o.draft[k as "size"] === "string",
          ) &&
          [o.quantity, o.reserve].every(finite) &&
          o.quantity > 0 &&
          o.reserve >= 0 &&
          [
            "Open",
            "Scheduled plan",
            "Filled",
            "Cancelled",
            "Rejected",
          ].includes(o.status) &&
          date(o.createdAt) &&
          date(o.updatedAt) &&
          bracket(o.bracket),
      )
    )
      return null;
    if (
      !a.orders.every(
        (o) =>
          !o.execution ||
          ((o.execution.costBasis === undefined ||
            o.execution.costBasis === "venue-midpoint") &&
            o.execution.reference > 0 &&
            o.execution.effectivePrice > 0 &&
            o.execution.feeBps >= 0 &&
            (o.execution.costBasis !== "venue-midpoint" ||
              (o.execution.priceCost >= 0 && o.execution.costBps >= 0)) &&
            [
              "reference",
              "costBps",
              "effectivePrice",
              "priceCost",
              "feeBps",
            ].every((key) =>
              finite(
                o.execution![key as keyof NonNullable<PaperOrder["execution"]>],
              ),
            )),
      )
    )
      return null;
    if (
      !a.orders.every(
        (o) =>
          !o.draft.strategy ||
          (typeof o.draft.strategy.kind === "string" &&
            typeof o.draft.strategy.summary === "string" &&
            typeof o.draft.strategy.note === "string" &&
            finite(o.draft.strategy.quantity) &&
            o.draft.strategy.config &&
            Object.values(o.draft.strategy.config).every(
              (v) => typeof v === "string" || typeof v === "boolean",
            ) &&
            Array.isArray(o.draft.strategy.rows) &&
            o.draft.strategy.rows.length <= 200 &&
            o.draft.strategy.rows.every(
              (r) =>
                finite(r.quantity) &&
                r.quantity > 0 &&
                (r.price === undefined || finite(r.price)) &&
                (r.seconds === undefined || finite(r.seconds)),
            )),
      )
    )
      return null;
    if (
      !a.fills.every(
        (f) =>
          typeof f.id === "string" &&
          typeof f.order === "string" &&
          venue(f.venue) &&
          market(f.market) &&
          ["Buy", "Sell"].includes(f.side) &&
          [f.quantity, f.price, f.fee, f.realized].every(finite) &&
          f.quantity > 0 &&
          f.price > 0 &&
          f.fee >= 0 &&
          date(f.at),
      )
    )
      return null;
    if (
      !a.events.every(
        (e) =>
          [e.id, e.category, e.title, e.detail, e.amount, e.actor].every(
            (v) => typeof v === "string",
          ) &&
          date(e.time) &&
          (!e.venue || venue(e.venue)),
      )
    )
      return null;
    if (
      new Set(a.orders.map((o) => o.id)).size !== a.orders.length ||
      new Set(a.positions.map((p) => p.id)).size !== a.positions.length
    )
      return null;
    if (Number(a.version) === 1) {
      // Preserve the original v1 key in storage. Attribute committed cash first,
      // then spread the existing remainder, never credit new funds on migration.
      const balances = { pacifica: 0, bulk: 0, phoenix: 0, velocity: 0 };
      for (const p of a.positions) balances[p.venue] += p.margin;
      for (const o of a.orders.filter(active))
        balances[o.draft.venue] += o.reserve;
      const remainder =
        a.cash! - Object.values(balances).reduce((sum, n) => sum + n, 0);
      for (const v of paperVenues)
        balances[v] = roundCash(balances[v] + remainder / paperVenues.length);
      balances.pacifica = roundCash(
        balances.pacifica +
          a.cash! -
          Object.values(balances).reduce((sum, n) => sum + n, 0),
      );
      const migrated: PaperAccount = {
        ...a,
        version: 2,
        venueCash: balances,
        walletCash: 0,
      };
      delete (migrated as PaperAccount & { cash?: number }).cash;
      event(migrated, new Date().toISOString(), {
        category: "transfers",
        actor: "system",
        title: "Saved demo upgraded to venue balances",
        detail:
          "Existing cash, positions and orders preserved. Cash covers each venue’s existing requirements first; the remaining cash is split equally across Pacifica, BULK and Phoenix. No new credit or real transfer.",
        amount: `${number(a.cash!)} USDC preserved`,
      });
      return migrated;
    }
    return a;
  } catch {
    return null;
  }
}

export function paperQuote(
  venue: Venue,
  feed: FeedState,
  side: string,
  notional: number,
  now = Date.now(),
  quantity?: number,
  reference?: number,
): { quote: Quote | null; reference: number; reason: string | null } {
  if (venue === "velocity")
    return {
      quote: null,
      reference: NaN,
      reason: "No live book for this venue",
    };
  const fee = feed.fee;
  const reason =
    bookIssue(feed, now) ??
    (!fee ||
    !Number.isFinite(fee.takerBps) ||
    fee.takerBps < 0 ||
    fee.takerBps > 100 ||
    now - fee.fetchedAt > FEE_MAX_AGE_MS ||
    fee.fetchedAt > now + 500
      ? "Waiting for a current venue fee"
      : null);
  if (reason || !feed.book) return { quote: null, reference: NaN, reason };
  const ref = reference ?? bookMidpoint(feed.book);
  // Preserve the selected intent's sizing and price guard. walkBook calculates
  // friction independently against the fresh book's own midpoint; never rebase
  // an already selected slippage bound just to make a moving market pass.
  const size = quantity ?? notional / (reference ?? ref);
  if (!(size > 0) || !Number.isFinite(size) || !(ref > 0))
    return { quote: null, reference: ref, reason: "Enter a valid order size" };
  const quote = walkBook(
    venue as LiveVenue,
    feed.book,
    side === "Sell" ? "Sell" : "Buy",
    size,
    fee!.takerBps,
  );
  return {
    quote,
    reference: ref,
    reason: quote ? null : "Insufficient visible depth for this size",
  };
}

function applyFill(
  a: PaperAccount,
  order: PaperOrder,
  quote: Quote,
  now: number,
) {
  const at = new Date(now).toISOString();
  const d = order.draft;
  const previous = a.positions.find(
    (p) => p.market === d.market && p.venue === d.venue,
  );
  const {
    signed,
    oldQuantity,
    closing,
    realized,
    nextQuantity,
    remainingOld,
    opening,
    released,
    added,
  } = paperFillImpact(
    previous,
    d.side,
    quote.quantity,
    quote.averageFill,
    parseAmount(d.leverage),
  );
  const allocation = Math.max(0, added - released) + quote.venueFee;
  // Released margin can pay a closing fee or realized loss. Do not block a
  // reduction simply because the rest of the wallet's cash is committed.
  const required = added - released + quote.venueFee;
  if (
    required >
    paperTotals(a, d.venue).available + order.reserve + realized + 1e-6
  )
    throw new Error(
      `Not enough available venue margin on ${venues[d.venue]}. Top up this venue.`,
    );
  if (allocation > 0)
    event(a, at, {
      category: "orders",
      actor: "system",
      venue: d.venue,
      order: order.id,
      title: "Venue margin committed",
      detail: `${number(Math.max(0, added - released))} USDC required on ${venues[d.venue]}; ${number(quote.venueFee)} USDC modeled fee. Uses this venue’s existing balance, not a wallet transfer.`,
      amount: `${number(allocation)} USDC`,
    });
  event(a, at, {
    category: "orders",
    actor: "you",
    venue: d.venue,
    order: order.id,
    title: "Paper order placed",
    detail: `${d.side} ${d.market}-PERP · ${d.type}${d.reduceOnly ? " · Reduce only" : ""}`,
    amount: `${number(quote.notional)} USDC`,
  });
  a.venueCash[d.venue] = roundCash(
    a.venueCash[d.venue] + realized - quote.venueFee,
  );
  a.positions = a.positions.filter((p) => p !== previous);
  if (Math.abs(nextQuantity) > 1e-10) {
    const sameDirection = oldQuantity * signed > 0;
    const entry = sameDirection
      ? (previous!.entry * Math.abs(oldQuantity) +
          quote.averageFill * opening) /
        Math.abs(nextQuantity)
      : remainingOld
        ? previous!.entry
        : quote.averageFill;
    const margin = roundCash((previous?.margin ?? 0) - released + added);
    a.positions.push({
      id: `${d.venue}-${d.market}`,
      market: d.market,
      venue: d.venue,
      quantity: nextQuantity,
      entry,
      margin,
      leverage: margin
        ? (Math.abs(nextQuantity) * entry) / margin
        : parseAmount(d.leverage),
      ...(remainingOld || sameDirection
        ? { tp: previous?.tp, sl: previous?.sl }
        : {}),
      ...(opening ? order.bracket : {}),
    });
  }
  order.status = "Filled";
  order.reserve = 0;
  order.updatedAt = at;
  order.execution = {
    costBasis: "venue-midpoint",
    reference: quote.reference,
    costBps: quote.costBps,
    effectivePrice: quote.effectivePrice,
    priceCost: quote.priceCost,
    feeBps: (quote.venueFee / quote.notional) * 10000,
  };
  a.fills.unshift({
    id: `P-F${++a.seq}`,
    order: order.id,
    market: d.market,
    venue: d.venue,
    side: d.side,
    quantity: quote.quantity,
    price: quote.averageFill,
    fee: quote.venueFee,
    realized,
    at,
  });
  event(a, at, {
    category: "trades",
    actor: "system",
    venue: d.venue,
    order: order.id,
    title: "Paper order filled",
    detail: `${d.market}-PERP · ${d.side} at ${number(quote.averageFill)} USD · visible-book simulation`,
    amount: `${number(quote.notional)} USDC`,
  });
  event(a, at, {
    category: "fees",
    actor: "system",
    venue: d.venue,
    order: order.id,
    title: "Modeled venue fee booked",
    detail:
      "Assumed venue fee deducted from paper funds. Cinder pricing excluded.",
    amount: `−${number(quote.venueFee)} USDC`,
  });
  if (closing)
    event(a, at, {
      category: "orders",
      actor: "system",
      venue: d.venue,
      order: order.id,
      title: "Venue margin released",
      detail: `${number(released)} USDC available again on ${venues[d.venue]}. Realized PnL: ${number(realized)} USDC, booked on this venue. No funds moved to another venue.`,
      amount: `${number(released)} USDC`,
    });
}
export function placePaperOrder(
  account: PaperAccount,
  draft: Draft,
  feed: FeedState,
  now = Date.now(),
  reference?: number,
  quantity?: number,
  bracket: Bracket = {},
): { account: PaperAccount; order: PaperOrder } {
  const a = structuredClone(account);
  const notional = parseAmount(draft.size),
    leverage = parseAmount(draft.leverage);
  if (
    !Number.isFinite(notional) ||
    notional <= 0 ||
    notional > 1e9 ||
    !Number.isFinite(leverage) ||
    leverage < 1 ||
    leverage > 25
  )
    throw new Error("Enter a valid size and leverage (1x to 25x)");
  const limit = draft.type === "Limit" ? parseAmount(draft.limit) : undefined;
  if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0))
    throw new Error("Enter a valid limit price");
  const requestedQuantity = quantity ?? (limit ? notional / limit : undefined);
  const result = paperQuote(
    draft.venue,
    feed,
    draft.side,
    notional,
    now,
    requestedQuantity,
    reference,
  );
  if (!Number.isFinite(result.reference))
    throw new Error(result.reason ?? "Waiting for a fresh book");
  const qty =
    requestedQuantity ??
    result.quote?.quantity ??
    notional / (reference ?? result.reference);
  const existing = a.positions.find(
    (p) => p.venue === draft.venue && p.market === draft.market,
  );
  if (
    draft.reduceOnly &&
    (!existing ||
      Math.sign(existing.quantity) === (draft.side === "Buy" ? 1 : -1) ||
      qty > Math.abs(existing.quantity) + 1e-10)
  )
    throw new Error(
      "Reduce-only size must reduce an existing position on this venue",
    );
  const entry =
    draft.type === "Limit"
      ? parseAmount(draft.limit)
      : (result.quote?.averageFill ?? result.reference);
  const direction = draft.side === "Buy" ? 1 : -1;
  if (
    [bracket.tp, bracket.sl].some(
      (n) => n !== undefined && (!Number.isFinite(n) || n <= 0),
    ) ||
    (bracket.tp !== undefined && direction * (bracket.tp - entry) <= 0) ||
    (bracket.sl !== undefined && direction * (bracket.sl - entry) >= 0)
  )
    throw new Error(
      "TP must be profitable and SL adverse relative to the estimated entry",
    );
  const at = new Date(now).toISOString();
  const order: PaperOrder = {
    id: `P-O${++a.seq}`,
    draft: { ...draft, route: undefined },
    quantity: qty,
    reserve: 0,
    status: "Open",
    createdAt: at,
    updatedAt: at,
    bracket,
  };
  a.orders.unshift(order);
  if (draft.strategy) {
    order.status = "Scheduled plan";
    order.reserve = roundCash(
      notional / leverage + (notional * feed.fee!.takerBps) / 10000,
    );
    if (order.reserve > paperTotals(account, draft.venue).available)
      throw new Error(
        `Not enough available venue margin on ${venues[draft.venue]}. Top up this venue.`,
      );
    event(a, at, {
      category: "orders",
      actor: "system",
      venue: draft.venue,
      order: order.id,
      title: "Paper strategy funds reserved",
      detail: `Reserved on ${venues[draft.venue]} for the preview plan. No child orders or transfers are executed.`,
      amount: `${number(order.reserve)} USDC`,
    });
    event(a, at, {
      category: "orders",
      actor: "you",
      venue: draft.venue,
      order: order.id,
      title: "Paper strategy scheduled",
      detail: `${draft.type} · funds reserved locally. Preview plan only; no child orders or fills are generated.`,
      amount: `${number(notional)} USDC`,
    });
    return { account: a, order };
  }
  if (draft.type === "Limit") {
    const limit = parseAmount(draft.limit);
    if (!Number.isFinite(limit) || limit <= 0)
      throw new Error("Enter a valid limit price");
    const crosses =
      direction *
        ((draft.side === "Buy"
          ? feed.book!.asks[0].price
          : feed.book!.bids[0].price) -
          limit) <=
      0;
    if (draft.tif === "ALO" && crosses)
      throw new Error("Post-only order would cross the book");
    if (
      crosses &&
      result.quote &&
      direction * (result.quote.worstFill - limit) <= 1e-10
    )
      applyFill(a, order, result.quote, now);
    else if (draft.tif === "IOC") {
      order.status = "Cancelled";
      order.reason =
        "IOC: full size unavailable within limit (no partial-fill simulation)";
      event(a, at, {
        category: "orders",
        actor: "you",
        venue: draft.venue,
        order: order.id,
        title: "Paper IOC cancelled",
        detail: order.reason,
        amount: "Unfilled",
      });
    } else {
      order.reserve = roundCash(
        (draft.reduceOnly ? 0 : (qty * limit) / leverage) +
          (qty * limit * feed.fee!.takerBps) / 10000,
      );
      if (order.reserve > paperTotals(account, draft.venue).available)
        throw new Error(
          `Not enough available venue margin on ${venues[draft.venue]}. Top up this venue.`,
        );
      event(a, at, {
        category: "orders",
        actor: "system",
        venue: draft.venue,
        order: order.id,
        title: "Paper collateral reserved",
        detail: `Reserved on ${venues[draft.venue]} for a resting limit and its estimated fee. No wallet transfer.`,
        amount: `${number(order.reserve)} USDC`,
      });
      event(a, at, {
        category: "orders",
        actor: "you",
        venue: draft.venue,
        order: order.id,
        title: "Paper limit order resting",
        detail: `${draft.market}-PERP · ${draft.side} limit ${number(limit)} USD. Monitored while this market's feed is active.`,
        amount: `${number(notional)} USDC`,
      });
    }
  } else {
    if (!result.quote)
      throw new Error(result.reason ?? "Insufficient visible depth");
    const tolerance = parseAmount(draft.slippage);
    if (
      !Number.isFinite(tolerance) ||
      tolerance <= 0 ||
      tolerance >= 100 ||
      direction * (result.quote.worstFill / result.reference - 1) * 100 >
        tolerance + 1e-10
    )
      throw new Error("Fresh fill exceeds maximum slippage");
    applyFill(a, order, result.quote, now);
  }
  return { account: a, order };
}
export function cancelPaperOrder(
  account: PaperAccount,
  id: string,
  now = Date.now(),
): PaperAccount {
  const a = structuredClone(account),
    order = a.orders.find((o) => o.id === id);
  if (!order || !active(order)) throw new Error("This order is no longer open");
  const reserve = order.reserve;
  order.status = "Cancelled";
  order.reserve = 0;
  order.updatedAt = new Date(now).toISOString();
  event(a, order.updatedAt, {
    category: "orders",
    actor: "you",
    venue: order.draft.venue,
    order: id,
    title: "Paper order cancelled",
    detail: "Unfilled order cancelled locally. Prior fills remain in history.",
    amount: "Cancelled",
  });
  event(a, order.updatedAt, {
    category: "orders",
    actor: "system",
    venue: order.draft.venue,
    order: id,
    title: "Paper reservation released",
    detail: `Reservation released back to available margin on ${venues[order.draft.venue]}. No funds moved.`,
    amount: `${number(reserve)} USDC`,
  });
  return a;
}

// Only the selected market's active, fresh feeds are monitored. No workers or
// native venue orders continue after closing the demo or switching markets.
export function tickPaperAccount(
  account: PaperAccount,
  market: Market,
  feeds: Partial<Record<Venue, FeedState>>,
  now = Date.now(),
): PaperAccount {
  let a = account;
  for (const open of account.orders.filter(
    (o) => o.status === "Open" && o.draft.market === market,
  )) {
    const feed = feeds[open.draft.venue];
    if (!feed) continue;
    const r = paperQuote(
      open.draft.venue,
      feed,
      open.draft.side,
      0,
      now,
      open.quantity,
    );
    if (
      !r.quote ||
      (open.draft.side === "Buy" ? 1 : -1) *
        (r.quote.worstFill - parseAmount(open.draft.limit)) >
        1e-10
    )
      continue;
    const next = structuredClone(a),
      order = next.orders.find((o) => o.id === open.id)!;
    try {
      if (order.draft.reduceOnly) {
        const p = next.positions.find(
          (p) => p.venue === order.draft.venue && p.market === market,
        );
        if (
          !p ||
          p.quantity * (order.draft.side === "Buy" ? 1 : -1) >= 0 ||
          order.quantity > Math.abs(p.quantity) + 1e-10
        ) {
          a = cancelPaperOrder(a, order.id, now);
          continue;
        }
      }
      applyFill(next, order, r.quote, now);
      a = next;
    } catch {
      /* Insufficient funds/depth: keep resting, never manufacture fills. */
    }
  }
  for (const p of [...a.positions].filter(
    (p) => p.market === market && (p.tp || p.sl),
  )) {
    const feed = feeds[p.venue];
    if (!feed || bookIssue(feed, now)) continue;
    const direction = Math.sign(p.quantity);
    const price =
      direction > 0 ? feed.book!.bids[0].price : feed.book!.asks[0].price;
    const trigger =
      p.tp && direction * (price - p.tp) >= 0
        ? "Take profit"
        : p.sl && direction * (price - p.sl) <= 0
          ? "Stop loss"
          : null;
    if (!trigger) continue;
    const q = paperQuote(
      p.venue,
      feed,
      direction > 0 ? "Sell" : "Buy",
      0,
      now,
      Math.abs(p.quantity),
    );
    if (!q.quote) continue;
    const d: Draft = {
      id: "",
      market,
      venue: p.venue,
      mode: "manual",
      allowed: [p.venue],
      side: direction > 0 ? "Sell" : "Buy",
      type: "Market",
      size: String(q.quote.notional),
      limit: "",
      slippage: "99",
      leverage: String(p.leverage),
      reduceOnly: true,
      sizeUnit: "USDC",
    };
    try {
      const next = structuredClone(a),
        at = new Date(now).toISOString();
      const o: PaperOrder = {
        id: `P-O${++next.seq}`,
        draft: d,
        quantity: Math.abs(p.quantity),
        reserve: 0,
        status: "Open",
        createdAt: at,
        updatedAt: at,
        bracket: {},
        reason: `${trigger} trigger`,
      };
      next.orders.unshift(o);
      event(next, at, {
        category: "orders",
        actor: "system",
        venue: p.venue,
        order: o.id,
        title: `Paper ${trigger.toLowerCase()} triggered`,
        detail:
          "Reduce-only close against the fresh visible book. Trigger price is not a guaranteed fill price.",
        amount: `${number(q.quote.notional)} USDC`,
      });
      applyFill(next, o, q.quote, now);
      a = next;
    } catch {
      /* Trigger remains attached if no safe full fill is possible. */
    }
  }
  return a;
}
