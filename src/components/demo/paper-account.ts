import type { ActivityEvent } from "./activity";
import { number, venues, type Draft, type Market, type Venue } from "./data";
import { bookIssue, walkBook } from "./live-routing";
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
  version: 1;
  wallet: string;
  cash: number;
  seq: number;
  createdAt: string;
  positions: PaperPosition[];
  orders: PaperOrder[];
  fills: PaperFill[];
  events: ActivityEvent[];
};
export const PAPER_PREFIX = "cinder:paper:v1:";
const roundCash = (n: number) => Math.round(n * 1e6) / 1e6;
const active = (o: PaperOrder) =>
  o.status === "Open" || o.status === "Scheduled plan";
export function paperTotals(account: PaperAccount | null) {
  const margin = account?.positions.reduce((n, p) => n + p.margin, 0) ?? 0;
  const reserved =
    account?.orders.filter(active).reduce((n, o) => n + o.reserve, 0) ?? 0;
  return {
    cash: account?.cash ?? 0,
    margin,
    reserved,
    available: roundCash((account?.cash ?? 0) - margin - reserved),
  };
}

// Valuation and spending capacity are deliberately different. The paper risk
// model reserves against settled cash; unrealised gains are not spendable.
export function paperValuation(
  account: PaperAccount | null,
  marks: Partial<Record<string, number>>,
) {
  const missing =
    account?.positions.filter(
      (p) => !Number.isFinite(marks[p.id]) || !(marks[p.id]! > 0),
    ) ?? [];
  const unrealized = missing.length
    ? null
    : roundCash(
        account?.positions.reduce(
          (sum, p) => sum + (marks[p.id]! - p.entry) * p.quantity,
          0,
        ) ?? 0,
      );
  return {
    unrealized,
    equity:
      unrealized === null ? null : roundCash((account?.cash ?? 0) + unrealized),
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
};

// No simulated funding status or native venue capacity is invented here. This
// previews only the local paper engine; live eligibility must come from Cinder.
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
    quantity ?? (limit ? notional / limit : notional / result.reference);
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
  const available = paperTotals(account).available;
  if (draft.strategy || (limit !== undefined && !fills)) {
    const margin =
      draft.strategy || !draft.reduceOnly ? notional / leverage : 0;
    const fees = (notional * feed.fee!.takerBps) / 10000;
    const cancelled = !draft.strategy && draft.tif === "IOC";
    const required = cancelled ? 0 : roundCash(margin + fees);
    return {
      margin: cancelled ? 0 : margin,
      released: 0,
      fees: cancelled ? 0 : fees,
      availableAfter: roundCash(available - required),
      reservation: true,
      reason:
        reduceIssue ??
        (limit !== undefined && draft.tif === "ALO" && crosses
          ? "Post-only order would cross the book. Change the limit price."
          : cancelled
            ? "IOC will cancel unfilled: the full size is not available within this limit."
            : required > available
              ? "Not enough available margin for this paper reservation. Reduce size or cancel an open order."
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
  return {
    margin: Math.max(0, impact.delta),
    released: Math.max(0, -impact.delta),
    fees: result.quote.venueFee,
    availableAfter: after,
    reservation: false,
    reason:
      reduceIssue ??
      (limit !== undefined && draft.tif === "ALO" && crosses
        ? "Post-only order would cross the book. Change the limit price."
        : limit === undefined &&
            direction * (result.quote.worstFill / result.reference - 1) * 100 >
              tolerance + 1e-10
          ? "Fresh fill exceeds maximum slippage. Reduce size or adjust slippage."
          : after < -1e-6
            ? "Not enough available margin for this paper order. Reduce size or choose higher leverage."
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
    version: 1,
    wallet,
    cash: 10000,
    seq: 0,
    createdAt: at,
    positions: [],
    orders: [],
    fills: [],
    events: [],
  };
  event(a, at, {
    category: "transfers",
    actor: "system",
    title: "Paper account credited",
    detail:
      "10,000 simulated USDC credited to your Cinder vault. No tokens were transferred.",
    amount: "+10,000.00 USDC",
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
    const a = JSON.parse(raw) as PaperAccount;
    const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
    const date = (s: unknown) =>
      typeof s === "string" && Number.isFinite(Date.parse(s));
    const venue = (v: unknown) =>
      typeof v === "string" && Object.hasOwn(venues, v);
    const market = (m: unknown) => m === "SOL" || m === "BTC";
    const bracket = (b: Bracket) =>
      b && [b.tp, b.sl].every((n) => n === undefined || (finite(n) && n > 0));
    if (
      a.version !== 1 ||
      a.wallet !== wallet ||
      !finite(a.cash) ||
      !Number.isSafeInteger(a.seq) ||
      a.seq < 0 ||
      !date(a.createdAt)
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
          (Object.values(o.execution).every(finite) &&
            o.execution.reference > 0 &&
            o.execution.effectivePrice > 0 &&
            o.execution.feeBps >= 0 &&
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
  const ref =
    reference ?? (feed.book.bids[0].price + feed.book.asks[0].price) / 2;
  const size = quantity ?? notional / ref;
  if (!(size > 0) || !Number.isFinite(size) || !(ref > 0))
    return { quote: null, reference: ref, reason: "Enter a valid order size" };
  const quote = walkBook(
    venue as LiveVenue,
    feed.book,
    side === "Sell" ? "Sell" : "Buy",
    size,
    ref,
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
  if (required > paperTotals(a).available + order.reserve + realized + 1e-6)
    throw new Error("Not enough available paper collateral");
  if (allocation > 0)
    event(a, at, {
      category: "transfers",
      actor: "system",
      venue: d.venue,
      order: order.id,
      title: "Paper collateral allocated",
      detail: `Cinder vault → Cinder account on ${venues[d.venue]}. ${number(Math.max(0, added - released))} USDC for margin; ${number(quote.venueFee)} USDC for the modeled fee.`,
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
  a.cash = roundCash(a.cash + realized - quote.venueFee);
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
    reference:
      quote.notional / quote.quantity -
      (quote.priceCost / quote.quantity) * (d.side === "Buy" ? 1 : -1),
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
      category: "transfers",
      actor: "system",
      venue: d.venue,
      order: order.id,
      title: "Paper margin returned",
      detail: `${number(released)} USDC margin released to the Cinder vault. Realized PnL: ${number(realized)} USDC.`,
      amount: `${number(released + realized)} USDC`,
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
  const qty = requestedQuantity ?? notional / result.reference;
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
    if (order.reserve > paperTotals(account).available)
      throw new Error("Not enough available paper collateral");
    event(a, at, {
      category: "transfers",
      actor: "system",
      venue: draft.venue,
      order: order.id,
      title: "Paper strategy funds reserved",
      detail:
        "Reserved in the Cinder vault for the preview plan. No child orders or venue transfers are executed.",
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
      if (order.reserve > paperTotals(account).available)
        throw new Error("Not enough available paper collateral");
      event(a, at, {
        category: "transfers",
        actor: "system",
        venue: draft.venue,
        order: order.id,
        title: "Paper collateral reserved",
        detail: `Cinder vault → Cinder account on ${venues[draft.venue]}. Reservation for a resting limit and its estimated fee.`,
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
    category: "transfers",
    actor: "system",
    venue: order.draft.venue,
    order: id,
    title: "Paper reservation released",
    detail: "Reserved collateral returned to the Cinder vault.",
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
