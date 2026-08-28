import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";

// 標準パターン（月別集計のみ）のCSVテンプレート
export async function GET() {
  await requireStaff();

  const header =
    "学籍番号,年月,要出席日数,出席日数,欠席日数,遅刻回数,早退回数,公欠日数,除外日数";
  const example = "S2020001,2020-04,20,18,2,1,0,0,0";
  const csv = `${header}\n${example}\n`;
  const fileName = "標準パターン_テンプレート.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
