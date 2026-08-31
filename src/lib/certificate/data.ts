import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { monthBuckets } from "@/lib/date";
import {
  buildStudentSummaries,
  type RawAttendanceRecord,
  type RawEventRecord,
} from "@/lib/attendance/summary";
import type { SymbolInfo } from "@/lib/attendance/calc";

type Client = SupabaseClient<Database>;
type Term = Database["public"]["Tables"]["terms"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];

export interface CertificateMonthCell {
  year: number;
  month: number;
  courseHours: number;
  attendanceHours: number;
  rate: number;
}

export interface CertificateData {
  student: StudentRow;
  cumulativeCourseHours: number;
  cumulativeAttendanceHours: number;
  cumulativeRate: number;
  // 入学年月から24ヶ月分（12ヶ月×2ブロック）。データがない月は0で埋める。
  monthBlocks: [CertificateMonthCell[], CertificateMonthCell[]];
}

export interface SchoolSettings {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  principalName: string;
  longVacation: string;
}

export async function getSchoolSettings(supabase: Client): Promise<SchoolSettings> {
  const { data } = await supabase
    .from("school_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return {
    schoolName: data?.school_name ?? "",
    schoolAddress: data?.school_address ?? "",
    schoolPhone: data?.school_phone ?? "",
    principalName: data?.principal_name ?? "",
    longVacation: data?.long_vacation ?? "",
  };
}

// 学生1人分の、入学からの通算・月別（時限数×単位数＝時間数換算済み）出席状況を計算する。
// 学生が過去に所属した全ての学期を横断して集計する（attendance-status/data.ts と同じ考え方）。
// 「時限あたりの単位数」は学期ごとに設定できるため、時間数換算は各学期の値でその学期分を
// 換算してから合算する。
export async function getCertificateData(
  supabase: Client,
  studentId: string,
): Promise<CertificateData | null> {
  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return null;

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
      ? await supabase.from("terms").select("*").in("id", termIds).order("start_date")
      : { data: [] };

  let cumulativeCourseHours = 0;
  let cumulativeAttendanceHours = 0;
  // 月(YYYY-M) -> 時間数換算済みの授業時間数・出席時間数
  const hoursByMonth = new Map<string, { courseHours: number; attendanceHours: number }>();

  for (const term of (terms ?? []) as Term[]) {
    const [{ data: symbolRows }, { data: conversionRule }, { data: termSettings }] =
      await Promise.all([
        supabase.from("symbols").select("*").eq("term_id", term.id).order("order_no"),
        supabase.from("conversion_rules").select("*").eq("term_id", term.id).maybeSingle(),
        supabase.from("term_settings").select("*").eq("term_id", term.id).maybeSingle(),
      ]);
    const creditHours = termSettings?.credit_hours_per_period ?? 1;

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

    const months = monthBuckets(term.start_date, term.end_date);
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

    cumulativeCourseHours += summary.cumulative.reqDays * creditHours;
    cumulativeAttendanceHours +=
      (summary.cumulative.reqDays - summary.cumulative.totalAbsences) * creditHours;

    for (const m of summary.months) {
      const key = `${m.year}-${m.month}`;
      const acc = hoursByMonth.get(key) ?? { courseHours: 0, attendanceHours: 0 };
      acc.courseHours += m.reqDays * creditHours;
      acc.attendanceHours += (m.reqDays - m.totalAbsences) * creditHours;
      hoursByMonth.set(key, acc);
    }
  }

  // CSV取り込みによる過去データも累計に合算する（現在アクティブな学期のうち最新のものの
  // 単位数換算値を用いる。過去データは学期に紐付かないため、その他に合理的な基準がない）。
  const { data: activeTerms } = await supabase
    .from("terms")
    .select("id")
    .eq("is_active", true)
    .order("start_date", { ascending: false })
    .limit(1);
  let historicalCreditHours = 1;
  if (activeTerms && activeTerms.length > 0) {
    const { data: activeTermSettings } = await supabase
      .from("term_settings")
      .select("credit_hours_per_period")
      .eq("term_id", activeTerms[0].id)
      .maybeSingle();
    historicalCreditHours = activeTermSettings?.credit_hours_per_period ?? 1;
  }

  const { data: historicalRows } = await supabase
    .from("historical_monthly_summaries")
    .select("year_month, required_days, absent_days")
    .eq("student_id", studentId);
  for (const h of historicalRows ?? []) {
    cumulativeCourseHours += h.required_days * historicalCreditHours;
    cumulativeAttendanceHours += (h.required_days - h.absent_days) * historicalCreditHours;
  }

  const cumulativeRate =
    cumulativeCourseHours > 0 ? cumulativeAttendanceHours / cumulativeCourseHours : 0;

  // 入学年月から24ヶ月（12ヶ月×2ブロック）分の月別セルを組み立てる。
  const [startYear, startMonth] = student.enrollment_date.split("-").map(Number);
  const monthCells: CertificateMonthCell[] = [];
  let y = startYear;
  let m = startMonth;
  for (let i = 0; i < 24; i++) {
    const key = `${y}-${m}`;
    const hours = hoursByMonth.get(key) ?? { courseHours: 0, attendanceHours: 0 };
    monthCells.push({
      year: y,
      month: m,
      courseHours: hours.courseHours,
      attendanceHours: hours.attendanceHours,
      rate: hours.courseHours > 0 ? hours.attendanceHours / hours.courseHours : 0,
    });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return {
    student,
    cumulativeCourseHours,
    cumulativeAttendanceHours,
    cumulativeRate,
    monthBlocks: [monthCells.slice(0, 12), monthCells.slice(12, 24)],
  };
}
