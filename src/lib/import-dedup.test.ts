// Run with: bun test src/lib/import-dedup.test.ts
import { test, expect } from "bun:test";
import { txnFingerprint, normDesc } from "./import-dedup";

test("normDesc lowercases, strips accents, ref numbers and punctuation", () => {
  expect(normDesc("Café Central  #0012")).toBe("cafe central");
  expect(normDesc("PINGO DOCE LX 998877")).toBe("pingo doce lx");
});

test("the same transaction re-imported matches (case/accents/ref/sign/time vary)", () => {
  const a = txnFingerprint({
    date: "2026-08-14",
    amount: -42.5,
    description: "Café Lisboa 000123",
    kind: "expense",
  });
  const b = txnFingerprint({
    date: "2026-08-14T09:12:00Z",
    amount: 42.5, // sign-agnostic; kind carries direction
    description: "CAFE LISBOA 999888",
    kind: "expense",
  });
  expect(a).toBe(b);
});

test("different day, amount, or direction produce different fingerprints", () => {
  const base = { date: "2026-08-14", amount: 42.5, description: "Cinema", kind: "expense" as const };
  expect(txnFingerprint(base)).not.toBe(txnFingerprint({ ...base, date: "2026-08-15" }));
  expect(txnFingerprint(base)).not.toBe(txnFingerprint({ ...base, amount: 43 }));
  expect(txnFingerprint(base)).not.toBe(txnFingerprint({ ...base, kind: "income" }));
});
