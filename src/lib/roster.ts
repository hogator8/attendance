import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
type Student = Database["public"]["Tables"]["students"]["Row"];

export interface RosterEntry {
  student: Student;
  seqNo: number | null;
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

  return (data ?? [])
    .filter((row) => row.student)
    .filter(
      (row) => includeWithdrawn || row.student!.status !== "withdrawn",
    )
    .map((row) => ({ student: row.student as Student, seqNo: row.seq_no }))
    .sort((a, b) => (a.seqNo ?? 0) - (b.seqNo ?? 0));
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
    .select("valid_from, valid_to, student:students(*)")
    .eq("class_id", classId)
    .lte("valid_from", date)
    .or(`valid_to.is.null,valid_to.gte.${date}`);

  if (error) throw error;

  return (data ?? [])
    .filter((row) => row.student)
    .filter(
      (row) => includeWithdrawn || row.student!.status !== "withdrawn",
    )
    .map((row) => ({ student: row.student as Student, seqNo: null }))
    .sort((a, b) => a.student.name.localeCompare(b.student.name, "ja"));
}

export interface ElectiveOverlapInfo {
  classId: string;
  className: string;
}

// 指定日・曜日・時限に「選択科目」として実施されるコマがあるかを調べ、
// その時間に選択科目へ参加する学生（studentId -> 選択科目情報）を返す。
// ホームルームの出席入力画面で、is_elective_slot=true のコマの表示に使う。
export async function getElectiveOverlapForSlot(
  supabase: Client,
  date: string,
  dayOfWeek: number,
  periodNo: number,
): Promise<Map<string, ElectiveOverlapInfo>> {
  const { data: electiveClasses, error: classErr } = await supabase
    .from("classes")
    .select("id, name")
    .eq("type", "elective");
  if (classErr) throw classErr;
  if (!electiveClasses || electiveClasses.length === 0) return new Map();

  const classIds = electiveClasses.map((c) => c.id);
  const classNameById = new Map(electiveClasses.map((c) => [c.id, c.name]));

  const { data: versions, error: verErr } = await supabase
    .from("timetable_versions")
    .select("id, class_id")
    .in("class_id", classIds)
    .lte("effective_from", date)
    .or(`effective_to.is.null,effective_to.gte.${date}`);
  if (verErr) throw verErr;
  if (!versions || versions.length === 0) return new Map();

  const versionIds = versions.map((v) => v.id);
  const versionToClass = new Map(versions.map((v) => [v.id, v.class_id]));

  const { data: slots, error: slotErr } = await supabase
    .from("timetable_slots")
    .select("timetable_version_id")
    .in("timetable_version_id", versionIds)
    .eq("day_of_week", dayOfWeek)
    .eq("period_no", periodNo);
  if (slotErr) throw slotErr;
  if (!slots || slots.length === 0) return new Map();

  const matchingClassIds = Array.from(
    new Set(
      slots.map((s) => versionToClass.get(s.timetable_version_id)!).filter(Boolean),
    ),
  );
  if (matchingClassIds.length === 0) return new Map();

  const { data: memberships, error: memErr } = await supabase
    .from("elective_memberships")
    .select("student_id, class_id")
    .in("class_id", matchingClassIds)
    .lte("valid_from", date)
    .or(`valid_to.is.null,valid_to.gte.${date}`);
  if (memErr) throw memErr;

  const result = new Map<string, ElectiveOverlapInfo>();
  for (const m of memberships ?? []) {
    result.set(m.student_id, {
      classId: m.class_id,
      className: classNameById.get(m.class_id) ?? "選択科目",
    });
  }
  return result;
}
