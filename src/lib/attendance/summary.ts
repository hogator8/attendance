import {
  calculateAttendanceRate,
  type AttendanceRateResult,
  type ConversionRule,
  type SymbolInfo,
} from "./calc";
import type { MonthBucket } from "@/lib/date";

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
  return studentIds.map((studentId) => {
    const cumulativeRecords = buildWeightedRecords(
      studentId,
      attendance,
      events,
      cumulativeFrom,
      cumulativeTo,
    );
    const cumulative = calculateAttendanceRate(
      cumulativeRecords,
      symbols,
      conversionRule,
    );

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
