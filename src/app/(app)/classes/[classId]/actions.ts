"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncElectiveSlotFlags } from "@/lib/timetable";
import { addDays } from "@/lib/date";

const MAX_PERIODS = 10;
const DAYS = [1, 2, 3, 4, 5, 6, 0]; // 月火水木金土日（表示順）。値はJSのgetDay()と同じ0=日〜6=土

export async function updateClassName(formData: FormData) {
  await requirePermission("can_manage_classes");
  const supabase = await createClient();
  const classId = String(formData.get("class_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!classId || !name) throw new Error("名称を入力してください。");

  const { error } = await supabase
    .from("classes")
    .update({ name })
    .eq("id", classId);
  if (error) throw new Error(error.message);

  revalidatePath(`/classes/${classId}`);
  revalidatePath("/classes");
}

export async function createTimetableVersion(formData: FormData) {
  await requirePermission("can_manage_classes");
  const supabase = await createClient();
  const classId = String(formData.get("class_id") ?? "");
  const effectiveFrom = String(formData.get("effective_from") ?? "");
  if (!classId || !effectiveFrom) {
    throw new Error("適用開始日を入力してください。");
  }

  // 既存の「無期限（effective_toがNULL）」バージョンがあれば、新バージョンの前日で区切る
  const { data: openVersions } = await supabase
    .from("timetable_versions")
    .select("id, effective_from")
    .eq("class_id", classId)
    .is("effective_to", null);

  for (const v of openVersions ?? []) {
    if (v.effective_from >= effectiveFrom) {
      throw new Error(
        "既存の時間割バージョンより後の日付を指定してください。",
      );
    }
    const effectiveTo = addDays(effectiveFrom, -1);
    await supabase
      .from("timetable_versions")
      .update({ effective_to: effectiveTo })
      .eq("id", v.id);
  }

  const { data, error } = await supabase
    .from("timetable_versions")
    .insert({ class_id: classId, effective_from: effectiveFrom })
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/classes/${classId}`);
  redirect(`/classes/${classId}?edit=${data.id}`);
}

export async function saveTimetableSlots(formData: FormData) {
  await requirePermission("can_manage_classes");
  const supabase = await createClient();

  const classId = String(formData.get("class_id") ?? "");
  const termId = String(formData.get("term_id") ?? "");
  const versionId = String(formData.get("timetable_version_id") ?? "");
  if (!classId || !termId || !versionId) {
    throw new Error("時間割バージョンが不正です。");
  }

  const rows: {
    timetable_version_id: string;
    day_of_week: number;
    period_no: number;
    period_label: string;
    subject: string;
    teacher_name: string | null;
  }[] = [];

  for (let p = 1; p <= MAX_PERIODS; p++) {
    const periodLabelRaw = String(formData.get(`period_label_${p}`) ?? "").trim();
    const periodLabel = periodLabelRaw || `${p}限`;

    for (const d of DAYS) {
      const subject = String(formData.get(`subject_${d}_${p}`) ?? "").trim();
      if (!subject) continue;
      const teacher = String(formData.get(`teacher_${d}_${p}`) ?? "").trim();
      rows.push({
        timetable_version_id: versionId,
        day_of_week: d,
        period_no: p,
        period_label: periodLabel,
        subject,
        teacher_name: teacher || null,
      });
    }
  }

  const { error: deleteError } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("timetable_version_id", versionId);
  if (deleteError) throw new Error(deleteError.message);

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("timetable_slots")
      .insert(rows);
    if (insertError) throw new Error(insertError.message);
  }

  await syncElectiveSlotFlags(supabase, termId);

  revalidatePath(`/classes/${classId}`);
}

// 単発の時間割変更（振替授業等）：特定クラス・日付・時限の科目・担当者名を
// 一時的に上書きする。通常の時間割（timetable_slots）自体は変更しない。
export async function createScheduleOverride(formData: FormData) {
  await requirePermission("can_manage_classes");
  const supabase = await createClient();

  const classId = String(formData.get("class_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const periodNo = Number(formData.get("period_no") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const teacherName = String(formData.get("teacher_name") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!classId || !date || !periodNo || periodNo <= 0) {
    throw new Error("日付・時限を入力してください。");
  }

  const { error } = await supabase.from("schedule_change_overrides").upsert(
    {
      class_id: classId,
      date,
      period_no: periodNo,
      subject: subject || null,
      teacher_name: teacherName || null,
      note: note || null,
    },
    { onConflict: "class_id,date,period_no" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/classes/${classId}`);
}

export async function deleteScheduleOverride(formData: FormData) {
  await requirePermission("can_manage_classes");
  const supabase = await createClient();

  const overrideId = String(formData.get("override_id") ?? "");
  const classId = String(formData.get("class_id") ?? "");
  if (!overrideId) throw new Error("対象の変更が不正です。");

  const { error } = await supabase
    .from("schedule_change_overrides")
    .delete()
    .eq("id", overrideId);
  if (error) throw new Error(error.message);

  revalidatePath(`/classes/${classId}`);
}
