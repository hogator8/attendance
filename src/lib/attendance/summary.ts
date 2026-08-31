import {
  calculateAttendanceRate,
  type AttendanceRateResult,
  type ConversionRule,
  type SymbolInfo,
} from "./calc";
import { monthBuckets, type MonthBucket } from "@/lib/date";

export interface RawAttendanceRecord {
  studentId: string;
  date: string;
  symbolId: string;
}

export interface RawEventRecord {
  studentId: string;
  symbolId: string;
  eventDate: string; // 集計上の基準日（events.date_from）
  creditPeriods: number;
}

export interface StudentMonthSummary extends AttendanceRateResult {
  year: number;
  month: number;
}

export interface StudentSummary {
  studentId: string;
  cumulative: AttendanceRateResult;
  months: StudentMonthSummary[];
}

function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

function buildWeightedRecords(
  studentId: string,
  attendance: RawAttendanceRecord[],
  events: RawEventRecord[],
  from: string,
  to: string,
) {
  const records: { symbolId: string; weight: number }[] = [];
  for (const r of attendance) {
    if (r.studentId === studentId && inRange(r.date, from, to)) {
      records.push({ symbolId: r.symbolId, weight: 1 });
    }
  }
  for (const e of events) {
    if (e.studentId === studentId && inRange(e.eventDate, from, to)) {
      records.push({ symbolId: e.symbolId, weight: e.creditPeriods });
    }
  }
  return records;
}

export function buildStudentSummaries(
  studentIds: string[],
  attendance: RawAttendanceRecord[],
  events: RawEventRecord[],
  symbols: SymbolInfo[],
  conversionRule: ConversionRule,
  cumulativeFrom: string,
  cumulativeTo: string,
  months: MonthBucket[],
): StudentSummary[] {
  // 換算欠席数（convertedAbsences）は、累計期間全体の遅刻・早退回数を
  // 合算してから1回だけfloor(合計回数/N)を計算するのではなく、月別表示と
  // 同じロジック（月ごとの遅刻・早退回数だけを対象にfloor(その月の回数/N)を
  // 計算する）を累計期間内の各月に適用し、単純合算する。
  // 「months」引数（表示用の月一覧）はcumulativeFrom〜cumulativeToより
  // 広い範囲（学期全体）になりうる（集計画面の期間絞り込みフィルターの場合）
  // ため、月別表示のロジックはそのまま再利用しつつ、累計期間の境界に
  // 合わせて改めて月バケットを区切り直す。
  const cumulativeMonthBuckets = monthBuckets(cumulativeFrom, cumulativeTo);

  return studentIds.map((studentId) => {
    const cumulativeRecords = buildWeightedRecords(
      studentId,
      attendance,
      events,
      cumulativeFrom,
      cumulativeTo,
    );
    const rawCumulative = calculateAttendanceRate(
      cumulativeRecords,
      symbols,
      conversionRule,
    );

    const convertedAbsences = cumulativeMonthBuckets.reduce((sum, bucket) => {
      const records = buildWeightedRecords(studentId, attendance, events, bucket.from, bucket.to);
      const result = calculateAttendanceRate(records, symbols, conversionRule);
      return sum + result.convertedAbsences;
    }, 0);
    const totalAbsences = rawCumulative.rawAbsCount + convertedAbsences;
    const cumulative: AttendanceRateResult = {
      ...rawCumulative,
      convertedAbsences,
      totalAbsences,
      rate:
        rawCumulative.reqDays > 0
          ? (rawCumulative.reqDays - totalAbsences) / rawCumulative.reqDays
          : 0,
    };

    const monthSummaries: StudentMonthSummary[] = months.map((bucket) => {
      const records = buildWeightedRecords(
        studentId,
        attendance,
        events,
        bucket.from,
        bucket.to,
      );
      const result = calculateAttendanceRate(records, symbols, conversionRule);
      return { ...result, year: bucket.year, month: bucket.month };
    });

    return { studentId, cumulative, months: monthSummaries };
  });
}
