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

export type DayClassStatus = "complete" | "incomplete" | "none";

interface MatrixClassInput {
  id: string;
  type: "homeroom" | "elective";
  term_id: string;
}

type MatrixRosterRow = {
  class_id: string;
  student_id: string;
  valid_from: string;
  valid_to: string | null;
  student: { status: string } | null;
};

// 出席入力ログページの月次一覧表向け：複数クラス×複数日をまとめて判定する。
// 日付×クラスの組み合わせごとに個別クエリを発行すると数百往復になり得るため、
// 関係する各テーブル（休業日・行事・行事対象クラス・行事置換時限・時間割・
// 在籍/履修・出席記録）を対象期間・対象クラス全体でそれぞれ1回だけ取得し、
// 日付×クラスごとの判定はメモリ上で行う。判定ロジック自体は
// getRequiredPeriodNumbers / isClassAttendanceComplete と同じ考え方を
// バッチ処理向けに書き直したもので、最終判定は computeCompletion をそのまま
// 呼び出す（新規のcomplete判定ロジックは実装しない）。
export async function getMonthlyCompletionMatrix(
  supabase: Client,
  classes: MatrixClassInput[],
  dates: string[],
): Promise<Map<string, Map<string, DayClassStatus>>> {
  const result = new Map<string, Map<string, DayClassStatus>>();
  for (const date of dates) result.set(date, new Map<string, DayClassStatus>());
  if (dates.length === 0 || classes.length === 0) return result;

  const dateFrom = dates[0];
  const dateTo = dates[dates.length - 1];
  const classIds = classes.map((c) => c.id);
  const termIds = Array.from(new Set(classes.map((c) => c.term_id)));
  const homeroomClassIds = classes.filter((c) => c.type === "homeroom").map((c) => c.id);
  const electiveClassIds = classes.filter((c) => c.type === "elective").map((c) => c.id);

  const [
    { data: holidays },
    { data: candidateEvents },
    { data: versions },
    { data: enrollmentRows },
    { data: membershipRows },
  ] = await Promise.all([
    supabase
      .from("holidays")
      .select("term_id, date")
      .in("term_id", termIds)
      .gte("date", dateFrom)
      .lte("date", dateTo),
    supabase
      .from("events")
      .select("id, term_id, replace_mode, date_from, date_to")
      .in("term_id", termIds)
      .lte("date_from", dateTo)
      .gte("date_to", dateFrom),
    supabase
      .from("timetable_versions")
      .select("id, class_id, effective_from, effective_to")
      .in("class_id", classIds)
      .lte("effective_from", dateTo)
      .or(`effective_to.is.null,effective_to.gte.${dateFrom}`),
    homeroomClassIds.length > 0
      ? supabase
          .from("class_enrollments")
          .select("class_id, student_id, valid_from, valid_to, student:students(status)")
          .in("class_id", homeroomClassIds)
          .lte("valid_from", dateTo)
          .or(`valid_to.is.null,valid_to.gte.${dateFrom}`)
      : { data: [] as MatrixRosterRow[] },
    electiveClassIds.length > 0
      ? supabase
          .from("elective_memberships")
          .select("class_id, student_id, valid_from, valid_to, student:students(status)")
          .in("class_id", electiveClassIds)
          .lte("valid_from", dateTo)
          .or(`valid_to.is.null,valid_to.gte.${dateFrom}`)
      : { data: [] as MatrixRosterRow[] },
  ]);

  const holidaySet = new Set((holidays ?? []).map((h) => `${h.term_id}_${h.date}`));

  const events = candidateEvents ?? [];
  const candidateEventIds = events.map((e) => e.id);
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

  const partialEventIds = events
    .filter((e) => e.replace_mode === "partial")
    .map((e) => e.id);
  const { data: replacedPeriodRows } =
    partialEventIds.length > 0
      ? await supabase
          .from("event_replaced_periods")
          .select("event_id, period_no")
          .in("event_id", partialEventIds)
      : { data: [] as { event_id: string; period_no: number }[] };
  const replacedPeriodsByEvent = new Map<string, Set<number>>();
  for (const r of replacedPeriodRows ?? []) {
    const set = replacedPeriodsByEvent.get(r.event_id) ?? new Set<number>();
    set.add(r.period_no);
    replacedPeriodsByEvent.set(r.event_id, set);
  }

  const versionsByClass = new Map<
    string,
    { id: string; effective_from: string; effective_to: string | null }[]
  >();
  for (const v of versions ?? []) {
    const arr = versionsByClass.get(v.class_id) ?? [];
    arr.push(v);
    versionsByClass.set(v.class_id, arr);
  }
  const versionIds = (versions ?? []).map((v) => v.id);
  const { data: slots } =
    versionIds.length > 0
      ? await supabase
          .from("timetable_slots")
          .select("timetable_version_id, day_of_week, period_no")
          .in("timetable_version_id", versionIds)
      : { data: [] as { timetable_version_id: string; day_of_week: number; period_no: number }[] };
  const slotsByVersion = new Map<string, { day_of_week: number; period_no: number }[]>();
  for (const s of slots ?? []) {
    const arr = slotsByVersion.get(s.timetable_version_id) ?? [];
    arr.push(s);
    slotsByVersion.set(s.timetable_version_id, arr);
  }

  function studentActive(row: MatrixRosterRow): boolean {
    return row.student !== null && row.student.status !== "withdrawn";
  }
  const rosterRowsByClass = new Map<string, MatrixRosterRow[]>();
  const allRosterRows = [
    ...((enrollmentRows ?? []) as MatrixRosterRow[]),
    ...((membershipRows ?? []) as MatrixRosterRow[]),
  ];
  for (const row of allRosterRows) {
    const arr = rosterRowsByClass.get(row.class_id) ?? [];
    arr.push(row);
    rosterRowsByClass.set(row.class_id, arr);
  }

  const allStudentIds = Array.from(new Set(allRosterRows.map((r) => r.student_id)));
  const { data: records } =
    allStudentIds.length > 0
      ? await supabase
          .from("attendance_records")
          .select("student_id, date, period_no")
          .in("student_id", allStudentIds)
          .gte("date", dateFrom)
          .lte("date", dateTo)
      : { data: [] as { student_id: string; date: string; period_no: number }[] };
  const recordedByDatePeriod = new Map<string, Set<string>>();
  for (const r of records ?? []) {
    const key = `${r.date}_${r.period_no}`;
    const set = recordedByDatePeriod.get(key) ?? new Set<string>();
    set.add(r.student_id);
    recordedByDatePeriod.set(key, set);
  }

  for (const date of dates) {
    const dayOfWeek = dayOfWeekOf(date);
    const dateResult = result.get(date)!;
    for (const cls of classes) {
      let periodNos: number[] = [];

      if (!holidaySet.has(`${cls.term_id}_${date}`)) {
        const applicableEvents = events.filter((e) => {
          if (e.term_id !== cls.term_id) return false;
          if (date < e.date_from || date > e.date_to) return false;
          const targets = classIdsByEvent.get(e.id);
          return !targets || targets.length === 0 || targets.includes(cls.id);
        });

        if (!applicableEvents.some((e) => e.replace_mode === "all")) {
          const replacedPeriods = new Set<number>();
          for (const e of applicableEvents) {
            if (e.replace_mode !== "partial") continue;
            for (const p of replacedPeriodsByEvent.get(e.id) ?? []) replacedPeriods.add(p);
          }

          const activeVersion = (versionsByClass.get(cls.id) ?? []).find(
            (v) => v.effective_from <= date && (v.effective_to === null || v.effective_to >= date),
          );
          periodNos = activeVersion
            ? Array.from(
                new Set(
                  (slotsByVersion.get(activeVersion.id) ?? [])
                    .filter((s) => s.day_of_week === dayOfWeek)
                    .map((s) => s.period_no),
                ),
              ).filter((p) => !replacedPeriods.has(p))
            : [];
        }
      }

      const rosterStudentIds =
        periodNos.length === 0
          ? []
          : (rosterRowsByClass.get(cls.id) ?? [])
              .filter(
                (row) =>
                  row.valid_from <= date &&
                  (row.valid_to === null || row.valid_to >= date) &&
                  studentActive(row),
              )
              .map((row) => row.student_id);

      const recordedByPeriod = new Map<number, Set<string>>();
      for (const p of periodNos) {
        recordedByPeriod.set(p, recordedByDatePeriod.get(`${date}_${p}`) ?? new Set<string>());
      }

      dateResult.set(cls.id, computeDayClassStatus(periodNos, rosterStudentIds, recordedByPeriod));
    }
  }

  return result;
}

// getMonthlyCompletionMatrix のセル1件分の状態決定ロジック（純粋関数として
// 切り出すことで、Supabaseクライアントをモックせずにユニットテストできるように
// している）。判定自体はcomputeCompletionをそのまま使う。
export function computeDayClassStatus(
  periodNos: number[],
  rosterStudentIds: string[],
  recordedByPeriod: Map<number, Set<string>>,
): DayClassStatus {
  if (periodNos.length === 0 || rosterStudentIds.length === 0) return "none";
  const { dayComplete } = computeCompletion(periodNos, rosterStudentIds, recordedByPeriod);
  return dayComplete ? "complete" : "incomplete";
}
