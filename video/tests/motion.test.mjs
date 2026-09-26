import { test } from "node:test";
import assert from "node:assert/strict";
import {
  center,
  accountPosition,
  badgeSize,
  fanProgress,
  orbitRadius,
  orbitRotation,
  connection,
  routeSignal,
  venuePosition,
  markPosition,
  traderContribution,
} from "../src/motion.ts";

test("the logo follows one continuous path directly into its closing position", () => {
  assert.deepEqual(markPosition(645), { x: 1029, y: 428 });
  assert.deepEqual(markPosition(697), { x: 869, y: 225 });
  assert.deepEqual(markPosition(809), markPosition(697));
  let previousSpeed = 0;
  for (let frame = 646; frame <= 698; frame++) {
    const previous = markPosition(frame - 1);
    const next = markPosition(frame);
    const speed = Math.hypot(next.x - previous.x, next.y - previous.y);
    assert.ok(
      next.x <= previous.x && next.y <= previous.y,
      "No bounce or detour",
    );
    assert.ok(speed < 10, `Logo jump at ${frame}`);
    assert.ok(
      Math.abs(speed - previousSpeed) < 0.6,
      `Abrupt acceleration at ${frame}`,
    );
    previousSpeed = speed;
  }
  for (const [a, b] of [
    [645, 646],
    [696, 697],
  ]) {
    assert.ok(
      Math.hypot(
        markPosition(b).x - markPosition(a).x,
        markPosition(b).y - markPosition(a).y,
      ) < 0.03,
    );
  }
});

test("all five venue marks stay in the visual safe area throughout the film", () => {
  for (let frame = 0; frame < 690; frame++)
    for (let i = 0; i < 5; i++) {
      const p = venuePosition(frame, i);
      const half = badgeSize(frame) / 2;
      assert.ok(
        p.x - half >= 96 && p.x + half <= 1824,
        `${frame}/${i} horizontal ${p.x}`,
      );
      assert.ok(
        p.y - half >= 80 && p.y + half + 59 <= 1000,
        `${frame}/${i} vertical ${p.y}`,
      );
    }
});

test("venues clear the account and each other through assembly, orbit and fan", () => {
  for (let frame = 150; frame < 690; frame++)
    for (let i = 0; i < 5; i++) {
      const p = venuePosition(frame, i);
      const account = accountPosition(frame);
      assert.ok(
        Math.hypot(p.x - account.x, p.y - account.y) > 240,
        `Central overlap ${frame}/${i}`,
      );
      for (let j = i + 1; j < 5; j++) {
        const q = venuePosition(frame, j);
        assert.ok(
          Math.hypot(q.x - p.x, q.y - p.y) > 190,
          `Badge overlap ${frame}/${i}/${j}`,
        );
      }
    }
});

test("venues share the brisk invisible orbit before it opens into a fan", () => {
  for (let frame = 268; frame <= 346; frame++)
    for (let i = 0; i < 5; i++) {
      const p = venuePosition(frame, i);
      assert.ok(
        Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - orbitRadius) <
          0.01,
      );
      for (let j = i + 1; j < 5; j++) {
        const q = venuePosition(frame, j);
        assert.ok(Math.hypot(q.x - p.x, q.y - p.y) > 190);
      }
    }
});

test("connection endpoints track the correct moving venue and central logo", () => {
  for (let frame = 284; frame < 645; frame++)
    for (let i = 0; i < 5; i++) {
      const p = venuePosition(frame, i);
      const c = connection(frame, i);
      const account = accountPosition(frame);
      const half = badgeSize(frame) / 2;
      const fromAccount = Math.hypot(c.x1 - account.x, c.y1 - account.y);
      if (frame < 540) assert.ok(Math.abs(fromAccount - 125) < 0.001);
      else assert.ok(fromAccount >= 125 - 0.001 && fromAccount < 240);
      const onX = Math.abs(Math.abs(c.x2 - p.x) - half - 10) < 0.001;
      const onY =
        Math.abs(c.y2 - p.y + half + 10) < 0.001 ||
        Math.abs(c.y2 - p.y - half - 59) < 0.001;
      assert.ok(onX || onY, "Ray should stop at the badge and label bounds");
    }
});

test("privacy routes stop outside the account boundary and lock", () => {
  for (let frame = 570; frame < 645; frame++) {
    const account = accountPosition(frame);
    for (let i = 0; i < 5; i++) {
      const c = connection(frame, i);
      const onX = Math.abs(Math.abs(c.x1 - account.x) - 134) < 0.001;
      const onY =
        Math.abs(c.y1 - account.y + 142) < 0.001 ||
        Math.abs(c.y1 - account.y - 196) < 0.001;
      assert.ok(onX || onY, `Ray crosses privacy panel ${frame}/${i}`);
    }
  }
});

