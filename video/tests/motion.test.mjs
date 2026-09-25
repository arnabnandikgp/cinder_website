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
} from "../src/motion.ts";

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
  for (let frame = 232; frame <= 324; frame++)
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
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 24, `Jump at ${frame}/${i}`);
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
      distance > 400,
      `Opening is too subdued for venue ${i}: ${distance}`,
    );
  }
  assert.ok(orbitRotation(290) - orbitRotation(289) > 0.00165 * 10);
  assert.ok(orbitRotation(324) > Math.PI / 2);
  assert.equal(orbitRotation(324), orbitRotation(600));
});

test("the fan settles to the right with full badge and label clearance", () => {
  assert.equal(fanProgress(324), 0);
  assert.equal(fanProgress(378), 1);
  for (let frame = 0; frame < 690; frame++) {
    const half = badgeSize(frame) / 2;
    for (let i = 0; i < 5; i++) {
      const p = venuePosition(frame, i);
      if (frame >= 378) assert.ok(p.x > accountPosition(frame).x + 190);
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
