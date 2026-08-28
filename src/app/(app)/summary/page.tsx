import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerm } from "@/lib/terms";
import { getSummaryAccessibleClasses } from "@/lib/permissions";
import { cardClass } from "@/lib/ui";

export default async function SummarySelectPage() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const term = await getActiveTerm(supabase);

  if (!term) {
    return <p className="text-sm text-slate-500">アクティブな学期がありません。</p>;
  }

  const classes = await getSummaryAccessibleClasses(supabase, staff, term.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">集計</h1>
      {classes.length === 0 ? (
        <p className="text-sm text-slate-500">
          集計を閲覧できるクラスがありません。管理者に権限設定を依頼してください。
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/summary/${c.id}`}
                className={`${cardClass} block hover:border-blue-400`}
              >
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  {c.type === "homeroom" ? "ホームルーム" : "選択科目"}
                </span>
                <p className="mt-1 font-medium text-slate-900">{c.name}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
