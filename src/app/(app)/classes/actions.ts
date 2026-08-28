"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClassType } from "@/lib/supabase/database.types";

export async function createClass(formData: FormData) {
  await requirePermission("can_manage_classes");
  const supabase = await createClient();

  const termId = String(formData.get("term_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (!termId || !name || !["homeroom", "elective"].includes(type)) {
    throw new Error("入力内容を確認してください。");
  }

  const { data, error } = await supabase
    .from("classes")
    .insert({ term_id: termId, name, type: type as ClassType })
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/classes");
  redirect(`/classes/${data.id}`);
}
