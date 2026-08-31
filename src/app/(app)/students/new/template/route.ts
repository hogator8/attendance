import { requireStaff } from "@/lib/auth";
import { csvDownloadResponse } from "@/lib/csv";

// 学生CSV一括登録のテンプレート
export async function GET() {
  await requireStaff();

  const header = "学籍番号,氏名,フリガナ,国籍,性別,生年月日,入学日,卒業予定年月日,クラス名";
  const example = "S2026001,山田太郎,やまだたろう,日本,男,2005/04/01,2026/04/01,2028/03/31,初級A";

  return csvDownloadResponse([header, example], "学生一括登録_テンプレート.csv");
}
