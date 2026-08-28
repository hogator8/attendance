import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireStaff } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  getClassSummaryData,
  buildColumnDefs,
  resolveSelectedColumns,
  getCellValue,
} from "../data";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const staff = await requireStaff();
  const { classId } = await params;
  const supabase = await createClient();

  const allowed = await hasPermission(supabase, staff, "can_view_summary");
  if (!allowed) {
    return NextResponse.json({ error: "権限がありません。" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const selectedCols = searchParams.getAll("col");
  const colsSubmitted = searchParams.has("cols_submitted");

  const data = await getClassSummaryData(supabase, classId, { from, to });
  if (!data) {
    return NextResponse.json({ error: "クラスが見つかりません。" }, { status: 404 });
  }

  const columnDefs = buildColumnDefs(data.symbolRows, data.months);
  const columns = resolveSelectedColumns(
    columnDefs,
    colsSubmitted ? selectedCols : undefined,
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("集計");

  const headerRow = ["学籍番号", "氏名", "フリガナ", ...columns.map((c) => c.label)];
  sheet.addRow(headerRow);
  sheet.getRow(1).font = { bold: true };

  for (const student of data.rosterList) {
    const summary = data.summaryByStudent.get(student.id);
    const row = [
      student.student_number,
      student.name,
      student.furigana,
      ...columns.map((c) =>
        getCellValue(c.key, student, summary, data.decimalDigits),
      ),
    ];
    sheet.addRow(row);
  }

  sheet.columns.forEach((col) => {
    col.width = 14;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${data.cls.name}_集計_${data.periodFrom}_${data.periodTo}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
