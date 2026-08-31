import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { monthBuckets, type MonthBucket } from "@/lib/date";
import {
  buildStudentSummaries,
  type RawAttendanceRecord,
  type RawEventRecord,
} from "@/lib/attendance/summary";
import { formatPercent, type SymbolInfo, type AttendanceRateResult } from "@/lib/attendance/calc";

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
  // 記号ごとの累計回数（"記号:項目名" をキーにして全所属学期を横断集計）
  symbolCountsByLabel: Map<string, number>;
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
  let totalRawAbs = 0;
  let totalLate = 0;
  let totalEarly = 0;
  let totalConvertedAbs = 0;
  let totalAbsences = 0;
  let totalExcused = 0;
  const monthlyRows: MonthlyRow[] = [];
  const symbolCountsByLabel = new Map<string, number>();

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
    const symbolLabelById = new Map(
      (symbolRows ?? []).map((s) => [s.id, `${s.symbol_char}：${s.label}`]),
    );
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
    totalRawAbs += summary.cumulative.rawAbsCount;
    totalLate += summary.cumulative.lateCount;
    totalEarly += summary.cumulative.earlyCount;
    totalConvertedAbs += summary.cumulative.convertedAbsences;
    totalAbsences += summary.cumulative.totalAbsences;
    totalExcused += summary.cumulative.excusedCount;

    for (const [symbolId, count] of Object.entries(summary.cumulative.symbolCounts)) {
      if (count === 0) continue;
      const label = symbolLabelById.get(symbolId) ?? symbolId;
      symbolCountsByLabel.set(label, (symbolCountsByLabel.get(label) ?? 0) + count);
    }

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
    totalRawAbs += h.absent_days;
    totalLate += h.late_count;
    totalEarly += h.early_leave_count;
    totalAbsences += h.absent_days;
    totalExcused += h.excused_days;
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
    rawAbsCount: totalRawAbs,
    lateCount: totalLate,
    earlyCount: totalEarly,
    convertedAbsences: totalConvertedAbs,
    totalAbsences,
    excusedCount: totalExcused,
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

  return { cumulative, monthlyRows, dailyRecords, symbolCountsByLabel };
}

export interface DetailColumnDef {
  key: string;
  label: string;
  value: string;
  defaultOn: boolean;
}

// 集計ページの列選択テーブルと同じ発想で、この学生1名分の全項目を
// キー・値のペアとして返す（「詳細」セクション用）。
export function buildDetailColumns(
  status: StudentAttendanceStatus,
  decimalDigits: number,
): DetailColumnDef[] {
  const c = status.cumulative;
  const cols: DetailColumnDef[] = [
    { key: "cum_req_days", label: "累計要出席時数", value: String(c.reqDays), defaultOn: false },
    {
      key: "cum_rate",
      label: "累計出席率",
      value: formatPercent(c.rate, decimalDigits),
      defaultOn: true,
    },
    { key: "cum_raw_abs", label: "累計欠席時数", value: String(c.rawAbsCount), defaultOn: false },
    { key: "cum_late", label: "累計遅刻回数", value: String(c.lateCount), defaultOn: false },
    { key: "cum_early", label: "累計早退回数", value: String(c.earlyCount), defaultOn: false },
    {
      key: "cum_converted_abs",
      label: "累計換算欠席時数",
      value: String(c.convertedAbsences),
      defaultOn: false,
    },
    {
      key: "cum_total_abs",
      label: "累計合計欠席時数",
      value: String(c.totalAbsences),
      defaultOn: false,
    },
    { key: "cum_excused", label: "累計公欠時数", value: String(c.excusedCount), defaultOn: false },
  ];
  for (const [label, count] of status.symbolCountsByLabel.entries()) {
    cols.push({ key: `symbol_${label}`, label: `累計${label}`, value: String(count), defaultOn: false });
  }
  for (const m of status.monthlyRows) {
    cols.push({
      key: `month_${m.key}_req`,
      label: `${m.label}　要出席時数`,
      value: String(m.reqDays),
      defaultOn: false,
    });
    cols.push({
      key: `month_${m.key}_rate`,
      label: `${m.label}　出席率`,
      value: formatPercent(m.rate, decimalDigits),
      defaultOn: true,
    });
  }
  return cols;
}

export function resolveDetailColumns(
  defs: DetailColumnDef[],
  selected: string[] | undefined,
): DetailColumnDef[] {
  if (!selected || selected.length === 0) {
    return defs.filter((c) => c.defaultOn);
  }
  const selectedSet = new Set(selected);
  return defs.filter((c) => selectedSet.has(c.key));
}
