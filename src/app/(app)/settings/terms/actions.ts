"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { termHasBlockingData } from "./termDeletion";

export async function createTerm(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const activate = formData.get("activate") === "on";

  if (!name || !startDate || !endDate) {
    throw new Error("学期名・開始日・終了日は必須です。");
  }
  if (startDate >= endDate) {
    throw new Error("開始日は終了日より前に設定してください。");
  }

  const { data: term, error } = await supabase
    .from("terms")
    .insert({
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: activate,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // 学期ごとの表示設定・換算ルールの初期値を作成しておく
  await supabase.from("term_settings").insert({ term_id: term.id });
  await supabase.from("conversion_rules").insert({ term_id: term.id });

  revalidatePath("/settings/terms");
}

// 学期のアクティブ状態は複数同時に許可され、いつでもON/OFFを切り替えられる
// （排他制御はしない）。
export async function setTermActive(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!termId) throw new Error("学期IDが不正です。");

  const { error } = await supabase
    .from("terms")
    .update({ is_active: active })
    .eq("id", termId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/terms");
  revalidatePath("/home");
}

// 学期の削除。判定ロジックの詳細はtermDeletion.tsのtermHasBlockingDataを参照。
export async function deleteTerm(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  if (!termId) throw new Error("学期IDが不正です。");

  const blocked = await termHasBlockingData(supabase, termId);
  if (blocked) {
    throw new Error(
      "この学期にはクラス・行事・休業日などのデータが既に登録されているため削除できません。削除するには、先にそれらのデータをすべて削除してください。",
    );
  }

  const { error } = await supabase.from("terms").delete().eq("id", termId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/terms");
  revalidatePath("/home");
}

export async function updateTermDates(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");

  if (!termId || !name || !startDate || !endDate) {
    throw new Error("入力内容を確認してください。");
  }
  if (startDate >= endDate) {
    throw new Error("開始日は終了日より前に設定してください。");
  }

  const { error } = await supabase
    .from("terms")
    .update({ name, start_date: startDate, end_date: endDate })
    .eq("id", termId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/terms");
  revalidatePath(`/settings/terms/${termId}`);
}