test("choreography has no frame jumps", () => {
  for (let frame = 1; frame < 690; frame++)
    for (let i = 0; i < 5; i++) {
      const a = venuePosition(frame - 1, i);
      const b = venuePosition(frame, i);
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 38, `Jump at ${frame}/${i}`);
    }
});

test("opening drift travels substantially farther and the orbit is over 10x faster", () => {
  for (let i = 0; i < 5; i++) {
    let distance = 0;
    for (let frame = 1; frame <= 150; frame++) {
      const a = venuePosition(frame - 1, i);
      const b = venuePosition(frame, i);
      distance += Math.hypot(b.x - a.x, b.y - a.y);
    }
    assert.ok(
      distance > 330,
      `Opening is too subdued for venue ${i}: ${distance}`,
    );
  }
  assert.ok(orbitRotation(290) - orbitRotation(289) > 0.00165 * 10);
  assert.ok(orbitRotation(346) > Math.PI / 2);
  assert.equal(orbitRotation(346), orbitRotation(600));
});

test("the fan settles to the right with full badge and label clearance", () => {
  assert.equal(fanProgress(346), 0);
  assert.equal(fanProgress(388), 1);
  for (let frame = 0; frame < 690; frame++) {
    const half = badgeSize(frame) / 2;
    for (let i = 0; i < 5; i++) {
      const p = venuePosition(frame, i);
      if (frame >= 388) assert.ok(p.x > accountPosition(frame).x + 190);
      for (let j = i + 1; j < 5; j++) {
        const q = venuePosition(frame, j);
        // Actual axis-aligned badge + label rectangles, not only centre distances.
        assert.ok(
          Math.abs(p.x - q.x) > half * 2 + 12 ||
            Math.abs(p.y - q.y) > half * 2 + 59,
          `Label overlap ${frame}/${i}/${j}`,
        );
      }
    }
  }
});

test("the introduction holds the logo in the center, then carries it into the network", () => {
  for (let frame = 120; frame <= 204; frame++) {
    assert.deepEqual(markPosition(frame), { x: 869, y: 306 });
  }
  assert.deepEqual(markPosition(252), { x: 1239, y: 428 });
  for (let frame = 135; frame <= 204; frame++) {
    for (let i = 0; i < 5; i++) {
      assert.deepEqual(venuePosition(frame, i), venuePosition(135, i));
    }
  }
  for (let frame = 120; frame <= 268; frame++) {
    const mark = markPosition(frame);
    for (let i = 0; i < 5; i++) {
      const venue = venuePosition(frame, i);
      assert.ok(
        Math.abs(venue.x - (mark.x + 91)) > 180 ||
          Math.abs(venue.y - (mark.y + 108)) > 190,
        `Venue overlaps intro logo at ${frame}/${i}`,
      );
    }
    if (frame > 204) {
      const previous = markPosition(frame - 1);
      assert.ok(Math.hypot(mark.x - previous.x, mark.y - previous.y) < 13);
    }
  }
});

test("three trader contributions converge from distinct users and fade at the account", () => {
  for (let i = 0; i < 3; i++) {
    const start = 442 + i * 8;
    assert.equal(traderContribution(start, i).x, 867);
    assert.equal(traderContribution(start, i).y, 420 + i * 110);
    assert.equal(
      traderContribution(start + 28, i).x,
      accountPosition(start).x - 125,
    );
    assert.equal(traderContribution(start + 28, i).y, 530);
    assert.equal(traderContribution(start + 28, i).opacity, 0);
    assert.equal(traderContribution(start + 14, i).opacity, 1);
    for (let frame = start + 1; frame <= start + 28; frame++) {
      const a = traderContribution(frame - 1, i);
      const b = traderContribution(frame, i);
      assert.ok(b.x >= a.x && b.x + 16 < markPosition(frame).x);
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 15);
    }
  }
});

test("routing sends an instruction, highlights arrival, and returns a result", () => {
  for (const [start, venue] of [
    [372, 4],
    [490, 0],
    [588, 3],
  ]) {
    assert.equal(routeSignal(start).venue, venue);
    assert.equal(routeSignal(start).progress, 0);
    assert.equal(routeSignal(start + 16).progress, 1);
    assert.equal(routeSignal(start + 19).arrival, 1);
    assert.equal(routeSignal(start + 30).returning, true);
    assert.equal(routeSignal(start + 38).progress, 0);
    assert.equal(routeSignal(start + 38).received, 1);
    assert.equal(routeSignal(start + 44), null);
  }
  for (let frame = 0; frame < 690; frame++) {
    const signal = routeSignal(frame);
    if (signal) assert.ok(signal.progress >= 0 && signal.progress <= 1);
  }
});
