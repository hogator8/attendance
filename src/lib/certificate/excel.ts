import "server-only";
import ExcelJS from "exceljs";
import type { CertificateData, SchoolSettings } from "./data";

const GENDER_LABEL: Record<string, string> = {
  male: "男",
  female: "女",
  男: "男",
  女: "女",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

// 添付の参考レイアウト（出席証明書.xlsx）の構成（学校名→発行日→タイトル→
// 学生情報→入学/卒業/累計時間・出席率→月別出席状況×2ブロック→特記事項→
// 発行者情報）に沿って組み立てる。
export function buildCertificateWorkbook(
  data: CertificateData,
  school: SchoolSettings,
  remarks: string,
  longVacation: string,
  issueDate: string,
): ExcelJS.Workbook {
  const { student } = data;
  const [issueYear, issueMonth, issueDay] = issueDate.split("-").map(Number);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("出席証明書", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  sheet.properties.defaultRowHeight = 18;
  for (let c = 1; c <= 14; c++) sheet.getColumn(c).width = 9;

  const center = { horizontal: "center" as const, vertical: "middle" as const, wrapText: true };
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  let row = 2;

  sheet.mergeCells(row, 2, row, 8);
  const nameCell = sheet.getCell(row, 2);
  nameCell.value = school.schoolName || "（学校名未設定）";
  nameCell.font = { size: 14, bold: true };
  nameCell.alignment = center;
  row++;

  sheet.mergeCells(row, 10, row, 14);
  const issueCell = sheet.getCell(row, 10);
  issueCell.value = `${issueYear}年${issueMonth}月${issueDay}日`;
  issueCell.alignment = { horizontal: "right", vertical: "middle" };
  row += 2;

  sheet.mergeCells(row, 2, row, 14);
  const titleCell = sheet.getCell(row, 2);
  titleCell.value = "出席証明書";
  titleCell.font = { size: 20, bold: true };
  titleCell.alignment = center;
  row += 2;

  function infoTable(
    cols: { label: string; value: string; span: number }[],
  ) {
    const labelRow = row;
    const valueRow = row + 1;
    let col = 2;
    for (const c of cols) {
      sheet.mergeCells(labelRow, col, labelRow, col + c.span - 1);
      const lc = sheet.getCell(labelRow, col);
      lc.value = c.label;
      lc.font = { bold: true };
      lc.alignment = center;
      lc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      for (let cc = col; cc < col + c.span; cc++) sheet.getCell(labelRow, cc).border = thinBorder;

      sheet.mergeCells(valueRow, col, valueRow, col + c.span - 1);
      const vc = sheet.getCell(valueRow, col);
      vc.value = c.value;
      vc.alignment = center;
      for (let cc = col; cc < col + c.span; cc++) sheet.getCell(valueRow, cc).border = thinBorder;

      col += c.span;
    }
    sheet.getRow(valueRow).height = 26;
    row = valueRow + 1;
  }

  infoTable([
    { label: "学籍番号", value: student.student_number, span: 2 },
    { label: "氏名", value: student.name, span: 4 },
    { label: "国籍", value: student.nationality ?? "", span: 2 },
    {
      label: "性別",
      value: student.gender ? GENDER_LABEL[student.gender] ?? student.gender : "",
      span: 2,
    },
    { label: "生年月日", value: fmtDate(student.date_of_birth), span: 3 },
  ]);
  row++;

  infoTable([
    { label: "入学年月日", value: fmtDate(student.enrollment_date), span: 3 },
    { label: "卒業予定年月日", value: fmtDate(student.expected_graduation_date), span: 3 },
    { label: "累計授業時間数", value: `${data.cumulativeCourseHours.toFixed(1)}時間`, span: 2 },
    { label: "累計出席時間数", value: `${data.cumulativeAttendanceHours.toFixed(1)}時間`, span: 2 },
    { label: "累計出席率", value: `${(data.cumulativeRate * 100).toFixed(1)}%`, span: 3 },
  ]);
  row += 1;

  function monthBlock(cells: CertificateData["monthBlocks"][number]) {
    const year = cells[0]?.year ?? new Date().getFullYear();

    sheet.mergeCells(row, 2, row, 14);
    const header = sheet.getCell(row, 2);
    header.value = "出席状況";
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    header.alignment = center;
    row++;

    const yearRow = row;
    const courseRow = row + 1;
    const attendRow = row + 2;
    const rateRow = row + 3;

    sheet.getCell(yearRow, 2).value = `${year}年`;
    sheet.getCell(courseRow, 2).value = "授業時間数";
    sheet.getCell(attendRow, 2).value = "出席時間数";
    sheet.getCell(rateRow, 2).value = "出席率";
    for (const r of [yearRow, courseRow, attendRow, rateRow]) {
      const c = sheet.getCell(r, 2);
      c.font = { bold: true };
      c.alignment = center;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      c.border = thinBorder;
    }

    cells.forEach((cell, i) => {
      const col = 3 + i;
      const monthCell = sheet.getCell(yearRow, col);
      monthCell.value = `${cell.month}月`;
      monthCell.alignment = center;
      monthCell.border = thinBorder;

      const courseCell = sheet.getCell(courseRow, col);
      courseCell.value = Number(cell.courseHours.toFixed(1));
      courseCell.alignment = center;
      courseCell.border = thinBorder;

      const attendCell = sheet.getCell(attendRow, col);
      attendCell.value = Number(cell.attendanceHours.toFixed(1));
      attendCell.alignment = center;
      attendCell.border = thinBorder;

      const rateCell = sheet.getCell(rateRow, col);
      rateCell.value = cell.courseHours > 0 ? `${(cell.rate * 100).toFixed(1)}%` : "-";
      rateCell.alignment = center;
      rateCell.border = thinBorder;
    });

    row = rateRow + 1;
  }

  monthBlock(data.monthBlocks[0]);
  row++;
  monthBlock(data.monthBlocks[1]);
  row += 1;

  sheet.getCell(row, 2).value = "特記事項：";
  sheet.getCell(row, 2).font = { bold: true };
  sheet.mergeCells(row, 3, row + 2, 14);
  const remarksCell = sheet.getCell(row, 3);
  remarksCell.value = remarks;
  remarksCell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  remarksCell.border = thinBorder;
  row += 4;

  sheet.getCell(row, 2).value = "長期休暇：";
  sheet.getCell(row, 2).font = { bold: true };
  sheet.mergeCells(row, 3, row + 2, 14);
  const longVacationCell = sheet.getCell(row, 3);
  longVacationCell.value = longVacation;
  longVacationCell.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  longVacationCell.border = thinBorder;
  row += 4;

  sheet.mergeCells(row, 9, row, 14);
  const footerName = sheet.getCell(row, 9);
  footerName.value = school.schoolName || "（学校名未設定）";
  footerName.font = { bold: true };
  footerName.alignment = { horizontal: "right" };
  row++;

  sheet.mergeCells(row, 9, row, 14);
  const footerPrincipal = sheet.getCell(row, 9);
  footerPrincipal.value = `校長：${school.principalName}`;
  footerPrincipal.font = { bold: true };
  footerPrincipal.alignment = { horizontal: "right" };
  row++;

  sheet.mergeCells(row, 9, row, 14);
  const footerAddress = sheet.getCell(row, 9);
  footerAddress.value = `住所：${school.schoolAddress}`;
  footerAddress.alignment = { horizontal: "right" };
  row++;

  sheet.mergeCells(row, 9, row, 14);
  const footerPhone = sheet.getCell(row, 9);
  footerPhone.value = `TEL：${school.schoolPhone}`;
  footerPhone.alignment = { horizontal: "right" };

  return workbook;
}
