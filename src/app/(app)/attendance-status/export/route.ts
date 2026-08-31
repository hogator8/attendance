import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStudentAttendanceStatus } from "../data";
import { csvDownloadResponse, csvField } from "@/lib/csv";
import { todayISO } from "@/lib/date";

// 出席状況ページの「日々の記録」を、画面表示と同じ項目（日付・クラス・時限・
// 記号・時刻・理由）でCSV出力する。
export async function GET(request: NextRequest) {
  await requirePermission("can_view_individual_records");
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get("student_id");
  if (!studentId) {
    return NextResponse.json({ error: "学生を選択してください。" }, { status: 400 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("student_number, name")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) {
    return NextResponse.json({ error: "学生が見つかりません。" }, { status: 404 });
  }

  const status = await getStudentAttendanceStatus(supabase, studentId);

  const header = "日付,クラス,時限,記号,時刻,理由";
  const rows = status.dailyRecords.map((r) =>
    [
      r.date,
      csvField(r.className),
      String(r.periodNo),
      csvField(`${r.symbolChar}（${r.symbolLabel}）`),
      r.timeValue ?? "",
      csvField(r.reason ?? ""),
    ].join(","),
  );

  const fileName = `日々の記録_${student.student_number}_${todayISO()}.csv`;
  return csvDownloadResponse([header, ...rows], fileName);
}
