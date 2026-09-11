import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCompletion } from "./completion";

test("computeCompletion: 全時限・全学生分の記録が揃っていればdayComplete=true", () => {
  const recordedByPeriod = new Map([
    [1, new Set(["s1", "s2"])],
    [2, new Set(["s1", "s2"])],
  ]);
  const { periodComplete, dayComplete } = computeCompletion([1, 2], ["s1", "s2"], recordedByPeriod);
  assert.equal(periodComplete.get(1), true);
  assert.equal(periodComplete.get(2), true);
  assert.equal(dayComplete, true);
});

test("computeCompletion: 1人でも未入力の学生がいればその時限はfalse、dayCompleteもfalse", () => {
  const recordedByPeriod = new Map([
    [1, new Set(["s1", "s2"])],
    [2, new Set(["s1"])], // s2が未入力
  ]);
  const { periodComplete, dayComplete } = computeCompletion([1, 2], ["s1", "s2"], recordedByPeriod);
  assert.equal(periodComplete.get(1), true);
  assert.equal(periodComplete.get(2), false);
  assert.equal(dayComplete, false);
});

test("computeCompletion: 対象時限が0件（休業日・行事による全置換等）ならdayComplete=false", () => {
  const { dayComplete } = computeCompletion([], ["s1", "s2"], new Map());
  assert.equal(dayComplete, false);
});

test("computeCompletion: 対象学生が0人ならその時限は完了とみなさない", () => {
  const { periodComplete, dayComplete } = computeCompletion([1], [], new Map());
  assert.equal(periodComplete.get(1), false);
  assert.equal(dayComplete, false);
});

test("computeCompletion: 記録が全く存在しない時限はfalse", () => {
  const { periodComplete } = computeCompletion([1], ["s1"], new Map());
  assert.equal(periodComplete.get(1), false);
});
