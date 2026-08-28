"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffRole } from "@/lib/supabase/database.types";

const STAFF_ROLES: StaffRole[] = ["admin", "full_time", "part_time"];

function internalEmailFor(loginId: string): string {
  return `${loginId}@attendance.internal`;
}

export async function updateStaffInfo(formData: FormData) {
  const actor = await requirePermission("can_manage_staff");

  const staffId = String(formData.get("staff_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const loginId = String(formData.get("login_id") ?? "").trim();
  const role = String(formData.get("role") ?? "full_time");

  if (!staffId || !name || !loginId || !STAFF_ROLES.includes(role as StaffRole)) {
    throw new Error("入力内容を確認してください。");
  }

  const admin = createAdminClient();

  // Admin APIはRLSをバイパスするため、admin以外（can_manage_staffのみ）は
  // 「admin行の変更」「role=adminへの変更」ができないようここで明示的に防ぐ。
  if (actor.role !== "admin") {
    const { data: target } = await admin
      .from("staff")
      .select("role")
      .eq("id", staffId)
      .maybeSingle();
    if (!target || target.role === "admin" || role === "admin") {
      throw new Error("この操作を行う権限がありません。");
    }
  }

  const email = internalEmailFor(loginId);

  // login_id（≒内部メールアドレス）を変更する場合はSupabase Auth側も同期する
  const { error: authError } = await admin.auth.admin.updateUserById(
    staffId,
    { email },
  );
  if (authError) throw new Error(authError.message);

  const { error } = await admin
    .from("staff")
    .update({
      name,
      login_id: loginId,
      email,
      role: role as StaffRole,
    })
    .eq("id", staffId);
  if (error) throw new Error(error.message);

  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/staff");
}

export async function updateStaffPassword(formData: FormData) {
  const actor = await requirePermission("can_manage_staff");

  const staffId = String(formData.get("staff_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!staffId || !password) {
    throw new Error("入力内容を確認してください。");
  }
  if (password.length < 6) {
    throw new Error("パスワードは6文字以上にしてください。");
  }

  const admin = createAdminClient();

  if (actor.role !== "admin") {
    const { data: target } = await admin
      .from("staff")
      .select("role")
      .eq("id", staffId)
      .maybeSingle();
    if (!target || target.role === "admin") {
      throw new Error("この操作を行う権限がありません。");
    }
  }

  const { error } = await admin.auth.admin.updateUserById(staffId, {
    password,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/staff/${staffId}`);
}

export async function deleteStaffAccount(formData: FormData) {
  const actor = await requirePermission("can_manage_staff");

  const staffId = String(formData.get("staff_id") ?? "");
  if (!staffId) throw new Error("教員IDが不正です。");
  if (staffId === actor.id) {
    throw new Error("自分自身のアカウントは削除できません。");
  }

  const admin = createAdminClient();

  if (actor.role !== "admin") {
    const { data: target } = await admin
      .from("staff")
      .select("role")
      .eq("id", staffId)
      .maybeSingle();
    if (!target || target.role === "admin") {
      throw new Error("この操作を行う権限がありません。");
    }
  }

  // staff行はauth.usersへの外部キー(on delete cascade)により連動して削除される。
  // ただし出席記録(attendance_records/event_attendance)のrecorded_byはon delete
  // restrictのため、記録が残っている教員は削除できない（データ保護のため意図的）。
  const { error } = await admin.auth.admin.deleteUser(staffId);
  if (error) {
    if (/foreign key|violates/i.test(error.message)) {
      throw new Error(
        "この教員はすでに出席記録の記録者として使用されているため削除できません。",
      );
    }
    throw new Error(error.message);
  }

  revalidatePath("/staff");
}

export async function savePermissions(formData: FormData) {
  await requirePermission("can_manage_staff");
  const supabase = await createClient();

  const staffId = String(formData.get("staff_id") ?? "");
  const classIds = formData.getAll("class_id").map(String);
  if (!staffId) throw new Error("教員IDが不正です。");

  const upserts: { staff_id: string; class_id: string; can_input: boolean }[] =
    [];
  const deletions: string[] = [];

  for (const classId of classIds) {
    const canInput = formData.get(`input_${classId}`) === "on";
    if (!canInput) {
      deletions.push(classId);
    } else {
      upserts.push({ staff_id: staffId, class_id: classId, can_input: true });
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

  const globalPermissions = {
    staff_id: staffId,
    can_view_summary: formData.get("perm_can_view_summary") === "on",
    can_manage_students: formData.get("perm_can_manage_students") === "on",
    can_manage_classes: formData.get("perm_can_manage_classes") === "on",
    can_manage_staff: formData.get("perm_can_manage_staff") === "on",
    can_manage_settings: formData.get("perm_can_manage_settings") === "on",
    can_view_individual_records:
      formData.get("perm_can_view_individual_records") === "on",
  };
  const { error: permError } = await supabase
    .from("staff_permissions")
    .upsert(globalPermissions, { onConflict: "staff_id" });
  if (permError) throw new Error(permError.message);

  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/staff");
}
