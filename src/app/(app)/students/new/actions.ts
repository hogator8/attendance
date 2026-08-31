"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadStudentPhoto } from "@/lib/storage";
import { getActiveTerms } from "@/lib/terms";
import { readCsvFile } from "@/lib/csv";
import { parseFlexibleDate } from "@/lib/date";
import { withFlash } from "@/lib/flash";

export async function createStudent(formData: FormData) {
  await requirePermission("can_manage_students");
  const supabase = await createClient();

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
  const categoryId = String(formData.get("category_id") ?? "").trim();
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
      gender: gender || null,
      date_of_birth: dateOfBirth || null,
      enrollment_date: enrollmentDate,
      expected_graduation_date: expectedGraduationDate || null,
      category_id: categoryId || null,
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

  revalidatePath("/students");
  redirect(withFlash(`/students/${student.id}`, "学生を登録しました"));
}

// CSV一括登録：1行につき
// 「学籍番号,氏名,フリガナ,国籍,性別,生年月日,入学日,卒業予定年月日,クラス名」の形式。
// 国籍・性別・生年月日・卒業予定年月日・クラス名は任意。クラス名が指定されている
// 場合、アクティブな学期の同名ホームルームクラスへ入学日を配属開始日として自動配属する。
export async function importStudentsCsv(formData: FormData) {
  await requirePermission("can_manage_students");
  const supabase = await createClient();

  const csv = await readCsvFile(formData);

  // 1行目はヘッダー行（テンプレートCSVをそのままアップロードした場合、
  // ヘッダー行の文字列自体がデータ行として誤ってパースされないようにする）。
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(1);

  type Row = {
    studentNumber: string;
    name: string;
    furigana: string;
    nationality: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    enrollmentDate: string | null;
    expectedGraduationDate: string | null;
    className: string | null;
    hasDateFormatError: boolean;
  };
  const rows: Row[] = lines.map((line) => {
    const cols = line.split(",").map((s) => s.trim());
    const [
      studentNumber,
      name,
      furigana,
      nationality,
      gender,
      dateOfBirthRaw,
      enrollmentDateRaw,
      expectedGraduationDateRaw,
      className,
    ] = cols;

    const dateOfBirth = dateOfBirthRaw ? parseFlexibleDate(dateOfBirthRaw) : null;
    const enrollmentDate = enrollmentDateRaw ? parseFlexibleDate(enrollmentDateRaw) : null;
    const expectedGraduationDate = expectedGraduationDateRaw
      ? parseFlexibleDate(expectedGraduationDateRaw)
      : null;
    const hasDateFormatError =
      (!!dateOfBirthRaw && dateOfBirth === null) ||
      !enrollmentDateRaw ||
      enrollmentDate === null ||
      (!!expectedGraduationDateRaw && expectedGraduationDate === null);

    return {
      studentNumber: studentNumber ?? "",
      name: name ?? "",
      furigana: furigana ?? "",
      nationality: nationality || null,
      gender: gender || null,
      dateOfBirth,
      enrollmentDate,
      expectedGraduationDate,
      className: className || null,
      hasDateFormatError,
    };
  });

  const invalid = rows.find(
    (r) => !r.studentNumber || !r.name || !r.furigana || r.hasDateFormatError,
  );
  if (invalid) {
    throw new Error(
      "CSVの形式が不正です。各行「学籍番号,氏名,フリガナ,国籍(任意),性別(任意),生年月日(任意・YYYY/MM/DD),YYYY/MM/DD,卒業予定年月日(任意・YYYY/MM/DD),クラス名(任意)」で入力してください。",
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
        gender: r.gender,
        date_of_birth: r.dateOfBirth,
        // 上のバリデーションで空欄・不正形式は弾いているため非nullが保証されている
        enrollment_date: r.enrollmentDate!,
        expected_graduation_date: r.expectedGraduationDate,
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
        valid_from: r.enrollmentDate!,
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
