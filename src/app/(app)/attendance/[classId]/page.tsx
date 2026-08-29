import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canInputClass } from "@/lib/permissions";
import { getHomeroomRoster, getElectiveRoster, getElectiveOverlapForSlots } from "@/lib/roster";
import { todayISO, dayOfWeekOf, formatDateLabel, addDays } from "@/lib/date";
import { saveAttendance } from "./actions";
import BulkFillButton from "./BulkFillButton";
import AttendanceSymbolCell from "./AttendanceSymbolCell";
import SubmitForm from "@/components/SubmitForm";
import { inputClass, buttonPrimaryClass, buttonSecondaryClass, cardClass } from "@/lib/ui";

export default async function AttendanceInputPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const staff = await requireStaff();
  const { classId } = await params;
  const { date: dateParam } = await searchParams;
  const date = dateParam || todayISO();
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("*, term:terms(*)")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || !cls.term) notFound();

  const allowed = await canInputClass(supabase, staff, classId);
  if (!allowed) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        このクラスへの出席入力権限がありません。
        <Link href="/attendance" className="ml-1 underline">
          出席入力トップに戻る
        </Link>
      </div>
    );
  }

  const prevDate = addDays(date, -1);
  const nextDate = addDays(date, 1);

  const dateNav = (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <p className="text-xs font-medium text-slate-400">出席入力</p>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{cls.name}</h1>
        <p className="mt-1 text-lg font-bold text-blue-700 sm:text-xl">
          {formatDateLabel(date)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link href={`/attendance/${classId}?date=${prevDate}`} className={buttonSecondaryClass}>
          前日
        </Link>
        <form action={`/attendance/${classId}`} className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={date} className={inputClass} />
          <button type="submit" className={buttonSecondaryClass}>
            表示
          </button>
        </form>
        <Link href={`/attendance/${classId}?date=${nextDate}`} className={buttonSecondaryClass}>
          翌日
        </Link>
      </div>
    </div>
  );

  // 一般教員は学期の授業期間外の日付を操作できない（管理者は制限なし）
  const isOutOfTerm = date < cls.term.start_date || date > cls.term.end_date;
  if (staff.role !== "admin" && isOutOfTerm) {
    return (
      <div className="flex flex-col gap-6">
        {dateNav}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
          授業期間外のため入力できません。
          <br />
          <span className="text-sm">
            この学期の授業期間：{cls.term.start_date} 〜 {cls.term.end_date}
          </span>
        </div>
      </div>
    );
  }

  const dayOfWeek = dayOfWeekOf(date);

  // 互いに依存しないクエリはPromise.allでまとめて発行し、逐次の往復回数を減らす。
  // 時間割（timetable_versions→timetable_slots）は2段階の依存関係があるため、
  // 内部で直列に取得しつつ、全体としては他のクエリと並行して走らせる。
  const [
    { data: symbols },
    { data: holiday },
    { data: candidateEvents },
    rawSlots,
    { data: overrides },
    roster,
  ] = await Promise.all([
    supabase.from("symbols").select("*").eq("term_id", cls.term_id).order("order_no"),
    supabase
      .from("holidays")
      .select("*")
      .eq("term_id", cls.term_id)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("events")
      .select("*")
      .eq("term_id", cls.term_id)
      .lte("date_from", date)
      .gte("date_to", date),
    (async () => {
      const { data: versions } = await supabase
        .from("timetable_versions")
        .select("id")
        .eq("class_id", classId)
        .lte("effective_from", date)
        .or(`effective_to.is.null,effective_to.gte.${date}`);
      const versionIds = (versions ?? []).map((v) => v.id);
      if (versionIds.length === 0) return [];
      const { data: slots } = await supabase
        .from("timetable_slots")
        .select("*")
        .in("timetable_version_id", versionIds)
        .eq("day_of_week", dayOfWeek)
        .order("period_no");
      return slots ?? [];
    })(),
    supabase
      .from("schedule_change_overrides")
      .select("*")
      .eq("class_id", classId)
      .eq("date", date),
    cls.type === "homeroom"
      ? getHomeroomRoster(supabase, classId, date)
      : getElectiveRoster(supabase, classId, date),
  ]);
  const defaultSymbol = symbols?.find((s) => s.category === "attendance");
  const studentIds = roster.map((r) => r.student.id);

  const candidateEventIds = (candidateEvents ?? []).map((e) => e.id);

  // 前段のクエリ結果に依存する2件（対象イベントのクラス紐付け／当日の出席済み記録）
  // も互いには依存しないため、まとめて並行取得する。
  const [{ data: eventClassLinks }, { data: existingAttendance }] = await Promise.all([
    candidateEventIds.length > 0
      ? supabase.from("event_classes").select("*").in("event_id", candidateEventIds)
      : Promise.resolve({ data: [] as { event_id: string; class_id: string }[] }),
    studentIds.length > 0
      ? supabase
          .from("attendance_records")
          .select("student_id, period_no, symbol_id, time_value, reason")
          .eq("date", date)
          .in("student_id", studentIds)
      : Promise.resolve({
          data: [] as {
            student_id: string;
            period_no: number;
            symbol_id: string;
            time_value: string | null;
            reason: string | null;
          }[],
        }),
  ]);
  const attByKey = new Map(
    (existingAttendance ?? []).map((r) => [
      `${r.student_id}_${r.period_no}`,
      { symbolId: r.symbol_id, timeValue: r.time_value, reason: r.reason },
    ]),
  );

  const classIdsByEvent = new Map<string, string[]>();
  for (const link of eventClassLinks ?? []) {
    const arr = classIdsByEvent.get(link.event_id) ?? [];
    arr.push(link.class_id);
    classIdsByEvent.set(link.event_id, arr);
  }
  const applicableEvents = (candidateEvents ?? []).filter((e) => {
    const targets = classIdsByEvent.get(e.id);
    return !targets || targets.length === 0 || targets.includes(classId);
  });

  const fullReplaceEvent = applicableEvents.find((e) => e.replace_mode === "all");
  const partialEvents = applicableEvents.filter((e) => e.replace_mode === "partial");
  const partialEventIds = partialEvents.map((e) => e.id);
  const { data: replacedPeriodRows } =
    partialEventIds.length > 0
      ? await supabase
          .from("event_replaced_periods")
          .select("*")
          .in("event_id", partialEventIds)
      : { data: [] };
  const replacedPeriods = new Set((replacedPeriodRows ?? []).map((r) => r.period_no));

  const skipNormalPeriods = !!holiday || !!fullReplaceEvent;

  // 時限一覧の組み立て（クエリは既に上のPromise.allで完了済み、ここはデータ加工のみ）
  type PeriodSlot = {
    periodNo: number;
    periodLabel: string;
    subject: string;
    teacherName: string | null;
    isElectiveSlot: boolean;
  };
  let periods: PeriodSlot[] = [];
  if (!skipNormalPeriods) {
    const overrideByPeriod = new Map((overrides ?? []).map((o) => [o.period_no, o]));
    periods = rawSlots
      .filter((s) => !replacedPeriods.has(s.period_no))
      .map((s) => {
        const override = overrideByPeriod.get(s.period_no);
        return {
          periodNo: s.period_no,
          periodLabel: s.period_label,
          subject: override?.subject ?? s.subject,
          teacherName: override?.teacher_name ?? s.teacher_name,
          isElectiveSlot: s.is_elective_slot,
        };
      });
  }

  const eventIds = applicableEvents.map((e) => e.id);
  const electivePeriodNos =
    cls.type === "homeroom"
      ? periods.filter((p) => p.isElectiveSlot).map((p) => p.periodNo)
      : [];

  const [electiveOverlapByPeriod, { data: existingEventAttendance }] = await Promise.all([
    cls.type === "homeroom"
      ? getElectiveOverlapForSlots(supabase, date, dayOfWeek, electivePeriodNos)
      : Promise.resolve(new Map<number, Map<string, { classId: string; className: string }>>()),
    eventIds.length > 0 && studentIds.length > 0
      ? supabase
          .from("event_attendance")
          .select("event_id, student_id, symbol_id")
          .in("event_id", eventIds)
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] as { event_id: string; student_id: string; symbol_id: string }[] }),
  ]);
  const evtByKey = new Map(
    (existingEventAttendance ?? []).map((r) => [
      `${r.event_id}_${r.student_id}`,
      r.symbol_id,
    ]),
  );

  return (
    <div className="flex flex-col gap-6">
      {dateNav}

      {holiday && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          本日は休業日です：{holiday.label}
        </div>
      )}

      {roster.length === 0 ? (
        <p className="text-sm text-slate-500">この日時点で在籍している学生がいません。</p>
      ) : (
        <div className="flex flex-col gap-8">
          {!skipNormalPeriods &&
            periods.map((p) => {
              const overlap = electiveOverlapByPeriod.get(p.periodNo);
              return (
                <SubmitForm
                  key={p.periodNo}
                  action={saveAttendance}
                  successMessage={`${p.periodLabel}の出席を保存しました`}
                >
                  <section className={cardClass}>
                    <input type="hidden" name="class_id" value={classId} />
                    <input type="hidden" name="date" value={date} />
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-bold text-slate-900">
                        {p.periodLabel}　{p.subject}
                        {p.teacherName && (
                          <span className="ml-2 text-sm font-normal text-slate-500">
                            （{p.teacherName}）
                          </span>
                        )}
                      </h2>
                      <div className="flex items-center gap-2">
                        {defaultSymbol && (
                          <BulkFillButton
                            namePrefix={`att_P${p.periodNo}_`}
                            symbolId={defaultSymbol.id}
                            label={`全員${defaultSymbol.label}`}
                          />
                        )}
                        <button type="submit" className={buttonPrimaryClass}>
                          この時限を保存
                        </button>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {roster.map(({ student }) => {
                        const elective = overlap?.get(student.id);
                        const existing = attByKey.get(`${student.id}_${p.periodNo}`);
                        return (
                          <li
                            key={student.id}
                            className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2 last:border-0"
                          >
                            <StudentBadge student={student} />
                            {elective ? (
                              <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">
                                選択科目：{elective.className}
                                <Link
                                  href={`/attendance/${elective.classId}?date=${date}`}
                                  className="ml-2 underline"
                                >
                                  入力へ
                                </Link>
                              </span>
                            ) : (
                              <AttendanceSymbolCell
                                symbolName={`att_P${p.periodNo}_${student.id}`}
                                timeName={`attTime_P${p.periodNo}_${student.id}`}
                                reasonName={`attReason_P${p.periodNo}_${student.id}`}
                                symbols={symbols ?? []}
                                defaultSymbolId={existing?.symbolId ?? ""}
                                defaultTime={existing?.timeValue ?? null}
                                defaultReason={existing?.reason ?? null}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </SubmitForm>
              );
            })}

          {applicableEvents.length > 0 && (
            <SubmitForm action={saveAttendance} successMessage="行事の出席を保存しました">
              <input type="hidden" name="class_id" value={classId} />
              <input type="hidden" name="date" value={date} />
              <div className="flex flex-col gap-8">
                {applicableEvents.map((event) => (
                  <section key={event.id} className={cardClass}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-bold text-slate-900">
                        学校行事：{event.name}
                        <span className="ml-2 text-sm font-normal text-slate-500">
                          （単位時数 {event.credit_periods}）
                        </span>
                      </h2>
                      {defaultSymbol && (
                        <BulkFillButton
                          namePrefix={`evt_${event.id}_`}
                          symbolId={defaultSymbol.id}
                          label={`全員${defaultSymbol.label}`}
                        />
                      )}
                    </div>
                    <ul className="flex flex-col gap-2">
                      {roster.map(({ student }) => (
                        <li
                          key={student.id}
                          className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-2 last:border-0"
                        >
                          <StudentBadge student={student} />
                          <select
                            name={`evt_${event.id}_${student.id}`}
                            defaultValue={evtByKey.get(`${event.id}_${student.id}`) ?? ""}
                            className={`${inputClass} ml-auto`}
                          >
                            <option value="">－</option>
                            {(symbols ?? []).map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.symbol_char}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                <div>
                  <button type="submit" className={buttonPrimaryClass}>
                    行事の出席を保存
                  </button>
                </div>
              </div>
            </SubmitForm>
          )}

          {skipNormalPeriods && applicableEvents.length === 0 && (
            <p className="text-sm text-slate-500">
              本日は通常授業がなく、対象の行事もありません。
            </p>
          )}
          {!skipNormalPeriods && periods.length === 0 && applicableEvents.length === 0 && (
            <p className="text-sm text-slate-500">
              この日・この曜日の時間割が設定されていません。
            </p>
          )}
        </div>
      )}

      {(symbols ?? []).length > 0 && <SymbolLegend symbols={symbols ?? []} />}
    </div>
  );
}

function SymbolLegend({
  symbols,
}: {
  symbols: { id: string; symbol_char: string; label: string }[];
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
      <p className="mb-1 text-xs font-medium text-slate-500">凡例</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
        {symbols.map((s) => (
          <span key={s.id}>
            <span className="font-bold text-slate-900">{s.symbol_char}</span>：{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StudentBadge({
  student,
}: {
  student: {
    id: string;
    student_number: string;
    name: string;
    furigana: string;
    photo_url: string | null;
  };
}) {
  return (
    <div className="flex items-center gap-2">
      {student.photo_url ? (
        <Image
          src={student.photo_url}
          alt={student.name}
          width={32}
          height={32}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-500">
          写真
        </span>
      )}
      <div>
        <p className="text-sm font-medium text-slate-900">
          {student.name}
          <span className="ml-1 text-xs font-normal text-slate-400">
            {student.student_number}
          </span>
        </p>
        <p className="text-xs text-slate-400">{student.furigana}</p>
      </div>
    </div>
  );
}
