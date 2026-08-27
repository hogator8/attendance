import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createStaffAccount } from "./actions";
import {
  cardClass,
  inputClass,
  labelClass,
  buttonPrimaryClass,
  tableClass,
  thClass,
  tdClass,
} from "@/lib/ui";

export default async function StaffPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: staffList } = await supabase
    .from("staff")
    .select("*")
    .order("role")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">教員管理</h1>

      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>氏名</th>
              <th className={thClass}>メールアドレス</th>
              <th className={thClass}>役職</th>
              <th className={thClass}>雇用形態</th>
              <th className={thClass}>クラス権限</th>
            </tr>
          </thead>
          <tbody>
            {(staffList ?? []).map((s) => (
              <tr key={s.id}>
                <td className={tdClass}>{s.name}</td>
                <td className={tdClass}>{s.email}</td>
                <td className={tdClass}>
                  {s.role === "admin" ? "管理者" : "教員"}
                </td>
                <td className={tdClass}>{s.employment_type ?? "-"}</td>
                <td className={tdClass}>
                  <Link
                    href={`/staff/${s.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    編集・権限設定
                  </Link>
                </td>
              </tr>
            ))}
            {(staffList ?? []).length === 0 && (
              <tr>
                <td className={tdClass} colSpan={5}>
                  教員が登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={`${cardClass} max-w-md`}>
        <h2 className="mb-3 font-bold text-slate-900">教員アカウントを作成</h2>
        <form action={createStaffAccount} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>氏名</label>
            <input name="name" required className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>メールアドレス（ログインID）</label>
            <input
              type="email"
              name="email"
              required
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>初期パスワード（8文字以上）</label>
            <input
              type="text"
              name="password"
              required
              minLength={8}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>役職</label>
            <select name="role" defaultValue="teacher" className={inputClass}>
              <option value="teacher">教員</option>
              <option value="admin">管理者</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>雇用形態（表示用・任意）</label>
            <input
              name="employment_type"
              placeholder="例：専任、非常勤"
              className={inputClass}
            />
          </div>
          <div>
            <button type="submit" className={buttonPrimaryClass}>
              作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
