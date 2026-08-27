import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccessClass } from "@/lib/permissions";
import { getHomeroomRoster, getElectiveRoster, getElectiveOverlapForSlot } from "@/lib/roster";
import { todayISO, dayOfWeekOf, formatDateLabel, addDays } from "@/lib/date";
import { saveAttendance } from "./actions";
import BulkFillButton from "./BulkFillButton";
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
    .select("*")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) notFound();

  const allowed = await canAccessClass(supabase, staff, classId, "input");
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

  const { data: symbols } = await supabase
    .from("symbols")
    .select("*")
    .eq("term_id", cls.term_id)
    .order("order_no");
  const defaultSymbol = symbols?.find((s) => s.category === "attendance");

  const dayOfWeek = dayOfWeekOf(date);

  const { data: holiday } = await supabase
    .from("holidays")
    .select("*")
    .eq("term_id", cls.term_id)
    .eq("date", date)
    .maybeSingle();

  const { data: candidateEvents } = await supabase
    .from("events")
    .select("*")
    .eq("term_id", cls.term_id)
    .lte("date_from", date)
    .gte("date_to", date);

  const candidateEventIds = (candidateEvents ?? []).map((e) => e.id);
  const { data: eventClassLinks } =
    candidateEventIds.length > 0
      ? await supabase
          .from("event_classes")
          .select("*")
          .in("event_id", candidateEventIds)
      : { data: [] };
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

  // 時限一覧の取得
  type PeriodSlot = {
    periodNo: number;
    periodLabel: string;
    subject: string;
    teacherName: string | null;
    isElectiveSlot: boolean;
  };
  let periods: PeriodSlot[] = [];
  if (!skipNormalPeriods) {
    const { data: versions } = await supabase
      .from("timetable_versions")
      .select("id")
      .eq("class_id", classId)
      .lte("effective_from", date)
      .or(`effective_to.is.null,effective_to.gte.${date}`);
    const versionIds = (versions ?? []).map((v) => v.id);
    const { data: slots } =
      versionIds.length > 0
        ? await supabase
            .from("timetable_slots")
            .select("*")
            .in("timetable_version_id", versionIds)
            .eq("day_of_week", dayOfWeek)
            .order("period_no")
        : { data: [] };
    periods = (slots ?? [])
      .filter((s) => !replacedPeriods.has(s.period_no))
      .map((s) => ({
        periodNo: s.period_no,
        periodLabel: s.period_label,
        subject: s.subject,
        teacherName: s.teacher_name,
        isElectiveSlot: s.is_elective_slot,
      }));
  }

  const roster =
    cls.type === "homeroom"
      ? await getHomeroomRoster(supabase, classId, date)
      : await getElectiveRoster(supabase, classId, date);
  const studentIds = roster.map((r) => r.student.id);

  const { data: existingAttendance } =
    studentIds.length > 0
      ? await supabase
          .from("attendance_records")
          .select("student_id, period_no, symbol_id")
          .eq("date", date)
          .in("student_id", studentIds)
      : { data: [] };
  const attByKey = new Map(
    (existingAttendance ?? []).map((r) => [`${r.student_id}_${r.period_no}`, r.symbol_id]),
  );

  const electiveOverlapByPeriod = new Map<
    number,
    Map<string, { classId: string; className: string }>
  >();
  if (cls.type === "homeroom") {
    for (const p of periods) {
      if (p.isElectiveSlot) {
        electiveOverlapByPeriod.set(
          p.periodNo,
          await getElectiveOverlapForSlot(supabase, date, dayOfWeek, p.periodNo),
        );
      }
    }
  }

  const eventIds = applicableEvents.map((e) => e.id);
  const { data: existingEventAttendance } =
    eventIds.length > 0 && studentIds.length > 0
      ? await supabase
          .from("event_attendance")
          .select("event_id, student_id, symbol_id")
          .in("event_id", eventIds)
          .in("student_id", studentIds)
      : { data: [] };
  const evtByKey = new Map(
    (existingEventAttendance ?? []).map((r) => [
      `${r.event_id}_${r.student_id}`,
      r.symbol_id,
    ]),
  );

  const prevDate = addDays(date, -1);
  const nextDate = addDays(date, 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{cls.name}</h1>
          <p className="text-sm text-slate-500">出席入力 － {formatDateLabel(date)}</p>
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

      {holiday && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          本日は休業日です：{holiday.label}
        </div>
      )}

      {roster.length === 0 ? (
        <p className="text-sm text-slate-500">この日時点で在籍している学生がいません。</p>
      ) : (
        <form action={saveAttendance} className="flex flex-col gap-8">
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="date" value={date} />

          {!skipNormalPeriods &&
            periods.map((p) => {
              const overlap = electiveOverlapByPeriod.get(p.periodNo);
              return (
                <section key={p.periodNo} className={cardClass}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-bold text-slate-900">
                      {p.periodLabel}　{p.subject}
                      {p.teacherName && (
                        <span className="ml-2 text-sm font-normal text-slate-500">
                          （{p.teacherName}）
                        </span>
                      )}
                    </h2>
                    {defaultSymbol && (
                      <BulkFillButton
                        namePrefix={`att_P${p.periodNo}_`}
                        symbolId={defaultSymbol.id}
                        label={`全員${defaultSymbol.label}`}
                      />
                    )}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {roster.map(({ student }) => {
                      const elective = overlap?.get(student.id);
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
                            <select
                              name={`att_P${p.periodNo}_${student.id}`}
                              defaultValue={
                                attByKey.get(`${student.id}_${p.periodNo}`) ?? ""
                              }
                              className={`${inputClass} ml-auto`}
                            >
                              <option value="">－ 未入力</option>
                              {(symbols ?? []).map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.symbol_char} {s.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

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
                      <option value="">－ 未入力</option>
                      {(symbols ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.symbol_char} {s.label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {skipNormalPeriods && applicableEvents.length === 0 && (
            <p className="text-sm text-slate-500">
              本日は通常授業がなく、対象の行事もありません。
            </p>
          )}

          <div>
            <button type="submit" className={buttonPrimaryClass}>
              保存
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function StudentBadge({
  student,
}: {
  student: { id: string; name: string; furigana: string; photo_url: string | null };
}) {
  return (
    <div className="flex items-center gap-2">
      {student.photo_url ? (
        <Image
          src={student.photo_url}
          alt={student.name}
          width={32}
          height={32}
          unoptimized
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[10px] text-slate-500">
          写真
        </span>
      )}
      <div>
        <p className="text-sm font-medium text-slate-900">{student.name}</p>
        <p className="text-xs text-slate-400">{student.furigana}</p>
      </div>
    </div>
  );
}
