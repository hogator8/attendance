import "server-only";
import { NextResponse } from "next/server";

// CSV一括登録系のServer Actionで共通して使う、FormDataからアップロードされた
// CSVファイルのテキスト内容を取り出すヘルパー。
export async function readCsvFile(formData: FormData, fieldName = "csv"): Promise<string> {
  const file = formData.get(fieldName);
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください。");
  }
  return file.text();
}

// CSVテンプレートダウンロード用のResponseを生成する共通ヘルパー。
// 先頭にUTF-8 BOM（﻿）を付与し、Excelでそのまま開いても文字化けしない
// ようにする（アプリ内の全てのCSVテンプレート生成箇所で共通利用する）。
export function csvDownloadResponse(lines: string[], fileName: string): NextResponse {
  const csv = "﻿" + lines.join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}

// CSVの1フィールド値をエスケープする。カンマ・ダブルクォート・改行を含む
// 場合のみダブルクォートで囲み、内部のダブルクォートは二重にする。
export function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
