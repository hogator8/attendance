"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccessClass } from "@/lib/permissions";

// フィールド名の規則:
//   通常時限   : att_P{periodNo}_{studentId} = symbolId（空文字列 = 記録なし）
//   学校行事   : evt_{eventId}_{studentId} = symbolId
const ATT_KEY = /^att_P(\d+)_(.+)$/;
const UUID = "[0-9a-fA-F-]{36}";
const EVT_KEY = new RegExp(`^evt_(${UUID})_(${UUID})$`);

export async function saveAttendance(formData: FormData) {
  const staff = await requireStaff();
  const supabase = await createClient();

  const classId = String(formData.get("class_id") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!classId || !date) throw new Error("クラス・日付が不正です。");

  const allowed = await canAccessClass(supabase, staff, classId, "input");
  if (!allowed) {
    throw new Error("このクラスへの出席入力権限がありません。");
  }

  type AttUpsert = {
    student_id: string;
    class_id: string;
    date: string;
    period_no: number;
    symbol_id: string;
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

  for (const [key, rawValue] of formData.entries()) {
    const value = String(rawValue);

    const attMatch = key.match(ATT_KEY);
    if (attMatch) {
      const periodNo = Number(attMatch[1]);
      const studentId = attMatch[2];
      if (value === "") {
        attDeletes.push({ student_id: studentId, period_no: periodNo });
      } else {
        attUpserts.push({
          student_id: studentId,
          class_id: classId,
          date,
          period_no: periodNo,
          symbol_id: value,
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

  if (attUpserts.length > 0) {
    const { error } = await supabase
      .from("attendance_records")
      .upsert(attUpserts, { onConflict: "student_id,date,period_no" });
    if (error) throw new Error(error.message);
  }
  for (const del of attDeletes) {
    await supabase
      .from("attendance_records")
      .delete()
      .eq("student_id", del.student_id)
      .eq("date", date)
      .eq("period_no", del.period_no);
  }

  if (evtUpserts.length > 0) {
    const { error } = await supabase
      .from("event_attendance")
      .upsert(evtUpserts, { onConflict: "event_id,student_id" });
    if (error) throw new Error(error.message);
  }
  for (const del of evtDeletes) {
    await supabase
      .from("event_attendance")
      .delete()
      .eq("event_id", del.event_id)
      .eq("student_id", del.student_id);
  }

  revalidatePath(`/attendance/${classId}`);
}
