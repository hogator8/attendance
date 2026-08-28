import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import {
  getClassSummaryData,
  buildColumnDefs,
  resolveSelectedColumns,
  getCellValue,
} from "./data";
import { colorForRate } from "@/lib/attendance/calc";
import { inputClass, buttonSecondaryClass, buttonPrimaryClass, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function SummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    col?: string | string[];
    cols_submitted?: string;
  }>;
}) {
  const staff = await requireStaff();
  const { classId } = await params;
  const { from, to, col, cols_submitted } = await searchParams;
  const supabase = await createClient();

  const allowed = await hasPermission(supabase, staff, "can_view_summary");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        このクラスの集計を閲覧する権限がありません。
        <Link href="/summary" className="ml-1 underline">
          集計トップに戻る
        </Link>
      </div>
    );
  }

  const data = await getClassSummaryData(supabase, classId, { from, to });
  if (!data) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        クラスが見つかりません。
      </div>
    );
  }
  const { cls, term, rosterList, summaryByStudent, colorRules, decimalDigits, periodFrom, periodTo } = data;

  const columnDefs = buildColumnDefs(data.symbolRows, data.months);
  const selectedColKeys = col ? (Array.isArray(col) ? col : [col]) : undefined;
  const columns = resolveSelectedColumns(
    columnDefs,
    cols_submitted ? selectedColKeys : undefined,
  );
  const selectedKeySet = new Set(columns.map((c) => c.key));

  const exportParams = new URLSearchParams();
  exportParams.set("from", periodFrom);
  exportParams.set("to", periodTo);
  exportParams.set("cols_submitted", "1");
  for (const c of columns) exportParams.append("col", c.key);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/summary" className="text-sm text-blue-600 hover:underline">
          ← クラス選択に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{cls.name} － 集計</h1>
        <p className="text-xs text-slate-500">学期：{term.name}</p>
      </div>

      <form action={`/summary/${classId}`} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">累計対象期間（開始）</label>
            <input type="date" name="from" defaultValue={periodFrom} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">累計対象期間（終了）</label>
            <input type="date" name="to" defaultValue={periodTo} className={inputClass} />
          </div>
          <button type="submit" className={buttonSecondaryClass}>
            表示
          </button>
          <Link href={`/summary/${classId}`} className="text-xs text-slate-400 underline">
            学期全体にリセット
          </Link>
          <Link
            href={`/summary/${classId}/export?${exportParams.toString()}`}
            className={buttonPrimaryClass}
          >
            Excelダウンロード
          </Link>
        </div>

        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">
            表示する列を選択
          </summary>
          <input type="hidden" name="cols_submitted" value="1" />
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
            {columnDefs.map((c) => (
              <label key={c.key} className="inline-flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  name="col"
                  value={c.key}
                  defaultChecked={selectedKeySet.has(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
          <div className="mt-3">
            <button type="submit" className={buttonSecondaryClass}>
              列を反映
            </button>
          </div>
        </details>
      </form>

      {rosterList.length === 0 ? (
        <p className="text-sm text-slate-500">対象の学生がいません。</p>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th
                  className={`${thClass} sticky top-0 left-0 z-30 w-28 min-w-28`}
                >
                  学籍番号
                </th>
                <th
                  className={`${thClass} sticky top-0 left-28 z-30 w-48 min-w-48`}
                >
                  氏名
                </th>
                <th
                  className={`${thClass} sticky top-0 left-[19rem] z-30 w-48 min-w-48`}
                >
                  フリガナ
                </th>
                {columns.map((c) => (
                  <th key={c.key} className={`${thClass} sticky top-0 z-20`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rosterList.map((student) => {
                const summary = summaryByStudent.get(student.id);
                return (
                  <tr key={student.id}>
                    <td className={`${tdClass} sticky left-0 z-10 w-28 min-w-28 bg-white`}>
                      {student.student_number}
                    </td>
                    <td className={`${tdClass} sticky left-28 z-10 w-48 min-w-48 bg-white`}>
                      {student.name}
                    </td>
                    <td className={`${tdClass} sticky left-[19rem] z-10 w-48 min-w-48 bg-white`}>
                      {student.furigana}
                    </td>
                    {columns.map((c) => {
                      const isRateColumn = c.key.endsWith("_rate");
                      const value = getCellValue(c.key, student, summary, decimalDigits);
                      let color: string | null = null;
                      if (isRateColumn && summary) {
                        // 要出席日数が0日の場合は「全欠席で出席率0%」と区別するため、
                        // 出席率の色分けは適用しない（無色のまま表示する）
                        const stats =
                          c.key === "cum_rate"
                            ? summary.cumulative
                            : summary.months.find(
                                (m) => `month_${m.year}_${m.month}_rate` === c.key,
                              );
                        if (stats && stats.reqDays > 0) {
                          color = colorForRate(stats.rate, colorRules);
                        }
                      }
                      return (
                        <td
                          key={c.key}
                          className={tdClass}
                          style={color ? { backgroundColor: color } : undefined}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
