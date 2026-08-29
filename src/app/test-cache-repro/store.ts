// テスト専用：本物のDBを使わず、モジュールレベルの変数だけで
// Server Actionによる更新→再読み込みのタイミングを再現する。
// 実際の出席入力・行事設定画面はSupabaseへの複数クエリで数百ms〜数秒
// かかるため、読み取り側にも同程度の遅延をわざと入れて条件を揃える。
let value = "1";

export async function getValue() {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return value;
}

export function setValue(next: string) {
  value = next;
}
