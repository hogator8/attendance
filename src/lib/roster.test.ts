import { test } from "node:test";
import assert from "node:assert/strict";
import { sortRosterEntries, type RosterEntry } from "./roster";
import type { Database } from "@/lib/supabase/database.types";

type Student = Database["public"]["Tables"]["students"]["Row"];

function entry(studentNumber: string, seqNo: number | null): RosterEntry {
  return {
    student: { student_number: studentNumber } as unknown as Student,
    seqNo,
  };
}

test("sortRosterEntries: 出席番号ありは出席番号順、出席番号なしは学籍番号順で、出席番号ありのグループを先に並べる", () => {
  const entries = [
    entry("S003", null),
    entry("S001", 2),
    entry("S002", null),
    entry("S004", 1),
  ];
  const sorted = sortRosterEntries(entries).map((e) => e.student.student_number);
  assert.deepEqual(sorted, ["S004", "S001", "S002", "S003"]);
});

test("sortRosterEntries: 出席番号がすべてnullなら学籍番号順のみになる", () => {
  const entries = [entry("S003", null), entry("S001", null), entry("S002", null)];
  const sorted = sortRosterEntries(entries).map((e) => e.student.student_number);
  assert.deepEqual(sorted, ["S001", "S002", "S003"]);
});

test("sortRosterEntries: 出席番号がすべて設定されていれば出席番号順のみになる", () => {
  const entries = [entry("S003", 3), entry("S001", 1), entry("S002", 2)];
  const sorted = sortRosterEntries(entries).map((e) => e.student.student_number);
  assert.deepEqual(sorted, ["S001", "S002", "S003"]);
});
