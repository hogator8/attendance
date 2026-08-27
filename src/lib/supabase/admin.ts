import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// service_role キーを使う管理用クライアント。RLSを完全にバイパスするため、
// 教員アカウントの作成（Supabase Authユーザー作成）など、
// admin操作でどうしても必要な場合のみサーバー側（Server Action）から使うこと。
// 絶対にクライアントコンポーネントへ値を渡したりインポートしたりしないこと。
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY が設定されていません。.env.local を確認してください。",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
