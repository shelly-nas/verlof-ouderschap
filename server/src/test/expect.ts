/**
 * Een kleine `expect` op `node:assert`, zodat de tests van de rekenkern met de
 * ingebouwde `node --test` draaien zonder extra testframework. Alleen de
 * matchers die de tests gebruiken staan erin.
 */
import assert from "node:assert/strict";

export { describe, it } from "node:test";

type Matchers = {
  toBe(expected: unknown): void;
  toBeCloseTo(expected: number, digits?: number): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeNull(): void;
  toContain(expected: unknown): void;
  toHaveLength(expected: number): void;
  toMatch(expected: RegExp | string): void;
  toThrow(): void;
};

function contains(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "string") return actual.includes(String(expected));
  if (Array.isArray(actual)) return actual.includes(expected);
  throw new TypeError("toContain verwacht een string of array");
}

function matches(actual: unknown, expected: RegExp | string): boolean {
  const text = String(actual);
  return typeof expected === "string" ? text.includes(expected) : expected.test(text);
}

export function expect(actual: unknown): Matchers & { not: Matchers } {
  const positive: Matchers = {
    toBe: (expected) => assert.strictEqual(actual, expected),
    toBeCloseTo: (expected, digits = 2) => {
      // Zelfde definitie als Jest/Vitest: |verschil| < 10^-digits / 2.
      const diff = Math.abs((actual as number) - expected);
      assert.ok(diff < 10 ** -digits / 2, `${actual} ligt niet dicht genoeg bij ${expected}`);
    },
    toBeGreaterThan: (expected) =>
      assert.ok((actual as number) > expected, `${actual} is niet groter dan ${expected}`),
    toBeGreaterThanOrEqual: (expected) =>
      assert.ok((actual as number) >= expected, `${actual} is kleiner dan ${expected}`),
    toBeLessThan: (expected) =>
      assert.ok((actual as number) < expected, `${actual} is niet kleiner dan ${expected}`),
    toBeNull: () => assert.strictEqual(actual, null),
    toContain: (expected) =>
      assert.ok(contains(actual, expected), `${JSON.stringify(actual)} bevat ${JSON.stringify(expected)} niet`),
    toHaveLength: (expected) =>
      assert.strictEqual((actual as { length: number }).length, expected),
    toMatch: (expected) => assert.ok(matches(actual, expected), `${actual} matcht ${expected} niet`),
    toThrow: () => assert.throws(actual as () => unknown),
  };

  const negative: Matchers = {
    toBe: (expected) => assert.notStrictEqual(actual, expected),
    toBeCloseTo: (expected, digits = 2) =>
      assert.ok(Math.abs((actual as number) - expected) >= 10 ** -digits / 2),
    toBeGreaterThan: (expected) => assert.ok(!((actual as number) > expected)),
    toBeGreaterThanOrEqual: (expected) => assert.ok(!((actual as number) >= expected)),
    toBeLessThan: (expected) => assert.ok(!((actual as number) < expected)),
    toBeNull: () => assert.notStrictEqual(actual, null),
    toContain: (expected) =>
      assert.ok(!contains(actual, expected), `${JSON.stringify(actual)} bevat ${JSON.stringify(expected)}`),
    toHaveLength: (expected) =>
      assert.notStrictEqual((actual as { length: number }).length, expected),
    toMatch: (expected) => assert.ok(!matches(actual, expected), `${actual} matcht ${expected}`),
    toThrow: () => assert.doesNotThrow(actual as () => unknown),
  };

  return { ...positive, not: negative };
}
