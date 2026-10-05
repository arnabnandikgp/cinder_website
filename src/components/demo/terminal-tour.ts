export const TOUR_SEEN_KEY = "cinder:terminal-tour:v1";

export type TourPresentation = "spotlight" | "overview";
export type TourStep = {
  id: string;
  label: string;
  title: string;
  description: string;
  target: string;
  context: Readonly<Record<string, string>>;
  presentation?: TourPresentation;
  navigationTarget?: string;
  modes?: readonly { name: string; description: string }[];
};

export const tourSteps: readonly TourStep[] = [
  {
    id: "modes",
    label: "TRADING MODES",
    title: "Two ways to trade.",
    description: "Start with the view that fits your trade.",
    modes: [
      {
        name: "Standard",
        description: "Choose a venue and trade with its chart and order book.",
      },
      {
        name: "Pro",
        description:
          "Compare estimated price cost and venue fees across venues for your order size.",
      },
    ],
    target: ".d-mode-switch",
    context: { view: "trade", mode: "manual" },
  },
  {
    id: "standard",
    label: "STANDARD MODE",
    title: "Choose where you trade.",
    description:
      "Select an execution venue here. Its chart and order book follow your choice. No wallet is needed to explore.",
    target: ".d-venue-header",
    context: { view: "trade", mode: "manual" },
  },
  {
    id: "standard-workspace",
    label: "STANDARD MODE",
    title: "Your trading workspace.",
    description:
      "The selected venue's chart and order book sit beside your order ticket. Positions, open orders, trades and funding stay together below.",
    target: ".d-workspace",
    presentation: "overview",
    navigationTarget: 'button[aria-labelledby="d-nav-trade-label"]',
    context: {
      view: "trade",
      mode: "manual",
      record: "positions",
      scope: "all",
    },
  },
  {
    id: "pro-workspace",
    label: "PRO MODE",
    title: "Compare venues in one view.",
    description:
      "Pro replaces the venue chart and order book with a cross-venue cost comparison. Your order size drives the curves and estimates, while your ticket and trading records stay in place.",
    target: ".d-workspace",
    presentation: "overview",
    navigationTarget: 'button[aria-labelledby="d-nav-trade-label"]',
    context: {
      view: "trade",
      mode: "auto",
      panel: "cost",
      analysis: "live",
      record: "positions",
      scope: "all",
    },
  },
  {
    id: "pro-cost",
    label: "PRO MODE",
    title: "Compare before you commit.",
    description:
      "Entry cost adds price cost and venue fees, in basis points. The lowest comparable estimate comes first. Your order size drives the comparison; these are estimates, not guaranteed fills.",
    target: "#d-route-comparison",
    context: {
      view: "trade",
      mode: "auto",
      panel: "cost",
      analysis: "live",
      record: "positions",
      scope: "all",
    },
  },
  {
    id: "account-overview",
    label: "ACCOUNT",
    title: "Your account at a glance.",
    description:
      "Connect a wallet to start with 10,000 simulated USDC. Estimated account equity, available margin and positions stay together, saved for this wallet in this browser.",
    target: ".d-workspace",
    presentation: "overview",
    navigationTarget: 'button[aria-labelledby="d-nav-account-label"]',
    context: { view: "account", scope: "all", record: "positions" },
  },
  {
    id: "account",
    label: "ACCOUNT",
    title: "Know where your margin is.",
    description:
      "See position margin requirements grouped by execution venue. These are read-only requirements, not separate venue accounts or editable allocations. Pending order reservations appear in Balance breakdown.",
    target: ".d-margin-group",
    context: { view: "account", scope: "all" },
  },
  {
    id: "activity-overview",
    label: "ACTIVITY",
    title: "Your account's timeline.",
    description:
      "One feed brings together account events from every venue, so you can see what happened without switching between separate dashboards.",
    target: ".d-workspace",
    presentation: "overview",
    navigationTarget: 'button[aria-labelledby="d-nav-activity-label"]',
    context: { view: "activity", filter: "all", actor: "all" },
  },
  {
    id: "activity",
    label: "ACTIVITY",
    title: "Follow the whole account.",
    description:
      "Follow paper collateral allocations, orders, fills and modeled fees across venues. Filter by event type, then open a record for its details. Funding payments are not simulated.",
    target: ".d-activity",
    context: { view: "activity", filter: "all", actor: "all" },
  },
  {
    id: "agents-overview",
    label: "AGENTS",
    title: "Trading access, under your control.",
    description:
      "Inspect each agent’s permissions, market, expiry and order allowance. View all activity opens the same account timeline filtered to that agent. Add agent previews authorization; no access is granted in this demo.",
    target: ".d-workspace",
    presentation: "overview",
    navigationTarget: 'button[aria-labelledby="d-nav-agents-label"]',
    context: { view: "agents", agent: "sol-execution" },
  },
];

export type TourRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};
export type TourViewport = { width: number; height: number };
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/** The live element stays behind the native modal. Surrounding panes blur the
 * background without cloning a chart, lifting controls or enabling orders. */
