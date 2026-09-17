import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dayOfWeekOf,
  addDays,
  formatDateLabel,
  parseFlexibleDate,
  parseFlexibleYearMonth,
  listMonthDates,
} from "./date";

test("dayOfWeekOf: 実行環境のタイムゾーンに関係なく正しい曜日を返す", () => {
  // 2026-06-08 は月曜日（実行環境がUTCでもJSTでも同じ結果になる必要がある）
  assert.equal(dayOfWeekOf("2026-06-08"), 1);
  // 2026-04-06 は月曜日
  assert.equal(dayOfWeekOf("2026-04-06"), 1);
  // 2026-04-10 は金曜日
  assert.equal(dayOfWeekOf("2026-04-10"), 5);
});

test("addDays: 月またぎ・年またぎでも正しく暦日を加減算する", () => {
  assert.equal(addDays("2026-06-08", 1), "2026-06-09");
  assert.equal(addDays("2026-06-08", -1), "2026-06-07");
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("formatDateLabel: 実際の曜日と一致するラベルを返す", () => {
  assert.equal(formatDateLabel("2026-06-08"), "6/8 (月)");
});

test("parseFlexibleDate: ハイフン区切り・ゼロ埋めありは従来通り受け付ける", () => {
  assert.equal(parseFlexibleDate("2026-04-01"), "2026-04-01");
});

test("parseFlexibleDate: スラッシュ区切り・ゼロ埋めありを受け付ける", () => {
  assert.equal(parseFlexibleDate("2026/04/01"), "2026-04-01");
});

test("parseFlexibleDate: スラッシュ区切り・ゼロ埋めなしを受け付ける（Excelの自動変換対策）", () => {
  assert.equal(parseFlexibleDate("2000/5/22"), "2000-05-22");
  assert.equal(parseFlexibleDate("2025/4/28"), "2025-04-28");
});

test("parseFlexibleDate: ハイフン区切り・ゼロ埋めなしも受け付ける", () => {
  assert.equal(parseFlexibleDate("2025-4-28"), "2025-04-28");
});

test("parseFlexibleDate: 月・日が範囲外なら不正", () => {
  assert.equal(parseFlexibleDate("2025/13/01"), null);
  assert.equal(parseFlexibleDate("2025/01/32"), null);
  assert.equal(parseFlexibleDate("2025/00/01"), null);
});

test("parseFlexibleDate: 区切り文字が混在・不足していれば不正", () => {
  assert.equal(parseFlexibleDate("2025.01.04"), null);
  assert.equal(parseFlexibleDate("2025/01"), null);
  assert.equal(parseFlexibleDate(""), null);
  assert.equal(parseFlexibleDate("入学日"), null);
});

test("parseFlexibleYearMonth: スラッシュ・ゼロ埋めなしを受け付ける", () => {
  assert.equal(parseFlexibleYearMonth("2020/4"), "2020-04");
  assert.equal(parseFlexibleYearMonth("2020-04"), "2020-04");
});

test("parseFlexibleYearMonth: 月が範囲外なら不正", () => {
  assert.equal(parseFlexibleYearMonth("2020/13"), null);
});

test("listMonthDates: 当月の場合は月初から今日までのみ返す（未来日は含めない）", () => {
  const dates = listMonthDates("2026-06", "2026-06-08");
  assert.deepEqual(dates, [
    "2026-06-01",
    "2026-06-02",
    "2026-06-03",
    "2026-06-04",
    "2026-06-05",
    "2026-06-06",
    "2026-06-07",
    "2026-06-08",
  ]);
});

test("listMonthDates: 過去の月の場合はその月の全日程を返す", () => {
  const dates = listMonthDates("2026-04", "2026-06-08");
  assert.equal(dates[0], "2026-04-01");
  assert.equal(dates[dates.length - 1], "2026-04-30");
  assert.equal(dates.length, 30);
});

test("listMonthDates: 完全に未来の月の場合は空配列を返す", () => {
  assert.deepEqual(listMonthDates("2026-07", "2026-06-08"), []);
});

test("listMonthDates: 年をまたぐ過去月でも正しく末日を求める", () => {
  const dates = listMonthDates("2025-12", "2026-06-08");
  assert.equal(dates[0], "2025-12-01");
  assert.equal(dates[dates.length - 1], "2025-12-31");
});
