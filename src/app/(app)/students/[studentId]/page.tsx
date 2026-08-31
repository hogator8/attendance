import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveTerms } from "@/lib/terms";
import { todayISO } from "@/lib/date";
import SubmitForm from "@/components/SubmitForm";
import FileInputButton from "@/components/FileInputButton";
import {
  updateStudentInfo,
  updateStudentStatus,
  assignHomeroom,
  endHomeroomEnrollment,
  editHomeroomEnrollment,
  deleteHomeroomEnrollment,
  assignElective,
  endElective,
  editElective,
  deleteElective,
} from "./actions";
import {
  cardClass,
  inputClass,
  labelClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  buttonDangerClass,
} from "@/lib/ui";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requirePermission("can_manage_students");
  const { studentId } = await params;
  const supabase = await createClient();
  const today = todayISO();

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) notFound();

  const { data: categories } = await supabase
    .from("student_categories")
    .select("*")
    .order("order_no");

  const activeTerms = await getActiveTerms(supabase);
  const activeTermIds = activeTerms.map((t) => t.id);
  const { data: homeroomClasses } =
    activeTermIds.length > 0
      ? await supabase
          .from("classes")
          .select("*")
          .in("term_id", activeTermIds)
          .eq("type", "homeroom")
          .order("name")
      : { data: [] };
  const { data: electiveClasses } =
    activeTermIds.length > 0
      ? await supabase
          .from("classes")
          .select("*")
          .in("term_id", activeTermIds)
          .eq("type", "elective")
          .order("name")
      : { data: [] };

  const { data: enrollments } = await supabase
    .from("class_enrollments")
    .select("*, class:classes(name)")
    .eq("student_id", studentId)
    .order("valid_from", { ascending: false });
  const currentEnrollment = enrollments?.find(
    (e) => e.valid_to === null || e.valid_to >= today,
  );

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
          ← 学生一覧に戻る
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
              <label className={labelClass}>国籍（任意）</label>
              <input
                name="nationality"
                defaultValue={student.nationality ?? ""}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>性別（任意）</label>
              <input
                name="gender"
                defaultValue={student.gender ?? ""}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>生年月日（任意）</label>
              <input
                type="date"
                name="date_of_birth"
                defaultValue={student.date_of_birth ?? ""}
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
              <label className={labelClass}>卒業予定年月日（任意）</label>
              <input
                type="date"
                name="expected_graduation_date"
                defaultValue={student.expected_graduation_date ?? ""}
                className={inputClass}
              />
            </div>
            {(categories ?? []).length > 0 && (
              <div className="flex flex-col gap-1">
                <label className={labelClass}>学生区分（任意）</label>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="category_id"
                      value=""
                      defaultChecked={!student.category_id}
                    />
                    未設定
                  </label>
                  {(categories ?? []).map((c) => (
                    <label key={c.id} className="inline-flex items-center gap-1 text-sm">
                      <input
                        type="radio"
                        name="category_id"
                        value={c.id}
                        defaultChecked={student.category_id === c.id}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className={labelClass}>写真を変更</label>
              <FileInputButton name="photo" accept="image/*" />
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

        {currentEnrollment && (
          <SubmitForm
            action={endHomeroomEnrollment}
            successMessage="配属を解除しました"
            className="mb-4 flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="enrollment_id" value={currentEnrollment.id} />
            <input type="hidden" name="student_id" value={student.id} />
            <div className="flex flex-col gap-1">
              <label className={labelClass}>配属解除日</label>
              <input
                type="date"
                name="valid_to"
                defaultValue={today}
                className={`${inputClass} w-36`}
              />
            </div>
            <button type="submit" className={buttonSecondaryClass}>
              配属解除
            </button>
          </SubmitForm>
        )}

        {activeTerms.length > 0 ? (
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
            <div className="flex flex-col gap-1">
              <label className={labelClass}>配属終了日（任意）</label>
              <input type="date" name="valid_to" className={inputClass} />
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

        <div className="flex flex-col gap-2">
          {(enrollments ?? []).length === 0 && (
            <p className="text-sm text-slate-500">配属履歴がありません。</p>
          )}
          {(enrollments ?? []).map((e) => {
            const classOptions =
              e.class_id && !(homeroomClasses ?? []).some((c) => c.id === e.class_id)
                ? [...(homeroomClasses ?? []), { id: e.class_id, name: e.class?.name ?? "(不明なクラス)" }]
                : (homeroomClasses ?? []);
            return (
              <div key={e.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {e.class?.name}（出席番号：{e.seq_no ?? "-"}）　{e.valid_from} 〜{" "}
                    {e.valid_to ?? "現在"}
                  </span>
                  <div className="flex gap-3 text-xs">
                    <details>
                      <summary className="cursor-pointer text-blue-600 hover:underline">
                        変更
                      </summary>
                      <SubmitForm
                        action={editHomeroomEnrollment}
                        successMessage="配属記録を変更しました"
                        className="mt-2 flex w-72 flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3"
                      >
                        <input type="hidden" name="enrollment_id" value={e.id} />
                        <input type="hidden" name="student_id" value={student.id} />
                        <div className="flex flex-col gap-1">
                          <label className={labelClass}>クラス</label>
                          <select
                            name="class_id"
                            defaultValue={e.class_id}
                            required
                            className={inputClass}
                          >
                            {classOptions.map((c) => (
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
                            defaultValue={e.seq_no ?? ""}
                            className={inputClass}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className={labelClass}>配属開始日</label>
                          <input
                            type="date"
                            name="valid_from"
                            defaultValue={e.valid_from}
                            required
                            className={inputClass}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className={labelClass}>配属終了日（任意）</label>
                          <input
                            type="date"
                            name="valid_to"
                            defaultValue={e.valid_to ?? ""}
                            className={inputClass}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className={labelClass}>
                            クラス・期間を変更する場合、記録済みの出席情報の扱い
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="radio"
                              name="attendance_handling"
                              value="keep"
                              defaultChecked
                            />
                            残す
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input type="radio" name="attendance_handling" value="delete" />
                            変更前の内容に基づく出席情報を削除する
                          </label>
                        </div>
                        <div>
                          <button type="submit" className={buttonPrimaryClass}>
                            変更を保存
                          </button>
                        </div>
                      </SubmitForm>
                    </details>
                    <details>
                      <summary className="cursor-pointer text-red-600 hover:underline">
                        削除
                      </summary>
                      <SubmitForm
                        action={deleteHomeroomEnrollment}
                        successMessage="配属記録を削除しました"
                        className="mt-2 flex w-72 flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3"
                      >
                        <input type="hidden" name="enrollment_id" value={e.id} />
                        <input type="hidden" name="student_id" value={student.id} />
                        <p className="text-xs text-red-700">
                          この配属記録（{e.class?.name}／{e.valid_from}〜{e.valid_to ?? "現在"}
                          ）を完全に削除します。元に戻せません。
                        </p>
                        <div className="flex flex-col gap-1">
                          <label className={labelClass}>記録済みの出席情報の扱い</label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="radio"
                              name="attendance_handling"
                              value="keep"
                              defaultChecked
                            />
                            残す
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input type="radio" name="attendance_handling" value="delete" />
                            この配属期間の出席情報も削除する
                          </label>
                        </div>
                        <div>
                          <button type="submit" className={buttonDangerClass}>
                            削除する
                          </button>
                        </div>
                      </SubmitForm>
                    </details>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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

        {activeTerms.length > 0 ? (
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
            <div className="flex flex-col gap-1">
              <label className={labelClass}>終了日（任意）</label>
              <input type="date" name="valid_to" className={inputClass} />
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

        <div className="mt-4 flex flex-col gap-2">
          {(electiveMemberships ?? []).length === 0 && (
            <p className="text-sm text-slate-500">選択科目の所属履歴がありません。</p>
          )}
          {(electiveMemberships ?? []).map((m) => {
            const classOptions =
              m.class_id && !(electiveClasses ?? []).some((c) => c.id === m.class_id)
                ? [
                    ...(electiveClasses ?? []),
                    { id: m.class_id, name: m.class?.name ?? "(不明なクラス)" },
                  ]
                : (electiveClasses ?? []);
            return (
              <div key={m.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {m.class?.name}　{m.valid_from} 〜 {m.valid_to ?? "現在"}
                  </span>
                  <div className="flex gap-3 text-xs">
                    <details>
                      <summary className="cursor-pointer text-blue-600 hover:underline">
                        変更
                      </summary>
                      <SubmitForm
                        action={editElective}
                        successMessage="選択科目の所属記録を変更しました"
                        className="mt-2 flex w-72 flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3"
                      >
                        <input type="hidden" name="membership_id" value={m.id} />
                        <input type="hidden" name="student_id" value={student.id} />
                        <div className="flex flex-col gap-1">
                          <label className={labelClass}>選択科目</label>
                          <select
                            name="class_id"
                            defaultValue={m.class_id}
                            required
                            className={inputClass}
                          >
                            {classOptions.map((c) => (
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
                            defaultValue={m.valid_from}
                            required
                            className={inputClass}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className={labelClass}>終了日（任意）</label>
                          <input
                            type="date"
                            name="valid_to"
                            defaultValue={m.valid_to ?? ""}
                            className={inputClass}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className={labelClass}>
                            選択科目・期間を変更する場合、記録済みの出席情報の扱い
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="radio"
                              name="attendance_handling"
                              value="keep"
                              defaultChecked
                            />
                            残す
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input type="radio" name="attendance_handling" value="delete" />
                            変更前の内容に基づく出席情報を削除する
                          </label>
                        </div>
                        <div>
                          <button type="submit" className={buttonPrimaryClass}>
                            変更を保存
                          </button>
                        </div>
                      </SubmitForm>
                    </details>
                    <details>
                      <summary className="cursor-pointer text-red-600 hover:underline">
                        削除
                      </summary>
                      <SubmitForm
                        action={deleteElective}
                        successMessage="選択科目の所属記録を削除しました"
                        className="mt-2 flex w-72 flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3"
                      >
                        <input type="hidden" name="membership_id" value={m.id} />
                        <input type="hidden" name="student_id" value={student.id} />
                        <p className="text-xs text-red-700">
                          この選択科目の所属記録（{m.class?.name}／{m.valid_from}〜
                          {m.valid_to ?? "現在"}）を完全に削除します。元に戻せません。
                        </p>
                        <div className="flex flex-col gap-1">
                          <label className={labelClass}>記録済みの出席情報の扱い</label>
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="radio"
                              name="attendance_handling"
                              value="keep"
                              defaultChecked
                            />
                            残す
                          </label>
                          <label className="inline-flex items-center gap-1">
                            <input type="radio" name="attendance_handling" value="delete" />
                            この所属期間の出席情報も削除する
                          </label>
                        </div>
                        <div>
                          <button type="submit" className={buttonDangerClass}>
                            削除する
                          </button>
                        </div>
                      </SubmitForm>
                    </details>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
