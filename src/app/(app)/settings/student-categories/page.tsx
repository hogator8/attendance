import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SubmitForm from "@/components/SubmitForm";
import { saveStudentCategories } from "./actions";
import { cardClass, inputClass, buttonPrimaryClass } from "@/lib/ui";

export default async function StudentCategoriesSettingsPage() {
  await requirePermission("can_manage_settings");
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("student_categories")
    .select("*")
    .order("order_no");

  const rows = Array.from({ length: 10 }, (_, i) => {
    const orderNo = i + 1;
    return categories?.find((c) => c.order_no === orderNo) ?? null;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/settings" className="text-sm text-blue-600 hover:underline">
          ← 設定に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">学生区分設定</h1>
        <p className="text-xs text-slate-500">
          長期生・短期生（科目履修生）など、学期をまたいで学校全体で共通の区分名を設定します。
        </p>
      </div>

      <section className={`${cardClass} max-w-xl`}>
        <h2 className="mb-1 font-bold text-slate-900">学生区分（最大10種類）</h2>
        <p className="mb-3 text-xs text-slate-500">
          区分名を入力した行のみ有効になります。保存すると既存の設定を置き換えます。
        </p>
        <SubmitForm
          action={saveStudentCategories}
          successMessage="学生区分を保存しました"
          className="flex flex-col gap-4"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">#</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-left">区分名</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const n = i + 1;
                  return (
                    <tr key={n}>
                      <td className="border-b border-slate-100 px-2 py-1.5">{n}</td>
                      <td className="border-b border-slate-100 px-2 py-1.5">
                        <input
                          name={`name_${n}`}
                          defaultValue={row?.name ?? ""}
                          placeholder="例：長期生"
                          className={`${inputClass} w-48`}
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
              学生区分を保存
            </button>
          </div>
        </SubmitForm>
      </section>
    </div>
  );
}
