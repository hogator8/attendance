import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getActiveTerms } from "@/lib/terms";
import { monthBuckets, type MonthBucket } from "@/lib/date";
import {
  buildStudentSummaries,
  type RawAttendanceRecord,
  type RawEventRecord,
  type StudentSummary,
} from "@/lib/attendance/summary";
import { formatPercent, type SymbolInfo, type AttendanceRateResult } from "@/lib/attendance/calc";

type Client = SupabaseClient<Database>;

export interface RosterStudent {
  id: string;
  student_number: string;
  name: string;
  furigana: string;
  nationality: string | null;
  categoryName: string | null;
}

export interface AllStudentsSummaryData {
  rosterList: RosterStudent[];
  months: MonthBucket[];
  decimalDigits: number;
  colorRules: { lowerPct: number; upperPct: number; colorHex: string }[];
  symbolLabels: string[];
  summaryByStudent: Map<string, StudentSummary>;
  symbolCountsByStudent: Map<string, Map<string, number>>;
  // 月別・記号別の内訳（studentId -> "年-月" -> 記号名 -> 件数）。
  // symbolCountsByStudentと同様、記号IDは学期をまたいで変わりうるため
  // "記号：項目名"のラベルをキーにして横断集計する。
  monthlySymbolCountsByStudent: Map<string, Map<string, Map<string, number>>>;
  periodFrom: string;
  periodTo: string;
}

function emptyRate(): AttendanceRateResult {
  return {
    reqDays: 0,
    attendedCount: 0,
    rawAbsCount: 0,
    lateCount: 0,
    earlyCount: 0,
    convertedAbsences: 0,
    totalAbsences: 0,
    excusedCount: 0,
    rate: 0,
    symbolCounts: {},
  };
}

function mergeRate(a: AttendanceRateResult, b: AttendanceRateResult): AttendanceRateResult {
  const reqDays = a.reqDays + b.reqDays;
  const totalAbsences = a.totalAbsences + b.totalAbsences;
  return {
    reqDays,
    attendedCount: a.attendedCount + b.attendedCount,
    rawAbsCount: a.rawAbsCount + b.rawAbsCount,
    lateCount: a.lateCount + b.lateCount,
    earlyCount: a.earlyCount + b.earlyCount,
    convertedAbsences: a.convertedAbsences + b.convertedAbsences,
    totalAbsences,
    excusedCount: a.excusedCount + b.excusedCount,
    rate: reqDays > 0 ? (reqDays - totalAbsences) / reqDays : 0,
    symbolCounts: a.symbolCounts,
  };
}

