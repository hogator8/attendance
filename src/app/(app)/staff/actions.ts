"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffRole } from "@/lib/supabase/database.types";

export async function createStaffAccount(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "teacher");
  const employmentType = String(formData.get("employment_type") ?? "").trim();

  if (!name || !email || !password) {
    throw new Error("氏名・メールアドレス・初期パスワードは必須です。");
  }
  if (password.length < 8) {
    throw new Error("初期パスワードは8文字以上にしてください。");
  }
  if (!["admin", "teacher"].includes(role)) {
    throw new Error("役職の指定が不正です。");
  }

  const admin = createAdminClient();

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
    role: role as StaffRole,
    employment_type: employmentType || null,
  });
  if (staffError) {
    // staffレコードの作成に失敗した場合、孤立したAuthユーザーを削除してロールバックする
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(staffError.message);
  }

  revalidatePath("/staff");
}
