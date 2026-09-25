export const center = { x: 1330, y: 530 };
export const orbitRadius = 310;
export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const smooth = (n: number) => {
  const t = clamp01(n);
  return t * t * (3 - 2 * t);
};
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const starts = [
  [1040, 190],
  [1650, 260],
  [1675, 740],
  [1070, 830],
  [300, 265],
];

// One brisk orbital flourish, then a different composition for routing.
// Integrating the speed ramps keeps position AND velocity continuous.
export const orbitRotation = (frame: number) => {
  const t = Math.max(0, frame - 232);
  const up = Math.min(t, 16);
  const ramp = up ** 3 / 16 ** 2 - up ** 4 / (2 * 16 ** 3);
  const cruise = Math.min(Math.max(0, t - 16), 56);
  const down = Math.min(Math.max(0, t - 72), 20);
  const brake = down - down ** 3 / 20 ** 2 + down ** 4 / (2 * 20 ** 3);
  return (ramp + cruise + brake) * 0.0225;
};

export const fanProgress = (frame: number) => smooth((frame - 324) / 54);
export const accountPosition = (frame: number) => ({
  x: mix(center.x, 1120, fanProgress(frame)),
  y: center.y,
});
export const badgeSize = (frame: number) => mix(146, 108, fanProgress(frame));

export const venuePosition = (frame: number, index: number) => {
  const driftFrame = Math.min(frame, 150);
  const phase = index * 1.4;
  const x =
    starts[index][0] +
    Math.sin(driftFrame * 0.078 + phase) * 62 +
    Math.sin(driftFrame * 0.127 + phase * 2) * 11;
  const y =
    starts[index][1] +
    Math.cos(driftFrame * 0.063 + phase) *
      (index === 0 ? 24 : index === 3 ? 36 : 42);
  const settle = smooth((frame - 150 - index * 2) / 72);
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5 + orbitRotation(frame);
  if (frame >= 324) {
    const fan = fanProgress(frame);
    // Preserve angular order around the account while opening into a right fan.
    // Left-side venues travel above/below Cinder, never through its mark.
    const targets = [0, 0.58, 1.16, Math.PI * 2 - 1.16, Math.PI * 2 - 0.58];
    const fanAngle = mix(angle, targets[index], fan);
    const account = accountPosition(frame);
    return {
      x: account.x + Math.cos(fanAngle) * mix(orbitRadius, 500, fan),
      y: account.y + Math.sin(fanAngle) * mix(orbitRadius, 360, fan),
    };
  }
  // The far-left opening mark uses an upper corridor, clear of the headline.
  // It joins the same orbit at the end without crossing the central account.
  if (index === 4) {
    return {
      x: mix(x, center.x + Math.cos(angle) * orbitRadius, settle),
      y: mix(
        y,
        center.y + Math.sin(angle) * orbitRadius,
        smooth((settle - 0.6) / 0.4),
      ),
    };
  }
  // Travel around Cinder, not across it. Keeping angular order avoids collisions.
  const startAngle = Math.atan2(y - center.y, x - center.x);
  const delta = Math.atan2(
    Math.sin(angle - startAngle),
    Math.cos(angle - startAngle),
  );
  const travelAngle = startAngle + delta * settle;
  const radius = mix(
    Math.hypot(x - center.x, y - center.y),
    orbitRadius,
    settle,
  );
  return {
    x: center.x + Math.cos(travelAngle) * radius,
    // Keep the topmost assembly arc inside the title-safe area.
    y:
      center.y +
      Math.sin(travelAngle) * radius +
      (index === 0 ? Math.sin(Math.PI * settle) * 16 : 0),
  };
};

// Shorten each spoke at BOTH ends. Nothing runs through the central mark or a venue badge.
export const connection = (frame: number, index: number) => {
  const p = venuePosition(frame, index);
  const account = accountPosition(frame);
  const halfSize = badgeSize(frame) / 2;
  const dx = p.x - account.x;
  const dy = p.y - account.y;
  const distance = Math.hypot(dx, dy);
  // Clip at the full badge + label bounds, so a spoke cannot cross a venue name.
  const towardX = -dx / distance;
  const towardY = -dy / distance;
  const stop = Math.min(
    (halfSize + 10) / Math.abs(towardX),
    (towardY > 0 ? halfSize + 59 : halfSize + 10) / Math.abs(towardY),
  );
  // As the privacy panel forms, rays leave its outer edge, not through the
  // account mark or lock. Use the same panel dimensions as NetworkDiagram.
  const panelEdge = Math.min(
    134 / Math.abs(towardX),
    (dy > 0 ? 196 : 142) / Math.abs(towardY),
  );
  const start = mix(125, panelEdge, smooth((frame - 540) / 30));
  return {
    x1: account.x + (dx / distance) * start,
    y1: account.y + (dy / distance) * start,
    x2: p.x + towardX * stop,
    y2: p.y + towardY * stop,
  };
};

// Exactly one highlighted route. An outgoing instruction and a returning result,
// not simultaneous activity everywhere. Timings are illustrative, not latency claims.
export const routeSignal = (frame: number) => {
  const windows = [
    { start: 372, venue: 4 },
    { start: 490, venue: 0 },
    { start: 588, venue: 3 },
  ];
  const route = windows.find(
    ({ start }) => frame >= start && frame < start + 44,
  );
  if (!route) return null;
  const t = frame - route.start;
  return {
    venue: route.venue,
    progress: t < 22 ? smooth(t / 16) : 1 - smooth((t - 22) / 16),
    traveling: t < 16 || (t >= 22 && t < 38),
    returning: t >= 22,
    arrival: smooth((t - 13) / 3) * (1 - smooth((t - 22) / 6)),
    received: smooth((t - 35) / 3) * (1 - smooth((t - 38) / 6)),
    opacity: smooth(t / 4) * (1 - smooth((t - 38) / 6)),
  };
};
