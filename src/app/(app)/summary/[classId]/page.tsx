import { Fragment } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import { monthBuckets } from "@/lib/date";
import {
  buildStudentSummaries,
  type RawAttendanceRecord,
  type RawEventRecord,
} from "@/lib/attendance/summary";
import { colorForRate, formatPercent, type SymbolInfo } from "@/lib/attendance/calc";
import { inputClass, buttonSecondaryClass, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function SummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const staff = await requireStaff();
  const { classId } = await params;
  const { from, to } = await searchParams;
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("*, term:terms(*)")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || !cls.term) notFound();
  const term = cls.term;

  const allowed = await hasPermission(supabase, staff, "can_view_summary");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        このクラスの集計を閲覧する権限がありません。
        <Link href="/summary" className="ml-1 underline">
          集計トップに戻る
        </Link>
      </div>
    );
  }

  const periodFrom = from && from >= term.start_date ? from : term.start_date;
  const periodTo = to && to <= term.end_date ? to : term.end_date;

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
  let roster: { id: string; student_number: string; name: string; furigana: string }[] = [];
  if (cls.type === "homeroom") {
    const { data } = await supabase
      .from("class_enrollments")
      .select("student:students(id, student_number, name, furigana)")
      .eq("class_id", classId)
      .lte("valid_from", term.end_date)
      .or(`valid_to.is.null,valid_to.gte.${term.start_date}`);
    roster = (data ?? [])
      .map((r) => r.student)
      .filter((s): s is NonNullable<typeof s> => !!s);
  } else {
    const { data } = await supabase
      .from("elective_memberships")
      .select("student:students(id, student_number, name, furigana)")
      .eq("class_id", classId)
      .lte("valid_from", term.end_date)
      .or(`valid_to.is.null,valid_to.gte.${term.start_date}`);
    roster = (data ?? [])
      .map((r) => r.student)
      .filter((s): s is NonNullable<typeof s> => !!s);
  }
  // 重複除去＋学籍番号順
  const rosterMap = new Map(roster.map((s) => [s.id, s]));
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
  const summaryByStudent = new Map(summaries.map((s) => [s.studentId, s]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/summary" className="text-sm text-blue-600 hover:underline">
          ← クラス選択に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{cls.name} － 集計</h1>
        <p className="text-xs text-slate-500">学期：{term.name}</p>
      </div>

      <form action={`/summary/${classId}`} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">累計対象期間（開始）</label>
          <input type="date" name="from" defaultValue={periodFrom} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">累計対象期間（終了）</label>
          <input type="date" name="to" defaultValue={periodTo} className={inputClass} />
        </div>
        <button type="submit" className={buttonSecondaryClass}>
          表示
        </button>
        <Link href={`/summary/${classId}`} className="text-xs text-slate-400 underline">
          学期全体にリセット
        </Link>
      </form>

      {rosterList.length === 0 ? (
        <p className="text-sm text-slate-500">対象の学生がいません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={`${thClass} sticky left-0 bg-slate-50`}>学籍番号</th>
                <th className={`${thClass} sticky left-20 bg-slate-50`}>氏名</th>
                <th className={thClass}>累計要出席</th>
                <th className={thClass}>
                  累計出席率
                  <br />
                  <span className="text-[10px] font-normal">
                    {periodFrom} 〜 {periodTo}
                  </span>
                </th>
                {months.map((m) => (
                  <th key={`${m.year}-${m.month}`} className={thClass} colSpan={2}>
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rosterList.map((student) => {
                const summary = summaryByStudent.get(student.id);
                if (!summary) return null;
                const cumulativeColor = colorForRate(summary.cumulative.rate, colorRules);
                return (
                  <tr key={student.id}>
                    <td className={`${tdClass} sticky left-0 bg-white`}>
                      {student.student_number}
                    </td>
                    <td className={`${tdClass} sticky left-20 bg-white`}>{student.name}</td>
                    <td className={tdClass}>{summary.cumulative.reqDays}</td>
                    <td
                      className={tdClass}
                      style={cumulativeColor ? { backgroundColor: cumulativeColor } : undefined}
                    >
                      {formatPercent(summary.cumulative.rate, decimalDigits)}
                    </td>
                    {summary.months.map((m) => {
                      const color = colorForRate(m.rate, colorRules);
                      return (
                        <Fragment key={`${m.year}-${m.month}`}>
                          <td className={tdClass}>{m.reqDays}</td>
                          <td
                            className={tdClass}
                            style={color ? { backgroundColor: color } : undefined}
                          >
                            {formatPercent(m.rate, decimalDigits)}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
