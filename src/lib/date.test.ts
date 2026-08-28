import { test } from "node:test";
import assert from "node:assert/strict";
import { dayOfWeekOf, addDays, formatDateLabel } from "./date";

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
