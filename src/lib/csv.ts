import "server-only";

// CSV一括登録系のServer Actionで共通して使う、FormDataからアップロードされた
// CSVファイルのテキスト内容を取り出すヘルパー。
export async function readCsvFile(formData: FormData, fieldName = "csv"): Promise<string> {
  const file = formData.get(fieldName);
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("CSVファイルを選択してください。");
  }
  return file.text();
}
