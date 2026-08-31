import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { cardClass } from "@/lib/ui";

export default async function SettingsPage() {
  await requirePermission("can_manage_settings");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">設定</h1>

      <div className="flex flex-wrap gap-4">
        <Link href="/settings/terms" className={`${cardClass} block w-64 hover:border-blue-300`}>
          <h2 className="font-bold text-slate-900">学期管理</h2>
          <p className="mt-1 text-xs text-slate-500">
            学期の作成・アクティブ化・削除、出席記号・行事・休業日などの学期ごとの設定
          </p>
        </Link>
        <Link
          href="/settings/student-categories"
          className={`${cardClass} block w-64 hover:border-blue-300`}
        >
          <h2 className="font-bold text-slate-900">学生区分設定</h2>
          <p className="mt-1 text-xs text-slate-500">
            長期生・短期生など、学期に依存しない学校全体共通の学生区分名の設定
          </p>
        </Link>
      </div>
    </div>
  );
}
