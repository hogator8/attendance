import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { dayOfWeekOf } from "@/lib/date";
import { getHomeroomRoster, getElectiveRoster } from "@/lib/roster";

type Client = SupabaseClient<Database>;

export interface CompletionResult {
  periodComplete: Map<number, boolean>;
  dayComplete: boolean;
}

// 時限ごとに、対象学生（rosterStudentIds）全員分のattendance_recordsが
// 存在するか（記号の種類は問わない）を判定する。全時限が揃って初めて
// dayComplete=true になる。periodNosが空（授業が組まれていない日）の場合は
// 常にdayComplete=false（そもそも入力すべきものがないため「完了」とはしない）。
export function computeCompletion(
  periodNos: number[],
  rosterStudentIds: string[],
  recordedByPeriod: Map<number, Set<string>>,
): CompletionResult {
  const periodComplete = new Map<number, boolean>();
  for (const p of periodNos) {
    const recorded = recordedByPeriod.get(p) ?? new Set<string>();
    periodComplete.set(
      p,
      rosterStudentIds.length > 0 && rosterStudentIds.every((id) => recorded.has(id)),
    );
  }
  const dayComplete =
    periodNos.length > 0 && periodNos.every((p) => periodComplete.get(p) === true);
  return { periodComplete, dayComplete };
}

// 指定クラス・指定日について、通常授業として入力対象となる時限番号一覧を返す。
// 休業日の場合・行事によって全時限が置き換えられている場合は空配列を返す
// （＝完了判定の対象外）。一部の時限のみ行事で置き換えられている場合は、
// 置き換えられていない時限のみを対象とする。出席入力ページ本体
// （src/app/(app)/attendance/[classId]/page.tsx）の時限決定ロジックと
// 同じ考え方だが、完了判定にしか使わない軽量版（科目名・担当教員名などの
// 表示用データは取得しない）として独立させている。
export async function getRequiredPeriodNumbers(
  supabase: Client,
  classId: string,
  termId: string,
  date: string,
): Promise<number[]> {
  const dayOfWeek = dayOfWeekOf(date);

  const [{ data: holiday }, { data: candidateEvents }, { data: versions }] = await Promise.all([
    supabase.from("holidays").select("id").eq("term_id", termId).eq("date", date).maybeSingle(),
    supabase
      .from("events")
      .select("id, replace_mode")
      .eq("term_id", termId)
      .lte("date_from", date)
      .gte("date_to", date),
    supabase
      .from("timetable_versions")
      .select("id")
      .eq("class_id", classId)
      .lte("effective_from", date)
      .or(`effective_to.is.null,effective_to.gte.${date}`),
  ]);

  if (holiday) return [];

  const candidateEventIds = (candidateEvents ?? []).map((e) => e.id);
  const { data: eventClassLinks } =
    candidateEventIds.length > 0
      ? await supabase
          .from("event_classes")
          .select("event_id, class_id")
          .in("event_id", candidateEventIds)
      : { data: [] as { event_id: string; class_id: string }[] };
  const classIdsByEvent = new Map<string, string[]>();
  for (const link of eventClassLinks ?? []) {
    const arr = classIdsByEvent.get(link.event_id) ?? [];
    arr.push(link.class_id);
    classIdsByEvent.set(link.event_id, arr);
  }
  const applicableEvents = (candidateEvents ?? []).filter((e) => {
    const targets = classIdsByEvent.get(e.id);
    return !targets || targets.length === 0 || targets.includes(classId);
  });
  // 行事によって全時限が置き換えられている日は対象外（今回のスコープ外の扱い）
  if (applicableEvents.some((e) => e.replace_mode === "all")) return [];

  const partialEventIds = applicableEvents
    .filter((e) => e.replace_mode === "partial")
    .map((e) => e.id);
  const { data: replacedPeriodRows } =
    partialEventIds.length > 0
      ? await supabase
          .from("event_replaced_periods")
          .select("period_no")
          .in("event_id", partialEventIds)
      : { data: [] as { period_no: number }[] };
  const replacedPeriods = new Set((replacedPeriodRows ?? []).map((r) => r.period_no));

  const versionIds = (versions ?? []).map((v) => v.id);
  const { data: slots } =
    versionIds.length > 0
      ? await supabase
          .from("timetable_slots")
          .select("period_no")
          .in("timetable_version_id", versionIds)
          .eq("day_of_week", dayOfWeek)
      : { data: [] as { period_no: number }[] };

  return Array.from(new Set((slots ?? []).map((s) => s.period_no))).filter(
    (p) => !replacedPeriods.has(p),
  );
}

// ホーム画面など、多数のクラスを一覧表示する場面向け：指定クラス1件について、
// 指定日の出席入力が完了しているかどうかを判定する。
export async function isClassAttendanceComplete(
  supabase: Client,
  cls: { id: string; type: "homeroom" | "elective"; term_id: string },
  date: string,
): Promise<boolean> {
  const periods = await getRequiredPeriodNumbers(supabase, cls.id, cls.term_id, date);
  if (periods.length === 0) return false;

  const roster =
    cls.type === "homeroom"
      ? await getHomeroomRoster(supabase, cls.id, date)
      : await getElectiveRoster(supabase, cls.id, date);
  if (roster.length === 0) return false;
  const rosterStudentIds = roster.map((r) => r.student.id);

  // attendance_recordsは(student_id, date, period_no)が実質一意（同じ学生が
  // 同じ時限に複数クラスへ同時出席することはない設計のため）、class_idでは
  // 絞り込まない。選択科目に取られている時限の学生も、その選択科目側で
  // 記録されていれば「入力済み」とみなす（出席入力ページの選択科目重複表示と
  // 同じ考え方）。
  const { data: records } = await supabase
    .from("attendance_records")
    .select("student_id, period_no")
    .eq("date", date)
    .in("student_id", rosterStudentIds)
    .in("period_no", periods);

  const recordedByPeriod = new Map<number, Set<string>>();
  for (const r of records ?? []) {
    const set = recordedByPeriod.get(r.period_no) ?? new Set<string>();
    set.add(r.student_id);
    recordedByPeriod.set(r.period_no, set);
  }

  return computeCompletion(periods, rosterStudentIds, recordedByPeriod).dayComplete;
}
