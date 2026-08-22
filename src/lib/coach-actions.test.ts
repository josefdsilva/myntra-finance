import { describe, expect, it } from "bun:test";
import { looksLikeAction, normalizeActions } from "./coach-actions";

describe("looksLikeAction", () => {
  it("recognises plain statements that record something", () => {
    expect(looksLikeAction("spent 34 at Lidl")).toBe(true);
    expect(looksLikeAction("gastei 12 no cafe")).toBe(true);
    expect(looksLikeAction("car loan 210 a month at 6.4%")).toBe(true);
    expect(looksLikeAction("save 200 a month for Japan")).toBe(true);
  });

  it("leaves questions and advice to the normal chat", () => {
    expect(looksLikeAction("how much did I spend on food?")).toBe(false);
    expect(looksLikeAction("should I pay off the 5000 loan first")).toBe(false);
    expect(looksLikeAction("thanks!")).toBe(false);
    expect(looksLikeAction("what's my surplus")).toBe(false);
  });
});

describe("normalizeActions", () => {
  const cats = ["Groceries", "Housing"];

  it("keeps valid rows and snaps categories to the household list", () => {
    const rows = normalizeActions(
      [{ kind: "expense", label: "Lidl", amount: "34,50", category: "groceries" }],
      cats,
    );
    expect(rows).toEqual([
      {
        kind: "expense",
        label: "Lidl",
        amount: 34.5,
        category: "Groceries",
        taeg_pct: null,
        occurred_at: null,
      },
    ]);
  });

  it("drops unknown kinds, missing labels and non-positive amounts", () => {
    const rows = normalizeActions(
      [
        { kind: "wire_transfer", label: "x", amount: 5 },
        { kind: "expense", label: "", amount: 5 },
        { kind: "expense", label: "y", amount: 0 },
      ],
      cats,
    );
    expect(rows).toHaveLength(0);
  });

  it("invents no category and clears dates on recurring rows", () => {
    const rows = normalizeActions(
      [{ kind: "fixed", label: "Rent", amount: -780, category: "Rent", occurred_at: "2026-08-01" }],
      cats,
    );
    expect(rows[0].category).toBeNull();
    expect(rows[0].amount).toBe(780);
    expect(rows[0].occurred_at).toBeNull();
  });

  it("keeps a debt rate only when plausible", () => {
    const [ok] = normalizeActions([{ kind: "debt", label: "Car", amount: 210, taeg_pct: 6.4 }]);
    const [bad] = normalizeActions([{ kind: "debt", label: "Car", amount: 210, taeg_pct: 640 }]);
    expect(ok.taeg_pct).toBe(6.4);
    expect(bad.taeg_pct).toBeNull();
  });
});
