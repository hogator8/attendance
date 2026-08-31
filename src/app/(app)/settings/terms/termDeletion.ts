import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

async function countIf<T extends { count: number | null }>(
  condition: boolean,
  query: () => PromiseLike<T>,
): Promise<number> {
  if (!condition) return 0;
  const { count } = await query();
  return count ?? 0;
}

// 学期削除の可否判定。terms.idを直接参照するテーブル（classes/events/holidays）
// に加え、classes.id/events.id経由でのみ存在しうるテーブル
// （class_enrollments/elective_memberships/attendance_records/
// schedule_change_overrides/timetable_versions/timetable_slots/
// event_attendance/attendance_input_logs）についても、間接的な保証に頼らず
// すべて直接クエリで件数を確認する。attendance_input_logsのclass_idは
// on delete restrictのため、ログが残っている学期のクラスを含む学期削除は
// そのままではFK違反になる（放置すると原因不明のエラーになるため、他の
// テーブルと同様に事前チェックの対象に含める）。historical_monthly_summaries
// はstudent_id・year_monthのみで構成され、terms.id等への外部キーを一切
// 持たないため対象外（学期をまたいで独立して保持される過去データのため）。
//
// symbols・conversion_rules・color_rules・term_settings（学期ごとの設定値）は
// 「実データ」とはみなさず、判定対象に含めない。削除許可時はterms行の
// ON DELETE CASCADEでまとめて削除される。
export async function termHasBlockingData(supabase: Client, termId: string): Promise<boolean> {
  const [{ data: classRows }, { data: eventRows }, { count: holidayCount }] = await Promise.all([
    supabase.from("classes").select("id").eq("term_id", termId),
    supabase.from("events").select("id").eq("term_id", termId),
    supabase.from("holidays").select("id", { count: "exact", head: true }).eq("term_id", termId),
  ]);
  const classIds = (classRows ?? []).map((c) => c.id);
  const eventIds = (eventRows ?? []).map((e) => e.id);
  const hasClasses = classIds.length > 0;
  const hasEvents = eventIds.length > 0;

  const { data: timetableVersionRows } = hasClasses
    ? await supabase.from("timetable_versions").select("id").in("class_id", classIds)
    : { data: [] };
  const timetableVersionIds = (timetableVersionRows ?? []).map((v) => v.id);
  const hasTimetableVersions = timetableVersionIds.length > 0;

  const [
    enrollmentCount,
    membershipCount,
    attendanceCount,
    overrideCount,
    slotCount,
    eventAttendanceCount,
    inputLogCount,
  ] = await Promise.all([
    countIf(hasClasses, () =>
      supabase
        .from("class_enrollments")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds),
    ),
    countIf(hasClasses, () =>
      supabase
        .from("elective_memberships")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds),
    ),
    countIf(hasClasses, () =>
      supabase
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds),
    ),
    countIf(hasClasses, () =>
      supabase
        .from("schedule_change_overrides")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds),
    ),
    countIf(hasTimetableVersions, () =>
      supabase
        .from("timetable_slots")
        .select("id", { count: "exact", head: true })
        .in("timetable_version_id", timetableVersionIds),
    ),
    countIf(hasEvents, () =>
      supabase
        .from("event_attendance")
        .select("id", { count: "exact", head: true })
        .in("event_id", eventIds),
    ),
    countIf(hasClasses, () =>
      supabase
        .from("attendance_input_logs")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds),
    ),
  ]);

  return (
    hasClasses ||
    hasEvents ||
    (holidayCount ?? 0) > 0 ||
    enrollmentCount > 0 ||
    membershipCount > 0 ||
    attendanceCount > 0 ||
    overrideCount > 0 ||
    hasTimetableVersions ||
    slotCount > 0 ||
    eventAttendanceCount > 0 ||
    inputLogCount > 0
  );
}

// 学期一覧ページのUI表示用に、複数学期分をまとめて判定する。
export async function getBlockedTermIds(
  supabase: Client,
  termIds: string[],
): Promise<Set<string>> {
  const results = await Promise.all(
    termIds.map(async (id) => [id, await termHasBlockingData(supabase, id)] as const),
  );
  return new Set(results.filter(([, blocked]) => blocked).map(([id]) => id));
}
