"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const loginId = String(formData.get("login_id") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/home");

  if (!loginId || !password) {
    return { error: "ログインIDとパスワードを入力してください。" };
  }

  const supabase = await createClient();

  // login_id はメールアドレス形式に縛られないため、Supabase Auth 用の
  // 内部メールアドレス（staff.email）をログイン前に引いてから認証する。
  const { data: email, error: lookupError } = await supabase.rpc(
    "staff_login_email",
    { p_login_id: loginId },
  );
  if (lookupError || !email) {
    return { error: "ログインIDまたはパスワードが正しくありません。" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // ユーザーへは詳細を出さず汎用メッセージのみ表示するが、
    // 原因調査のため実際のエラー内容はサーバーログ（Vercel Runtime Logs等）に残す。
    console.error("[auth] signInWithPassword failed", {
      status: error.status,
      code: error.code,
      message: error.message,
    });
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  redirect(next.startsWith("/") ? next : "/home");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
