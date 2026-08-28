"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadStudentPhoto } from "@/lib/storage";
import { getActiveTerms } from "@/lib/terms";

export async function createStudent(formData: FormData) {
  await requirePermission("can_manage_students");
  const supabase = await createClient();

  const studentNumber = String(formData.get("student_number") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const furigana = String(formData.get("furigana") ?? "").trim();
  const nationality = String(formData.get("nationality") ?? "").trim();
  const enrollmentDate = String(formData.get("enrollment_date") ?? "");
  const photo = formData.get("photo");

  if (!studentNumber || !name || !furigana || !enrollmentDate) {
    throw new Error("学籍番号・氏名・フリガナ・入学日は必須です。");
  }

  const { data: student, error } = await supabase
    .from("students")
    .insert({
      student_number: studentNumber,
      name,
      furigana,
      nationality: nationality || null,
      enrollment_date: enrollmentDate,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (photo instanceof File && photo.size > 0) {
    const photoUrl = await uploadStudentPhoto(supabase, student.id, photo);
    await supabase
      .from("students")
      .update({ photo_url: photoUrl })
      .eq("id", student.id);
  }

  redirect(`/students/${student.id}`);
}

// CSV一括登録：1行につき「学籍番号,氏名,フリガナ,国籍,入学日,クラス名」の形式。
// 国籍・クラス名は任意。クラス名が指定されている場合、アクティブな学期の
// 同名ホームルームクラスへ入学日を配属開始日として自動配属する。
export async function importStudentsCsv(formData: FormData) {
  await requirePermission("can_manage_students");
  const supabase = await createClient();

  const csv = String(formData.get("csv") ?? "");
  if (!csv.trim()) throw new Error("CSVを入力してください。");

  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  type Row = {
    studentNumber: string;
    name: string;
    furigana: string;
    nationality: string | null;
    enrollmentDate: string;
    className: string | null;
  };
  const rows: Row[] = lines.map((line) => {
    const cols = line.split(",").map((s) => s.trim());
    const [studentNumber, name, furigana, nationality, enrollmentDate, className] = cols;
    return {
      studentNumber: studentNumber ?? "",
      name: name ?? "",
      furigana: furigana ?? "",
      nationality: nationality || null,
      enrollmentDate: enrollmentDate ?? "",
      className: className || null,
    };
  });

  const invalid = rows.find(
    (r) =>
      !r.studentNumber ||
      !r.name ||
      !r.furigana ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.enrollmentDate),
  );
  if (invalid) {
    throw new Error(
      "CSVの形式が不正です。各行「学籍番号,氏名,フリガナ,国籍(任意),YYYY-MM-DD,クラス名(任意)」で入力してください。",
    );
  }

  const activeTerms = await getActiveTerms(supabase);
  const activeTermIds = activeTerms.map((t) => t.id);
  const { data: homeroomClasses } =
    activeTermIds.length > 0
      ? await supabase
          .from("classes")
          .select("id, name")
          .in("term_id", activeTermIds)
          .eq("type", "homeroom")
      : { data: [] };
  const classIdByName = new Map(
    (homeroomClasses ?? []).map((c) => [c.name, c.id]),
  );

  const { data: inserted, error } = await supabase
    .from("students")
    .insert(
      rows.map((r) => ({
        student_number: r.studentNumber,
        name: r.name,
        furigana: r.furigana,
        nationality: r.nationality,
        enrollment_date: r.enrollmentDate,
      })),
    )
    .select("id, student_number");
  if (error) throw new Error(error.message);

  const idByStudentNumber = new Map(
    (inserted ?? []).map((s) => [s.student_number, s.id]),
  );

  const enrollments = rows
    .filter((r) => r.className)
    .map((r) => {
      const studentId = idByStudentNumber.get(r.studentNumber);
      const classId = r.className ? classIdByName.get(r.className) : undefined;
      if (!studentId || !classId) return null;
      return {
        student_id: studentId,
        class_id: classId,
        valid_from: r.enrollmentDate,
      };
    })
    .filter((e): e is NonNullable<typeof e> => !!e);

  if (enrollments.length > 0) {
    const { error: enrollError } = await supabase
      .from("class_enrollments")
      .insert(enrollments);
    if (enrollError) throw new Error(enrollError.message);
  }

  revalidatePath("/students");
}
