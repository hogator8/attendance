import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerm } from "@/lib/terms";
import { todayISO } from "@/lib/date";
import SubmitForm from "@/components/SubmitForm";
import {
  updateStudentInfo,
  updateStudentStatus,
  assignHomeroom,
  assignElective,
  endElective,
} from "./actions";
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

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requireAdmin();
  const { studentId } = await params;
  const supabase = await createClient();
  const today = todayISO();

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) notFound();

  const activeTerm = await getActiveTerm(supabase);
  const { data: homeroomClasses } = activeTerm
    ? await supabase
        .from("classes")
        .select("*")
        .eq("term_id", activeTerm.id)
        .eq("type", "homeroom")
        .order("name")
    : { data: [] };
  const { data: electiveClasses } = activeTerm
    ? await supabase
        .from("classes")
        .select("*")
        .eq("term_id", activeTerm.id)
        .eq("type", "elective")
        .order("name")
    : { data: [] };

  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select("*, class:classes(name)")
    .eq("student_id", studentId)
    .order("valid_from", { ascending: false });
  const currentEnrollment = enrollments?.find((e) => e.valid_to === null);

  const { data: electiveMemberships } = await supabase
    .from("elective_memberships")
    .select("*, class:classes(name)")
    .eq("student_id", studentId)
    .order("valid_from", { ascending: false });
  const activeMemberships = (electiveMemberships ?? []).filter(
    (m) => m.valid_to === null || m.valid_to >= today,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/students" className="text-sm text-blue-600 hover:underline">
          ← 生徒一覧に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          {student.name}（{student.student_number}）
        </h1>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className={`${cardClass} flex max-w-md flex-1 flex-col gap-4`}>
          <h2 className="font-bold text-slate-900">基本情報</h2>
          <div className="flex items-center gap-4">
            {student.photo_url ? (
              <Image
                src={student.photo_url}
                alt={student.name}
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">
                写真なし
              </span>
            )}
          </div>
          <SubmitForm
            action={updateStudentInfo}
            successMessage="保存しました"
            encType="multipart/form-data"
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="student_id" value={student.id} />
            <div className="flex flex-col gap-1">
              <label className={labelClass}>学籍番号</label>
              <input
                name="student_number"
                defaultValue={student.student_number}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>氏名</label>
              <input
                name="name"
                defaultValue={student.name}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>フリガナ</label>
              <input
                name="furigana"
                defaultValue={student.furigana}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>入学日</label>
              <input
                type="date"
                name="enrollment_date"
                defaultValue={student.enrollment_date}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>写真を変更</label>
              <input type="file" name="photo" accept="image/*" className="text-sm" />
            </div>
            <div>
              <button type="submit" className={buttonPrimaryClass}>
                保存
              </button>
            </div>
          </SubmitForm>
        </div>

        <div className={`${cardClass} max-w-md flex-1`}>
          <h2 className="mb-3 font-bold text-slate-900">ステータス</h2>
          <SubmitForm
            action={updateStudentStatus}
            successMessage="ステータスを更新しました"
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="student_id" value={student.id} />
            <div className="flex flex-col gap-1">
              <label className={labelClass}>状態</label>
              <select
                name="status"
                defaultValue={student.status}
                className={inputClass}
              >
                <option value="enrolled">在籍</option>
                <option value="graduated">卒業</option>
                <option value="withdrawn">退学</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>卒業日／退学日</label>
              <input
                type="date"
                name="status_date"
                defaultValue={student.status_date ?? ""}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>備考（退学理由等）</label>
              <textarea
                name="status_note"
                defaultValue={student.status_note ?? ""}
                rows={2}
                className={inputClass}
              />
            </div>
            <div>
              <button type="submit" className={buttonSecondaryClass}>
                ステータスを更新
              </button>
            </div>
          </SubmitForm>
        </div>
      </div>

      <section className={cardClass}>
        <h2 className="mb-1 font-bold text-slate-900">ホームルームクラス</h2>
        <p className="mb-3 text-sm text-slate-600">
          現在の所属：
          {currentEnrollment ? (
            <span className="font-medium">
              {" "}
              {currentEnrollment.class?.name}（{currentEnrollment.valid_from}〜）
            </span>
          ) : (
            " 未配属"
          )}
        </p>

        {activeTerm ? (
          <SubmitForm
            action={assignHomeroom}
            successMessage="クラス配属を更新しました"
            className="mb-4 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="student_id" value={student.id} />
            <div className="flex flex-col gap-1">
              <label className={labelClass}>クラス</label>
              <select name="class_id" required className={inputClass}>
                <option value="">選択してください</option>
                {(homeroomClasses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>出席番号</label>
              <input
                type="number"
                name="seq_no"
                min={1}
                className={`${inputClass} w-20`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>配属開始日</label>
              <input
                type="date"
                name="valid_from"
                required
                defaultValue={today}
                className={inputClass}
              />
            </div>
            <button type="submit" className={buttonPrimaryClass}>
              配属・クラス異動
            </button>
          </SubmitForm>
        ) : (
          <p className="mb-4 text-xs text-slate-500">
            アクティブな学期がないため、クラス配属はできません。
          </p>
        )}

        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>クラス</th>
              <th className={thClass}>出席番号</th>
              <th className={thClass}>期間</th>
            </tr>
          </thead>
          <tbody>
            {(enrollments ?? []).map((e) => (
              <tr key={e.id}>
                <td className={tdClass}>{e.class?.name}</td>
                <td className={tdClass}>{e.seq_no ?? "-"}</td>
                <td className={tdClass}>
                  {e.valid_from} 〜 {e.valid_to ?? "現在"}
                </td>
              </tr>
            ))}
            {(enrollments ?? []).length === 0 && (
              <tr>
                <td className={tdClass} colSpan={3}>
                  配属履歴がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className={cardClass}>
        <h2 className="mb-3 font-bold text-slate-900">選択科目</h2>

        {activeMemberships.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {activeMemberships.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <span>
                  {m.class?.name}（{m.valid_from}〜）
                </span>
                <SubmitForm
                  action={endElective}
                  successMessage="選択科目を終了しました"
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="membership_id" value={m.id} />
                  <input type="hidden" name="student_id" value={student.id} />
                  <input
                    type="date"
                    name="valid_to"
                    defaultValue={today}
                    className={`${inputClass} w-36`}
                  />
                  <button type="submit" className={buttonSecondaryClass}>
                    終了
                  </button>
                </SubmitForm>
              </li>
            ))}
          </ul>
        )}

        {activeTerm ? (
          <SubmitForm
            action={assignElective}
            successMessage="選択科目を追加しました"
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="student_id" value={student.id} />
            <div className="flex flex-col gap-1">
              <label className={labelClass}>選択科目</label>
              <select name="class_id" required className={inputClass}>
                <option value="">選択してください</option>
                {(electiveClasses ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>開始日</label>
              <input
                type="date"
                name="valid_from"
                required
                defaultValue={today}
                className={inputClass}
              />
            </div>
            <button type="submit" className={buttonPrimaryClass}>
              追加
            </button>
          </SubmitForm>
        ) : (
          <p className="text-xs text-slate-500">
            アクティブな学期がないため、選択科目の割当はできません。
          </p>
        )}
      </section>
    </div>
  );
}
