import { requireAdmin } from "@/lib/auth";
import ResetAllDataButton from "@/components/ResetAllDataButton";
import { resetAllData } from "./actions";
import { cardClass } from "@/lib/ui";

export default async function DangerZonePage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">データ初期化（危険な操作）</h1>
        <p className="text-xs text-slate-500">
          この画面の操作は管理者（admin）のみが実行できます。取り消しはできません。
        </p>
      </div>

      <div className={`${cardClass} max-w-2xl border-red-200`}>
        <h2 className="mb-2 font-bold text-red-800">全データリセット</h2>
        <p className="mb-4 text-sm text-slate-600">
          管理者（admin）アカウントを除く、このサイトに登録されているすべてのデータを完全に
          削除し、初期状態に戻します。誤った操作の巻き戻しや部分的な取り消しはできません。
        </p>
        <ResetAllDataButton action={resetAllData} />
      </div>
    </div>
  );
}
