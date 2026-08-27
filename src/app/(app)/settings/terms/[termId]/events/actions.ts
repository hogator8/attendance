"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EventReplaceMode } from "@/lib/supabase/database.types";

const REPLACE_MODES: EventReplaceMode[] = ["all", "partial", "none"];

export async function saveEvent(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const termId = String(formData.get("term_id") ?? "");
  const eventId = String(formData.get("event_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const dateFrom = String(formData.get("date_from") ?? "");
  const dateTo = String(formData.get("date_to") ?? "");
  const creditPeriods = Number(formData.get("credit_periods") ?? 0);
  const replaceMode = String(formData.get("replace_mode") ?? "none");
  const replacedPeriodsRaw = String(formData.get("replaced_periods") ?? "");
  const classIds = formData.getAll("class_ids").map(String).filter(Boolean);

  if (!termId || !name || !dateFrom || !dateTo) {
    throw new Error("入力内容を確認してください。");
  }
  if (dateFrom > dateTo) {
    throw new Error("開始日は終了日以前にしてください。");
  }
  if (!Number.isFinite(creditPeriods) || creditPeriods < 0) {
    throw new Error("単位時数は0以上の数値で入力してください。");
  }
  if (!REPLACE_MODES.includes(replaceMode as EventReplaceMode)) {
    throw new Error("置き換えモードが不正です。");
  }

  const replacedPeriods = replacedPeriodsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);

  let id = eventId;
  if (id) {
    const { error } = await supabase
      .from("events")
      .update({
        name,
        date_from: dateFrom,
        date_to: dateTo,
        credit_periods: creditPeriods,
        replace_mode: replaceMode as EventReplaceMode,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    await supabase.from("event_replaced_periods").delete().eq("event_id", id);
    await supabase.from("event_classes").delete().eq("event_id", id);
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert({
        term_id: termId,
        name,
        date_from: dateFrom,
        date_to: dateTo,
        credit_periods: creditPeriods,
        replace_mode: replaceMode as EventReplaceMode,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
  }

  if (replaceMode === "partial" && replacedPeriods.length > 0) {
    const { error } = await supabase
      .from("event_replaced_periods")
      .insert(replacedPeriods.map((period_no) => ({ event_id: id!, period_no })));
    if (error) throw new Error(error.message);
  }

  if (classIds.length > 0) {
    const { error } = await supabase
      .from("event_classes")
      .insert(classIds.map((class_id) => ({ event_id: id!, class_id })));
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/settings/terms/${termId}/events`);
}

export async function deleteEvent(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const termId = String(formData.get("term_id") ?? "");
  if (!id) throw new Error("IDが不正です。");

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/settings/terms/${termId}/events`);
}
