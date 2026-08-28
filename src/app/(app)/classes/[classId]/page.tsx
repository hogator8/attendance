import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SubmitForm from "@/components/SubmitForm";
import {
  updateClassName,
  createTimetableVersion,
  saveTimetableSlots,
  createScheduleOverride,
  deleteScheduleOverride,
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

const MAX_PERIODS = 10;
const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
  { value: 0, label: "日" },
];

export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  await requirePermission("can_manage_classes");
  const { classId } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) notFound();

  const { data: versions } = await supabase
    .from("timetable_versions")
    .select("*")
    .eq("class_id", classId)
    .order("effective_from", { ascending: false });

  const editingVersionId = edit ?? versions?.[0]?.id ?? null;
  const editingVersion = versions?.find((v) => v.id === editingVersionId);

  const { data: slots } = editingVersionId
    ? await supabase
        .from("timetable_slots")
        .select("*")
        .eq("timetable_version_id", editingVersionId)
    : { data: [] };

  const slotByKey = new Map(
    (slots ?? []).map((s) => [`${s.day_of_week}_${s.period_no}`, s]),
  );
  const labelByPeriod = new Map<number, string>();
  for (const s of slots ?? []) {
    if (!labelByPeriod.has(s.period_no)) {
      labelByPeriod.set(s.period_no, s.period_label);
    }
  }

  const { data: scheduleOverrides } = await supabase
    .from("schedule_change_overrides")
    .select("*")
    .eq("class_id", classId)
    .order("date", { ascending: false })
    .order("period_no");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/classes" className="text-sm text-blue-600 hover:underline">
          ← クラス一覧に戻る
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{cls.name}</h1>
        <p className="text-xs text-slate-500">
          {cls.type === "homeroom" ? "ホームルームクラス" : "選択科目"}
        </p>
      </div>

      <div className={`${cardClass} max-w-md`}>
        <h2 className="mb-3 font-bold text-slate-900">名称変更</h2>
        <SubmitForm
          action={updateClassName}
          successMessage="名称を保存しました"
          className="flex items-end gap-3"
        >
          <input type="hidden" name="class_id" value={cls.id} />
          <div className="flex flex-1 flex-col gap-1">
            <label className={labelClass}>名称</label>
            <input
              name="name"
              defaultValue={cls.name}
              required
              className={inputClass}
            />
          </div>
          <button type="submit" className={buttonSecondaryClass}>
            保存
          </button>
        </SubmitForm>
      </div>

      <section>
        <h2 className="mb-2 font-bold text-slate-900">時間割バージョン</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {(versions ?? []).map((v) => (
            <Link
              key={v.id}
              href={`/classes/${classId}?edit=${v.id}`}
              className={
                v.id === editingVersionId
                  ? "rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white"
                  : buttonSecondaryClass
              }
            >
              {v.effective_from} 〜 {v.effective_to ?? "現在"}
            </Link>
          ))}
        </div>

        <div className={`${cardClass} mb-4 max-w-md`}>
          <h3 className="mb-2 text-sm font-bold text-slate-900">
            新しい時間割バージョンを追加
          </h3>
          <p className="mb-2 text-xs text-slate-500">
            年度途中で時間割を変更する場合、適用開始日を指定して新しいバージョンを作成します。
          </p>
          <SubmitForm
            action={createTimetableVersion}
            successMessage="時間割バージョンを作成しました"
            className="flex items-end gap-3"
          >
            <input type="hidden" name="class_id" value={cls.id} />
            <div className="flex flex-col gap-1">
              <label className={labelClass}>適用開始日</label>
              <input
                type="date"
                name="effective_from"
                required
                className={inputClass}
              />
            </div>
            <button type="submit" className={buttonPrimaryClass}>
              作成
            </button>
          </SubmitForm>
        </div>

        {editingVersion ? (
          <div className="overflow-x-auto">
            <p className="mb-2 text-sm text-slate-600">
              編集中：{editingVersion.effective_from} 〜{" "}
              {editingVersion.effective_to ?? "現在"}
            </p>
            <SubmitForm
              action={saveTimetableSlots}
              successMessage="時間割を保存しました"
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="class_id" value={cls.id} />
              <input type="hidden" name="term_id" value={cls.term_id} />
              <input
                type="hidden"
                name="timetable_version_id"
                value={editingVersion.id}
              />
              <table className="w-full min-w-[900px] border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border border-slate-200 bg-slate-50 px-2 py-1">
                      時限
                    </th>
                    {DAY_LABELS.map((d) => (
                      <th
                        key={d.value}
                        className="border border-slate-200 bg-slate-50 px-2 py-1"
                      >
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: MAX_PERIODS }, (_, i) => i + 1).map(
                    (p) => (
                      <tr key={p}>
                        <td className="border border-slate-200 px-1 py-1">
                          <input
                            name={`period_label_${p}`}
                            defaultValue={labelByPeriod.get(p) ?? `${p}限`}
                            className={`${inputClass} w-20`}
                          />
                        </td>
                        {DAY_LABELS.map((d) => {
                          const slot = slotByKey.get(`${d.value}_${p}`);
                          return (
                            <td
                              key={d.value}
                              className="border border-slate-200 px-1 py-1"
                            >
                              <div className="flex flex-col gap-1">
                                <input
                                  name={`subject_${d.value}_${p}`}
                                  defaultValue={slot?.subject ?? ""}
                                  placeholder="教科"
                                  className={`${inputClass} w-24`}
                                />
                                <input
                                  name={`teacher_${d.value}_${p}`}
                                  defaultValue={slot?.teacher_name ?? ""}
                                  placeholder="担当者"
                                  className={`${inputClass} w-24`}
                                />
                                {slot?.is_elective_slot && (
                                  <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-700">
                                    選択科目あり
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <div>
                <button type="submit" className={buttonPrimaryClass}>
                  時間割を保存
                </button>
              </div>
            </SubmitForm>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            時間割バージョンがまだありません。上のフォームから作成してください。
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-bold text-slate-900">
          単発の時間割変更（振替授業等）
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          特定の日・時限だけ、通常の時間割とは異なる教科・担当者で出席入力画面に表示します。
          必要出席日数の数え方には影響しません。
        </p>

        {(scheduleOverrides ?? []).length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>日付</th>
                  <th className={thClass}>時限</th>
                  <th className={thClass}>教科</th>
                  <th className={thClass}>担当者</th>
                  <th className={thClass}>メモ</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {(scheduleOverrides ?? []).map((o) => (
                  <tr key={o.id}>
                    <td className={tdClass}>{o.date}</td>
                    <td className={tdClass}>{o.period_no}</td>
                    <td className={tdClass}>{o.subject ?? "-"}</td>
                    <td className={tdClass}>{o.teacher_name ?? "-"}</td>
                    <td className={tdClass}>{o.note ?? "-"}</td>
                    <td className={tdClass}>
                      <SubmitForm
                        action={deleteScheduleOverride}
                        successMessage="削除しました"
                      >
                        <input type="hidden" name="override_id" value={o.id} />
                        <input type="hidden" name="class_id" value={classId} />
                        <button type="submit" className={buttonSecondaryClass}>
                          削除
                        </button>
                      </SubmitForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={`${cardClass} max-w-md`}>
          <h3 className="mb-2 text-sm font-bold text-slate-900">変更を追加</h3>
          <SubmitForm
            action={createScheduleOverride}
            successMessage="時間割の変更を保存しました"
            className="flex flex-col gap-3"
          >
            <input type="hidden" name="class_id" value={classId} />
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <label className={labelClass}>日付</label>
                <input type="date" name="date" required className={inputClass} />
              </div>
              <div className="flex w-24 flex-col gap-1">
                <label className={labelClass}>時限</label>
                <input
                  type="number"
                  name="period_no"
                  min={1}
                  required
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>教科（任意）</label>
              <input name="subject" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>担当者（任意）</label>
              <input name="teacher_name" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass}>メモ（任意）</label>
              <input name="note" className={inputClass} />
            </div>
            <div>
              <button type="submit" className={buttonPrimaryClass}>
                追加
              </button>
            </div>
          </SubmitForm>
        </div>
      </section>
    </div>
  );
}
