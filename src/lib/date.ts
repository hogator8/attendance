// 日付関連の共通ユーティリティ。
// day_of_week は JavaScript の Date#getDay() と同じ規則（0=日曜〜6=土曜）に統一する。

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function todayISO(): string {
  // Asia/Tokyo基準の「今日」をYYYY-MM-DD形式で返す
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

// dateISO（YYYY-MM-DD）はタイムゾーンを持たない「暦日」として扱う。
// `new Date(`${dateISO}T00:00:00+09:00`).getDay()` のように実行環境のローカル
// タイムゾーンに依存する方法で曜日を求めると、ローカル開発環境（JST等）と
// Vercel本番環境（UTC）とで結果がずれてしまう（本番では常に1日前の曜日になる）。
// Date.UTC + getUTCDay() は実行環境のタイムゾーンに一切依存しないため、
// 暦日としてのYYYY-MM-DDから曜日を求める処理は必ずこちらを使うこと。
export function dayOfWeekOf(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatDateLabel(dateISO: string): string {
  const [, month, day] = dateISO.split("-");
  const dow = WEEKDAY_LABELS[dayOfWeekOf(dateISO)];
  return `${Number(month)}/${Number(day)} (${dow})`;
}

// dayOfWeekOf と同じ理由で、日付の加減算も実行環境のタイムゾーンに依存しない
// UTCベースの暦日演算で行う。
export function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface MonthBucket {
  year: number;
  month: number;
  from: string;
  to: string;
  label: string;
}

// CSV一括登録の日付欄（YYYY/MM/DD）をパースする。区切り文字は "/" を正としつつ、
// 従来形式の "-" 区切りも引き続き受け付ける。月・日はゼロ埋めなし（例："2025/1/4"）
// でも受け付ける（Excelでセルの書式が「日付」のままCSV保存すると、区切りが自動的に
// "/"・ゼロ埋めなしになることが多く、それをそのまま取り込めるようにするため）。
// 妥当な形式であれば "YYYY-MM-DD"（DB保存・内部の日付比較で使う正規形）を返し、
// 形式が不正なら null を返す。
export function parseFlexibleDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// parseFlexibleDate の年月版（YYYY/MM。日を持たない月次データ用）。
export function parseFlexibleYearMonth(value: string): string | null {
  const match = value.trim().match(/^(\d{4})[-/](\d{1,2})$/);
  if (!match) return null;
  const [, y, m] = match;
  const month = Number(m);
  if (month < 1 || month > 12) return null;
  return `${y}-${m.padStart(2, "0")}`;
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
