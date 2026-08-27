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

export function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00+09:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

export interface MonthBucket {
  year: number;
  month: number;
  from: string;
  to: string;
  label: string;
}

// termStart〜termEnd の範囲を、暦月単位（学期の開始・終了で端を切り詰め）に分割する。
export function monthBuckets(termStart: string, termEnd: string): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  let [y, m] = termStart.split("-").map(Number);
  const [endY, endM] = termEnd.split("-").map(Number);

  while (y < endY || (y === endY && m <= endM)) {
    const monthFirst = `${y}-${String(m).padStart(2, "0")}-01`;
    const nextMonthFirst =
      m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const monthLast = addDays(nextMonthFirst, -1);
    const from = monthFirst < termStart ? termStart : monthFirst;
    const to = monthLast > termEnd ? termEnd : monthLast;
    buckets.push({ year: y, month: m, from, to, label: `${y}年${m}月` });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return buckets;
}
