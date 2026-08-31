import { requireStaff } from "@/lib/auth";
import { csvDownloadResponse } from "@/lib/csv";

// 標準パターン（月別集計のみ）のCSVテンプレート
export async function GET() {
  await requireStaff();

  const header =
    "学籍番号,年月,要出席時数,出席時数,欠席時数,遅刻回数,早退回数,公欠時数,除外時数";
  const example = "S2020001,2020/04,20,18,2,1,0,0,0";

  return csvDownloadResponse([header, example], "標準パターン_テンプレート.csv");
}
