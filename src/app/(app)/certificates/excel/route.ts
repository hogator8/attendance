import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCertificateData, getSchoolSettings } from "@/lib/certificate/data";
import { buildCertificateWorkbook } from "@/lib/certificate/excel";
import { todayISO } from "@/lib/date";

export async function GET(request: NextRequest) {
  await requirePermission("can_view_individual_records");
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get("student_id");
  const remarks = searchParams.get("remarks") ?? "";
  const longVacation = searchParams.get("long_vacation") ?? "";
  if (!studentId) {
    return NextResponse.json({ error: "学生を選択してください。" }, { status: 400 });
  }

  const [data, school] = await Promise.all([
    getCertificateData(supabase, studentId),
    getSchoolSettings(supabase),
  ]);
  if (!data) {
    return NextResponse.json({ error: "学生が見つかりません。" }, { status: 404 });
  }

  const issueDate = todayISO();
  const workbook = buildCertificateWorkbook(data, school, remarks, longVacation, issueDate);
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `出席証明書_${data.student.student_number}_${issueDate}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
