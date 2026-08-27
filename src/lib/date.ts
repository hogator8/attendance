// 日付関連の共通ユーティリティ。
// day_of_week は JavaScript の Date#getDay() と同じ規則（0=日曜〜6=土曜）に統一する。

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function todayISO(): string {
  // Asia/Tokyo基準の「今日」をYYYY-MM-DD形式で返す
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

export function dayOfWeekOf(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00+09:00`).getDay();
}

export function formatDateLabel(dateISO: string): string {
  const [, month, day] = dateISO.split("-");
  const dow = WEEKDAY_LABELS[dayOfWeekOf(dateISO)];
  return `${Number(month)}/${Number(day)} (${dow})`;
}
