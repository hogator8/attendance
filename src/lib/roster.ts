import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type Student = Database["public"]["Tables"]["students"]["Row"];

export interface RosterEntry {
  student: Student;
  seqNo: number | null;
}

// 出席番号（seq_no）が設定されている学生を出席番号順で先に、seq_noがnullの
// 学生を学籍番号順でその後ろに並べる。ホームルーム・選択科目で共通の並び順
// ロジック。seq_noを0や無限大に置き換えて単純にソートすると、null=0扱いに
// なる場合に本来後方に来るべき学生が先頭に来てしまうため、明示的に2グループ
// に分けてそれぞれ別の基準でソートする。
export function sortRosterEntries(entries: RosterEntry[]): RosterEntry[] {
  const withSeqNo = entries
    .filter((e) => e.seqNo !== null)
    .sort((a, b) => a.seqNo! - b.seqNo!);
  const withoutSeqNo = entries
    .filter((e) => e.seqNo === null)
    .sort((a, b) => a.student.student_number.localeCompare(b.student.student_number));
  return [...withSeqNo, ...withoutSeqNo];
}

// 指定日時点で class_id（ホームルーム）に所属している学生一覧を返す。
// includeWithdrawn=false の場合、status='withdrawn' の学生はデフォルトで除外する。
export async function getHomeroomRoster(
  supabase: Client,
  classId: string,
  date: string,
  { includeWithdrawn = false }: { includeWithdrawn?: boolean } = {},
): Promise<RosterEntry[]> {
  const { data, error } = await supabase
    .from("class_enrollments")
    .select("seq_no, valid_from, valid_to, student:students(*)")
    .eq("class_id", classId)
    .lte("valid_from", date)
    .or(`valid_to.is.null,valid_to.gte.${date}`);

  if (error) throw error;

  const entries = (data ?? [])
    .filter((row) => row.student)
    .filter(
      (row) => includeWithdrawn || row.student!.status !== "withdrawn",
    )
    .map((row) => ({ student: row.student as Student, seqNo: row.seq_no }));
  return sortRosterEntries(entries);
}

// 指定日時点で選択科目 class_id に所属している学生一覧を返す。
export async function getElectiveRoster(
  supabase: Client,
  classId: string,
  date: string,
  { includeWithdrawn = false }: { includeWithdrawn?: boolean } = {},
): Promise<RosterEntry[]> {
  const { data, error } = await supabase
    .from("elective_memberships")
    .select("seq_no, valid_from, valid_to, student:students(*)")
    .eq("class_id", classId)
    .lte("valid_from", date)
    .or(`valid_to.is.null,valid_to.gte.${date}`);

  if (error) throw error;

  const entries = (data ?? [])
    .filter((row) => row.student)
    .filter(
      (row) => includeWithdrawn || row.student!.status !== "withdrawn",
    )
    .map((row) => ({ student: row.student as Student, seqNo: row.seq_no }));
  return sortRosterEntries(entries);
}

export interface ElectiveOverlapInfo {
  classId: string;
  className: string;
}

// 指定日・曜日の、複数の時限それぞれについて「選択科目」として実施される
// コマがあるかを調べ、その時間に選択科目へ参加する学生
// （periodNo -> studentId -> 選択科目情報）をまとめて返す。
// ホームルームの出席入力画面で、is_elective_slot=true のコマの表示に使う。
//
// 時限ごとに個別のクエリを発行すると、対象時限の数だけ往復（各4クエリ）が
// 発生してしまうため、時限に依存しない部分（選択科目クラス一覧・時間割
// バージョン）は1回だけ取得し、時限に依存する部分（該当時限のコマ・
// 履修者）も対象時限をまとめて1回のクエリで取得する。
export async function getElectiveOverlapForSlots(
  supabase: Client,
  date: string,
  dayOfWeek: number,
  periodNos: number[],
): Promise<Map<number, Map<string, ElectiveOverlapInfo>>> {
  const result = new Map<number, Map<string, ElectiveOverlapInfo>>();
  for (const periodNo of periodNos) result.set(periodNo, new Map());
  if (periodNos.length === 0) return result;

  const { data: electiveClasses, error: classErr } = await supabase
    .from("classes")
    .select("id, name")
    .eq("type", "elective");
  if (classErr) throw classErr;
  if (!electiveClasses || electiveClasses.length === 0) return result;

  const classIds = electiveClasses.map((c) => c.id);
  const classNameById = new Map(electiveClasses.map((c) => [c.id, c.name]));

  const { data: versions, error: verErr } = await supabase
    .from("timetable_versions")
    .select("id, class_id")
    .in("class_id", classIds)
    .lte("effective_from", date)
    .or(`effective_to.is.null,effective_to.gte.${date}`);
  if (verErr) throw verErr;
  if (!versions || versions.length === 0) return result;

  const versionIds = versions.map((v) => v.id);
  const versionToClass = new Map(versions.map((v) => [v.id, v.class_id]));

  const { data: slots, error: slotErr } = await supabase
    .from("timetable_slots")
    .select("timetable_version_id, period_no")
    .in("timetable_version_id", versionIds)
    .eq("day_of_week", dayOfWeek)
    .in("period_no", periodNos);
  if (slotErr) throw slotErr;
  if (!slots || slots.length === 0) return result;

  // 時限ごとの対象クラスID一覧
  const matchingClassIdsByPeriod = new Map<number, Set<string>>();
  const allMatchingClassIds = new Set<string>();
  for (const s of slots) {
    const classId = versionToClass.get(s.timetable_version_id);
    if (!classId) continue;
    allMatchingClassIds.add(classId);
    const set = matchingClassIdsByPeriod.get(s.period_no) ?? new Set<string>();
    set.add(classId);
    matchingClassIdsByPeriod.set(s.period_no, set);
  }
  if (allMatchingClassIds.size === 0) return result;

  const { data: memberships, error: memErr } = await supabase
    .from("elective_memberships")
    .select("student_id, class_id")
    .in("class_id", Array.from(allMatchingClassIds))
    .lte("valid_from", date)
    .or(`valid_to.is.null,valid_to.gte.${date}`);
  if (memErr) throw memErr;

  for (const [periodNo, classIdsForPeriod] of matchingClassIdsByPeriod) {
    const map = result.get(periodNo)!;
    for (const m of memberships ?? []) {
      if (!classIdsForPeriod.has(m.class_id)) continue;
      map.set(m.student_id, {
        classId: m.class_id,
        className: classNameById.get(m.class_id) ?? "選択科目",
      });
    }
  }
  return result;
}
