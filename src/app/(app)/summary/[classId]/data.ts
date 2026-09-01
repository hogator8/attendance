import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { monthBuckets, type MonthBucket } from "@/lib/date";
import {
  buildStudentSummaries,
  type RawAttendanceRecord,
  type RawEventRecord,
  type StudentSummary,
} from "@/lib/attendance/summary";
import { formatPercent, type SymbolInfo } from "@/lib/attendance/calc";

type Client = SupabaseClient<Database>;

export interface RosterStudent {
  id: string;
  student_number: string;
  name: string;
  furigana: string;
  nationality: string | null;
  categoryName: string | null;
}

export interface ClassSummaryData {
  cls: Database["public"]["Tables"]["classes"]["Row"];
  term: Database["public"]["Tables"]["terms"]["Row"];
  symbolRows: Database["public"]["Tables"]["symbols"]["Row"][];
  colorRules: { lowerPct: number; upperPct: number; colorHex: string }[];
  decimalDigits: number;
  months: MonthBucket[];
  periodFrom: string;
  periodTo: string;
  rosterList: RosterStudent[];
  summaryByStudent: Map<string, StudentSummary>;
}

// 集計画面（テーブル表示・Excel出力）で共通して使うデータ取得ロジック。
// ページ本体とExcel出力用のRoute Handlerの両方から呼び出す。
export async function getClassSummaryData(
  supabase: Client,
  classId: string,
  range: { from?: string; to?: string },
): Promise<ClassSummaryData | null> {
  const { data: cls } = await supabase
    .from("classes")
    .select("*, term:terms(*)")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || !cls.term) return null;
  const term = cls.term;

  const periodFrom =
    range.from && range.from >= term.start_date ? range.from : term.start_date;
  const periodTo = range.to && range.to <= term.end_date ? range.to : term.end_date;

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
  const rule = {
    lateN: conversionRule?.late_n ?? 0,
    earlyN: conversionRule?.early_n ?? 0,
    combinedN: conversionRule?.combined_n ?? 0,
  };
  const colorRules = (colorRuleRows ?? []).map((c) => ({
    lowerPct: c.lower_pct,
    upperPct: c.upper_pct,
    colorHex: c.color_hex,
  }));
  const decimalDigits = termSettings?.percent_decimal_digits ?? 1;

  // このクラスに学期中一度でも所属した学生を対象にする（月別列は学期全体を表示するため）
  type RosterRow = {
    id: string;
    student_number: string;
    name: string;
    furigana: string;
    nationality: string | null;
    category: { name: string } | null;
  };
  let roster: RosterRow[] = [];
  if (cls.type === "homeroom") {
    const { data } = await supabase
      .from("class_enrollments")
      .select(
        "student:students(id, student_number, name, furigana, nationality, category:student_categories(name))",
      )
      .eq("class_id", classId)
      .lte("valid_from", term.end_date)
      .or(`valid_to.is.null,valid_to.gte.${term.start_date}`);
    roster = (data ?? [])
      .map((r) => r.student)
      .filter((s): s is NonNullable<typeof s> => !!s);
  } else {
    const { data } = await supabase
      .from("elective_memberships")
      .select(
        "student:students(id, student_number, name, furigana, nationality, category:student_categories(name))",
      )
      .eq("class_id", classId)
      .lte("valid_from", term.end_date)
      .or(`valid_to.is.null,valid_to.gte.${term.start_date}`);
    roster = (data ?? [])
      .map((r) => r.student)
      .filter((s): s is NonNullable<typeof s> => !!s);
  }
  // 重複除去＋学籍番号順
  const rosterMap = new Map<string, RosterStudent>(
    roster.map((s) => [
      s.id,
      {
        id: s.id,
        student_number: s.student_number,
        name: s.name,
        furigana: s.furigana,
        nationality: s.nationality,
        categoryName: s.category?.name ?? null,
      },
    ]),
  );
  const rosterList = Array.from(rosterMap.values()).sort((a, b) =>
    a.student_number.localeCompare(b.student_number, "ja"),
  );
  const studentIds = rosterList.map((s) => s.id);

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
  const summaries = buildStudentSummaries(
    studentIds,
    attendance,
    events,
    symbols,
    rule,
    periodFrom,
    periodTo,
    months,
  );

  // CSV取り込み（標準パターン）による過去の月別集計を、累計出席率に合算する
  // （入学からの通算出席率を表示するため）。月別列自体には反映しない
  // （月別列はこのクラスが属する学期の月のみを対象とするため）。
  const { data: historicalRows } =
    studentIds.length > 0
      ? await supabase
          .from("historical_monthly_summaries")
          .select(
            "student_id, required_days, absent_days, late_count, early_leave_count, excused_days",
          )
          .in("student_id", studentIds)
      : { data: [] };
  const historicalByStudent = new Map<
    string,
    {
      requiredDays: number;
      absentDays: number;
      lateCount: number;
      earlyCount: number;
      excusedDays: number;
    }
  >();
  for (const r of historicalRows ?? []) {
    const acc = historicalByStudent.get(r.student_id) ?? {
      requiredDays: 0,
      absentDays: 0,
      lateCount: 0,
      earlyCount: 0,
      excusedDays: 0,
    };
    acc.requiredDays += r.required_days;
    acc.absentDays += r.absent_days;
    acc.lateCount += r.late_count;
    acc.earlyCount += r.early_leave_count;
    acc.excusedDays += r.excused_days;
    historicalByStudent.set(r.student_id, acc);
  }

  for (const summary of summaries) {
    const historical = historicalByStudent.get(summary.studentId);
    if (!historical) continue;
    const reqDays = summary.cumulative.reqDays + historical.requiredDays;
    const totalAbsences = summary.cumulative.totalAbsences + historical.absentDays;
    summary.cumulative = {
      ...summary.cumulative,
      reqDays,
      totalAbsences,
      lateCount: summary.cumulative.lateCount + historical.lateCount,
      earlyCount: summary.cumulative.earlyCount + historical.earlyCount,
      excusedCount: summary.cumulative.excusedCount + historical.excusedDays,
      rate: reqDays > 0 ? (reqDays - totalAbsences) / reqDays : 0,
    };
  }

  const summaryByStudent = new Map(summaries.map((s) => [s.studentId, s]));

  return {
    cls,
    term,
    symbolRows: symbolRows ?? [],
    colorRules,
    decimalDigits,
    months,
    periodFrom,
    periodTo,
    rosterList,
    summaryByStudent,
  };
}

