"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, canInputClass } from "@/lib/permissions";
import { readCsvFile } from "@/lib/csv";
import { parseFlexibleDate, parseFlexibleYearMonth } from "@/lib/date";

// 標準パターン：月別集計のみのCSV取り込み。
// 1行につき「学籍番号,年月(YYYY/MM),要出席日数,出席日数,欠席日数,遅刻回数,早退回数,公欠日数,除外日数」
// （出席記号設定の集計区分 attendance/absence/late/early_leave/excused/excluded の6区分に対応）
export async function importHistoricalMonthlySummariesCsv(formData: FormData) {
  const staff = await requireStaff();
  const supabase = await createClient();

  const allowed = await hasPermission(supabase, staff, "can_manage_students");
  if (!allowed) throw new Error("この操作を行う権限がありません。");

  const csv = await readCsvFile(formData);

  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  type Row = {
    studentNumber: string;
    yearMonth: string | null;
    requiredDays: number;
    attendedDays: number;
    absentDays: number;
    lateCount: number;
    earlyLeaveCount: number;
    excusedDays: number;
    excludedDays: number;
  };
  const rows: Row[] = lines.map((line) => {
    const cols = line.split(",").map((s) => s.trim());
    const [studentNumber, yearMonthRaw, req, attended, absent, late, early, excused, excluded] = cols;
    return {
      studentNumber: studentNumber ?? "",
      yearMonth: yearMonthRaw ? parseFlexibleYearMonth(yearMonthRaw) : null,
      requiredDays: Number(req ?? "0"),
      attendedDays: Number(attended ?? "0"),
      absentDays: Number(absent ?? "0"),
      lateCount: Number(late ?? "0"),
      earlyLeaveCount: Number(early ?? "0"),
      excusedDays: Number(excused ?? "0"),
      excludedDays: Number(excluded ?? "0"),
    };
  });

  const invalid = rows.find(
    (r) =>
      !r.studentNumber ||
      !r.yearMonth ||
      [
        r.requiredDays,
        r.attendedDays,
        r.absentDays,
        r.lateCount,
        r.earlyLeaveCount,
        r.excusedDays,
        r.excludedDays,
      ].some((n) => !Number.isFinite(n) || n < 0),
  );
  if (invalid) {
    throw new Error(
      "CSVの形式が不正です。各行「学籍番号,YYYY/MM,要出席時数,出席時数,欠席時数,遅刻回数,早退回数,公欠時数,除外時数」で入力してください。",
    );
  }

  const studentNumbers = Array.from(new Set(rows.map((r) => r.studentNumber)));
  const { data: students } = await supabase
    .from("students")
    .select("id, student_number")
    .in("student_number", studentNumbers);
  const studentIdByNumber = new Map(
    (students ?? []).map((s) => [s.student_number, s.id]),
  );

  const missing = rows.find((r) => !studentIdByNumber.has(r.studentNumber));
  if (missing) {
    throw new Error(`学籍番号 ${missing.studentNumber} の学生が見つかりません。`);
  }

  const upserts = rows.map((r) => ({
    student_id: studentIdByNumber.get(r.studentNumber)!,
    // 上のバリデーションで不正形式は弾いているため非nullが保証されている
    year_month: `${r.yearMonth!}-01`,
    required_days: r.requiredDays,
    attended_days: r.attendedDays,
    absent_days: r.absentDays,
    late_count: r.lateCount,
    early_leave_count: r.earlyLeaveCount,
    excused_days: r.excusedDays,
    excluded_days: r.excludedDays,
  }));

  const { error } = await supabase
    .from("historical_monthly_summaries")
    .upsert(upserts, { onConflict: "student_id,year_month" });
  if (error) throw new Error(error.message);

  revalidatePath("/csv-import");
}

// 詳細パターン：日次の出席データを attendance_records に直接取り込む。
// 1行につき「学籍番号,日付(YYYY/MM/DD),時限,記号,時刻(任意),理由(任意)」
// 記号は、選択したクラスが属する学期のsymbol_charと一致するものを使う。
export async function importHistoricalAttendanceCsv(formData: FormData) {
  const staff = await requireStaff();
  const supabase = await createClient();

  const classId = String(formData.get("class_id") ?? "");
  if (!classId) throw new Error("クラスを選択してください。");
  const csv = await readCsvFile(formData);

  const allowed = await canInputClass(supabase, staff, classId);
  if (!allowed) throw new Error("このクラスへの出席入力権限がありません。");

  const { data: cls } = await supabase
    .from("classes")
    .select("id, term_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls) throw new Error("クラスが見つかりません。");

  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  type Row = {
    studentNumber: string;
    date: string | null;
    periodNo: number;
    symbolChar: string;
    time: string | null;
    reason: string | null;
  };
  const rows: Row[] = lines.map((line) => {
    const cols = line.split(",").map((s) => s.trim());
    const [studentNumber, dateRaw, periodNoRaw, symbolChar, time, reason] = cols;
    return {
      studentNumber: studentNumber ?? "",
      date: dateRaw ? parseFlexibleDate(dateRaw) : null,
      periodNo: Number(periodNoRaw ?? "0"),
      symbolChar: symbolChar ?? "",
      time: time || null,
      reason: reason || null,
    };
  });

  const invalid = rows.find(
    (r) =>
      !r.studentNumber ||
      !r.date ||
      !Number.isInteger(r.periodNo) ||
      r.periodNo <= 0 ||
      !r.symbolChar,
  );
  if (invalid) {
    throw new Error(
      "CSVの形式が不正です。各行「学籍番号,YYYY/MM/DD,時限,記号,時刻(任意),理由(任意)」で入力してください。",
    );
  }

  const studentNumbers = Array.from(new Set(rows.map((r) => r.studentNumber)));
  const { data: students } = await supabase
    .from("students")
    .select("id, student_number")
    .in("student_number", studentNumbers);
  const studentIdByNumber = new Map(
    (students ?? []).map((s) => [s.student_number, s.id]),
  );

  const { data: symbols } = await supabase
    .from("symbols")
    .select("id, symbol_char")
    .eq("term_id", cls.term_id);
  const symbolIdByChar = new Map((symbols ?? []).map((s) => [s.symbol_char, s.id]));

  const missingStudent = rows.find((r) => !studentIdByNumber.has(r.studentNumber));
  if (missingStudent) {
    throw new Error(`学籍番号 ${missingStudent.studentNumber} の学生が見つかりません。`);
  }
  const missingSymbol = rows.find((r) => !symbolIdByChar.has(r.symbolChar));
  if (missingSymbol) {
    throw new Error(`記号「${missingSymbol.symbolChar}」がこの学期の出席記号設定に見つかりません。`);
  }

  const upserts = rows.map((r) => ({
    student_id: studentIdByNumber.get(r.studentNumber)!,
    class_id: classId,
    // 上のバリデーションで不正形式は弾いているため非nullが保証されている
    date: r.date!,
    period_no: r.periodNo,
    symbol_id: symbolIdByChar.get(r.symbolChar)!,
    time_value: r.time,
    reason: r.reason,
    recorded_by: staff.id,
  }));

  const { error } = await supabase
    .from("attendance_records")
    .upsert(upserts, { onConflict: "student_id,date,period_no" });
  if (error) throw new Error(error.message);

  revalidatePath("/csv-import");
}