export function tourLayout(
  target: TourRect | null,
  viewport: TourViewport,
  card: { width: number; height: number },
  presentation: TourPresentation = "spotlight",
) {
  const inset = 16,
    gap = 16;
  const mobile = viewport.width <= 760;
  const width = Math.min(card.width, Math.max(0, viewport.width - inset * 2));
  const height = Math.min(
    card.height,
    Math.max(0, viewport.height - inset * 2),
  );
  let frame = target
    ? {
        left: clamp(target.left - 6, 4, viewport.width - 4),
        top: clamp(target.top - 6, 4, viewport.height - 4),
        width: 0,
        height: 0,
      }
    : null;
  if (frame && target) {
    frame.width =
      clamp(target.left + target.width + 6, frame.left, viewport.width - 4) -
      frame.left;
    frame.height =
      clamp(target.top + target.height + 6, frame.top, viewport.height - 4) -
      frame.top;
  }
  const bottom = viewport.height - inset - height;
  let left = (viewport.width - width) / 2,
    top = bottom;
  let side: "left" | "right" | "top" | "bottom" | "none" | "overlay" = "none";
  if (presentation === "overview") {
    // Overview stops keep the visible content clear, without cropping the
    // cutout to the compact corner card. The header is excluded by the caller.
    return {
      frame,
      card: {
        left: mobile ? left : viewport.width - inset - width,
        top,
        width,
        height,
      },
      side: "overlay" as const,
      mobile,
    };
  }
  if (frame && !mobile) {
    if (frame.left >= width + gap + inset) {
      left = frame.left - width - gap;
      top = clamp(frame.top, inset, bottom);
      side = "left";
    } else if (
      viewport.width - frame.left - frame.width >=
      width + gap + inset
    ) {
      left = frame.left + frame.width + gap;
      top = clamp(frame.top, inset, bottom);
      side = "right";
    } else if (
      viewport.height - frame.top - frame.height >=
      height + gap + inset
    ) {
      left = clamp(frame.left, inset, viewport.width - width - inset);
      top = frame.top + frame.height + gap;
      side = "bottom";
    } else if (frame.top >= height + gap + inset) {
      left = clamp(frame.left, inset, viewport.width - width - inset);
      top = frame.top - height - gap;
      side = "top";
    }
  }
  if (!frame) top = (viewport.height - height) / 2;
  else if (mobile || side === "none") {
    // A full-width section cannot take a side callout. Reveal its upper part
    // above the bottom sheet rather than laying the card over the subject.
    side = "bottom";
    frame.height = Math.min(frame.height, Math.max(0, top - gap - frame.top));
    if (frame.height < 8 || frame.width < 8) frame = null;
  }
  return { frame, card: { left, top, width, height }, side, mobile };
}

/** Join the content cutout to its active navigation tab. The notch extends down
 * to the content, leaving no blur strip or internal border across their join. */
export function tourOverviewShape(
  frame: TourRect,
  navigation: TourRect | null,
  viewport: TourViewport,
) {
  const left = frame.left,
    top = frame.top,
    right = left + frame.width,
    bottom = top + frame.height;
  const notchLeft = navigation ? clamp(navigation.left, left, right) : left;
  const notchRight = navigation
    ? clamp(navigation.left + navigation.width, notchLeft, right)
    : left;
  const notchTop = navigation ? clamp(navigation.top, 4, top) : top;
  const notch: TourRect | null =
    navigation &&
    navigation.height > 0 &&
    notchRight > notchLeft &&
    notchTop < top
      ? {
          left: notchLeft,
          top: notchTop,
          width: notchRight - notchLeft,
          height: top - notchTop,
        }
      : null;
  const radius = Math.min(8, frame.width / 2, frame.height / 2);
  const leftRadius = notch ? Math.min(radius, (notch.left - left) / 2) : radius;
  const rightRadius = notch
    ? Math.min(radius, (right - notch.left - notch.width) / 2)
    : radius;
  const outline = [`M ${left + leftRadius} ${top}`];
  if (notch) {
    const nl = notch.left,
      nr = nl + notch.width,
      nt = notch.top;
    const cap = Math.min(radius, notch.width / 2, notch.height / 2);
    const joinLeft = Math.min(leftRadius, notch.height / 2),
      joinRight = Math.min(rightRadius, notch.height / 2);
    outline.push(
      `H ${nl - joinLeft}`,
      `Q ${nl} ${top} ${nl} ${top - joinLeft}`,
      `V ${nt + cap}`,
      `Q ${nl} ${nt} ${nl + cap} ${nt}`,
      `H ${nr - cap}`,
      `Q ${nr} ${nt} ${nr} ${nt + cap}`,
      `V ${top - joinRight}`,
      `Q ${nr} ${top} ${nr + joinRight} ${top}`,
    );
  }
  outline.push(
    `H ${right - rightRadius}`,
    `Q ${right} ${top} ${right} ${top + rightRadius}`,
    `V ${bottom - radius}`,
    `Q ${right} ${bottom} ${right - radius} ${bottom}`,
    `H ${left + radius}`,
    `Q ${left} ${bottom} ${left} ${bottom - radius}`,
    `V ${top + leftRadius}`,
    `Q ${left} ${top} ${left + leftRadius} ${top}`,
    "Z",
  );
  const headerShades: TourRect[] = notch
    ? [
        { left: 0, top: 0, width: viewport.width, height: notch.top },
        { left: 0, top: notch.top, width: notch.left, height: notch.height },
        {
          left: notch.left + notch.width,
          top: notch.top,
          width: viewport.width - notch.left - notch.width,
          height: notch.height,
        },
      ]
    : [{ left: 0, top: 0, width: viewport.width, height: top }];
  return {
    notch,
    outline: outline.join(" "),
    shades: [
      ...headerShades,
      {
        left: 0,
        top: bottom,
        width: viewport.width,
        height: viewport.height - bottom,
      },
      { left: 0, top, width: left, height: frame.height },
      { left: right, top, width: viewport.width - right, height: frame.height },
    ],
  };
}
