import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions";
import SubmitForm from "@/components/SubmitForm";
import FileInputButton from "@/components/FileInputButton";
import {
  importHistoricalMonthlySummariesCsv,
  importHistoricalAttendanceCsv,
} from "./actions";
import { cardClass, inputClass, buttonPrimaryClass } from "@/lib/ui";

export default async function CsvImportPage() {
  const staff = await requireStaff();
  const supabase = await createClient();

  const canManageStudents = await hasPermission(supabase, staff, "can_manage_students");

  // 詳細パターンの取り込み先クラス候補：過去の学期を含む全クラスのうち、
  // 出席入力権限があるもの（adminは全クラス）。
  const { data: allClasses } = await supabase
    .from("classes")
    .select("*, term:terms(name, start_date)")
    .order("type")
    .order("name");

  let inputtableClasses = allClasses ?? [];
  if (staff.role !== "admin") {
    const { data: perms } = await supabase
      .from("staff_class_permissions")
      .select("class_id")
      .eq("staff_id", staff.id)
      .eq("can_input", true);
    const allowedIds = new Set((perms ?? []).map((p) => p.class_id));
    inputtableClasses = inputtableClasses.filter((c) => allowedIds.has(c.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">CSV読み込み</h1>
        <p className="text-xs text-slate-500">
          過去の出席データを取り込みます。標準パターン（月別集計のみ）と詳細パターン（日次データ）のどちらかを選んでください。
          取り込んだデータは集計画面の累計出席率（入学からの通算出席率）に合算されます。
        </p>
      </div>

      <div className={`${cardClass} max-w-2xl`}>
        <h2 className="mb-1 font-bold text-slate-900">標準パターン（月別集計のみ）</h2>
        <p className="mb-3 text-xs text-slate-500">
          日次データを持たず、学生×年月ごとの集計値のみを取り込みます。この月は集計画面の月別出席率にもそのまま反映されます（日次ドリルダウンは行いません）。
          <br />
          「学籍番号,年月(YYYY-MM),要出席日数,出席日数,欠席日数,遅刻回数,早退回数,公欠日数,除外日数」の形式のCSVファイルを選択してください。
          <br />
          <Link
            href="/csv-import/templates/monthly"
            className="text-blue-600 underline"
          >
            テンプレートCSVをダウンロード
          </Link>
        </p>
        {canManageStudents ? (
          <SubmitForm
            action={importHistoricalMonthlySummariesCsv}
            successMessage="月別集計を取り込みました"
            encType="multipart/form-data"
            className="flex flex-col gap-3"
          >
            <FileInputButton name="csv" accept=".csv,text/csv" />
            <div>
              <button type="submit" className={buttonPrimaryClass}>
                取り込む
              </button>
            </div>
          </SubmitForm>
        ) : (
          <p className="text-sm text-slate-500">この操作を行う権限がありません。</p>
        )}
      </div>

      <div className={`${cardClass} max-w-2xl`}>
        <h2 className="mb-1 font-bold text-slate-900">詳細パターン（日次データ）</h2>
        <p className="mb-3 text-xs text-slate-500">
          出席記号設定の記号を使って、日次の出席データをそのまま取り込みます。
          <br />
          「学籍番号,日付(YYYY-MM-DD),時限,記号,時刻(任意),理由(任意)」の形式のCSVファイルを選択してください。記号は取り込み先クラスの学期の出席記号設定と一致させてください。
          <br />
          <Link href="/csv-import/templates/daily" className="text-blue-600 underline">
            テンプレートCSVをダウンロード
          </Link>
        </p>
        {inputtableClasses.length === 0 ? (
          <p className="text-sm text-slate-500">
            出席入力権限のあるクラスがありません。管理者に権限設定を依頼してください。
          </p>
        ) : (
          <SubmitForm
            action={importHistoricalAttendanceCsv}
            successMessage="日次データを取り込みました"
            encType="multipart/form-data"
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">取り込み先クラス</label>
              <select name="class_id" required className={inputClass}>
                <option value="">選択してください</option>
                {inputtableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}（{c.term?.name ?? "-"}）
                  </option>
                ))}
              </select>
            </div>
            <FileInputButton name="csv" accept=".csv,text/csv" />
            <div>
              <button type="submit" className={buttonPrimaryClass}>
                取り込む
              </button>
            </div>
          </SubmitForm>
        )}
      </div>
    </div>
  );
}
