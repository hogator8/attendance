import Link from "next/link";
import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import { buttonPrimaryClass, tableClass, thClass, tdClass } from "@/lib/ui";
import type { StudentStatus } from "@/lib/supabase/database.types";

const STATUS_LABELS: Record<StudentStatus, string> = {
  enrolled: "在籍",
  graduated: "卒業",
  withdrawn: "退学",
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ showWithdrawn?: string }>;
}) {
  await requireAdmin();
  const { showWithdrawn } = await searchParams;
  const includeWithdrawn = showWithdrawn === "1";
  const supabase = await createClient();
  const today = todayISO();

  let query = supabase
    .from("students")
    .select("*")
    .order("student_number");
  if (!includeWithdrawn) {
    query = query.neq("status", "withdrawn");
  }
  const { data: students } = await query;

  const studentIds = (students ?? []).map((s) => s.id);
  const { data: enrollments } =
    studentIds.length > 0
      ? await supabase
          .from("class_enrollments")
          .select("student_id, valid_from, valid_to, class:classes(name)")
          .in("student_id", studentIds)
          .lte("valid_from", today)
          .or(`valid_to.is.null,valid_to.gte.${today}`)
      : { data: [] };

  const homeroomByStudent = new Map<string, string>();
  for (const e of enrollments ?? []) {
    const className = e.class?.name;
    if (className) homeroomByStudent.set(e.student_id, className);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">生徒管理</h1>
        <Link href="/students/new" className={buttonPrimaryClass}>
          新規登録
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        <Link
          href="/students"
          className={!includeWithdrawn ? "font-bold text-blue-600" : "text-slate-500"}
        >
          在籍・卒業のみ表示
        </Link>
        <span className="text-slate-300">|</span>
        <Link
          href="/students?showWithdrawn=1"
          className={includeWithdrawn ? "font-bold text-blue-600" : "text-slate-500"}
        >
          退学者も含めて表示
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}></th>
              <th className={thClass}>学籍番号</th>
              <th className={thClass}>氏名</th>
              <th className={thClass}>フリガナ</th>
              <th className={thClass}>現在のホームルーム</th>
              <th className={thClass}>状態</th>
            </tr>
          </thead>
          <tbody>
            {(students ?? []).map((s) => (
              <tr key={s.id}>
                <td className={tdClass}>
                  {s.photo_url ? (
                    <Image
                      src={s.photo_url}
                      alt={s.name}
                      width={32}
                      height={32}
                      unoptimized
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
                      無
                    </span>
                  )}
                </td>
                <td className={tdClass}>
                  <Link
                    href={`/students/${s.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {s.student_number}
                  </Link>
                </td>
                <td className={tdClass}>{s.name}</td>
                <td className={tdClass}>{s.furigana}</td>
                <td className={tdClass}>
                  {homeroomByStudent.get(s.id) ?? "-"}
                </td>
                <td className={tdClass}>
                  <span
                    className={
                      s.status === "withdrawn"
                        ? "text-slate-400"
                        : s.status === "graduated"
                          ? "text-blue-600"
                          : "text-green-700"
                    }
                  >
                    {STATUS_LABELS[s.status]}
                  </span>
                </td>
              </tr>
            ))}
            {(students ?? []).length === 0 && (
              <tr>
                <td className={tdClass} colSpan={6}>
                  生徒が登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
