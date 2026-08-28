import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerms } from "@/lib/terms";
import { getInputAccessibleClasses } from "@/lib/permissions";
import { todayISO } from "@/lib/date";
import { cardClass } from "@/lib/ui";

export default async function AttendanceSelectPage() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const terms = await getActiveTerms(supabase);
  const today = todayISO();

  if (terms.length === 0) {
    return <p className="text-sm text-slate-500">アクティブな学期がありません。</p>;
  }

  const termIds = terms.map((t) => t.id);
  const termNameById = new Map(terms.map((t) => [t.id, t.name]));
  const showTermLabel = terms.length > 1;

  const classes = await getInputAccessibleClasses(supabase, staff, termIds);
  const homerooms = classes.filter((c) => c.type === "homeroom");
  const electives = classes.filter((c) => c.type === "elective");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">出席入力</h1>

      {classes.length === 0 && (
        <p className="text-sm text-slate-500">
          出席入力が許可されているクラスがありません。管理者に権限設定を依頼してください。
        </p>
      )}

      {homerooms.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold text-slate-900">ホームルームクラス</h2>
          <ClassGrid
            classes={homerooms}
            date={today}
            termNameById={termNameById}
            showTermLabel={showTermLabel}
          />
        </section>
      )}
      {electives.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold text-slate-900">選択科目</h2>
          <ClassGrid
            classes={electives}
            date={today}
            termNameById={termNameById}
            showTermLabel={showTermLabel}
          />
        </section>
      )}
    </div>
  );
}

function ClassGrid({
  classes,
  date,
  termNameById,
  showTermLabel,
}: {
  classes: { id: string; name: string; term_id: string }[];
  date: string;
  termNameById: Map<string, string>;
  showTermLabel: boolean;
}) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {classes.map((c) => (
        <li key={c.id}>
          <Link
            href={`/attendance/${c.id}?date=${date}`}
            className={`${cardClass} block hover:border-blue-400`}
          >
            {c.name}
            {showTermLabel && (
              <span className="ml-1 text-xs text-slate-400">
                （{termNameById.get(c.term_id)}）
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
