import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerm } from "@/lib/terms";
import { getAccessibleClasses } from "@/lib/permissions";
import { todayISO } from "@/lib/date";
import { cardClass } from "@/lib/ui";

export default async function AttendanceSelectPage() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const term = await getActiveTerm(supabase);
  const today = todayISO();

  if (!term) {
    return <p className="text-sm text-slate-500">アクティブな学期がありません。</p>;
  }

  const classes = await getAccessibleClasses(supabase, staff, term.id, "input");
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
          <ClassGrid classes={homerooms} date={today} />
        </section>
      )}
      {electives.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold text-slate-900">選択科目</h2>
          <ClassGrid classes={electives} date={today} />
        </section>
      )}
    </div>
  );
}

function ClassGrid({
  classes,
  date,
}: {
  classes: { id: string; name: string }[];
  date: string;
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
          </Link>
        </li>
      ))}
    </ul>
  );
}
