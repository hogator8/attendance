import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  inputClass,
  labelClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardClass,
  tableClass,
  thClass,
  tdClass,
} from "@/lib/ui";
import { getMonthlyCompletionMatrix } from "@/lib/attendance/completion";
import { todayISO, formatDateLabel, listMonthDates } from "@/lib/date";
import CompletionCheckIcon from "@/components/CompletionCheckIcon";

const ROLE_LABEL: Record<string, string> = {
  admin: "管理者",
  full_time: "専任",
  part_time: "非常勤",
};

export default async function AttendanceLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    date_from?: string;
    date_to?: string;
    class_id?: string;
    staff_id?: string;
    month?: string;
  }>;
}) {
  await requirePermission("can_view_attendance_logs");
  const {
    date_from: dateFrom,
    date_to: dateTo,
    class_id: classId,
    staff_id: staffId,
    month: monthParam,
  } = await searchParams;
  const supabase = await createClient();

  const [{ data: classes }, { data: staffList }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, term:terms(name)")
      .order("name"),
    supabase.from("staff").select("id, name, role").order("role").order("name"),
  ]);

  const today = todayISO();
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const monthDates = listMonthDates(month, today);

  const { data: matrixClasses } = await supabase
    .from("classes")
    .select("id, name, type, term_id, term:terms(name, start_date, end_date)")
    .order("name");

  const relevantClasses = (matrixClasses ?? []).filter((c) => {
    if (monthDates.length === 0 || !c.term) return false;
    return c.term.start_date <= monthDates[monthDates.length - 1] && c.term.end_date >= monthDates[0];
  });

  const matrix =
    relevantClasses.length > 0
      ? await getMonthlyCompletionMatrix(
          supabase,
          relevantClasses.map((c) => ({ id: c.id, type: c.type, term_id: c.term_id })),
          monthDates,
        )
      : new Map<string, Map<string, "complete" | "incomplete" | "none">>();

  let countQuery = supabase
    .from("attendance_input_logs")
    .select("id", { count: "exact", head: true });
  if (dateFrom) countQuery = countQuery.gte("date", dateFrom);
  if (dateTo) countQuery = countQuery.lte("date", dateTo);
  if (classId) countQuery = countQuery.eq("class_id", classId);
  if (staffId) countQuery = countQuery.eq("staff_id", staffId);
  const { count } = await countQuery;

  const exportParams = new URLSearchParams();
  if (dateFrom) exportParams.set("date_from", dateFrom);
  if (dateTo) exportParams.set("date_to", dateTo);
  if (classId) exportParams.set("class_id", classId);
  if (staffId) exportParams.set("staff_id", staffId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">出席入力ログ</h1>
        <p className="text-xs text-slate-500">
          出席入力ページで「保存」が行われるたびに記録される監査ログです。件数が膨大になりうるため、画面上には一覧表示せず、絞り込み条件を指定してCSVでダウンロードしてください。
        </p>
      </div>

      <form className={`${cardClass} flex flex-wrap items-end gap-3`}>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>授業日（開始・任意）</label>
          <input
            type="date"
            name="date_from"
            defaultValue={dateFrom ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>授業日（終了・任意）</label>
          <input type="date" name="date_to" defaultValue={dateTo ?? ""} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>クラス（任意）</label>
          <select
            name="class_id"
            defaultValue={classId ?? ""}
            className={`${inputClass} min-w-[14rem]`}
          >
            <option value="">すべて</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.term?.name ? `（${c.term.name}）` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>担当教員（任意）</label>
          <select
            name="staff_id"
            defaultValue={staffId ?? ""}
            className={`${inputClass} min-w-[12rem]`}
          >
            <option value="">すべて</option>
            {(staffList ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{ROLE_LABEL[s.role] ?? s.role}）
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonSecondaryClass}>
          絞り込み
        </button>
      </form>

      <div className={`${cardClass} max-w-md`}>
        <p className="mb-3 text-sm text-slate-700">
          該当件数：<span className="font-bold">{count ?? 0}</span> 件
        </p>
        <a
          href={`/attendance-logs/export?${exportParams.toString()}`}
          className={`${buttonPrimaryClass} inline-block`}
        >
          CSVダウンロード
        </a>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">月次入力状況一覧</h2>
          <p className="text-xs text-slate-500">
            選択した年月について、授業日・クラスごとに出席入力が完了しているかを一覧表示します（画面表示のみ、CSVダウンロードはありません）。
          </p>
        </div>

        <form className={`${cardClass} flex flex-wrap items-end gap-3`}>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>年月</label>
            <input type="month" name="month" defaultValue={month} className={inputClass} />
          </div>
          <button type="submit" className={buttonSecondaryClass}>
            表示
          </button>
        </form>

        {monthDates.length === 0 ? (
          <p className="text-sm text-slate-500">表示する日付がありません。</p>
        ) : relevantClasses.length === 0 ? (
          <p className="text-sm text-slate-500">
            この年月に対応するクラスがありません。
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={`${thClass} sticky top-0 left-0 z-30 w-28 min-w-28 bg-slate-50`}>
                    日付
                  </th>
                  {relevantClasses.map((c) => (
                    <th key={c.id} className={`${thClass} sticky top-0 z-20 whitespace-nowrap`}>
                      {c.name}
                      {c.term?.name && (
                        <span className="ml-1 text-xs font-normal text-slate-400">
                          （{c.term.name}）
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthDates.map((date) => {
                  const rowStatuses = matrix.get(date);
                  return (
                    <tr key={date}>
                      <td
                        className={`${tdClass} sticky left-0 z-10 w-28 min-w-28 bg-white whitespace-nowrap`}
                      >
                        {formatDateLabel(date)}
                      </td>
                      {relevantClasses.map((c) => {
                        const status = rowStatuses?.get(c.id) ?? "none";
                        return (
                          <td key={c.id} className={`${tdClass} text-center`}>
                            {status === "complete" && (
                              <CompletionCheckIcon
                                className="mx-auto h-5 w-5"
                                title="入力完了"
                              />
                            )}
                            {status === "incomplete" && (
                              <span className="font-bold text-red-600">未</span>
                            )}
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
      </section>
    </div>
  );
}
