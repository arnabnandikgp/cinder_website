import { expect, test } from "@playwright/test";
import {
  buildStrategyPlan,
  initialStrategy,
  isStrategy,
  strategies,
  type StrategyConfig,
} from "../src/components/demo/strategies";

const config: StrategyConfig = {
  ...initialStrategy,
  start: "152",
  end: "148",
  boundary: "154",
  tip: "0.3",
};

for (const kind of Object.keys(strategies) as (keyof typeof strategies)[]) {
  test(`${kind} preview conserves quantity and stays deterministic`, () => {
    for (const size of ["2", "0.12345678", "1000", "12345.12345678"]) {
      const input = {
        ...config,
        tip: (Number(size) / 4).toFixed(8),
        randomize: true,
      };
      const result = buildStrategyPlan(kind, size, "151", input);
      expect(result.errors).toEqual({});
      const plan = result.plan!;
      expect(plan.sizeUnit).toBe("USDC");
      expect(plan.rows.reduce((sum, row) => sum + row.quantity, 0)).toBeCloseTo(
        Number(size),
        8,
      );
      expect(
        plan.rows.every(
          (row) => row.quantity > 0 && Number.isFinite(row.quantity),
        ),
      ).toBe(true);
      expect(plan.rows.length).toBeLessThanOrEqual(200);
      expect(buildStrategyPlan(kind, size, "151", input)).toEqual(result);
      input.duration = "99";
      expect(plan.config.duration).toBe("5");
    }
  });
}

test("strategy preview validation rejects unsafe or incoherent input", () => {
  expect(isStrategy("constructor")).toBe(false);
  expect(
    buildStrategyPlan("Iceberg", "0.00000201", "151", {
      ...config,
      tip: "0.00000001009",
    }).errors.tip,
  ).toBeTruthy();
  expect(
    buildStrategyPlan("Scale", "2", "151", {
      ...config,
      start: "152.0",
      end: "152",
    }).errors.end,
  ).toBeTruthy();
  for (const count of ["0", "1", "1.5", "101", "NaN", "Infinity"])
    expect(
      buildStrategyPlan("Scale", "2", "151", { ...config, count }).plan,
    ).toBeUndefined();
  for (const size of ["0", "-1", "NaN", "0.000000001", "1000001"])
    expect(buildStrategyPlan("TWAP", size, "151", config).plan).toBeUndefined();
  expect(
    buildStrategyPlan("TWAP", "2", "151", { ...config, interval: "0" }).errors
      .interval,
  ).toBeTruthy();
  expect(
    buildStrategyPlan("TWAP", "2", "151", { ...config, duration: "1441" })
      .errors.duration,
  ).toBeTruthy();
  expect(
    buildStrategyPlan("Iceberg", "2", "151", { ...config, tip: "3" }).errors
      .tip,
  ).toBeTruthy();
  expect(
    buildStrategyPlan("Iceberg", "2", "151", { ...config, tip: "0.00001" })
      .errors.tip,
  ).toBeTruthy();
  expect(
    buildStrategyPlan("Chase", "2", "151", { ...config, boundary: "" }).errors
      .boundary,
  ).toBeTruthy();
  expect(
    buildStrategyPlan("Swarm", "2", "151", { ...config, pace: "11" }).errors
      .pace,
  ).toBeTruthy();
});

test("ladders, iceberg residuals and volume profile have their intended semantics", () => {
  const scale = buildStrategyPlan("Scale", "2", "151", {
    ...config,
    skew: "2",
  }).plan!;
  expect(scale.rows[0].price).toBe(152);
  expect(scale.rows.at(-1)!.price).toBe(148);
  expect(scale.rows[0].quantity).toBeLessThan(scale.rows.at(-1)!.quantity);
  const iceberg = buildStrategyPlan("Iceberg", "2", "151", config).plan!;
  expect(iceberg.rows).toHaveLength(7);
  expect(iceberg.rows.at(-1)!.quantity).toBeCloseTo(0.2);
  const twap = buildStrategyPlan("TWAP", "2", "151", config).plan!;
  expect(twap.rows).toHaveLength(10);
  expect(twap.rows.at(-1)!.seconds).toBe(270);
  const vwap = buildStrategyPlan("VWAP", "2", "151", config).plan!;
  expect(vwap.note).toContain("not venue-derived");
  expect(vwap.rows[4].quantity).toBeGreaterThan(vwap.rows[0].quantity);
});
