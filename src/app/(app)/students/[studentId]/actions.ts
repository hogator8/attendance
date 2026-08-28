"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadStudentPhoto } from "@/lib/storage";
import { addDays } from "@/lib/date";
import type { StudentStatus } from "@/lib/supabase/database.types";

export async function updateStudentInfo(formData: FormData) {
  await requirePermission("can_manage_students");
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "");
  const studentNumber = String(formData.get("student_number") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const furigana = String(formData.get("furigana") ?? "").trim();
  const nationality = String(formData.get("nationality") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim();
  const enrollmentDate = String(formData.get("enrollment_date") ?? "");
  const expectedGraduationDate = String(
    formData.get("expected_graduation_date") ?? "",
  ).trim();
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
      nationality: nationality || null,
      gender: gender || null,
      date_of_birth: dateOfBirth || null,
      enrollment_date: enrollmentDate,
      expected_graduation_date: expectedGraduationDate || null,
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

// 学生を完全に削除する。出席記録(attendance_records/event_attendance)・
// 所属履歴(class_enrollments/elective_memberships)・過去データ
// (historical_monthly_summaries)は students への外部キーが on delete cascade
// のため連動して削除される。呼び出し側（学生一覧）で学籍番号の入力による
// 確認を必須にしている。
export async function deleteStudent(formData: FormData) {
  await requirePermission("can_manage_students");
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "");
  if (!studentId) throw new Error("学生IDが不正です。");

  const { error } = await supabase.from("students").delete().eq("id", studentId);
  if (error) throw new Error(error.message);

  revalidatePath("/students");
}

export async function updateStudentStatus(formData: FormData) {
  await requirePermission("can_manage_students");
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

// ホームルームへの新規配属・クラス異動。終了日（任意）を指定した場合、
// その日をvalid_toとしてセットした状態で配属する。
export async function assignHomeroom(formData: FormData) {
  await requirePermission("can_manage_students");
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "");
  const classId = String(formData.get("class_id") ?? "");
  const validFrom = String(formData.get("valid_from") ?? "");
  const validTo = String(formData.get("valid_to") ?? "").trim();
  const seqNoRaw = String(formData.get("seq_no") ?? "");
  const seqNo = seqNoRaw ? Number(seqNoRaw) : null;

  if (!studentId || !classId || !validFrom) {
    throw new Error("クラス・配属開始日を入力してください。");
  }
  if (validTo && validTo < validFrom) {
    throw new Error("配属終了日は開始日以降にしてください。");
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
      .update({ seq_no: seqNo, valid_to: validTo || null })
      .eq("id", current.id);
    if (error) throw new Error(error.message);
    revalidatePath(`/students/${studentId}`);
    revalidatePath("/students");
    return;
  }

  if (current) {
    if (current.valid_from >= validFrom) {
      throw new Error("異動日は現在の所属開始日より後にしてください。");
    }
    const closeDate = addDays(validFrom, -1);
    const { error } = await supabase
      .from("class_enrollments")
      .update({ valid_to: closeDate })
      .eq("id", current.id);
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase.from("class_enrollments").insert({
    student_id: studentId,
    class_id: classId,
    seq_no: seqNo,
    valid_from: validFrom,
    valid_to: validTo || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
}

// 現在のホームルーム配属を、割当解除（配属終了日をセット）する。
export async function endHomeroomEnrollment(formData: FormData) {
  await requirePermission("can_manage_students");
  const supabase = await createClient();

  const enrollmentId = String(formData.get("enrollment_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const validTo = String(formData.get("valid_to") ?? "");

  if (!enrollmentId || !validTo) {
    throw new Error("終了日を入力してください。");
  }

  const { data: enrollment } = await supabase
    .from("class_enrollments")
    .select("valid_from")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (enrollment && validTo < enrollment.valid_from) {
    throw new Error("配属解除日は配属開始日以降にしてください。");
  }

  const { error } = await supabase
    .from("class_enrollments")
    .update({ valid_to: validTo })
    .eq("id", enrollmentId);
  if (error) throw new Error(error.message);

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
}

export async function assignElective(formData: FormData) {
  await requirePermission("can_manage_students");
  const supabase = await createClient();

  const studentId = String(formData.get("student_id") ?? "");
  const classId = String(formData.get("class_id") ?? "");
  const validFrom = String(formData.get("valid_from") ?? "");
  const validTo = String(formData.get("valid_to") ?? "").trim();

  if (!studentId || !classId || !validFrom) {
    throw new Error("選択科目・開始日を入力してください。");
  }
  if (validTo && validTo < validFrom) {
    throw new Error("終了日は開始日以降にしてください。");
  }

  const { error } = await supabase.from("elective_memberships").insert({
    student_id: studentId,
    class_id: classId,
    valid_from: validFrom,
    valid_to: validTo || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/students/${studentId}`);
}

export async function endElective(formData: FormData) {
  await requirePermission("can_manage_students");
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
