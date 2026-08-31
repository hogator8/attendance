import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStudentSummaries } from "./summary";
import { monthBuckets } from "@/lib/date";
import type { SymbolInfo } from "./calc";

test("monthBuckets: 学期開始・終了日で端の月を切り詰める", () => {
  const buckets = monthBuckets("2026-04-10", "2026-06-05");
  assert.equal(buckets.length, 3);
  assert.deepEqual(buckets[0], {
    year: 2026,
    month: 4,
    from: "2026-04-10",
    to: "2026-04-30",
    label: "2026年4月",
  });
  assert.deepEqual(buckets[1], {
    year: 2026,
    month: 5,
    from: "2026-05-01",
    to: "2026-05-31",
    label: "2026年5月",
  });
  assert.deepEqual(buckets[2], {
    year: 2026,
    month: 6,
    from: "2026-06-01",
    to: "2026-06-05",
    label: "2026年6月",
  });
});

test("monthBuckets: 年をまたぐ場合", () => {
  const buckets = monthBuckets("2026-12-20", "2027-01-10");
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].label, "2026年12月");
  assert.equal(buckets[1].label, "2027年1月");
});

const symbols: SymbolInfo[] = [
  { id: "present", category: "attendance", countsAsRequired: true, isLateEarlyTarget: false },
  { id: "absent", category: "absence", countsAsRequired: true, isLateEarlyTarget: false },
];

test("buildStudentSummaries: 累計期間と月別が独立して集計される", () => {
  const summaries = buildStudentSummaries(
    ["s1"],
    [
      { studentId: "s1", date: "2026-04-10", symbolId: "present" },
      { studentId: "s1", date: "2026-04-11", symbolId: "absent" },
      { studentId: "s1", date: "2026-05-01", symbolId: "present" },
    ],
    [],
    symbols,
    { lateN: 0, earlyN: 0, combinedN: 0 },
    "2026-04-01",
    "2026-05-31",
    monthBuckets("2026-04-01", "2026-05-31"),
  );

  const s1 = summaries[0];
  assert.equal(s1.cumulative.reqDays, 3);
  assert.equal(s1.cumulative.rawAbsCount, 1);
  assert.equal(s1.months.length, 2);
  assert.equal(s1.months[0].reqDays, 2); // 4月分のみ
  assert.equal(s1.months[1].reqDays, 1); // 5月分のみ
});

test("buildStudentSummaries: 累計の換算欠席数は月ごとにfloor計算してから合算する（月をまたいで合算してから1回だけfloorしない）", () => {
  const lateSymbols: SymbolInfo[] = [
    { id: "present", category: "attendance", countsAsRequired: true, isLateEarlyTarget: false },
    { id: "late", category: "late", countsAsRequired: true, isLateEarlyTarget: true },
  ];

  const summaries = buildStudentSummaries(
    ["s1"],
    [
      // 4月：遅刻5回
      { studentId: "s1", date: "2026-04-01", symbolId: "late" },
      { studentId: "s1", date: "2026-04-02", symbolId: "late" },
      { studentId: "s1", date: "2026-04-03", symbolId: "late" },
      { studentId: "s1", date: "2026-04-04", symbolId: "late" },
      { studentId: "s1", date: "2026-04-05", symbolId: "late" },
      // 5月：遅刻2回
      { studentId: "s1", date: "2026-05-01", symbolId: "late" },
      { studentId: "s1", date: "2026-05-02", symbolId: "late" },
    ],
    [],
    lateSymbols,
    { lateN: 3, earlyN: 0, combinedN: 0 },
    "2026-04-01",
    "2026-05-31",
    monthBuckets("2026-04-01", "2026-05-31"),
  );

  const s1 = summaries[0];
  // 月別：4月はfloor(5/3)=1、5月はfloor(2/3)=0（月別表示自体は従来通り変更なし）
  assert.equal(s1.months[0].convertedAbsences, 1);
  assert.equal(s1.months[1].convertedAbsences, 0);
  // 累計：月ごとのfloor結果を合算した1（floor((5+2)/3)=2ではない）
  assert.equal(s1.cumulative.convertedAbsences, 1);
  assert.equal(s1.cumulative.rawAbsCount, 0);
  assert.equal(s1.cumulative.totalAbsences, 1);
  assert.equal(s1.cumulative.reqDays, 7);
  assert.equal(s1.cumulative.rate, (7 - 1) / 7);
});

test("buildStudentSummaries: 学校行事はcredit_periodsで重み付けされる", () => {
  const summaries = buildStudentSummaries(
    ["s1"],
    [{ studentId: "s1", date: "2026-04-10", symbolId: "present" }],
    [{ studentId: "s1", symbolId: "absent", eventDate: "2026-04-15", creditPeriods: 3 }],
    symbols,
    { lateN: 0, earlyN: 0, combinedN: 0 },
    "2026-04-01",
    "2026-04-30",
    [],
  );

  const s1 = summaries[0];
  assert.equal(s1.cumulative.reqDays, 4);
  assert.equal(s1.cumulative.rawAbsCount, 3);
});
