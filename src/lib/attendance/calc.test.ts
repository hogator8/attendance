import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateAttendanceRate,
  colorForRate,
  type SymbolInfo,
} from "./calc";

const SYM_PRESENT: SymbolInfo = {
  id: "present",
  category: "attendance",
  countsAsRequired: true,
  isLateEarlyTarget: false,
};
const SYM_ABSENT: SymbolInfo = {
  id: "absent",
  category: "absence",
  countsAsRequired: true,
  isLateEarlyTarget: false,
};
const SYM_LATE: SymbolInfo = {
  id: "late",
  category: "late",
  countsAsRequired: true,
  isLateEarlyTarget: true,
};
const SYM_EARLY: SymbolInfo = {
  id: "early",
  category: "early_leave",
  countsAsRequired: true,
  isLateEarlyTarget: true,
};
const SYM_EXCLUDED: SymbolInfo = {
  id: "excluded",
  category: "excluded",
  countsAsRequired: false,
  isLateEarlyTarget: false,
};

const symbols = [SYM_PRESENT, SYM_ABSENT, SYM_LATE, SYM_EARLY, SYM_EXCLUDED];

test("指示書7.1の例：要出席4（出席1+遅刻3）、遅刻3回・lateN=3 → 換算1、出席率75%", () => {
  const records = [
    { symbolId: "present", weight: 1 },
    { symbolId: "late", weight: 1 },
    { symbolId: "late", weight: 1 },
    { symbolId: "late", weight: 1 },
  ];
  const result = calculateAttendanceRate(records, symbols, {
    lateN: 3,
    earlyN: 0,
    combinedN: 0,
  });
  assert.equal(result.reqDays, 4);
  assert.equal(result.rawAbsCount, 0);
  assert.equal(result.convertedAbsences, 1);
  assert.equal(result.totalAbsences, 1);
  assert.equal(result.rate, 0.75);
});

test("欠席の生カウントに換算欠席が加算される", () => {
  const records = [
    { symbolId: "present", weight: 6 },
    { symbolId: "absent", weight: 2 },
    { symbolId: "late", weight: 3 }, // lateN=3 -> 換算1
  ];
  const result = calculateAttendanceRate(records, symbols, {
    lateN: 3,
    earlyN: 0,
    combinedN: 0,
  });
  assert.equal(result.reqDays, 11);
  assert.equal(result.rawAbsCount, 2);
  assert.equal(result.convertedAbsences, 1);
  assert.equal(result.totalAbsences, 3);
  assert.equal(result.rate, (11 - 3) / 11);
});

test("combined_n が優先され、個別ルールとの二重適用を避ける", () => {
  const records = [
    { symbolId: "present", weight: 10 },
    { symbolId: "late", weight: 2 },
    { symbolId: "early", weight: 2 },
  ];
  // 個別ルールなら floor(2/2)+floor(2/2)=2 になるが、合算ルールがあるので
  // floor((2+2)/2)=2 ... 差が出るケースで検証する
  const result = calculateAttendanceRate(records, symbols, {
    lateN: 1,
    earlyN: 1,
    combinedN: 4,
  });
  // 個別ルールなら floor(2/1)+floor(2/1)=4 になるはずだが、combinedN>0なので
  // floor((2+2)/4)=1 のみが適用される
  assert.equal(result.convertedAbsences, 1);
});

test("combined_n>0 でも早退の記号が定義されていなければ合算ルールは適用されない", () => {
  const symbolsNoEarly = [SYM_PRESENT, SYM_ABSENT, SYM_LATE];
  const records = [
    { symbolId: "present", weight: 10 },
    { symbolId: "late", weight: 6 },
  ];
  const result = calculateAttendanceRate(records, symbolsNoEarly, {
    lateN: 3,
    earlyN: 0,
    combinedN: 2,
  });
  // combinedN条件（遅刻・早退の記号が両方定義されていること）を満たさないため、
  // 個別ルール（lateN=3）にフォールバックする -> floor(6/3)=2
  assert.equal(result.convertedAbsences, 2);
});

test("要出席日数が0の場合は出席率0", () => {
  const result = calculateAttendanceRate([], symbols, {
    lateN: 0,
    earlyN: 0,
    combinedN: 0,
  });
  assert.equal(result.reqDays, 0);
  assert.equal(result.rate, 0);
});

test("category=excluded の記号は要出席日数・出席率に一切影響しない", () => {
  const records = [
    { symbolId: "present", weight: 5 },
    { symbolId: "excluded", weight: 100 },
  ];
  const result = calculateAttendanceRate(records, symbols, {
    lateN: 0,
    earlyN: 0,
    combinedN: 0,
  });
  assert.equal(result.reqDays, 5);
  assert.equal(result.rate, 1);
});

test("学校行事の credit_periods は weight として reqDays・欠席数に反映される", () => {
  const records = [
    { symbolId: "present", weight: 6 },
    // credit_periods=3 の行事を欠席扱いの記号で記録
    { symbolId: "absent", weight: 3 },
  ];
  const result = calculateAttendanceRate(records, symbols, {
    lateN: 0,
    earlyN: 0,
    combinedN: 0,
  });
  assert.equal(result.reqDays, 9);
  assert.equal(result.rawAbsCount, 3);
  assert.equal(result.rate, (9 - 3) / 9);
});

test("colorForRate: 範囲に一致する色を返す", () => {
  const rules = [
    { lowerPct: 90, upperPct: 100, colorHex: "#00ff00" },
    { lowerPct: 70, upperPct: 89.9, colorHex: "#ffff00" },
    { lowerPct: 0, upperPct: 69.9, colorHex: "#ff0000" },
  ];
  assert.equal(colorForRate(0.95, rules), "#00ff00");
  assert.equal(colorForRate(0.75, rules), "#ffff00");
  assert.equal(colorForRate(0.5, rules), "#ff0000");
});

test("colorForRate: 一致するルールがなければ null", () => {
  const rules = [{ lowerPct: 90, upperPct: 100, colorHex: "#00ff00" }];
  assert.equal(colorForRate(0.5, rules), null);
});
