// Minimal ambient types for `bun:test` so TS compiles without pulling in
// the full @types/bun package (which conflicts with DOM `fetch` typing).
declare module "bun:test" {
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const it: typeof test;
  export const describe: (name: string, fn: () => void) => void;
  export const beforeAll: (fn: () => void | Promise<void>) => void;
  export const afterAll: (fn: () => void | Promise<void>) => void;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const afterEach: (fn: () => void | Promise<void>) => void;
  interface Matchers<R = unknown> {
    toBe(expected: unknown): R;
    toEqual(expected: unknown): R;
    toBeLessThan(expected: number): R;
    toBeGreaterThan(expected: number): R;
    toBeLessThanOrEqual(expected: number): R;
    toBeGreaterThanOrEqual(expected: number): R;
    toBeCloseTo(expected: number, precision?: number): R;
    toBeNull(): R;
    toBeDefined(): R;
    toBeUndefined(): R;
    toBeTruthy(): R;
    toBeFalsy(): R;
    toContain(expected: unknown): R;
    toThrow(expected?: unknown): R;
    not: Matchers<R>;
  }
  export function expect<T = unknown>(actual: T): Matchers;
}
