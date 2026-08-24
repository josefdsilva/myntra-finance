import { describe, expect, it } from "bun:test";
import { swapLever, timeToDream } from "./pace";

describe("timeToDream", () => {
  it("returns months and an ETA at the current pace", () => {
    const r = timeToDream(1200, 300, new Date("2026-01-15T00:00:00Z"));
    expect(r.months).toBe(4);
    expect(r.etaIso).toBe("2026-05-01");
  });

  it("rounds partial months up", () => {
    expect(timeToDream(1000, 300).months).toBe(4);
  });

  it("is unknowable with no pace", () => {
    const r = timeToDream(1000, 0);
    expect(r.months).toBeNull();
    expect(r.etaIso).toBeNull();
    expect(r.monthsSaved).toBe(0);
  });

  it("is already there when nothing is missing", () => {
    expect(timeToDream(0, 0).months).toBe(0);
  });

  it("shows the swap landing it sooner", () => {
    const r = timeToDream(6000, 500);
    expect(r.months).toBe(12);
    expect(r.swapEur).toBe(120);
    expect(r.monthsWithSwap).toBe(10);
    expect(r.monthsSaved).toBe(2);
  });
});

describe("swapLever", () => {
  it("never suggests less than 10", () => {
    expect(swapLever(0, 0)).toBe(10);
  });

  it("scales with the pace in tidy steps", () => {
    expect(swapLever(300, 1000)).toBe(60);
    expect(swapLever(1000, 1000)).toBe(200);
  });
});
