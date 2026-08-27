import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

interface Range {
  dayOfWeek: number;
  periodNo: number;
  from: string;
  to: string | null; // null = 無期限
}

function overlaps(a: Range, b: Range): boolean {
  if (a.dayOfWeek !== b.dayOfWeek || a.periodNo !== b.periodNo) return false;
  const aTo = a.to ?? "9999-12-31";
  const bTo = b.to ?? "9999-12-31";
  return a.from <= bTo && b.from <= aTo;
}

// 学期内の全クラスの時間割を見直し、ホームルームの各コマについて
// 「同じ曜日・時限に有効期間が重なる選択科目のコマが存在するか」を再計算し、
// timetable_slots.is_elective_slot を更新する。
// 時間割（ホームルーム・選択科目どちらか）を保存した直後に毎回呼び出す想定。
export async function syncElectiveSlotFlags(supabase: Client, termId: string) {
  const { data: classes, error: classErr } = await supabase
    .from("classes")
    .select("id, type")
    .eq("term_id", termId);
  if (classErr) throw classErr;
  if (!classes || classes.length === 0) return;

  const classTypeById = new Map(classes.map((c) => [c.id, c.type]));
  const classIds = classes.map((c) => c.id);

  const { data: versions, error: verErr } = await supabase
    .from("timetable_versions")
    .select("id, class_id, effective_from, effective_to")
    .in("class_id", classIds);
  if (verErr) throw verErr;
  if (!versions || versions.length === 0) return;

  const versionInfoById = new Map(versions.map((v) => [v.id, v]));
  const versionIds = versions.map((v) => v.id);

  const { data: slots, error: slotErr } = await supabase
    .from("timetable_slots")
    .select("id, timetable_version_id, day_of_week, period_no, is_elective_slot")
    .in("timetable_version_id", versionIds);
  if (slotErr) throw slotErr;
  if (!slots) return;

  const electiveRanges: Range[] = [];
  for (const slot of slots) {
    const version = versionInfoById.get(slot.timetable_version_id);
    if (!version) continue;
    if (classTypeById.get(version.class_id) !== "elective") continue;
    electiveRanges.push({
      dayOfWeek: slot.day_of_week,
      periodNo: slot.period_no,
      from: version.effective_from,
      to: version.effective_to,
    });
  }

  const updates: { id: string; is_elective_slot: boolean }[] = [];
  for (const slot of slots) {
    const version = versionInfoById.get(slot.timetable_version_id);
    if (!version) continue;
    if (classTypeById.get(version.class_id) !== "homeroom") continue;

    const homeroomRange: Range = {
      dayOfWeek: slot.day_of_week,
      periodNo: slot.period_no,
      from: version.effective_from,
      to: version.effective_to,
    };
    const shouldBeElective = electiveRanges.some((r) =>
      overlaps(r, homeroomRange),
    );
    if (shouldBeElective !== slot.is_elective_slot) {
      updates.push({ id: slot.id, is_elective_slot: shouldBeElective });
    }
  }

  for (const update of updates) {
    await supabase
      .from("timetable_slots")
      .update({ is_elective_slot: update.is_elective_slot })
      .eq("id", update.id);
  }
}
