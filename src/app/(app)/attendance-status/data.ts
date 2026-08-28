import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { monthBuckets, type MonthBucket } from "@/lib/date";
import {
  buildStudentSummaries,
  type RawAttendanceRecord,
  type RawEventRecord,
} from "@/lib/attendance/summary";
import type { SymbolInfo, AttendanceRateResult } from "@/lib/attendance/calc";

type Client = SupabaseClient<Database>;
type Term = Database["public"]["Tables"]["terms"]["Row"];

export interface MonthlyRow {
  key: string;
  label: string;
  reqDays: number;
  rate: number;
  isHistorical: boolean;
}

export interface DailyRecord {
  date: string;
  periodNo: number;
  className: string;
  symbolChar: string;
  symbolLabel: string;
  timeValue: string | null;
  reason: string | null;
}

export interface StudentAttendanceStatus {
  cumulative: AttendanceRateResult;
  monthlyRows: MonthlyRow[];
  dailyRecords: DailyRecord[];
}

// 学生1人分の、入学からの通算出席状況を計算する。
// 学生が過去に所属した全ての学期を横断して集計し、標準パターンで取り込んだ
// 過去データ（historical_monthly_summaries）も月別列・累計にそのまま合算する。
export async function getStudentAttendanceStatus(
  supabase: Client,
  studentId: string,
): Promise<StudentAttendanceStatus> {
  const [{ data: enrollments }, { data: memberships }] = await Promise.all([
    supabase
      .from("class_enrollments")
      .select("class:classes(term_id)")
      .eq("student_id", studentId),
    supabase
      .from("elective_memberships")
      .select("class:classes(term_id)")
      .eq("student_id", studentId),
  ]);
  const termIds = Array.from(
    new Set(
      [...(enrollments ?? []), ...(memberships ?? [])]
        .map((r) => r.class?.term_id)
        .filter((id): id is string => !!id),
    ),
  );

  const { data: terms } =
    termIds.length > 0
      ? await supabase
          .from("terms")
          .select("*")
          .in("id", termIds)
          .order("start_date")
      : { data: [] };

  let totalReqDays = 0;
  let totalAbsences = 0;
  const monthlyRows: MonthlyRow[] = [];

  for (const term of (terms ?? []) as Term[]) {
    const [{ data: symbolRows }, { data: conversionRule }] = await Promise.all([
      supabase.from("symbols").select("*").eq("term_id", term.id).order("order_no"),
      supabase.from("conversion_rules").select("*").eq("term_id", term.id).maybeSingle(),
    ]);
    const symbols: SymbolInfo[] = (symbolRows ?? []).map((s) => ({
      id: s.id,
      category: s.category,
      countsAsRequired: s.counts_as_required,
      isLateEarlyTarget: s.is_late_early_target,
    }));
    const rule = {
      lateN: conversionRule?.late_n ?? 0,
      earlyN: conversionRule?.early_n ?? 0,
      combinedN: conversionRule?.combined_n ?? 0,
    };

    const { data: attendanceRows } = await supabase
      .from("attendance_records")
      .select("date, symbol_id")
      .eq("student_id", studentId)
      .gte("date", term.start_date)
      .lte("date", term.end_date);
    const attendance: RawAttendanceRecord[] = (attendanceRows ?? []).map((r) => ({
      studentId,
      date: r.date,
      symbolId: r.symbol_id,
    }));

    const { data: termEvents } = await supabase
      .from("events")
      .select("id, date_from, credit_periods")
      .eq("term_id", term.id)
      .gte("date_from", term.start_date)
      .lte("date_from", term.end_date);
    const eventMeta = new Map(
      (termEvents ?? []).map((e) => [e.id, { dateFrom: e.date_from, creditPeriods: e.credit_periods }]),
    );
    const eventIds = (termEvents ?? []).map((e) => e.id);
    const { data: eventAttendanceRows } =
      eventIds.length > 0
        ? await supabase
            .from("event_attendance")
            .select("event_id, symbol_id")
            .eq("student_id", studentId)
            .in("event_id", eventIds)
        : { data: [] };
    const events: RawEventRecord[] = (eventAttendanceRows ?? [])
      .map((r) => {
        const meta = eventMeta.get(r.event_id);
        if (!meta) return null;
        return {
          studentId,
          symbolId: r.symbol_id,
          eventDate: meta.dateFrom,
          creditPeriods: meta.creditPeriods,
        };
      })
      .filter((e): e is RawEventRecord => !!e);

    const months: MonthBucket[] = monthBuckets(term.start_date, term.end_date);
    const [summary] = buildStudentSummaries(
      [studentId],
      attendance,
      events,
      symbols,
      rule,
      term.start_date,
      term.end_date,
      months,
    );

    totalReqDays += summary.cumulative.reqDays;
    totalAbsences += summary.cumulative.totalAbsences;

    for (const m of summary.months) {
      monthlyRows.push({
        key: `${m.year}-${m.month}`,
        label: `${m.year}年${m.month}月`,
        reqDays: m.reqDays,
        rate: m.rate,
        isHistorical: false,
      });
    }
  }

  const { data: historicalRows } = await supabase
    .from("historical_monthly_summaries")
    .select("*")
    .eq("student_id", studentId)
    .order("year_month");
  for (const h of historicalRows ?? []) {
    totalReqDays += h.required_days;
    totalAbsences += h.absent_days;
    const [y, m] = h.year_month.split("-").map(Number);
    monthlyRows.push({
      key: `${y}-${m}-historical`,
      label: `${y}年${m}月（過去データ）`,
      reqDays: h.required_days,
      rate: h.required_days > 0 ? (h.required_days - h.absent_days) / h.required_days : 0,
      isHistorical: true,
    });
  }

  monthlyRows.sort((a, b) => a.key.localeCompare(b.key));

  const cumulative: AttendanceRateResult = {
    reqDays: totalReqDays,
    rawAbsCount: 0,
    lateCount: 0,
    earlyCount: 0,
    convertedAbsences: 0,
    totalAbsences,
    rate: totalReqDays > 0 ? (totalReqDays - totalAbsences) / totalReqDays : 0,
    symbolCounts: {},
  };

  const { data: dailyRows } = await supabase
    .from("attendance_records")
    .select("date, period_no, time_value, reason, class:classes(name), symbol:symbols(symbol_char, label)")
    .eq("student_id", studentId)
    .order("date", { ascending: false })
    .order("period_no");
  const dailyRecords: DailyRecord[] = (dailyRows ?? []).map((r) => ({
    date: r.date,
    periodNo: r.period_no,
    className: r.class?.name ?? "-",
    symbolChar: r.symbol?.symbol_char ?? "-",
    symbolLabel: r.symbol?.label ?? "-",
    timeValue: r.time_value,
    reason: r.reason,
  }));

  return { cumulative, monthlyRows, dailyRecords };
}
