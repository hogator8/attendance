import Link from "next/link";
import Image from "next/image";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import { buttonPrimaryClass, buttonDangerClass, tableClass, thClass, tdClass } from "@/lib/ui";
import TypeToConfirmDeleteButton from "@/components/TypeToConfirmDeleteButton";
import { deleteStudent } from "./[studentId]/actions";
import type { StudentStatus } from "@/lib/supabase/database.types";

const STATUS_LABELS: Record<StudentStatus, string> = {
  enrolled: "在籍",
  graduated: "卒業",
  withdrawn: "退学",
};

type SortKey = "student_number" | "name" | "furigana" | "homeroom" | "status";
const SORT_KEYS: SortKey[] = ["student_number", "name", "furigana", "homeroom", "status"];
const SORT_LABELS: Record<SortKey, string> = {
  student_number: "学籍番号",
  name: "氏名",
  furigana: "フリガナ",
  homeroom: "現在のホームルーム",
  status: "状態",
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ showWithdrawn?: string; sort?: string; dir?: string }>;
}) {
  await requirePermission("can_manage_students");
  const { showWithdrawn, sort, dir } = await searchParams;
  const includeWithdrawn = showWithdrawn === "1";
  const sortKey: SortKey = SORT_KEYS.includes(sort as SortKey)
    ? (sort as SortKey)
    : "student_number";
  const sortDir: "asc" | "desc" = dir === "desc" ? "desc" : "asc";
  const supabase = await createClient();
  const today = todayISO();

  let query = supabase.from("students").select("*");
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

  const sorted = [...(students ?? [])].sort((a, b) => {
    const va =
      sortKey === "homeroom" ? (homeroomByStudent.get(a.id) ?? "") : a[sortKey];
    const vb =
      sortKey === "homeroom" ? (homeroomByStudent.get(b.id) ?? "") : b[sortKey];
    const cmp = String(va).localeCompare(String(vb), "ja");
    return sortDir === "asc" ? cmp : -cmp;
  });

  function sortHref(key: SortKey) {
    const nextDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    const params = new URLSearchParams();
    if (includeWithdrawn) params.set("showWithdrawn", "1");
    params.set("sort", key);
    params.set("dir", nextDir);
    return `/students?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">学生管理</h1>
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
              {SORT_KEYS.map((key) => (
                <th key={key} className={thClass}>
                  <Link href={sortHref(key)} className="inline-flex items-center gap-1 hover:underline">
                    {SORT_LABELS[key]}
                    {sortKey === key && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </Link>
                </th>
              ))}
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id}>
                <td className={tdClass}>
                  {s.photo_url ? (
                    <Image
                      src={s.photo_url}
                      alt={s.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500" />

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
                <td className={tdClass}>
                  <TypeToConfirmDeleteButton
                    action={deleteStudent}
                    hiddenFields={{ student_id: s.id }}
                    confirmText={s.student_number}
                    confirmLabel={`削除するには学籍番号「${s.student_number}」を入力してください。出席記録も含めて完全に削除され、元に戻せません。`}
                    successMessage="学生を削除しました"
                    buttonLabel="削除"
                    buttonClassName={buttonDangerClass}
                  />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td className={tdClass} colSpan={7}>
                  学生が登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
