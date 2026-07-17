// Run with: bun test src/lib/movements.test.ts
import { test, expect } from "bun:test";
import { bucketBalance, bucketBalancesFor, type AccountMovement } from "./movements";

// Minimal movement factory: bucketBalance only reads to/from type+id and amount.
const mv = (o: Partial<AccountMovement>) => o as AccountMovement;

test("bucketBalance = initial + confirmed allocations + deposits in - withdrawals out", () => {
  const allocations = [
    { bucket_id: "b1", amount: 100 },
    { bucket_id: "b1", amount: 50 },
    { bucket_id: "b2", amount: 999 }, // different bucket, ignored
  ];
  const movements = [
    mv({ to_type: "bucket", to_id: "b1", from_type: "cash", from_id: null, amount: 30 }), // +30
    mv({ from_type: "bucket", from_id: "b1", to_type: "cash", to_id: null, amount: 20 }), // -20
    mv({ from_type: "bucket", from_id: "b1", to_type: "debt", to_id: "d1", amount: 10 }), // -10 (paid a debt from the bucket)
    mv({ to_type: "bucket", to_id: "b2", from_type: "cash", from_id: null, amount: 5 }), // other bucket
  ];
  // 200 initial + (100 + 50) + 30 - 20 - 10 = 350
  expect(bucketBalance("b1", 200, allocations, movements)).toBe(350);
});

test("bucketBalance coerces string amounts and initial", () => {
  const allocations = [{ bucket_id: "b1", amount: "40" as unknown as number }];
  expect(bucketBalance("b1", "10" as unknown as number, allocations, [])).toBe(50);
});

test("bucketBalance nets a bucket-to-bucket transfer on both sides", () => {
  const movements = [
    mv({ from_type: "bucket", from_id: "b1", to_type: "bucket", to_id: "b2", amount: 25 }),
  ];
  expect(bucketBalance("b1", 100, [], movements)).toBe(75);
  expect(bucketBalance("b2", 0, [], movements)).toBe(25);
});

test("bucketBalance rounds to cents", () => {
  const allocations = [{ bucket_id: "b1", amount: 0.1 }, { bucket_id: "b1", amount: 0.2 }];
  expect(bucketBalance("b1", 0, allocations, [])).toBe(0.3);
});

test("bucketBalancesFor computes every bucket in one pass", () => {
  const buckets = [
    { id: "b1", initial_balance: 100 },
    { id: "b2", initial_balance: 0 },
  ];
  const allocations = [{ bucket_id: "b1", amount: 50 }];
  const movements = [
    mv({ to_type: "bucket", to_id: "b2", from_type: "cash", from_id: null, amount: 10 }),
  ];
  const res = bucketBalancesFor(buckets, allocations, movements);
  expect(res.b1).toBe(150);
  expect(res.b2).toBe(10);
});
