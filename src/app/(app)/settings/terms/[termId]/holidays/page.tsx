import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addHoliday, deleteHoliday, importHolidaysCsv } from "./actions";
import {
  cardClass,
  inputClass,
  labelClass,
  buttonPrimaryClass,
  buttonDangerClass,
  tableClass,
  thClass,
  tdClass,
} from "@/lib/ui";

export default async function HolidaysSettingsPage({
  params,
}: {
  params: Promise<{ termId: string }>;
}) {
  await requireAdmin();
  const { termId } = await params;
  const supabase = await createClient();

  const [{ data: term }, { data: holidays }] = await Promise.all([
    supabase.from("terms").select("*").eq("id", termId).maybeSingle(),
    supabase
      .from("holidays")
      .select("*")
      .eq("term_id", termId)
      .order("date"),
  ]);

  if (!term) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/settings/terms/${termId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← {term.name} の設定に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          休業日設定（{term.name}）
        </h1>
        <p className="text-xs text-slate-500">
          登録件数の上限はありません。ここに登録した日は、出席簿作成時に通常の時間割ではなく休業日として扱われます。
        </p>
      </div>

      <div className={`${cardClass} max-w-lg`}>
        <h2 className="mb-3 font-bold text-slate-900">休業日を追加</h2>
        <form action={addHoliday} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="term_id" value={termId} />
          <div className="flex flex-col gap-1">
            <label className={labelClass}>日付</label>
            <input type="date" name="date" required className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>項目名</label>
            <input
              name="label"
              required
              placeholder="例：夏季休暇"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>色（任意）</label>
            <input
              type="color"
              name="color_hex"
              defaultValue="#FFCCCC"
              className="h-9 w-14"
            />
          </div>
          <button type="submit" className={buttonPrimaryClass}>
            追加
          </button>
        </form>
      </div>

      <div className={`${cardClass} max-w-lg`}>
        <h2 className="mb-1 font-bold text-slate-900">CSV一括登録</h2>
        <p className="mb-3 text-xs text-slate-500">
          1行につき「YYYY-MM-DD,項目名,色(任意・#RRGGBB)」の形式で入力してください。
        </p>
        <form action={importHolidaysCsv} className="flex flex-col gap-3">
          <input type="hidden" name="term_id" value={termId} />
          <textarea
            name="csv"
            rows={5}
            placeholder={"2026-08-01,夏季休暇,#fde68a\n2026-08-02,夏季休暇,#fde68a"}
            className={`${inputClass} font-mono`}
          />
          <div>
            <button type="submit" className={buttonPrimaryClass}>
              一括登録
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>日付</th>
              <th className={thClass}>項目名</th>
              <th className={thClass}>色</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {(holidays ?? []).map((h) => (
              <tr key={h.id}>
                <td className={tdClass}>{h.date}</td>
                <td className={tdClass}>{h.label}</td>
                <td className={tdClass}>
                  {h.color_hex && (
                    <span
                      className="inline-block h-4 w-8 rounded border border-slate-300 align-middle"
                      style={{ backgroundColor: h.color_hex }}
                    />
                  )}
                </td>
                <td className={tdClass}>
                  <form action={deleteHoliday}>
                    <input type="hidden" name="id" value={h.id} />
                    <input type="hidden" name="term_id" value={termId} />
                    <button type="submit" className={buttonDangerClass}>
                      削除
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(holidays ?? []).length === 0 && (
              <tr>
                <td className={tdClass} colSpan={4}>
                  休業日はまだ登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
