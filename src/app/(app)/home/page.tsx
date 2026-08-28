import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerms } from "@/lib/terms";
import {
  getInputAccessibleClasses,
  getSummaryAccessibleClasses,
} from "@/lib/permissions";
import { todayISO, formatDateLabel } from "@/lib/date";

export default async function HomePage() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const terms = await getActiveTerms(supabase);
  const today = todayISO();

  if (terms.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        {staff.role === "admin" ? (
          <p>
            現在アクティブな学期が設定されていません。
            <Link href="/settings" className="ml-1 underline">
              設定画面
            </Link>
            から学期を作成してください。
          </p>
        ) : (
          <p>現在アクティブな学期が設定されていません。管理者にお問い合わせください。</p>
        )}
      </div>
    );
  }

  const termIds = terms.map((t) => t.id);
  const termNameById = new Map(terms.map((t) => [t.id, t.name]));

  const inputClasses = await getInputAccessibleClasses(supabase, staff, termIds);
  const viewClasses = await getSummaryAccessibleClasses(supabase, staff, termIds);

  const viewOnlyIds = new Set(
    viewClasses
      .filter((c) => !inputClasses.some((ic) => ic.id === c.id))
      .map((c) => c.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">アクティブな学期</p>
        <ul className="mt-1 flex flex-col gap-1">
          {terms.map((term) => (
            <li key={term.id}>
              <span className="font-bold text-slate-900">{term.name}</span>
              <span className="ml-2 text-xs text-slate-400">
                {term.start_date} 〜 {term.end_date}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <section>
        <h2 className="mb-2 text-base font-bold text-slate-900">
          出席入力・集計 － 今日は{formatDateLabel(today)}
        </h2>
        {inputClasses.length === 0 && viewClasses.length === 0 ? (
          <p className="text-sm text-slate-500">
            アクセス可能なクラス・選択科目がありません。管理者に権限設定を依頼してください。
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...inputClasses, ...viewClasses.filter((c) => viewOnlyIds.has(c.id))].map(
              (cls) => (
                <li
                  key={cls.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      {cls.type === "homeroom" ? "ホームルーム" : "選択科目"}
                    </span>
                    <p className="mt-1 font-medium text-slate-900">
                      {cls.name}
                      {terms.length > 1 && (
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          （{termNameById.get(cls.term_id)}）
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="mt-auto flex gap-2 text-sm">
                    {(inputClasses.some((c) => c.id === cls.id)) && (
                      <Link
                        href={`/attendance/${cls.id}?date=${today}`}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
                      >
                        今日の出席入力
                      </Link>
                    )}
                    {viewClasses.some((c) => c.id === cls.id) && (
                      <Link
                        href={`/summary/${cls.id}`}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                      >
                        集計
                      </Link>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
