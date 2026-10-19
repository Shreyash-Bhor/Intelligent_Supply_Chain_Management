import assert from "node:assert/strict";
import test from "node:test";
import { calculateAmounts, fromMinor, toMinor } from "../src/services/money.ts";

test("converts decimal prices to exact minor units", () => {
  assert.equal(toMinor("19.95"), 1995);
  assert.equal(toMinor(0), 0);
  assert.equal(fromMinor(1995), "19.95");
});

test("rejects unsupported precision and unsafe amounts", () => {
  assert.throws(() => toMinor("1.001"));
  assert.throws(() => toMinor("-1.00"));
  assert.throws(() => toMinor("999999999999999999.99"));
});

test("calculates shipping and tax without floating point currency math", () => {
  assert.deepEqual(calculateAmounts(10000, 500, 825), {
    subtotalMinor: 10000,
    shippingMinor: 500,
    taxMinor: 825,
    totalMinor: 11325,
  });
  assert.throws(() => calculateAmounts(-1, 0, 0));
});
