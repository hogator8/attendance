import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerm } from "@/lib/terms";
import { updateStaffInfo, savePermissions } from "./actions";
import {
  cardClass,
  inputClass,
  labelClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  tableClass,
  thClass,
  tdClass,
} from "@/lib/ui";

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  await requireAdmin();
  const { staffId } = await params;
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("id", staffId)
    .maybeSingle();
  if (!staff) notFound();

  const activeTerm = await getActiveTerm(supabase);
  const { data: classes } = activeTerm
    ? await supabase
        .from("classes")
        .select("*")
        .eq("term_id", activeTerm.id)
        .order("type")
        .order("name")
    : { data: [] };

  const { data: permissions } = await supabase
    .from("staff_class_permissions")
    .select("*")
    .eq("staff_id", staffId);
  const permByClass = new Map(permissions?.map((p) => [p.class_id, p]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/staff" className="text-sm text-blue-600 hover:underline">
          ← 教員一覧に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{staff.name}</h1>
        <p className="text-xs text-slate-500">{staff.email}</p>
      </div>

      <div className={`${cardClass} max-w-md`}>
        <h2 className="mb-3 font-bold text-slate-900">基本情報</h2>
        <form action={updateStaffInfo} className="flex flex-col gap-3">
          <input type="hidden" name="staff_id" value={staff.id} />
          <div className="flex flex-col gap-1">
            <label className={labelClass}>氏名</label>
            <input
              name="name"
              defaultValue={staff.name}
              required
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>役職</label>
            <select
              name="role"
              defaultValue={staff.role}
              className={inputClass}
            >
              <option value="teacher">教員</option>
              <option value="admin">管理者</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>雇用形態（表示用・任意）</label>
            <input
              name="employment_type"
              defaultValue={staff.employment_type ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <button type="submit" className={buttonSecondaryClass}>
              保存
            </button>
          </div>
        </form>
      </div>

      <section className={cardClass}>
        <h2 className="mb-1 font-bold text-slate-900">クラスごとの権限</h2>
        {staff.role === "admin" ? (
          <p className="text-sm text-slate-500">
            この教員は管理者のため、権限設定に関わらず常に全クラスへアクセスできます。
          </p>
        ) : !activeTerm ? (
          <p className="text-sm text-slate-500">
            アクティブな学期がないため、権限を設定できません。
          </p>
        ) : (classes ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">クラスがまだ登録されていません。</p>
        ) : (
          <form action={savePermissions} className="flex flex-col gap-4">
            <input type="hidden" name="staff_id" value={staff.id} />
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>クラス</th>
                    <th className={thClass}>入力可</th>
                    <th className={thClass}>閲覧可</th>
                  </tr>
                </thead>
                <tbody>
                  {(classes ?? []).map((c) => {
                    const perm = permByClass.get(c.id);
                    return (
                      <tr key={c.id}>
                        <td className={tdClass}>
                          {c.name}
                          <span className="ml-1 text-xs text-slate-400">
                            （{c.type === "homeroom" ? "ホームルーム" : "選択科目"}）
                          </span>
                          <input type="hidden" name="class_id" value={c.id} />
                        </td>
                        <td className={`${tdClass} text-center`}>
                          <input
                            type="checkbox"
                            name={`input_${c.id}`}
                            defaultChecked={perm?.can_input ?? false}
                          />
                        </td>
                        <td className={`${tdClass} text-center`}>
                          <input
                            type="checkbox"
                            name={`view_${c.id}`}
                            defaultChecked={perm?.can_view_summary ?? false}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <button type="submit" className={buttonPrimaryClass}>
                権限を保存
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
