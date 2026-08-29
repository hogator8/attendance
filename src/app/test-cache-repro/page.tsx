import SubmitForm from "@/components/SubmitForm";
import ControlledCell from "./ControlledCell";
import { saveControlled, saveUncontrolled } from "./actions";
import { getValue } from "./store";

// 実際の出席入力・行事設定画面はcookies()を使うため常に動的レンダリングになる。
// このテストページも同じ条件で再現するため、明示的に動的レンダリングを強制する。
export const dynamic = "force-dynamic";

// テスト専用ページ（本番には含めない）。
// 出席入力（制御コンポーネント・remountOnSuccess=false）と
// 行事設定の単位数（非制御コンポーネント・remountOnSuccess=デフォルトtrue）の
// 2パターンを、本物のSubmitFormを使って再現する。
export default async function TestCacheReproPage() {
  const current = await getValue();
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
      <p data-testid="server-value">server value: {current}</p>

      <section>
        <h2>制御コンポーネント（remountOnSuccess=false、出席入力パターン）</h2>
        <SubmitForm
          action={saveControlled}
          successMessage="保存しました（controlled）"
          remountOnSuccess={false}
        >
          <ControlledCell defaultValue={current} />
          <button type="submit">保存</button>
        </SubmitForm>
      </section>

      <section>
        <h2>非制御コンポーネント（remountOnSuccessデフォルト、行事設定パターン）</h2>
        <SubmitForm action={saveUncontrolled} successMessage="保存しました（uncontrolled）">
          <input
            data-testid="uncontrolled-input"
            name="value"
            defaultValue={current}
            style={{ border: "1px solid #ccc", padding: "4px" }}
          />
          <button type="submit">保存</button>
        </SubmitForm>
      </section>
    </div>
  );
}
