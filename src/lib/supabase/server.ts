import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

// Server Components / Server Actions / Route Handlers から使うクライアント。
// 現在ログイン中のユーザーの Cookie を使うため、RLSがそのユーザーの権限で評価される。
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component から呼ばれた場合は Cookie を書き換えられないため無視する。
            // セッションのリフレッシュは proxy.ts 側で行われる。
          }
        },
      },
    },
  );
}
