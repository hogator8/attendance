"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadStudentPhoto } from "@/lib/storage";
import type { StudentStatus } from "@/lib/supabase/database.types";

export async function updateStudentInfo(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "");
  const studentNumber = String(formData.get("student_number") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const furigana = String(formData.get("furigana") ?? "").trim();
  const enrollmentDate = String(formData.get("enrollment_date") ?? "");
  const photo = formData.get("photo");

  if (!studentId || !studentNumber || !name || !furigana || !enrollmentDate) {
    throw new Error("必須項目を入力してください。");
  }

  const { error } = await supabase
    .from("students")
    .update({
      student_number: studentNumber,
      name,
      furigana,
      enrollment_date: enrollmentDate,
    })
    .eq("id", studentId);
  if (error) throw new Error(error.message);

  if (photo instanceof File && photo.size > 0) {
    const photoUrl = await uploadStudentPhoto(supabase, studentId, photo);
    await supabase
      .from("students")
      .update({ photo_url: photoUrl })
      .eq("id", studentId);
  }

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
}

export async function updateStudentStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "");
  const status = String(formData.get("status") ?? "") as StudentStatus;
  const statusDate = String(formData.get("status_date") ?? "");
  const statusNote = String(formData.get("status_note") ?? "").trim();

  if (!["enrolled", "graduated", "withdrawn"].includes(status)) {
    throw new Error("状態の指定が不正です。");
  }
  if (status !== "enrolled" && !statusDate) {
    throw new Error("卒業日または退学日を入力してください。");
  }

  const { error } = await supabase
    .from("students")
    .update({
      status,
      status_date: status === "enrolled" ? null : statusDate,
      status_note: status === "enrolled" ? null : statusNote || null,
    })
    .eq("id", studentId);
  if (error) throw new Error(error.message);

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
}

// ホームルームへの新規配属・クラス異動。
// 既存の在籍中エンロールメントがあれば有効期間を閉じてから新しい行を追加する。
export async function assignHomeroom(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "");
  const classId = String(formData.get("class_id") ?? "");
  const validFrom = String(formData.get("valid_from") ?? "");
  const seqNoRaw = String(formData.get("seq_no") ?? "");
  const seqNo = seqNoRaw ? Number(seqNoRaw) : null;

  if (!studentId || !classId || !validFrom) {
    throw new Error("クラス・配属開始日を入力してください。");
  }

  const { data: current } = await supabase
    .from("class_enrollments")
    .select("*")
    .eq("student_id", studentId)
    .is("valid_to", null)
    .maybeSingle();

  if (current && current.class_id === classId) {
    const { error } = await supabase
      .from("class_enrollments")
      .update({ seq_no: seqNo })
      .eq("id", current.id);
    if (error) throw new Error(error.message);
    revalidatePath(`/students/${studentId}`);
    return;
  }

  if (current) {
    if (current.valid_from >= validFrom) {
      throw new Error("異動日は現在の所属開始日より後にしてください。");
    }
    const prevDay = new Date(`${validFrom}T00:00:00+09:00`);
    prevDay.setDate(prevDay.getDate() - 1);
    const validTo = prevDay.toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });
    const { error } = await supabase
      .from("class_enrollments")
      .update({ valid_to: validTo })
      .eq("id", current.id);
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase.from("class_enrollments").insert({
    student_id: studentId,
    class_id: classId,
    seq_no: seqNo,
    valid_from: validFrom,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/students/${studentId}`);
}

export async function assignElective(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "");
  const classId = String(formData.get("class_id") ?? "");
  const validFrom = String(formData.get("valid_from") ?? "");

  if (!studentId || !classId || !validFrom) {
    throw new Error("選択科目・開始日を入力してください。");
  }

  const { error } = await supabase.from("elective_memberships").insert({
    student_id: studentId,
    class_id: classId,
    valid_from: validFrom,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/students/${studentId}`);
}

export async function endElective(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const membershipId = String(formData.get("membership_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const validTo = String(formData.get("valid_to") ?? "");

  if (!membershipId || !validTo) {
    throw new Error("終了日を入力してください。");
  }

  const { error } = await supabase
    .from("elective_memberships")
    .update({ valid_to: validTo })
    .eq("id", membershipId);
  if (error) throw new Error(error.message);

  revalidatePath(`/students/${studentId}`);
}
