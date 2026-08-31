import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerms } from "@/lib/terms";
import SubmitForm from "@/components/SubmitForm";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { createStaffAccount } from "./actions";
import { savePermissions, deleteStaffAccount } from "./[staffId]/actions";
import {
  cardClass,
  inputClass,
  labelClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  buttonDangerClass,
  tableClass,
  thClass,
  tdClass,
} from "@/lib/ui";

const ROLE_LABEL: Record<string, string> = {
  admin: "管理者",
  full_time: "専任",
  part_time: "非常勤",
};

export default async function StaffPage() {
  const actor = await requirePermission("can_manage_staff");
  const supabase = await createClient();
  const terms = await getActiveTerms(supabase);
  const termIds = terms.map((t) => t.id);
  const termNameById = new Map(terms.map((t) => [t.id, t.name]));
  const showTermLabel = terms.length > 1;

  const { data: staffList } = await supabase
    .from("staff")
    .select("*")
    .order("role")
    .order("name");

  const { data: classes } =
    termIds.length > 0
      ? await supabase
          .from("classes")
          .select("*")
          .in("term_id", termIds)
          .order("type")
          .order("name")
      : { data: [] };

  const { data: permissions } = await supabase
    .from("staff_class_permissions")
    .select("*");
  const permByStaffClass = new Map(
    (permissions ?? []).map((p) => [`${p.staff_id}_${p.class_id}`, p]),
  );
  // 権限データが変わるたびにテーブル・隠しフォームを再マウントさせ、
  // 保存直後のcheckboxが保存前の初期値に戻って見える不具合を防ぐ
  const permKey =
    (permissions ?? [])
      .map((p) => `${p.staff_id}:${p.class_id}:${p.can_input}`)
      .sort()
      .join("|") || "empty";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">教員管理</h1>

      <div key={permKey}>
        {terms.length === 0 ? (
          <p className="mb-2 text-sm text-slate-500">
            アクティブな学期がないため、クラス権限は設定できません。
          </p>
        ) : (classes ?? []).length === 0 ? (
          <p className="mb-2 text-sm text-slate-500">クラスがまだ登録されていません。</p>
        ) : null}

        {/* 教員一覧（氏名・ログインID・役職・削除）は、クラス権限の有無に
            かかわらず常に表示する。クラス権限の列は、アクティブな学期・
            クラスが存在する場合のみ追加で表示する。 */}
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>氏名</th>
                <th className={thClass}>ログインID</th>
                <th className={thClass}>役職</th>
                {(classes ?? []).map((c) => (
                  <th key={c.id} className={thClass}>
                    {c.name}
                    <br />
                    <span className="text-[10px] font-normal text-slate-400">
                      {c.type === "homeroom" ? "ホームルーム" : "選択科目"}
                      {showTermLabel && `／${termNameById.get(c.term_id)}`}
                    </span>
                  </th>
                ))}
                <th className={thClass}></th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {(staffList ?? []).map((s) => (
                <tr key={s.id}>
                  <td className={tdClass}>
                    <Link
                      href={`/staff/${s.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className={tdClass}>{s.login_id}</td>
                  <td className={tdClass}>{ROLE_LABEL[s.role] ?? s.role}</td>
                  {s.role === "admin"
                    ? (classes ?? []).length > 0 && (
                        <td className={tdClass} colSpan={(classes ?? []).length}>
                          <span className="text-xs text-slate-400">
                            管理者は常に全クラスへアクセス可能
                          </span>
                        </td>
                      )
                    : (
                        <PermissionCells
                          staffId={s.id}
                          classes={classes ?? []}
                          permByStaffClass={permByStaffClass}
                        />
                      )}
                  <td className={tdClass}>
                    {s.role !== "admin" && (classes ?? []).length > 0 && (
                      <button
                        type="submit"
                        form={`perm-form-${s.id}`}
                        className={buttonSecondaryClass}
                      >
                        保存
                      </button>
                    )}
                  </td>
                  <td className={tdClass}>
                    {s.id !== actor.id && (
                      <SubmitForm
                        action={deleteStaffAccount}
                        successMessage="教員を削除しました"
                      >
                        <input type="hidden" name="staff_id" value={s.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`${s.name}を削除します。よろしいですか？`}
                          className={buttonDangerClass}
                        >
                          削除
                        </ConfirmSubmitButton>
                      </SubmitForm>
                    )}
                  </td>
                </tr>
              ))}
              {(staffList ?? []).length === 0 && (
                <tr>
                  <td className={tdClass} colSpan={5 + (classes ?? []).length}>
                    教員が登録されていません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 各教員のクラス権限フォーム本体（表の外に配置し、form属性でセル内の入力と紐付ける） */}
        {(classes ?? []).length > 0 &&
          (staffList ?? [])
            .filter((s) => s.role !== "admin")
            .map((s) => (
              <SubmitForm
                key={s.id}
                id={`perm-form-${s.id}`}
                action={savePermissions}
                successMessage="権限を保存しました"
                className="hidden"
              >
                <input type="hidden" name="staff_id" value={s.id} />
              </SubmitForm>
            ))}
      </div>

      <div className={`${cardClass} max-w-md`}>
        <h2 className="mb-3 font-bold text-slate-900">教員アカウントを作成</h2>
        <SubmitForm
          action={createStaffAccount}
          successMessage="教員アカウントを作成しました"
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <label className={labelClass}>氏名</label>
            <input name="name" required className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>ログインID</label>
            <input name="login_id" required className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>初期パスワード（6文字以上）</label>
            <input
              type="text"
              name="password"
              required
              minLength={6}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>役職</label>
            <select name="role" defaultValue="full_time" className={inputClass}>
              <option value="full_time">専任</option>
              <option value="part_time">非常勤</option>
              <option value="admin">管理者</option>
            </select>
          </div>
          <div>
            <button type="submit" className={buttonPrimaryClass}>
              作成
            </button>
          </div>
        </SubmitForm>
      </div>
    </div>
  );
}

function PermissionCells({
  staffId,
  classes,
  permByStaffClass,
}: {
  staffId: string;
  classes: { id: string; name: string }[];
  permByStaffClass: Map<string, { can_input: boolean }>;
}) {
  return (
    <>
      {classes.map((c) => {
        const perm = permByStaffClass.get(`${staffId}_${c.id}`);
        return (
          <td key={c.id} className={`${tdClass} text-center`}>
            <input type="hidden" form={`perm-form-${staffId}`} name="class_id" value={c.id} />
            <label className="inline-flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                form={`perm-form-${staffId}`}
                name={`input_${c.id}`}
                defaultChecked={perm?.can_input ?? false}
              />
              入力可
            </label>
          </td>
        );
      })}
    </>
  );
}
