import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dayOfWeekOf,
  addDays,
  formatDateLabel,
  parseFlexibleDate,
  parseFlexibleYearMonth,
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
