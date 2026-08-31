import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCertificateData, getSchoolSettings } from "@/lib/certificate/data";
import { saveSchoolSettings, saveLongVacation } from "./actions";
import SubmitForm from "@/components/SubmitForm";
import {
  inputClass,
  labelClass,
  buttonSecondaryClass,
  buttonPrimaryClass,
  cardClass,
  tableClass,
  thClass,
  tdClass,
} from "@/lib/ui";

const GENDER_LABEL: Record<string, string> = {
  male: "男",
  female: "女",
  男: "男",
  女: "女",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
function fmtHours(n: number): string {
  return `${n.toFixed(1)}時間`;
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ student_id?: string }>;
}) {
  const staff = await requirePermission("can_view_individual_records");
  const { student_id: studentId } = await searchParams;
  const supabase = await createClient();

  const [{ data: students }, school] = await Promise.all([
    supabase.from("students").select("id, student_number, name").order("student_number"),
    getSchoolSettings(supabase),
  ]);

  const data = studentId ? await getCertificateData(supabase, studentId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">証明書</h1>
        <p className="text-xs text-slate-500">
          学生を選択すると出席証明書のプレビューを確認できます。特記事項を入力のうえ、PDFまたはExcelでダウンロードしてください。
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

      {studentId && !data && (
        <p className="text-sm text-amber-700">学生が見つかりません。</p>
      )}

      {data && (
        <>
          <div className={`${cardClass} max-w-3xl`}>
            <h2 className="mb-2 font-bold text-slate-900">
              {data.student.name}（{data.student.student_number}）
            </h2>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">国籍</p>
                <p>{data.student.nationality ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">性別</p>
                <p>
                  {data.student.gender
                    ? GENDER_LABEL[data.student.gender] ?? data.student.gender
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">生年月日</p>
                <p>{fmtDate(data.student.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">入学年月日</p>
                <p>{fmtDate(data.student.enrollment_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">卒業予定年月日</p>
                <p>{fmtDate(data.student.expected_graduation_date)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-slate-500">累計授業時間数</p>
                <p className="text-lg font-bold text-slate-900">
                  {fmtHours(data.cumulativeCourseHours)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">累計出席時間数</p>
                <p className="text-lg font-bold text-slate-900">
                  {fmtHours(data.cumulativeAttendanceHours)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">累計出席率</p>
                <p className="text-lg font-bold text-slate-900">
                  {fmtPct(data.cumulativeRate)}
                </p>
              </div>
            </div>
          </div>

          <section>
            <h2 className="mb-2 font-bold text-slate-900">月別出席状況（入学年月から24ヶ月）</h2>
            <div className="flex flex-col gap-4">
              {data.monthBlocks.map((block, i) => (
                <div key={i} className="overflow-x-auto">
                  <table className={tableClass}>
                    <thead>
                      <tr>
                        <th className={thClass}>{block[0]?.year}年</th>
                        {block.map((c) => (
                          <th key={c.month} className={thClass}>
                            {c.month}月
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={`${tdClass} font-medium`}>授業時間数</td>
                        {block.map((c) => (
                          <td key={c.month} className={tdClass}>
                            {c.courseHours.toFixed(1)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className={`${tdClass} font-medium`}>出席時間数</td>
                        {block.map((c) => (
                          <td key={c.month} className={tdClass}>
                            {c.attendanceHours.toFixed(1)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className={`${tdClass} font-medium`}>出席率</td>
                        {block.map((c) => (
                          <td key={c.month} className={tdClass}>
                            {c.courseHours > 0 ? fmtPct(c.rate) : "-"}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          <section className={`${cardClass} max-w-3xl`}>
            <h2 className="mb-3 font-bold text-slate-900">発行</h2>
            <form className="flex flex-col gap-3">
              <input type="hidden" name="student_id" value={studentId} />
              <div className="flex flex-col gap-1">
                <label className={labelClass}>特記事項（発行の都度入力）</label>
                <textarea
                  name="remarks"
                  rows={3}
                  className={inputClass}
                  placeholder="必要に応じて記入してください"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>長期休暇</label>
                <textarea
                  name="long_vacation"
                  rows={3}
                  defaultValue={school.longVacation}
                  className={inputClass}
                  placeholder="必要に応じて記入してください"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  formAction="/certificates/pdf"
                  className={buttonPrimaryClass}
                >
                  PDFダウンロード
                </button>
                <button
                  type="submit"
                  formAction="/certificates/excel"
                  className={buttonSecondaryClass}
                >
                  Excelダウンロード
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {staff.role === "admin" && (
        <section className={`${cardClass} max-w-xl`}>
          <h2 className="mb-1 font-bold text-slate-900">発行者情報設定</h2>
          <p className="mb-3 text-xs text-slate-500">
            証明書に印字される学校名・住所・電話番号・校長名です。ここで保存した内容は次回以降の発行にも使い回されます。
          </p>
          <SubmitForm
            action={saveSchoolSettings}
            successMessage="発行者情報を保存しました"
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1">
              <label className={labelClass}>学校名</label>
              <input name="school_name" defaultValue={school.schoolName} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>学校住所</label>
              <input
                name="school_address"
                defaultValue={school.schoolAddress}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>学校電話番号</label>
              <input name="school_phone" defaultValue={school.schoolPhone} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>校長名</label>
              <input
                name="principal_name"
                defaultValue={school.principalName}
                className={inputClass}
              />
            </div>
            <div>
              <button type="submit" className={buttonPrimaryClass}>
                保存
              </button>
            </div>
          </SubmitForm>
        </section>
      )}

      {staff.role === "admin" && (
        <section className={`${cardClass} max-w-xl`}>
          <h2 className="mb-1 font-bold text-slate-900">長期休暇設定</h2>
          <p className="mb-3 text-xs text-slate-500">
            ここで保存した内容が、証明書発行時の「長期休暇」欄の初期値として反映されます。発行時に個別に修正することもできます。
          </p>
          <SubmitForm
            action={saveLongVacation}
            successMessage="長期休暇設定を保存しました"
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1">
              <label className={labelClass}>長期休暇</label>
              <textarea
                name="long_vacation"
                rows={3}
                defaultValue={school.longVacation}
                className={inputClass}
              />
            </div>
            <div>
              <button type="submit" className={buttonPrimaryClass}>
                保存
              </button>
            </div>
          </SubmitForm>
        </section>
      )}
    </div>
  );
}
