"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/supabase/database.types";

export async function updateStaffInfo(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const staffId = String(formData.get("staff_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "teacher");
  const employmentType = String(formData.get("employment_type") ?? "").trim();

  if (!staffId || !name || !["admin", "teacher"].includes(role)) {
    throw new Error("入力内容を確認してください。");
  }

  const { error } = await supabase
    .from("staff")
    .update({
      name,
      role: role as StaffRole,
      employment_type: employmentType || null,
    })
    .eq("id", staffId);
  if (error) throw new Error(error.message);

  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/staff");
}

export async function savePermissions(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const staffId = String(formData.get("staff_id") ?? "");
  const classIds = formData.getAll("class_id").map(String);
  if (!staffId) throw new Error("教員IDが不正です。");

  const upserts: {
    staff_id: string;
    class_id: string;
    can_input: boolean;
    can_view_summary: boolean;
  }[] = [];
  const deletions: string[] = [];

  for (const classId of classIds) {
    const canInput = formData.get(`input_${classId}`) === "on";
    const canView = formData.get(`view_${classId}`) === "on";
    if (!canInput && !canView) {
      deletions.push(classId);
    } else {
      upserts.push({
        staff_id: staffId,
        class_id: classId,
        can_input: canInput,
        can_view_summary: canView,
      });
    }
  }

  if (deletions.length > 0) {
    const { error } = await supabase
      .from("staff_class_permissions")
      .delete()
      .eq("staff_id", staffId)
      .in("class_id", deletions);
    if (error) throw new Error(error.message);
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("staff_class_permissions")
      .upsert(upserts, { onConflict: "staff_id,class_id" });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/staff/${staffId}`);
}