export interface ColumnDef {
  key: string;
  label: string;
  defaultOn: boolean;
}

// 列フィルターの候補一覧。「出席記号設定にある全項目」＝各記号の累計回数列を含む。
export function buildColumnDefs(
  symbolRows: Database["public"]["Tables"]["symbols"]["Row"][],
  months: MonthBucket[],
): ColumnDef[] {
  const cols: ColumnDef[] = [
    { key: "nationality", label: "国籍", defaultOn: false },
    { key: "student_category", label: "学生区分", defaultOn: false },
    { key: "cum_req_days", label: "累計要出席時数", defaultOn: false },
    { key: "cum_rate", label: "累計出席率", defaultOn: true },
    { key: "cum_raw_abs", label: "累計欠席時数", defaultOn: false },
    { key: "cum_late", label: "累計遅刻回数", defaultOn: false },
    { key: "cum_early", label: "累計早退回数", defaultOn: false },
    { key: "cum_converted_abs", label: "累計換算欠席時数", defaultOn: false },
    { key: "cum_total_abs", label: "累計合計欠席時数", defaultOn: false },
    { key: "cum_excused", label: "累計公欠時数", defaultOn: false },
  ];
  for (const s of symbolRows) {
    cols.push({
      key: `cum_symbol_${s.id}`,
      label: `累計${s.symbol_char}（${s.label}）`,
      defaultOn: false,
    });
  }
  for (const m of months) {
    const prefix = `month_${m.year}_${m.month}`;
    cols.push({ key: `${prefix}_req`, label: `${m.label}要出席時数`, defaultOn: false });
    cols.push({ key: `${prefix}_rate`, label: `${m.label}出席率`, defaultOn: true });
    cols.push({ key: `${prefix}_raw_abs`, label: `${m.label}欠席時数`, defaultOn: false });
    cols.push({ key: `${prefix}_late`, label: `${m.label}遅刻回数`, defaultOn: false });
    cols.push({ key: `${prefix}_early`, label: `${m.label}早退回数`, defaultOn: false });
    cols.push({ key: `${prefix}_converted_abs`, label: `${m.label}換算欠席時数`, defaultOn: false });
    cols.push({ key: `${prefix}_total_abs`, label: `${m.label}合計欠席時数`, defaultOn: false });
    cols.push({ key: `${prefix}_excused`, label: `${m.label}公欠時数`, defaultOn: false });
    for (const s of symbolRows) {
      cols.push({
        key: `${prefix}_symbol_${s.id}`,
        label: `${m.label}${s.symbol_char}（${s.label}）`,
        defaultOn: false,
      });
    }
  }
  return cols;
}

export function resolveSelectedColumns(
  defs: ColumnDef[],
  selected: string[] | undefined,
): ColumnDef[] {
  if (!selected || selected.length === 0) {
    return defs.filter((c) => c.defaultOn);
  }
  const selectedSet = new Set(selected);
  return defs.filter((c) => selectedSet.has(c.key));
}

export function getCellValue(
  key: string,
  student: RosterStudent,
  summary: StudentSummary | undefined,
  decimalDigits: number,
): string {
  if (!summary) return "";
  if (key === "nationality") return student.nationality ?? "";
  if (key === "student_category") return student.categoryName ?? "";
  if (key === "cum_req_days") return String(summary.cumulative.reqDays);
  if (key === "cum_rate") return formatPercent(summary.cumulative.rate, decimalDigits);
  if (key === "cum_raw_abs") return String(summary.cumulative.rawAbsCount);
  if (key === "cum_late") return String(summary.cumulative.lateCount);
  if (key === "cum_early") return String(summary.cumulative.earlyCount);
  if (key === "cum_converted_abs") return String(summary.cumulative.convertedAbsences);
  if (key === "cum_total_abs") return String(summary.cumulative.totalAbsences);
  if (key === "cum_excused") return String(summary.cumulative.excusedCount);

  if (key.startsWith("cum_symbol_")) {
    const symbolId = key.slice("cum_symbol_".length);
    return String(summary.cumulative.symbolCounts[symbolId] ?? 0);
  }

  const monthSymbolMatch = key.match(/^month_(\d+)_(\d+)_symbol_(.+)$/);
  if (monthSymbolMatch) {
    const year = Number(monthSymbolMatch[1]);
    const month = Number(monthSymbolMatch[2]);
    const symbolId = monthSymbolMatch[3];
    const monthSummary = summary.months.find((m) => m.year === year && m.month === month);
    if (!monthSummary) return "";
    return String(monthSummary.symbolCounts[symbolId] ?? 0);
  }

  const monthMatch = key.match(
    /^month_(\d+)_(\d+)_(req|rate|raw_abs|late|early|converted_abs|total_abs|excused)$/,
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
