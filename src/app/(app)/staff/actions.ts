"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffRole } from "@/lib/supabase/database.types";

const STAFF_ROLES: StaffRole[] = ["admin", "full_time", "part_time"];

// login_id から、実際には送信されない内部専用ダミーメールアドレスを生成する。
// Supabase Auth は内部的にメールアドレス形式のアカウントを必要とするため。
function internalEmailFor(loginId: string): string {
  return `${loginId}@attendance.internal`;
}

export async function createStaffAccount(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const loginId = String(formData.get("login_id") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "full_time");

  if (!name || !loginId || !password) {
    throw new Error("氏名・ログインID・初期パスワードは必須です。");
  }
  if (password.length < 4) {
    throw new Error("初期パスワードは4文字以上にしてください。");
  }
  if (!STAFF_ROLES.includes(role as StaffRole)) {
    throw new Error("役職の指定が不正です。");
  }

  const admin = createAdminClient();
  const email = internalEmailFor(loginId);

  const { data: authUser, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  if (authError || !authUser.user) {
    throw new Error(
      `教員アカウントの作成に失敗しました: ${authError?.message ?? "不明なエラー"}`,
    );
  }

  const { error: staffError } = await admin.from("staff").insert({
    id: authUser.user.id,
    name,
    email,
    login_id: loginId,
    role: role as StaffRole,
  });
  if (staffError) {
    // staffレコードの作成に失敗した場合、孤立したAuthユーザーを削除してロールバックする
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(staffError.message);
  }

  const { error: permError } = await admin
    .from("staff_permissions")
    .insert({ staff_id: authUser.user.id });
  if (permError) throw new Error(permError.message);

  revalidatePath("/staff");
}
