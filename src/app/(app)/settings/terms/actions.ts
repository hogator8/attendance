"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

  if (activate) {
    await supabase.from("terms").update({ is_active: false }).eq(
      "is_active",
      true,
    );
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

export async function activateTerm(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const termId = String(formData.get("term_id") ?? "");
  if (!termId) throw new Error("学期IDが不正です。");

  await supabase
    .from("terms")
    .update({ is_active: false })
    .eq("is_active", true)
    .neq("id", termId);
  const { error } = await supabase
    .from("terms")
    .update({ is_active: true })
    .eq("id", termId);
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
