import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getStudentAttendanceStatus,
  buildDetailColumns,
  resolveDetailColumns,
} from "./data";
import { formatPercent } from "@/lib/attendance/calc";
import { inputClass, buttonSecondaryClass, cardClass, tableClass, thClass, tdClass } from "@/lib/ui";

export default async function AttendanceStatusPage({
  searchParams,
}: {
  searchParams: Promise<{
    student_id?: string;
    col?: string | string[];
    cols_submitted?: string;
  }>;
}) {
  await requirePermission("can_view_individual_records");
  const { student_id: studentId, col, cols_submitted } = await searchParams;
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("id, student_number, name")
    .order("student_number");

  const { data: student } = studentId
    ? await supabase
        .from("students")
        .select("*, category:student_categories(name)")
        .eq("id", studentId)
        .maybeSingle()
    : { data: null };

  const status = student ? await getStudentAttendanceStatus(supabase, student.id) : null;
  const detailColumnDefs = status
    ? buildDetailColumns(status, 1, {
        nationality: student!.nationality,
        categoryName: student!.category?.name ?? null,
      })
    : [];
  const selectedColKeys = col ? (Array.isArray(col) ? col : [col]) : undefined;
  const detailColumns = resolveDetailColumns(
    detailColumnDefs,
    cols_submitted ? selectedColKeys : undefined,
  );
  const selectedKeySet = new Set(detailColumns.map((c) => c.key));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">出席状況</h1>
        <p className="text-xs text-slate-500">
          学生を選択すると、入学からの通算出席率・月別出席率・日々の記録を確認できます。
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">学生</label>
          <select
            name="student_id"
            defaultValue={studentId ?? ""}
            className={`${inputClass} min-w-[16rem]`}
          >
            <option value="">選択してください</option>
            {(students ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.student_number} － {s.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonSecondaryClass}>
          表示
        </button>
      </form>

      {student && status && (
        <>
          <div className={`${cardClass} max-w-2xl`}>
            <h2 className="mb-1 font-bold text-slate-900">
              {student.name}（{student.student_number}）
            </h2>
            <p className="text-xs text-slate-500">
              入学日：{student.enrollment_date}
              {student.nationality && <> ／ 国籍：{student.nationality}</>}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">累計要出席時数</p>
                <p className="text-lg font-bold text-slate-900">{status.cumulative.reqDays}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">累計出席率（入学からの通算）</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatPercent(status.cumulative.rate, 1)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">累計欠席時数</p>
                <p className="text-lg font-bold text-slate-900">
                  {status.cumulative.rawAbsCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">累計遅刻回数</p>
                <p className="text-lg font-bold text-slate-900">{status.cumulative.lateCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">累計早退回数</p>
                <p className="text-lg font-bold text-slate-900">{status.cumulative.earlyCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">累計公欠時数</p>
                <p className="text-lg font-bold text-slate-900">
                  {status.cumulative.excusedCount}
                </p>
              </div>
            </div>
          </div>

          <section>
            <h2 className="mb-2 font-bold text-slate-900">月別出席率</h2>
            {status.monthlyRows.length === 0 ? (
              <p className="text-sm text-slate-500">記録がありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>年月</th>
                      <th className={thClass}>出席率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.monthlyRows.map((m) => (
                      <tr key={m.key}>
                        <td className={tdClass}>{m.label}</td>
                        <td className={tdClass}>{formatPercent(m.rate, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-bold text-slate-900">詳細</h2>
            <form action="/attendance-status" className="mb-3 flex flex-col gap-3">
              <input type="hidden" name="student_id" value={studentId} />
              <details className="rounded-lg border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">
                  表示する項目を選択
                </summary>
                <input type="hidden" name="cols_submitted" value="1" />
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                  {detailColumnDefs.map((c) => (
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
                    項目を反映
                  </button>
                </div>
              </details>
            </form>

            {detailColumns.length === 0 ? (
              <p className="text-sm text-slate-500">表示する項目を選択してください。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      {detailColumns.map((c) => (
                        <th key={c.key} className={thClass}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {detailColumns.map((c) => (
                        <td key={c.key} className={tdClass}>
                          {c.value}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-900">日々の記録</h2>
              {status.dailyRecords.length > 0 && (
                <Link
                  href={`/attendance-status/export?student_id=${studentId}`}
                  className={buttonSecondaryClass}
                >
                  CSVダウンロード
                </Link>
              )}
            </div>
            {status.dailyRecords.length === 0 ? (
              <p className="text-sm text-slate-500">記録がありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>日付</th>
                      <th className={thClass}>クラス</th>
                      <th className={thClass}>時限</th>
                      <th className={thClass}>記号</th>
                      <th className={thClass}>時刻</th>
                      <th className={thClass}>理由</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.dailyRecords.map((r, i) => (
                      <tr key={`${r.date}_${r.periodNo}_${i}`}>
                        <td className={tdClass}>{r.date}</td>
                        <td className={tdClass}>{r.className}</td>
                        <td className={tdClass}>{r.periodNo}</td>
                        <td className={tdClass}>
                          {r.symbolChar}（{r.symbolLabel}）
                        </td>
                        <td className={tdClass}>{r.timeValue ?? "-"}</td>
                        <td className={tdClass}>{r.reason ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