// クラスの垣根を越えた全学生分の集計データを取得する。
// アクティブな学期が複数ある場合は、月別列は全学期の月を統合し、
// 累計は学生ごとに各学期の集計を合算する（過去データCSV取り込み分も合算）。
export async function getAllStudentsSummaryData(
  supabase: Client,
  range: { from?: string; to?: string },
): Promise<AllStudentsSummaryData> {
  const { data: studentsRaw } = await supabase
    .from("students")
    .select("id, student_number, name, furigana, nationality, category:student_categories(name)")
    .neq("status", "withdrawn")
    .order("student_number");
  const rosterList: RosterStudent[] = (studentsRaw ?? []).map((s) => ({
    id: s.id,
    student_number: s.student_number,
    name: s.name,
    furigana: s.furigana,
    nationality: s.nationality,
    categoryName: s.category?.name ?? null,
  }));
  const studentIds = rosterList.map((s) => s.id);

  const activeTerms = await getActiveTerms(supabase);

  const summaryByStudent = new Map<string, StudentSummary>(
    studentIds.map((id) => [id, { studentId: id, cumulative: emptyRate(), months: [] }]),
  );
  const symbolCountsByStudent = new Map<string, Map<string, number>>(
    studentIds.map((id) => [id, new Map<string, number>()]),
  );
  const monthlySymbolCountsByStudent = new Map<string, Map<string, Map<string, number>>>(
    studentIds.map((id) => [id, new Map<string, Map<string, number>>()]),
  );
  const monthMap = new Map<string, MonthBucket>();
  const symbolLabelSet = new Set<string>();

  let decimalDigits = 1;
  let colorRules: { lowerPct: number; upperPct: number; colorHex: string }[] = [];
  let overallPeriodFrom: string | null = null;
  let overallPeriodTo: string | null = null;

  for (const term of activeTerms) {
    const periodFrom = range.from && range.from >= term.start_date ? range.from : term.start_date;
    const periodTo = range.to && range.to <= term.end_date ? range.to : term.end_date;
    if (overallPeriodFrom === null || periodFrom < overallPeriodFrom) overallPeriodFrom = periodFrom;
    if (overallPeriodTo === null || periodTo > overallPeriodTo) overallPeriodTo = periodTo;

    const [{ data: symbolRows }, { data: conversionRule }, { data: colorRuleRows }, { data: termSettings }] =
      await Promise.all([
        supabase.from("symbols").select("*").eq("term_id", term.id).order("order_no"),
        supabase.from("conversion_rules").select("*").eq("term_id", term.id).maybeSingle(),
        supabase.from("color_rules").select("*").eq("term_id", term.id).order("tier_no"),
        supabase.from("term_settings").select("*").eq("term_id", term.id).maybeSingle(),
      ]);

    const symbols: SymbolInfo[] = (symbolRows ?? []).map((s) => ({
      id: s.id,
      category: s.category,
      countsAsRequired: s.counts_as_required,
      isLateEarlyTarget: s.is_late_early_target,
    }));
    const symbolLabelById = new Map(
      (symbolRows ?? []).map((s) => [s.id, `${s.symbol_char}：${s.label}`]),
    );
    for (const label of symbolLabelById.values()) symbolLabelSet.add(label);
    const rule = {
      lateN: conversionRule?.late_n ?? 0,
      earlyN: conversionRule?.early_n ?? 0,
      combinedN: conversionRule?.combined_n ?? 0,
    };
    if (activeTerms.length === 1) {
      decimalDigits = termSettings?.percent_decimal_digits ?? 1;
      colorRules = (colorRuleRows ?? []).map((c) => ({
        lowerPct: c.lower_pct,
        upperPct: c.upper_pct,
        colorHex: c.color_hex,
      }));
    }

    const { data: attendanceRows } =
      studentIds.length > 0
        ? await supabase
            .from("attendance_records")
            .select("student_id, date, symbol_id")
            .in("student_id", studentIds)
            .gte("date", term.start_date)
            .lte("date", term.end_date)
        : { data: [] };
    const attendance: RawAttendanceRecord[] = (attendanceRows ?? []).map((r) => ({
      studentId: r.student_id,
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
      eventIds.length > 0 && studentIds.length > 0
        ? await supabase
            .from("event_attendance")
            .select("event_id, student_id, symbol_id")
            .in("event_id", eventIds)
            .in("student_id", studentIds)
        : { data: [] };
    const events: RawEventRecord[] = (eventAttendanceRows ?? [])
      .map((r) => {
        const meta = eventMeta.get(r.event_id);
        if (!meta) return null;
        return {
          studentId: r.student_id,
          symbolId: r.symbol_id,
          eventDate: meta.dateFrom,
          creditPeriods: meta.creditPeriods,
        };
      })
      .filter((e): e is RawEventRecord => !!e);

    const months = monthBuckets(term.start_date, term.end_date);
    for (const m of months) monthMap.set(`${m.year}-${m.month}`, m);

    const termSummaries = buildStudentSummaries(
      studentIds,
      attendance,
      events,
      symbols,
      rule,
      periodFrom,
      periodTo,
      months,
    );

    for (const s of termSummaries) {
      const existing = summaryByStudent.get(s.studentId)!;
      summaryByStudent.set(s.studentId, {
        studentId: s.studentId,
        cumulative: mergeRate(existing.cumulative, s.cumulative),
        months: [...existing.months, ...s.months],
      });

      const counts = symbolCountsByStudent.get(s.studentId)!;
      for (const [symbolId, count] of Object.entries(s.cumulative.symbolCounts)) {
        if (count === 0) continue;
        const label = symbolLabelById.get(symbolId) ?? symbolId;
        counts.set(label, (counts.get(label) ?? 0) + count);
      }

      const monthlyCounts = monthlySymbolCountsByStudent.get(s.studentId)!;
      for (const m of s.months) {
        const monthKey = `${m.year}-${m.month}`;
        const countsForMonth = monthlyCounts.get(monthKey) ?? new Map<string, number>();
        for (const [symbolId, count] of Object.entries(m.symbolCounts)) {
          if (count === 0) continue;
          const label = symbolLabelById.get(symbolId) ?? symbolId;
          countsForMonth.set(label, (countsForMonth.get(label) ?? 0) + count);
        }
        monthlyCounts.set(monthKey, countsForMonth);
      }
    }
  }

  // CSV取り込み（標準パターン）による過去の月別集計を累計に合算する。
  const { data: historicalRows } =
    studentIds.length > 0
      ? await supabase
          .from("historical_monthly_summaries")
          .select(
            "student_id, required_days, attended_days, absent_days, late_count, early_leave_count, excused_days",
          )
          .in("student_id", studentIds)
      : { data: [] };
  for (const h of historicalRows ?? []) {
    const existing = summaryByStudent.get(h.student_id);
    if (!existing) continue;
    const reqDays = existing.cumulative.reqDays + h.required_days;
    const totalAbsences = existing.cumulative.totalAbsences + h.absent_days;
    existing.cumulative = {
      ...existing.cumulative,
      reqDays,
      totalAbsences,
      attendedCount: existing.cumulative.attendedCount + h.attended_days,
      lateCount: existing.cumulative.lateCount + h.late_count,
      earlyCount: existing.cumulative.earlyCount + h.early_leave_count,
      excusedCount: existing.cumulative.excusedCount + h.excused_days,
      rate: reqDays > 0 ? (reqDays - totalAbsences) / reqDays : 0,
    };
  }

  const months = Array.from(monthMap.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );

  const today = new Date().toISOString().slice(0, 10);

  return {
    rosterList,
    months,
    decimalDigits,
    colorRules,
    symbolLabels: Array.from(symbolLabelSet.values()).sort((a, b) => a.localeCompare(b, "ja")),
    summaryByStudent,
    symbolCountsByStudent,
    monthlySymbolCountsByStudent,
    periodFrom: overallPeriodFrom ?? range.from ?? today,
    periodTo: overallPeriodTo ?? range.to ?? today,
  };
}

export interface ColumnDef {
  key: string;
  label: string;
  defaultOn: boolean;
}

export function buildAllStudentsColumnDefs(data: AllStudentsSummaryData): ColumnDef[] {
  const cols: ColumnDef[] = [
    { key: "nationality", label: "国籍", defaultOn: false },
    { key: "student_category", label: "学生区分", defaultOn: false },
    { key: "cum_req_days", label: "累計要出席時数", defaultOn: false },
    { key: "cum_attended", label: "累計出席時数", defaultOn: false },
    { key: "cum_rate", label: "累計出席率", defaultOn: true },
    { key: "cum_raw_abs", label: "累計欠席時数", defaultOn: false },
    { key: "cum_late", label: "累計遅刻回数", defaultOn: false },
    { key: "cum_early", label: "累計早退回数", defaultOn: false },
    { key: "cum_converted_abs", label: "累計換算欠席時数", defaultOn: false },
    { key: "cum_total_abs", label: "累計合計欠席時数", defaultOn: false },
    { key: "cum_excused", label: "累計公欠時数", defaultOn: false },
  ];
  for (const label of data.symbolLabels) {
    cols.push({ key: `symbol_${label}`, label: `累計${label}`, defaultOn: false });
  }
  for (const m of data.months) {
    const prefix = `month_${m.year}_${m.month}`;
    cols.push({ key: `${prefix}_req`, label: `${m.label}要出席時数`, defaultOn: false });
    cols.push({ key: `${prefix}_attended`, label: `${m.label}出席時数`, defaultOn: false });
    cols.push({ key: `${prefix}_rate`, label: `${m.label}出席率`, defaultOn: true });
    cols.push({ key: `${prefix}_raw_abs`, label: `${m.label}欠席時数`, defaultOn: false });
    cols.push({ key: `${prefix}_late`, label: `${m.label}遅刻回数`, defaultOn: false });
    cols.push({ key: `${prefix}_early`, label: `${m.label}早退回数`, defaultOn: false });
    cols.push({ key: `${prefix}_converted_abs`, label: `${m.label}換算欠席時数`, defaultOn: false });
    cols.push({ key: `${prefix}_total_abs`, label: `${m.label}合計欠席時数`, defaultOn: false });
    cols.push({ key: `${prefix}_excused`, label: `${m.label}公欠時数`, defaultOn: false });
    for (const label of data.symbolLabels) {
      cols.push({ key: `${prefix}_symbol_${label}`, label: `${m.label}${label}`, defaultOn: false });
    }
  }
  return cols;
}

export function resolveAllStudentsColumns(
  defs: ColumnDef[],
  selected: string[] | undefined,
): ColumnDef[] {
  if (!selected || selected.length === 0) {
    return defs.filter((c) => c.defaultOn);
  }
  const selectedSet = new Set(selected);
  return defs.filter((c) => selectedSet.has(c.key));
}

export function getAllStudentsCellValue(
  key: string,
  student: RosterStudent,
  summary: StudentSummary | undefined,
  symbolCounts: Map<string, number> | undefined,
  monthlySymbolCounts: Map<string, Map<string, number>> | undefined,
  decimalDigits: number,
): string {
  if (key === "nationality") return student.nationality ?? "";
  if (key === "student_category") return student.categoryName ?? "";
  if (!summary) return "";
  if (key === "cum_req_days") return String(summary.cumulative.reqDays);
  if (key === "cum_attended") return String(summary.cumulative.attendedCount);
  if (key === "cum_rate") return formatPercent(summary.cumulative.rate, decimalDigits);
  if (key === "cum_raw_abs") return String(summary.cumulative.rawAbsCount);
  if (key === "cum_late") return String(summary.cumulative.lateCount);
  if (key === "cum_early") return String(summary.cumulative.earlyCount);
  if (key === "cum_converted_abs") return String(summary.cumulative.convertedAbsences);
  if (key === "cum_total_abs") return String(summary.cumulative.totalAbsences);
  if (key === "cum_excused") return String(summary.cumulative.excusedCount);

  if (key.startsWith("symbol_")) {
    const label = key.slice("symbol_".length);
    return String(symbolCounts?.get(label) ?? 0);
  }

  const monthSymbolMatch = key.match(/^month_(\d+)_(\d+)_symbol_(.+)$/);
  if (monthSymbolMatch) {
    const year = monthSymbolMatch[1];
    const month = monthSymbolMatch[2];
    const label = monthSymbolMatch[3];
    const countsForMonth = monthlySymbolCounts?.get(`${year}-${month}`);
    return String(countsForMonth?.get(label) ?? 0);
  }

  const monthMatch = key.match(
    /^month_(\d+)_(\d+)_(req|attended|rate|raw_abs|late|early|converted_abs|total_abs|excused)$/,
  );
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    const field = monthMatch[3];
    const monthSummary = summary.months.find((m) => m.year === year && m.month === month);
    if (!monthSummary) return "";
    switch (field) {
      case "req":
        return String(monthSummary.reqDays);
      case "attended":
        return String(monthSummary.attendedCount);
      case "rate":
        return formatPercent(monthSummary.rate, decimalDigits);
      case "raw_abs":
        return String(monthSummary.rawAbsCount);
      case "late":
        return String(monthSummary.lateCount);
      case "early":
        return String(monthSummary.earlyCount);
      case "converted_abs":
        return String(monthSummary.convertedAbsences);
      case "total_abs":
        return String(monthSummary.totalAbsences);
      case "excused":
        return String(monthSummary.excusedCount);
      default:
        return "";
    }
  }

  return "";
}
