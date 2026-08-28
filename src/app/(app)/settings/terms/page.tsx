import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SubmitForm from "@/components/SubmitForm";
import { createTerm, setTermActive } from "./actions";
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

export default async function TermsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: terms } = await supabase
    .from("terms")
    .select("*")
    .order("start_date", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-slate-900">学期管理</h1>

      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>学期名</th>
              <th className={thClass}>授業期間</th>
              <th className={thClass}>状態</th>
              <th className={thClass}>設定</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {(terms ?? []).map((term) => (
              <tr key={term.id}>
                <td className={tdClass}>{term.name}</td>
                <td className={tdClass}>
                  {term.start_date} 〜 {term.end_date}
                </td>
                <td className={tdClass}>
                  {term.is_active ? (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      アクティブ
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className={tdClass}>
                  <Link
                    href={`/settings/terms/${term.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    記号・行事・休業日など
                  </Link>
                </td>
                <td className={tdClass}>
                  <SubmitForm
                    action={setTermActive}
                    successMessage={
                      term.is_active
                        ? "学期を非アクティブにしました"
                        : "学期をアクティブにしました"
                    }
                  >
                    <input type="hidden" name="term_id" value={term.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={term.is_active ? "false" : "true"}
                    />
                    <button type="submit" className={buttonSecondaryClass}>
                      {term.is_active ? "非アクティブにする" : "アクティブにする"}
                    </button>
                  </SubmitForm>
                </td>
              </tr>
            ))}
            {(terms ?? []).length === 0 && (
              <tr>
                <td className={tdClass} colSpan={5}>
                  学期がまだ登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={`${cardClass} max-w-lg`}>
        <h2 className="mb-3 font-bold text-slate-900">新しい学期を作成</h2>
        <SubmitForm
          action={createTerm}
          successMessage="学期を作成しました"
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <label className={labelClass}>学期名</label>
            <input
              name="name"
              required
              placeholder="例：2027年度"
              className={inputClass}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className={labelClass}>授業開始日</label>
              <input
                type="date"
                name="start_date"
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className={labelClass}>授業終了日</label>
              <input
                type="date"
                name="end_date"
                required
                className={inputClass}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="activate" />
            作成後、この学期をアクティブにする
          </label>
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
