"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { uploadStudentPhoto } from "@/lib/storage";

export async function createStudent(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const studentNumber = String(formData.get("student_number") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const furigana = String(formData.get("furigana") ?? "").trim();
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
