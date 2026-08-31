"use server";

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

  // 出席入力ログ（class_name）・授業期間外チェックの両方で使うため、
  // クラス名・学期IDは常に取得しておく。
  const { data: cls } = await supabase
    .from("classes")
    .select("name, term_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) throw new Error("クラスが見つかりません。");

  // 一般教員は学期の授業期間外の日付には入力できない（管理者は制限なし）
  if (staff.role !== "admin") {
    const { data: term } = await supabase
      .from("terms")
      .select("start_date, end_date")
      .eq("id", cls.term_id)
      .maybeSingle();
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

  // 出席入力ログ用：時限ごとに、この保存で対象になった学生全員（記号を
  // 入力した学生・空欄に戻した学生の両方）のスナップショット材料を集める。
  type PeriodLogEntry = {
    studentId: string;
    symbolId: string | null;
    time: string | null;
    reason: string | null;
  };
  const periodEntriesMap = new Map<number, PeriodLogEntry[]>();

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
      const periodStudentKey = `${periodNo}_${studentId}`;
      const time = timeByKey.get(periodStudentKey) ?? null;
      const reason = reasonByKey.get(periodStudentKey) ?? null;

      const periodEntries = periodEntriesMap.get(periodNo) ?? [];
      periodEntries.push({
        studentId,
        symbolId: value === "" ? null : value,
        time: value === "" ? null : time,
        reason: value === "" ? null : reason,
      });
      periodEntriesMap.set(periodNo, periodEntries);

      if (value === "") {
        attDeletes.push({ student_id: studentId, period_no: periodNo });
      } else {
        attUpserts.push({
          student_id: studentId,
          class_id: classId,
          date,
          period_no: periodNo,
          symbol_id: value,
          time_value: time,
          reason,
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

  // 出席入力ログ：時限単位の保存（att_P*フィールドを含む保存）ごとに、
  // 上書きではなく新しい行として記録する。学校行事（evt_*）の保存は
  // 時限の概念がないため対象外。
  if (periodEntriesMap.size > 0) {
    const allStudentIds = new Set<string>();
    const allSymbolIds = new Set<string>();
    for (const entries of periodEntriesMap.values()) {
      for (const e of entries) {
        allStudentIds.add(e.studentId);
        if (e.symbolId) allSymbolIds.add(e.symbolId);
      }
    }

    const [{ data: studentRows }, { data: symbolRows }] = await Promise.all([
      allStudentIds.size > 0
        ? supabase
            .from("students")
            .select("id, student_number, name")
            .in("id", Array.from(allStudentIds))
        : Promise.resolve({ data: [] as { id: string; student_number: string; name: string }[] }),
      allSymbolIds.size > 0
        ? supabase
            .from("symbols")
            .select("id, symbol_char, label")
            .in("id", Array.from(allSymbolIds))
        : Promise.resolve({ data: [] as { id: string; symbol_char: string; label: string }[] }),
    ]);
    const studentById = new Map((studentRows ?? []).map((s) => [s.id, s]));
    const symbolById = new Map((symbolRows ?? []).map((s) => [s.id, s]));

    const logRows = Array.from(periodEntriesMap.entries()).map(([periodNo, entries]) => ({
      staff_id: staff.id,
      staff_name: staff.name,
      class_id: classId,
      class_name: cls.name,
      date,
      period_no: periodNo,
      entries: entries.map((e) => {
        const student = studentById.get(e.studentId);
        const symbol = e.symbolId ? symbolById.get(e.symbolId) : null;
        return {
          student_id: e.studentId,
          student_number: student?.student_number ?? "",
          student_name: student?.name ?? "",
          symbol_id: e.symbolId,
          symbol_char: symbol?.symbol_char ?? null,
          symbol_label: symbol?.label ?? null,
          time_value: e.time,
          reason: e.reason,
        };
      }),
    }));

    const { error: logError } = await supabase.from("attendance_input_logs").insert(logRows);
    if (logError) throw new Error(logError.message);
  }

  // この画面はcookies()（認証）に依存するため常に動的レンダリングであり、
  // fetchキャッシュも使っていない。よってrevalidatePath()はキャッシュ無効化としては
  // 何もしておらず、唯一の効果はNext.jsのServer Action機構が保存結果のレスポンスに
  // このルートの再レンダリング結果を自動的に含めてしまうことだった。この自動再描画が
  // AttendanceSymbolCell（記号選択のプルダウン。保存結果を自前のstateで正しく保持する
  // 制御コンポーネント）を古いpropsで巻き戻す不具合の原因だったため、あえて呼ばない。
  // 画面上の反映はAttendanceSymbolCell自身の状態と、行事フォーム側の
  // remountOnSuccess（router.refresh()による明示的な再取得）だけで完結する。
}
