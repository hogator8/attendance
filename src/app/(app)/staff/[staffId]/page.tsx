import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerm } from "@/lib/terms";
import SubmitForm from "@/components/SubmitForm";
import { updateStaffInfo, updateStaffPassword, savePermissions } from "./actions";
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

const PERMISSION_FIELDS: { name: string; label: string }[] = [
  { name: "can_view_summary", label: "集計の閲覧" },
  { name: "can_manage_students", label: "学生管理" },
  { name: "can_manage_classes", label: "クラス・時間割管理" },
  { name: "can_manage_staff", label: "教員管理" },
  { name: "can_manage_settings", label: "各種設定管理" },
  { name: "can_view_individual_records", label: "個別学生の出席状況閲覧" },
];

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  await requirePermission("can_manage_staff");
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

  const { data: globalPermissions } = await supabase
    .from("staff_permissions")
    .select("*")
    .eq("staff_id", staffId)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/staff" className="text-sm text-blue-600 hover:underline">
          ← 教員一覧に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{staff.name}</h1>
        <p className="text-xs text-slate-500">ログインID：{staff.login_id}</p>
      </div>

      <div className={`${cardClass} max-w-md`}>
        <h2 className="mb-3 font-bold text-slate-900">基本情報</h2>
        <SubmitForm
          action={updateStaffInfo}
          successMessage="保存しました"
          className="flex flex-col gap-3"
        >
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
            <label className={labelClass}>ログインID</label>
            <input
              name="login_id"
              defaultValue={staff.login_id}
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
              <option value="full_time">専任</option>
              <option value="part_time">非常勤</option>
              <option value="admin">管理者</option>
            </select>
          </div>
          <div>
            <button type="submit" className={buttonSecondaryClass}>
              保存
            </button>
          </div>
        </SubmitForm>
      </div>

      <div className={`${cardClass} max-w-md`}>
        <h2 className="mb-3 font-bold text-slate-900">パスワードの変更</h2>
        <SubmitForm
          action={updateStaffPassword}
          successMessage="パスワードを変更しました"
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="staff_id" value={staff.id} />
          <div className="flex flex-col gap-1">
            <label className={labelClass}>新しいパスワード（4文字以上）</label>
            <input
              type="text"
              name="password"
              required
              minLength={4}
              className={inputClass}
            />
          </div>
          <div>
            <button type="submit" className={buttonSecondaryClass}>
              変更
            </button>
          </div>
        </SubmitForm>
      </div>

      <section className={cardClass}>
        <h2 className="mb-1 font-bold text-slate-900">権限設定</h2>
        {staff.role === "admin" ? (
          <p className="text-sm text-slate-500">
            この教員は管理者のため、権限設定に関わらず常に全機能・全クラスへアクセスできます。
          </p>
        ) : (
          <SubmitForm
            action={savePermissions}
            successMessage="権限を保存しました"
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="staff_id" value={staff.id} />

            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-700">
                機能単位の権限
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PERMISSION_FIELDS.map((f) => (
                  <label
                    key={f.name}
                    className="inline-flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name={`perm_${f.name}`}
                      defaultChecked={
                        !!(globalPermissions as Record<string, boolean> | null)?.[
                          f.name
                        ]
                      }
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-700">
                クラスごとの出席入力権限
              </h3>
              {!activeTerm ? (
                <p className="text-sm text-slate-500">
                  アクティブな学期がないため、クラス権限を設定できません。
                </p>
              ) : (classes ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">クラスがまだ登録されていません。</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className={tableClass}>
                    <thead>
                      <tr>
                        <th className={thClass}>クラス</th>
                        <th className={thClass}>入力可</th>
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <button type="submit" className={buttonPrimaryClass}>
                権限を保存
              </button>
            </div>
          </SubmitForm>
        )}
      </section>
    </div>
  );
}
