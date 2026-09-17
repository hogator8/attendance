import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCompletion, computeDayClassStatus } from "./completion";

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

test("computeDayClassStatus: 全学生・全時限の記録が揃っていればcomplete（月次一覧表の緑チェック相当）", () => {
  const recordedByPeriod = new Map([
    [1, new Set(["s1", "s2"])],
    [2, new Set(["s1", "s2"])],
  ]);
  const status = computeDayClassStatus([1, 2], ["s1", "s2"], recordedByPeriod);
  assert.equal(status, "complete");
});

test("computeDayClassStatus: 1人でも1時限でも未入力ならincomplete（月次一覧表の「未」相当）", () => {
  const recordedByPeriod = new Map([
    [1, new Set(["s1", "s2"])],
    [2, new Set(["s1"])], // s2が2時限目未入力
  ]);
  const status = computeDayClassStatus([1, 2], ["s1", "s2"], recordedByPeriod);
  assert.equal(status, "incomplete");
});

test("computeDayClassStatus: 記録が1件も無い時限があってもincomplete", () => {
  const status = computeDayClassStatus([1, 2], ["s1", "s2"], new Map());
  assert.equal(status, "incomplete");
});

test("computeDayClassStatus: 授業が組まれている時限が0件ならnone（空欄相当）", () => {
  const status = computeDayClassStatus([], ["s1", "s2"], new Map([[1, new Set(["s1", "s2"])]]));
  assert.equal(status, "none");
});

test("computeDayClassStatus: 在籍学生が0人ならnone（空欄相当）", () => {
  const status = computeDayClassStatus([1], [], new Map());
  assert.equal(status, "none");
});
