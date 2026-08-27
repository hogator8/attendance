"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function addHoliday(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const colorHex = String(formData.get("color_hex") ?? "").trim();

  if (!termId || !date || !label) {
    throw new Error("日付と項目名は必須です。");
  }

  const { error } = await supabase.from("holidays").upsert(
    { term_id: termId, date, label, color_hex: colorHex || null },
    { onConflict: "term_id,date" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/settings/terms/${termId}/holidays`);
}

export async function deleteHoliday(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const termId = String(formData.get("term_id") ?? "");
  if (!id) throw new Error("IDが不正です。");

  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/settings/terms/${termId}/holidays`);
}

// CSV一括登録：1行につき「日付,項目名,色(任意・#RRGGBB)」の形式
export async function importHolidaysCsv(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  const csv = String(formData.get("csv") ?? "");
  if (!termId || !csv.trim()) {
    throw new Error("CSVを入力してください。");
  }

  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [date, label, colorHex] = line.split(",").map((s) => s.trim());
      return { term_id: termId, date, label, color_hex: colorHex || null };
    });

  const invalid = rows.find(
    (r) => !r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !r.label,
  );
  if (invalid) {
    throw new Error(
      "CSVの形式が不正です。各行「YYYY-MM-DD,項目名,色(任意)」で入力してください。",
    );
  }

  const { error } = await supabase
    .from("holidays")
    .upsert(rows, { onConflict: "term_id,date" });
  if (error) throw new Error(error.message);

  revalidatePath(`/settings/terms/${termId}/holidays`);
}
