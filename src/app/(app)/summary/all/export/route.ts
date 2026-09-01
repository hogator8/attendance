import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireStaff } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  getAllStudentsSummaryData,
  buildAllStudentsColumnDefs,
  resolveAllStudentsColumns,
  getAllStudentsCellValue,
} from "../data";

export async function GET(request: NextRequest) {
  const staff = await requireStaff();
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

  const data = await getAllStudentsSummaryData(supabase, { from, to });

  const columnDefs = buildAllStudentsColumnDefs(data);
  const columns = resolveAllStudentsColumns(
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
    const symbolCounts = data.symbolCountsByStudent.get(student.id);
    const monthlySymbolCounts = data.monthlySymbolCountsByStudent.get(student.id);
    const row = [
      student.student_number,
      student.name,
      student.furigana,
      ...columns.map((c) =>
        getAllStudentsCellValue(
          c.key,
          student,
          summary,
          symbolCounts,
          monthlySymbolCounts,
          data.decimalDigits,
        ),
      ),
    ];
    sheet.addRow(row);
  }

  sheet.columns.forEach((col) => {
    col.width = 14;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `全学生_集計_${data.periodFrom}_${data.periodTo}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
