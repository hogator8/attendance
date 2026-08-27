"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/home");

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  const supabase = await createClient();
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
