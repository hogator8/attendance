import { requireStaff } from "@/lib/auth";
import { csvDownloadResponse } from "@/lib/csv";

// 詳細パターン（日次データ）のCSVテンプレート
export async function GET() {
  await requireStaff();

  const header = "学籍番号,日付,時限,記号,時刻,理由";
  const examples = [
    "S2020001,2020/04/06,1,〇,,",
    "S2020001,2020/04/06,2,遅,09:15,電車遅延",
  ];

  return csvDownloadResponse([header, ...examples], "詳細パターン_テンプレート.csv");
}
