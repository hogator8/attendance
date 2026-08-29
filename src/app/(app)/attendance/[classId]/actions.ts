"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canInputClass } from "@/lib/permissions";

// フィールド名の規則:
//   通常時限   : att_P{periodNo}_{studentId} = symbolId（空文字列 = 記録なし）
//   　　　　　   attTime_P{periodNo}_{studentId} = 時刻（任意、遅刻・早退用）
//   　　　　　   attReason_P{periodNo}_{studentId} = 理由（任意）
//   学校行事   : evt_{eventId}_{studentId} = symbolId
const ATT_KEY = /^att_P(\d+)_(.+)$/;
const ATT_TIME_KEY = /^attTime_P(\d+)_(.+)$/;
const ATT_REASON_KEY = /^attReason_P(\d+)_(.+)$/;
const UUID = "[0-9a-fA-F-]{36}";
const EVT_KEY = new RegExp(`^evt_(${UUID})_(${UUID})$`);

export async function saveAttendance(formData: FormData) {
  const staff = await requireStaff();
  const supabase = await createClient();

  const classId = String(formData.get("class_id") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!classId || !date) throw new Error("クラス・日付が不正です。");

  const allowed = await canInputClass(supabase, staff, classId);
  if (!allowed) {
    throw new Error("このクラスへの出席入力権限がありません。");
  }

  // 一般教員は学期の授業期間外の日付には入力できない（管理者は制限なし）
  if (staff.role !== "admin") {
    const { data: cls } = await supabase
      .from("classes")
      .select("term_id")
      .eq("id", classId)
      .maybeSingle();
    const { data: term } = cls
      ? await supabase
          .from("terms")
          .select("start_date, end_date")
          .eq("id", cls.term_id)
          .maybeSingle()
      : { data: null };
    if (term && (date < term.start_date || date > term.end_date)) {
      throw new Error("授業期間外のため出席を入力できません。");
    }
  }

  type AttUpsert = {
    student_id: string;
    class_id: string;
    date: string;
    period_no: number;
    symbol_id: string;
    time_value: string | null;
    reason: string | null;
    recorded_by: string;
  };
  const attUpserts: AttUpsert[] = [];
  const attDeletes: { student_id: string; period_no: number }[] = [];

  type EvtUpsert = {
    event_id: string;
    student_id: string;
    symbol_id: string;
    recorded_by: string;
  };
  const evtUpserts: EvtUpsert[] = [];
  const evtDeletes: { event_id: string; student_id: string }[] = [];

  // att_/attTime_/attReason_ の各フィールドはname順に依存せず組み合わせる
  // 必要があるため、先に time/reason を `${periodNo}_${studentId}` 単位で集めておく。
  const timeByKey = new Map<string, string>();
  const reasonByKey = new Map<string, string>();
  for (const [key, rawValue] of formData.entries()) {
    const value = String(rawValue).trim();
    if (!value) continue;

    const timeMatch = key.match(ATT_TIME_KEY);
    if (timeMatch) {
      timeByKey.set(`${timeMatch[1]}_${timeMatch[2]}`, value);
      continue;
    }
    const reasonMatch = key.match(ATT_REASON_KEY);
    if (reasonMatch) {
      reasonByKey.set(`${reasonMatch[1]}_${reasonMatch[2]}`, value);
    }
  }

  for (const [key, rawValue] of formData.entries()) {
    const value = String(rawValue);

    const attMatch = key.match(ATT_KEY);
    if (attMatch) {
      const periodNo = Number(attMatch[1]);
      const studentId = attMatch[2];
      if (value === "") {
        attDeletes.push({ student_id: studentId, period_no: periodNo });
      } else {
        const periodStudentKey = `${periodNo}_${studentId}`;
        attUpserts.push({
          student_id: studentId,
          class_id: classId,
          date,
          period_no: periodNo,
          symbol_id: value,
          time_value: timeByKey.get(periodStudentKey) ?? null,
          reason: reasonByKey.get(periodStudentKey) ?? null,
          recorded_by: staff.id,
        });
      }
      continue;
    }

    const evtMatch = key.match(EVT_KEY);
    if (evtMatch) {
      const eventId = evtMatch[1];
      const studentId = evtMatch[2];
      if (value === "") {
        evtDeletes.push({ event_id: eventId, student_id: studentId });
      } else {
        evtUpserts.push({
          event_id: eventId,
          student_id: studentId,
          symbol_id: value,
          recorded_by: staff.id,
        });
      }
    }
  }

  const upsertPromises: PromiseLike<{ error: { message: string } | null }>[] = [];

  if (attUpserts.length > 0) {
    upsertPromises.push(
      supabase
        .from("attendance_records")
        .upsert(attUpserts, { onConflict: "student_id,date,period_no" }),
    );
  }
  if (evtUpserts.length > 0) {
    upsertPromises.push(
      supabase.from("event_attendance").upsert(evtUpserts, { onConflict: "event_id,student_id" }),
    );
  }

  // 未入力に戻された分の削除は、学生1人ずつ逐次delete()するのではなく、
  // period_no（またはevent_id）単位でまとめてIN句によるバッチ削除にする。
  const attDeletesByPeriod = new Map<number, string[]>();
  for (const del of attDeletes) {
    const arr = attDeletesByPeriod.get(del.period_no) ?? [];
    arr.push(del.student_id);
    attDeletesByPeriod.set(del.period_no, arr);
  }
  for (const [periodNo, studentIdsForPeriod] of attDeletesByPeriod) {
    upsertPromises.push(
      supabase
        .from("attendance_records")
        .delete()
        .eq("date", date)
        .eq("period_no", periodNo)
        .in("student_id", studentIdsForPeriod),
    );
  }

  const evtDeletesByEvent = new Map<string, string[]>();
  for (const del of evtDeletes) {
    const arr = evtDeletesByEvent.get(del.event_id) ?? [];
    arr.push(del.student_id);
    evtDeletesByEvent.set(del.event_id, arr);
  }
  for (const [eventId, studentIdsForEvent] of evtDeletesByEvent) {
    upsertPromises.push(
      supabase
        .from("event_attendance")
        .delete()
        .eq("event_id", eventId)
        .in("student_id", studentIdsForEvent),
    );
  }

  const results = await Promise.all(upsertPromises);
  for (const { error } of results) {
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/attendance/${classId}`);
}
